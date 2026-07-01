#!/usr/bin/env python3
"""
MEEZUS TERMINAL Server
Serves the dashboard and proxies YouTube live streams via yt-dlp + HLS proxy.

Setup (one-time):
    pip install yt-dlp

Run:
    python3 server.py
    Then open http://localhost:8080
"""

import http.server
import socketserver
import subprocess
import json
import math
import os
import re
import ssl
import time
import xml.etree.ElementTree as ET
import urllib.request
import urllib.parse
import threading

# ── Kronos forecast model (optional — only active after forecast_setup.py) ────
try:
    import kronos_forecast as _kf
    _FORECAST_AVAILABLE = True
except ImportError:
    _kf = None
    _FORECAST_AVAILABLE = False

PORT      = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

# macOS ships with Python that lacks root CA certs — create an unverified context
# so our localhost proxy can fetch googlevideo.com HLS segments without SSL errors.
_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode    = ssl.CERT_NONE

# Browser-mimicking User-Agent used for every upstream request
_USER_AGENT = (
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
)


def _rss_date_ms(s):
    """Parse common RSS pubDate / Atom updated formats to epoch ms.
    Falls back to current time on any failure (better than skewing scores)."""
    if not s:
        return int(time.time() * 1000)
    try:
        from email.utils import parsedate_to_datetime
        return int(parsedate_to_datetime(s).timestamp() * 1000)
    except Exception:
        pass
    try:
        from datetime import datetime as _datetime
        # ISO-8601 like 2026-05-14T07:30:00Z
        s2 = s.rstrip('Z')
        return int(_datetime.fromisoformat(s2).timestamp() * 1000)
    except Exception:
        return int(time.time() * 1000)


def _iso_date_ms(s):
    """Parse ISO-8601 (StockTwits / Lemmy) to epoch ms, UTC-correct."""
    if not s:
        return int(time.time() * 1000)
    try:
        from datetime import datetime, timezone
        dt = datetime.fromisoformat(s.replace('Z', '+00:00'))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return int(dt.timestamp() * 1000)
    except Exception:
        return _rss_date_ms(s)


def _http_get(url, timeout=12, extra_headers=None):
    """Single helper for all upstream GETs — UA + SSL ctx baked in."""
    headers = {'User-Agent': _USER_AGENT}
    if extra_headers:
        headers.update(extra_headers)
    req = urllib.request.Request(url, headers=headers)
    return urllib.request.urlopen(req, timeout=timeout, context=_SSL_CTX)


def _parse_qs(path):
    """Parse query string from a request path."""
    return urllib.parse.parse_qs(path.split('?', 1)[1]) if '?' in path else {}

# ── Stream URL cache ────────────────────────────────────────────────────────
# HLS manifest URLs expire (~6 min), so we cache for 5 minutes then refresh.
_cache      = {}   # video_id -> (url, timestamp)
_cache_lock = threading.Lock()
CACHE_TTL   = 300  # seconds (5 min — safely under YouTube's expiry window)

# ── Calendar cache ───────────────────────────────────────────────────────────
# faireconomy.media rate-limits aggressive polling (429).
# Cache for 90 minutes; on 429 or any error, serve stale data rather than fail.
_cal_cache      = None   # raw bytes of last good response
_cal_cache_ts   = 0.0    # epoch seconds of last successful fetch
_cal_cache_lock = threading.Lock()
CAL_CACHE_TTL   = 5400   # 90 minutes

# ── Open Interest cache ──────────────────────────────────────────────────────
# Binance publishes hourly OI buckets; cache for 5 min to avoid hammering.
_oi_cache      = {}    # symbol -> (bytes, timestamp)
_oi_cache_lock = threading.Lock()
OI_CACHE_TTL   = 300   # 5 minutes

# ── Crypto-pulse sentiment cache ─────────────────────────────────────────────
# Aggregates posts from r/CryptoCurrency, r/Bitcoin, r/CryptoMarkets so the
# browser can compute a -100..+100 sentiment score client-side. Reddit JSON
# endpoints are free, no auth — just need a real User-Agent.
_pulse_cache      = None       # (bytes, timestamp)
_pulse_cache_lock = threading.Lock()
PULSE_CACHE_TTL   = 4 * 3600   # 4 hours

# ── Sentiment scoring engine (VADER heuristics + finance/crypto lexicon) ──────
# A faithful port of the VADER model (Hutto & Gilbert, ICWSM-2014) — lexicon
# valence plus five context heuristics — over a lexicon that merges:
#   • VADER's general-emotion core,
#   • the Loughran-McDonald financial dictionary (the accounting-research
#     standard, built precisely because general lexicons misread finance
#     register — e.g. "liability", "cut", "tax" aren't inherently negative),
#   • a hand-tuned crypto-slang layer.
# Heuristics applied: ALL-CAPS emphasis, degree modifiers, negation flip,
# contrastive "but", and punctuation emphasis. Output compound ∈ [-1, +1].
PULSE_HALFLIFE_H   = 12.0   # recency half-life (h) for post weighting
PULSE_SENSITIVITY  = 215    # maps reach-weighted mean compound onto -100..100
PULSE_HISTORY_FILE = os.path.join(DIRECTORY, 'pulse_history.json')
PULSE_HISTORY_MAX  = 84     # ~14 days at the 4h refresh cadence

_VADER_B_INCR   = 0.293     # degree-modifier increment
_VADER_C_INCR   = 0.733     # ALL-CAPS emphasis increment
_VADER_N_SCALAR = -0.74     # negation scalar
_PUNC_STRIP     = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'

_VADER_NEGATE = {
    'not', 'no', 'never', 'none', 'nobody', 'nowhere', 'nothing', 'neither',
    'nor', 'without', 'cannot', 'cant', 'wont', 'arent', 'isnt', 'wasnt',
    'werent', 'dont', 'doesnt', 'didnt', 'aint', 'havent', 'hasnt', 'hadnt',
    'couldnt', 'wouldnt', 'shouldnt', 'despite', 'lack', 'lacks', 'lacking',
}

# Degree modifiers — intensify (+) or dampen (-) the following sentiment word.
_VADER_BOOST = {
    'absolutely': 0.293, 'amazingly': 0.293, 'completely': 0.293,
    'considerably': 0.293, 'decidedly': 0.293, 'deeply': 0.293,
    'enormously': 0.293, 'entirely': 0.293, 'especially': 0.293,
    'exceptionally': 0.293, 'extremely': 0.293, 'fully': 0.293, 'hugely': 0.293,
    'incredibly': 0.293, 'intensely': 0.293, 'majorly': 0.293,
    'massively': 0.293, 'more': 0.293, 'most': 0.293, 'particularly': 0.293,
    'purely': 0.293, 'quite': 0.293, 'really': 0.293, 'remarkably': 0.293,
    'so': 0.293, 'substantially': 0.293, 'thoroughly': 0.293, 'totally': 0.293,
    'tremendously': 0.293, 'unbelievably': 0.293, 'utterly': 0.293,
    'very': 0.293, 'super': 0.293, 'insanely': 0.293,
    'almost': -0.293, 'barely': -0.293, 'hardly': -0.293, 'kinda': -0.293,
    'less': -0.293, 'little': -0.293, 'marginally': -0.293, 'partly': -0.293,
    'scarcely': -0.293, 'slightly': -0.293, 'somewhat': -0.293, 'sorta': -0.293,
}

# Multi-word idioms scored as a phrase (overrides token-level scoring).
_VADER_IDIOMS = {
    'to the moon': 3.0, 'buy the dip': 1.5, 'diamond hands': 1.8,
    'paper hands': -1.5, 'exit liquidity': -2.5, 'bull trap': -1.5,
    'bear trap': 1.0, 'dead cat bounce': -1.5, 'selling pressure': -1.8,
    'buying pressure': 1.8, 'all time high': 3.0, 'all-time high': 3.0,
    'all time low': -3.0, 'all-time low': -3.0, 'record high': 2.6,
    'record low': -2.6, 'short squeeze': 1.6, 'risk off': -2.0, 'risk on': 2.0,
    'flight to safety': -1.5, 'soft landing': 1.6, 'hard landing': -2.4,
    'rug pull': -3.2, 'pump and dump': -2.6, 'god candle': 3.0,
    'blood bath': -3.0, 'bloodbath': -3.0, 'melt up': 2.6, 'melt-up': 2.6,
    'sell off': -2.4, 'sell-off': -2.4, 'death cross': -2.4, 'golden cross': 2.4,
}

# Merged sentiment lexicon — every token appears once; valence ∈ [-4, +4].
_PULSE_LEX = {
    # ── Crypto-native bullish ──
    'moon': 3.2, 'mooning': 3.2, 'lambo': 2.4, 'ath': 2.5, 'breakout': 2.8,
    'breakouts': 2.6, 'pump': 2.0, 'pumping': 2.0, 'pumped': 1.5, 'rally': 2.6,
    'rallies': 2.6, 'rallying': 2.6, 'surge': 2.6, 'surging': 2.6, 'surged': 2.6,
    'soar': 2.8, 'soaring': 2.8, 'soared': 2.8, 'parabolic': 3.0, 'bullish': 2.8,
    'bull': 1.8, 'bulls': 1.6, 'bullrun': 3.2, 'bullruns': 3.0, 'supercycle': 2.6,
    'hodl': 1.2, 'hodling': 1.2, 'accumulate': 1.6, 'accumulating': 1.6,
    'accumulation': 1.6, 'stacking': 1.5, 'adoption': 2.2, 'mainstream': 1.6,
    'institutional': 1.4, 'etf': 1.0, 'approval': 2.2, 'approved': 2.4,
    'breakthrough': 2.6, 'milestone': 1.8, 'halving': 1.6, 'rebound': 2.0,
    'rebounded': 2.0, 'bounce': 1.6, 'bouncing': 1.6, 'oversold': 1.0,
    'rocket': 2.6, 'gem': 1.6, 'alpha': 1.4, 'upside': 1.8, 'inflow': 1.8,
    'inflows': 2.0, 'tailwind': 1.6, 'tailwinds': 1.6,

    # ── Crypto-native bearish ──
    'crash': -3.4, 'crashing': -3.4, 'crashed': -3.4, 'meltdown': -3.4,
    'dump': -2.4, 'dumping': -2.4, 'dumped': -2.4, 'tank': -2.6, 'tanking': -2.6,
    'tanked': -2.6, 'bearish': -2.8, 'bear': -1.6, 'bears': -1.6, 'rekt': -2.8,
    'liquidated': -2.6, 'liquidation': -2.4, 'liquidations': -2.4, 'liqd': -2.2,
    'capitulation': -3.0, 'capitulate': -3.0, 'capitulating': -3.0,
    'rug': -3.2, 'rugged': -3.2, 'rugpull': -3.6, 'scam': -3.0, 'ponzi': -3.2,
    'fraud': -3.2, 'hack': -2.6, 'hacked': -2.8, 'exploit': -2.4,
    'exploited': -2.6, 'breach': -2.4, 'drained': -2.6, 'fud': -1.8,
    'selloff': -2.6, 'outflow': -1.8, 'outflows': -2.0, 'overbought': -1.2,
    'bubble': -1.6, 'worthless': -3.2, 'doomed': -2.8, 'bleeding': -2.0,
    'bagholder': -1.6, 'bagholders': -1.6, 'delisted': -2.4, 'delisting': -2.4,
    'headwind': -1.6, 'headwinds': -1.6, 'contagion': -2.6,

    # ── Loughran-McDonald financial — positive ──
    'gain': 1.6, 'gains': 1.8, 'gained': 1.6, 'gaining': 1.6, 'profit': 1.8,
    'profits': 1.8, 'profitable': 1.8, 'growth': 1.6, 'growing': 1.4,
    'beat': 1.4, 'beats': 1.4, 'outperform': 2.0, 'outperformed': 2.0,
    'outperforming': 2.0, 'upgrade': 1.6, 'upgraded': 1.6, 'robust': 1.6,
    'resilient': 1.6, 'recovery': 1.8, 'recovered': 1.6, 'optimistic': 1.8,
    'optimism': 1.8, 'surplus': 1.2, 'boom': 2.2, 'booming': 2.2,
    'expansion': 1.4, 'opportunity': 1.2, 'advance': 1.2, 'advanced': 1.0,
    'rose': 1.0, 'rises': 1.0, 'rising': 1.0, 'jumped': 1.6, 'jump': 1.4,
    'climb': 1.2, 'climbed': 1.2, 'climbing': 1.2, 'higher': 1.0, 'record': 1.2,

    # ── Loughran-McDonald financial — negative ──
    'loss': -1.8, 'losses': -1.8, 'losing': -1.6, 'decline': -1.6,
    'declined': -1.6, 'declining': -1.6, 'declines': -1.6, 'downturn': -2.0,
    'recession': -2.4, 'slowdown': -1.6, 'slump': -2.2, 'slumped': -2.2,
    'plummet': -3.0, 'plummeted': -3.0, 'plummeting': -3.0, 'plunge': -3.0,
    'plunged': -3.0, 'plunging': -3.0, 'tumble': -2.4, 'tumbled': -2.4,
    'tumbling': -2.4, 'fell': -1.4, 'falling': -1.4, 'falls': -1.4,
    'drop': -1.4, 'dropped': -1.4, 'dropping': -1.4, 'sink': -1.8,
    'sinking': -1.8, 'sank': -1.8, 'miss': -1.4, 'missed': -1.4,
    'underperform': -2.0, 'downgrade': -1.8, 'downgraded': -1.8,
    'warning': -1.4, 'warn': -1.4, 'warns': -1.4, 'warned': -1.4, 'fear': -1.8,
    'fears': -1.8, 'risk': -0.8, 'risks': -0.8, 'risky': -1.6,
    'uncertainty': -1.4, 'uncertain': -1.2, 'volatile': -0.8, 'volatility': -0.6,
    'deficit': -1.4, 'layoffs': -2.0, 'layoff': -2.0, 'lower': -0.9,
    'lowered': -1.2, 'struggle': -1.8, 'struggling': -1.8, 'struggles': -1.8,
    'pressure': -1.0, 'slashed': -1.8, 'slash': -1.6, 'freeze': -1.4,
    'frozen': -1.4, 'probe': -1.4, 'investigation': -1.6, 'charges': -1.6,
    'fined': -1.4, 'penalty': -1.6, 'sanctions': -1.8, 'lawsuit': -1.8,
    'sued': -1.8, 'ban': -2.4, 'banned': -2.4, 'halt': -1.6, 'halted': -1.8,
    'default': -2.6, 'insolvent': -3.0, 'insolvency': -3.0, 'bankruptcy': -3.2,
    'bankrupt': -3.2, 'crisis': -2.4, 'panic': -2.6, 'turmoil': -2.2,

    # ── General emotion — positive ──
    'great': 2.0, 'amazing': 2.6, 'awesome': 2.6, 'excellent': 2.6,
    'fantastic': 2.6, 'brilliant': 2.4, 'best': 2.0, 'better': 1.2, 'good': 1.4,
    'solid': 1.4, 'perfect': 2.8, 'incredible': 2.4, 'win': 1.6, 'wins': 1.6,
    'winning': 1.6, 'winner': 1.8, 'victory': 1.8, 'success': 1.8,
    'successful': 1.8, 'positive': 1.2, 'love': 1.8, 'loved': 1.6,
    'hopeful': 1.2, 'confident': 1.6, 'promising': 1.6, 'strong': 1.6,
    'stronger': 1.6, 'strongest': 2.0,

    # ── General emotion — negative ──
    'bad': -1.6, 'terrible': -2.8, 'awful': -2.8, 'horrible': -2.8,
    'worst': -3.0, 'worse': -2.0, 'poor': -1.4, 'fail': -2.0, 'fails': -2.0,
    'failed': -2.0, 'failing': -2.0, 'failure': -2.2, 'weak': -1.6,
    'weaker': -1.6, 'weakest': -2.0, 'pathetic': -2.6, 'garbage': -2.6,
    'trash': -2.6, 'disaster': -2.8, 'disastrous': -2.8, 'danger': -1.8,
    'dangerous': -1.8, 'negative': -1.2, 'hate': -2.2, 'scared': -1.8,
    'scary': -1.6, 'ugly': -1.6, 'dead': -2.0, 'dying': -2.2, 'nightmare': -2.6,
    'chaos': -2.2, 'collapse': -3.4, 'collapsed': -3.4, 'collapsing': -3.4,
}

# Entity buckets — tag each post by what it's about, for the topic breakdown.
_ENTITY_PATTERNS = [
    ('BTC',        re.compile(r'\b(bitcoin|btc|satoshi)\b', re.I)),
    ('ETH',        re.compile(r'\b(ethereum|ether|eth|vitalik)\b', re.I)),
    ('SOL',        re.compile(r'\b(solana|sol)\b', re.I)),
    ('ETF',        re.compile(r'\b(etf|etfs|blackrock|ibit|grayscale|fidelity)\b', re.I)),
    ('REGULATION', re.compile(r'\b(sec|cftc|regulat\w*|lawsuit|court|congress|senate|gensler|legal|sue[ds]?)\b', re.I)),
    ('MACRO',      re.compile(r'\b(fed|fomc|powell|cpi|inflation|rate\s?(cut|hike)|interest rate|treasury|recession|gdp|yields?|jobs)\b', re.I)),
    ('HACK',       re.compile(r'\b(hack\w*|exploit\w*|breach|drained|stolen|scam|rug\w*|phishing)\b', re.I)),
    ('STABLES',    re.compile(r'\b(stablecoin|usdt|usdc|tether|circle|dai)\b', re.I)),
    ('DEFI',       re.compile(r'\b(defi|staking|yield|uniswap|aave|lending)\b', re.I)),
]


def _allcap_differential(raw_tokens):
    """True when SOME (but not all) tokens are ALL-CAPS — VADER's caps gate."""
    allcap = sum(1 for w in raw_tokens if len(w) > 1 and w.isupper() and w.isalpha())
    return 0 < allcap < len(raw_tokens)


def _vader_scalar(src_token, valence, is_cap_diff):
    """Degree-modifier contribution for a booster token preceding a senti word."""
    s = _VADER_BOOST.get(src_token.lower().strip(_PUNC_STRIP), 0.0)
    if s == 0.0:
        return 0.0
    if valence < 0:
        s = -s
    if src_token.isupper() and is_cap_diff:
        s += _VADER_B_INCR if valence > 0 else -_VADER_B_INCR
    return s


def _vader_compound(text):
    """VADER-style sentiment. Returns (compound ∈ [-1,1], lexicon_hit_count)."""
    if not text:
        return 0.0, 0
    raw = text.split()
    toks = [t.strip(_PUNC_STRIP).replace('’', "'") for t in raw]
    is_cap_diff = _allcap_differential(raw)
    sentiments, hits, n = [], 0, len(toks)

    for i in range(n):
        low = toks[i].lower()
        if low in _VADER_BOOST:          # boosters score 0 on their own
            sentiments.append(0.0)
            continue
        v = _PULSE_LEX.get(low)
        if v is None:
            sentiments.append(0.0)
            continue
        hits += 1
        if raw[i].isupper() and is_cap_diff and len(toks[i]) > 1:
            v += _VADER_C_INCR if v > 0 else -_VADER_C_INCR
        # preceding 3 tokens: degree modifiers (damped by distance)
        for dist in (1, 2, 3):
            j = i - dist
            if j >= 0 and toks[j].lower() not in _PULSE_LEX:
                s = _vader_scalar(raw[j], v, is_cap_diff)
                if dist == 2:
                    s *= 0.95
                elif dist == 3:
                    s *= 0.90
                v += s
        # negation flip over the same 3-token window
        for dist in (1, 2, 3):
            j = i - dist
            if j >= 0 and toks[j].lower() in _VADER_NEGATE:
                v *= _VADER_N_SCALAR
                break
        sentiments.append(v)

    # contrastive conjunction "but" — pre-but ×0.5, post-but ×1.5
    low_toks = [t.lower() for t in toks]
    if 'but' in low_toks:
        bi = low_toks.index('but')
        for k in range(len(sentiments)):
            if k < bi:
                sentiments[k] *= 0.5
            elif k > bi:
                sentiments[k] *= 1.5

    s = sum(sentiments)
    # punctuation emphasis (sign-aware)
    ep = min(text.count('!'), 4) * 0.292
    qm = text.count('?')
    qd = (qm * 0.18 if qm <= 3 else 0.96) if qm > 1 else 0.0
    punct = ep + qd
    if s > 0:
        s += punct
    elif s < 0:
        s -= punct

    # multi-word idioms — fold into the raw sum before normalisation
    low_text = ' ' + text.lower() + ' '
    for phrase, val in _VADER_IDIOMS.items():
        if phrase in low_text:
            s += val
            hits += 1

    compound = s / math.sqrt(s * s + 15) if s else 0.0
    return compound, hits


def _tag_entities(text):
    return [name for name, pat in _ENTITY_PATTERNS if pat.search(text)]


def _pulse_classify(score):
    if score >= 55:  return ('Euphoria', 'euphoria')
    if score >= 22:  return ('Bullish', 'bullish')
    if score >= 8:   return ('Mild Bullish', 'mild-bullish')
    if score > -8:   return ('Neutral', 'neutral')
    if score > -22:  return ('Mild Bearish', 'mild-bearish')
    if score > -55:  return ('Bearish', 'bearish')
    return ('Capitulation', 'capitulation')


def _pulse_divergence(price_chg, sent_slope):
    """Price trend vs social-mood trend → the actionable divergence signal."""
    sent_pts = round(sent_slope * 100, 1)
    base = {'price24h': round(price_chg, 1), 'sent': sent_pts}
    p_up, p_dn = price_chg > 0.8, price_chg < -0.8
    s_up, s_dn = sent_slope > 0.04, sent_slope < -0.04
    if p_up and s_dn:
        return {**base, 'state': 'bearish', 'label': 'Bearish Divergence',
                'detail': 'Price climbing while social mood cools — distribution risk.'}
    if p_dn and s_up:
        return {**base, 'state': 'bullish', 'label': 'Bullish Divergence',
                'detail': 'Price falling while mood warms — possible accumulation / capitulation bottom.'}
    if p_up and s_up:
        return {**base, 'state': 'confirm-bull', 'label': 'Bullish Confirmation',
                'detail': 'Price and mood rising together — trend supported.'}
    if p_dn and s_dn:
        return {**base, 'state': 'confirm-bear', 'label': 'Bearish Confirmation',
                'detail': 'Price and mood falling together — downtrend intact.'}
    return {**base, 'state': 'neutral', 'label': 'No Divergence',
            'detail': 'Price and mood broadly aligned — no actionable gap.'}


def _pulse_history_load():
    try:
        with open(PULSE_HISTORY_FILE) as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _pulse_history_append(entry):
    hist = _pulse_history_load()
    hist.append(entry)
    hist = hist[-PULSE_HISTORY_MAX:]
    try:
        with open(PULSE_HISTORY_FILE, 'w') as f:
            json.dump(hist, f)
    except Exception as e:
        print(f'[MEEZUS] Pulse history save failed: {str(e)[:80]}')
    return hist

# ── Quant analysis cache ──────────────────────────────────────────────────────
# Computes technical indicators + generates narrative for BTC and ETH.
# Expensive (multiple Binance calls + computation) so cached for 4 hours.
_quant_cache      = {"ts": 0, "data": None}
_quant_lock       = threading.Lock()
QUANT_CACHE_TTL   = 4 * 3600   # 4 hours


# ── Quant math helpers ────────────────────────────────────────────────────────

def _ema(closes, period):
    """Exponential moving average with SMA seed (proper Wilder init)."""
    if not closes or len(closes) < period:
        return sum(closes) / len(closes) if closes else 0.0
    k   = 2.0 / (period + 1)
    val = sum(closes[:period]) / period      # SMA seed
    for p in closes[period:]:
        val = p * k + val * (1 - k)
    return val

def _rsi(closes, period=14):
    """Wilder-smoothed RSI."""
    if len(closes) < period + 1:
        return 50.0
    gains, losses = [], []
    for i in range(1, len(closes)):
        d = closes[i] - closes[i - 1]
        gains.append(max(d, 0.0))
        losses.append(max(-d, 0.0))
    avg_g = sum(gains[:period]) / period
    avg_l = sum(losses[:period]) / period
    for i in range(period, len(gains)):
        avg_g = (avg_g * (period - 1) + gains[i]) / period
        avg_l = (avg_l * (period - 1) + losses[i]) / period
    if avg_l == 0:
        return 100.0
    return 100.0 - 100.0 / (1.0 + avg_g / avg_l)

def _macd(closes):
    """Returns (macd_line, signal_line, histogram). Needs ≥ 35 closes."""
    if len(closes) < 35:
        return 0.0, 0.0, 0.0
    k12, k26, k9 = 2/13, 2/27, 2/10
    ema12 = ema26 = closes[0]
    macd_series = []
    for p in closes:
        ema12 = p * k12 + ema12 * (1 - k12)
        ema26 = p * k26 + ema26 * (1 - k26)
        macd_series.append(ema12 - ema26)
    sig = macd_series[0]
    for m in macd_series:
        sig = m * k9 + sig * (1 - k9)
    macd_line = macd_series[-1]
    return macd_line, sig, macd_line - sig

def _bb(closes, period=20, mult=2.0):
    """Bollinger Bands (upper, mid, lower, std). Returns (None,…) if not enough data."""
    if len(closes) < period:
        return None, None, None, None
    sl  = closes[-period:]
    mid = sum(sl) / period
    std = math.sqrt(sum((x - mid) ** 2 for x in sl) / period)
    return mid + mult * std, mid, mid - mult * std, std

def _atr(ohlc, period=14):
    """Average True Range. ohlc = list of (open,high,low,close) tuples."""
    if len(ohlc) < 2:
        return 0.0
    trs = []
    for i in range(1, len(ohlc)):
        h, l, pc = ohlc[i][1], ohlc[i][2], ohlc[i - 1][3]
        trs.append(max(h - l, abs(h - pc), abs(l - pc)))
    if len(trs) < period:
        return sum(trs) / len(trs)
    atr = sum(trs[:period]) / period
    for tr in trs[period:]:
        atr = (atr * (period - 1) + tr) / period
    return atr

def _quant_analysis(sym, price, rsi, ema20, ema50, ema200,
                    macd, macd_sig, macd_hist,
                    bb_upper, bb_mid, bb_lower,
                    atr, vol_ratio,
                    funding, oi_change_pct, ls_ratio, rsi_4h=50.0):
    """
    Generate a professional quant analysis for the given symbol and indicators.
    Returns a dict ready to serialise as JSON.
    """
    name = sym.replace('USDT', '')

    # ── Per-signal scores (-2…+2) ───────────────────────────────────────────
    scores = []

    # EMA alignment
    ema_above = sum([price > ema20, price > ema50, price > ema200])
    if   ema_above == 3: scores.append(2)
    elif ema_above == 2: scores.append(1)
    elif ema_above == 1: scores.append(-1)
    else:                scores.append(-2)

    # RSI (daily)
    if   rsi >= 75: scores.append(-2)
    elif rsi >= 65: scores.append(-1)
    elif rsi >= 55: scores.append(1)
    elif rsi >= 45: scores.append(0)
    elif rsi >= 35: scores.append(-1)
    else:           scores.append(1)   # deeply oversold = contrarian

    # MACD
    if macd > macd_sig:
        scores.append(1 if macd > 0 else 0)
    else:
        scores.append(-1 if macd < 0 else 0)

    # Bollinger position
    bb_range = (bb_upper - bb_lower) if (bb_upper and bb_lower) else 1
    bb_pos   = (price - bb_lower) / bb_range if bb_range else 0.5
    if   bb_pos > 0.88: scores.append(-1)
    elif bb_pos > 0.55: scores.append(1)
    elif bb_pos < 0.12: scores.append(-1)
    elif bb_pos < 0.45: scores.append(-1)
    else:               scores.append(0)

    # Funding
    if   funding > 0.08: scores.append(-2)
    elif funding > 0.02: scores.append(-1)
    elif funding > -0.01: scores.append(1)
    elif funding > -0.05: scores.append(1)
    else:                 scores.append(2)

    # OI direction (in context of trend)
    if   oi_change_pct > 5:  scores.append(1 if ema_above >= 2 else -1)
    elif oi_change_pct < -5: scores.append(-1)

    # L/S ratio (crowding, contrarian at extremes)
    if   ls_ratio > 1.5: scores.append(-1)
    elif ls_ratio < 0.8: scores.append(1)

    # ── Aggregate ────────────────────────────────────────────────────────────
    total      = sum(scores)
    max_pos    = len(scores) * 2
    bias_score = max(0, min(10, round(5 + (total / max(max_pos, 1)) * 5)))

    if   total >=  7: regime = 'Strong Bull'
    elif total >=  3: regime = 'Bullish'
    elif total >=  1: regime = 'Mild Bullish'
    elif total >= -1: regime = 'Neutral'
    elif total >= -3: regime = 'Mild Bearish'
    elif total >= -6: regime = 'Bearish'
    else:             regime = 'Strong Bear'

    # ── Narrative paragraphs (4 focused blocks) ───────────────────────────────
    paragraphs = []

    # 1. Structure
    pct200 = ((price - ema200) / ema200 * 100) if ema200 else 0
    pct50  = ((price - ema50)  / ema50  * 100) if ema50  else 0
    pct20  = ((price - ema20)  / ema20  * 100) if ema20  else 0
    if ema_above == 3:
        paragraphs.append(
            f"Structure: {name} trades {pct200:+.1f}% above its 200-day EMA (${ema200:,.0f}) "
            f"with all three major EMAs (20/50/200) stacked in bullish alignment — a textbook "
            f"uptrend configuration. The 50-day EMA at ${ema50:,.0f} and 20-day at ${ema20:,.0f} "
            f"are the primary dynamic support levels to watch on any pullback."
        )
    elif ema_above == 2:
        if price > ema50:
            paragraphs.append(
                f"Structure: {name} holds above its 20-day (${ema20:,.0f}) and 50-day (${ema50:,.0f}) "
                f"EMAs but remains {abs(pct200):.1f}% below the critical 200-day EMA (${ema200:,.0f}). "
                f"Short-term structure is constructive, but the macro trend stays bearish until "
                f"${ema200:,.0f} is reclaimed on a weekly close."
            )
        else:
            paragraphs.append(
                f"Structure: {name} is recovering above the 200-day EMA (${ema200:,.0f}, "
                f"{pct200:+.1f}%) but trades below its 20-day (${ema20:,.0f}) and 50-day (${ema50:,.0f}). "
                f"Mixed EMA alignment suggests a transitional market — no clean trend until the "
                f"shorter MAs realign above the 200-day."
            )
    elif ema_above == 1:
        paragraphs.append(
            f"Structure: {name} sits {abs(pct50):.1f}% below its 50-day EMA (${ema50:,.0f}) and "
            f"{abs(pct200):.1f}% below the 200-day (${ema200:,.0f}), with only the 20-day offering "
            f"near-term support at ${ema20:,.0f}. The overall EMA stack is bearish — any bounce is "
            f"likely to encounter supply at these overhead moving averages."
        )
    else:
        paragraphs.append(
            f"Structure: {name} is trading below all three key EMAs — 20-day (${ema20:,.0f}), "
            f"50-day (${ema50:,.0f}), and 200-day (${ema200:,.0f}) — a clear bearish trend structure. "
            f"Each EMA represents a resistance layer on any relief rally; the 200-day at ${ema200:,.0f} "
            f"is the primary bull/bear watershed."
        )

    # 2. Momentum
    macd_state = 'bullish crossover' if (macd > macd_sig and macd > 0) else \
                 'nascent bullish crossover' if (macd > macd_sig and macd <= 0) else \
                 'bearish crossover' if (macd < macd_sig and macd < 0) else 'bearish crossover'
    rsi_read = (
        'overbought' if rsi >= 70 else
        'healthy bullish momentum' if rsi >= 58 else
        'neutral with slight bullish lean' if rsi >= 50 else
        'neutral with slight bearish lean' if rsi >= 42 else
        'approaching oversold' if rsi >= 30 else
        'deeply oversold (potential reversal zone)'
    )
    rsi4h_read = (
        'overbought short-term' if rsi_4h >= 70 else
        'bullish on 4H' if rsi_4h >= 55 else
        'neutral 4H' if rsi_4h >= 45 else
        'bearish on 4H' if rsi_4h >= 30 else
        'oversold 4H'
    )
    paragraphs.append(
        f"Momentum: Daily RSI at {rsi:.1f} reads as {rsi_read}; the 4-hour RSI at {rsi_4h:.1f} "
        f"is {rsi4h_read}. MACD shows a {macd_state} (line {macd:+.1f} vs signal {macd_sig:+.1f}). "
        f"{'Combined, these confirm trend continuation is likely.' if (rsi >= 50 and macd > macd_sig) else 'Watch for momentum confirmation before adding exposure.' if total >= 0 else 'Momentum signals reinforce the bearish structure — risk-off positioning is appropriate.'}"
    )

    # 3. Derivatives
    fund_read = (
        'dangerously elevated — extreme long crowding with high cascade risk' if funding > 0.08 else
        'moderately positive — longs pay shorts, mild positioning imbalance' if funding > 0.02 else
        'near flat — balanced perpetuals positioning, no directional extremes' if funding > -0.01 else
        'slightly negative — shorts dominant, squeeze risk on any bullish catalyst' if funding > -0.05 else
        'deeply negative — one of the strongest contrarian long signals in perpetuals'
    )
    oi_read = (
        f'risen {oi_change_pct:.1f}% (new money entering, {"confirms trend" if ema_above >= 2 else "adds downside risk"})' if oi_change_pct > 3 else
        f'fallen {abs(oi_change_pct):.1f}% (deleveraging / position unwinding)' if oi_change_pct < -3 else
        f'stable ({oi_change_pct:+.1f}%)'
    )
    ls_read = (
        f'heavily long-skewed at {ls_ratio:.2f} — stop-hunt risk below current price' if ls_ratio > 1.4 else
        f'mildly long-biased at {ls_ratio:.2f}' if ls_ratio > 1.1 else
        f'balanced at {ls_ratio:.2f}' if ls_ratio >= 0.9 else
        f'net short at {ls_ratio:.2f} — mechanical squeeze risk on any rally'
    )
    paragraphs.append(
        f"Derivatives: Funding at {funding:+.4f}% is {fund_read}. Open Interest has {oi_read} over 24h. "
        f"The long/short account ratio is {ls_read}."
    )

    # 4. Verdict
    atr_pct  = (atr / price * 100) if price else 0
    bb_width = ((bb_upper - bb_lower) / bb_mid * 100) if bb_mid else 0
    strength = 'high' if abs(total) >= 6 else 'moderate' if abs(total) >= 3 else 'low'
    direction_lbl = 'bullish' if total > 0 else 'bearish' if total < 0 else 'neutral'
    support_lvls    = sorted([v for v in [ema20, ema50, ema200, bb_lower] if v and v < price])[-3:]
    resistance_lvls = sorted([v for v in [bb_upper] if v and v > price])[:2]
    lvl_str = ''
    if support_lvls:
        lvl_str += 'Support: ' + ', '.join(f'${v:,.0f}' for v in reversed(support_lvls)) + '. '
    if resistance_lvls:
        lvl_str += 'Resistance: ' + ', '.join(f'${v:,.0f}' for v in resistance_lvls) + '. '
    paragraphs.append(
        f"Verdict ({regime}, score {total:+d}/{max_pos}): The weight of {len(scores)} signals "
        f"points to a {direction_lbl} bias with {strength} conviction. "
        f"ATR at {atr_pct:.1f}% of price signals {'elevated' if atr_pct > 3 else 'moderate' if atr_pct > 1.5 else 'compressed'} volatility; "
        f"Bollinger width at {bb_width:.1f}% {'suggests a breakout is building' if bb_width < 4 else 'reflects an active trend phase'}. "
        + lvl_str
    )

    # ── Key levels ────────────────────────────────────────────────────────────
    return {
        "regime":     regime,
        "bias_score": bias_score,
        "score_raw":  total,
        "price":      round(price, 2),
        "rsi_4h":     round(rsi_4h, 1),
        "signals": {
            "rsi":         round(rsi, 1),
            "ema20":       round(ema20, 0),
            "ema50":       round(ema50, 0),
            "ema200":      round(ema200, 0),
            "macd":        round(macd, 2),
            "macd_signal": round(macd_sig, 2),
            "bb_upper":    round(bb_upper, 0) if bb_upper else None,
            "bb_mid":      round(bb_mid,   0) if bb_mid   else None,
            "bb_lower":    round(bb_lower, 0) if bb_lower else None,
            "atr":         round(atr, 2),
            "atr_pct":     round(atr_pct, 2),
            "vol_ratio":   round(vol_ratio, 2),
            "funding":     round(funding, 6),
            "ls_ratio":    round(ls_ratio, 2),
            "oi_change":   round(oi_change_pct, 1),
        },
        "key_levels": {
            "support":    [round(v, 0) for v in reversed(support_lvls)],
            "resistance": [round(v, 0) for v in resistance_lvls],
        },
        "paragraphs": paragraphs,
    }



def get_stream_url(video_id):
    """
    Call yt-dlp to get the best HLS URL for a YouTube live stream.
    Returns a string URL on success, raises on failure.
    """
    with _cache_lock:
        if video_id in _cache:
            url, ts = _cache[video_id]
            if time.time() - ts < CACHE_TTL:
                print(f'[MEEZUS] Cache hit : {video_id}')
                return url

    print(f'[MEEZUS] yt-dlp    : {video_id} — fetching stream URL...')

    yt_url    = f'https://www.youtube.com/watch?v={video_id}'
    # Resolution ceiling for the Bookmap streams. YouTube hands us a SINGLE-
    # rendition HLS playlist (no client-side ABR levels to cap), so the quality
    # is chosen here. Kept at 1080p for full legibility of Bookmap's fine text.
    # Lower MAX_H (e.g. 720 or 480) to trade sharpness for browser RAM — decode
    # memory scales with pixel count (480p ≈ 5× fewer pixels/frame than 1080p).
    # Falls back to best if no rendition ≤ MAX_H exists.
    MAX_H     = 1080
    base_args = [
        'yt-dlp', '--no-playlist', '--no-warnings',
        '--format',
        f'best[protocol=m3u8_native][height<={MAX_H}]/best[protocol=m3u8][height<={MAX_H}]/'
        f'best[height<={MAX_H}]/best[protocol=m3u8_native]/best[protocol=m3u8]/best',
        '-g',
    ]

    # Try strategies in order until one succeeds
    strategies = [
        # 1. Safari cookies (needs Full Disk Access for Terminal in macOS Privacy settings)
        ['--cookies-from-browser', 'safari'],
        # 2. Chrome cookies fallback
        ['--cookies-from-browser', 'chrome'],
        # 3. iOS client — often bypasses bot detection without any cookies
        ['--extractor-args', 'youtube:player_client=ios'],
        # 4. TV embedded client
        ['--extractor-args', 'youtube:player_client=tv_embedded'],
    ]

    result   = None
    last_err = 'all strategies failed'

    for extra in strategies:
        r = subprocess.run(
            base_args + extra + [yt_url],
            capture_output=True, text=True, timeout=45,
        )
        if r.returncode == 0 and r.stdout.strip():
            result = r
            print(f'[MEEZUS] yt-dlp OK  : strategy {extra[1]}')
            break
        err = r.stderr.strip()
        print(f'[MEEZUS] Strategy {extra[-1][:30]} failed: {err[:80]}')
        last_err = err

    if result is None:
        raise RuntimeError(last_err)

    # yt-dlp -g can return multiple lines (video + audio for DASH); take line 1
    url = result.stdout.strip().split('\n')[0]
    if not url:
        raise RuntimeError('yt-dlp returned an empty URL')

    print(f'[MEEZUS] Got URL   : …{url[-60:]}')

    with _cache_lock:
        _cache[video_id] = (url, time.time())

    return url


# ── HTTP handler ─────────────────────────────────────────────────────────────
class MeezusHandler(http.server.SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Force browsers to revalidate local assets (HTML/JS/CSS) so edits show
        # up on a normal reload — no hard-refresh needed. The handler still
        # answers If-Modified-Since with 304 when unchanged, so it stays cheap.
        # API responses (path starts with /api/) manage their own caching.
        if not self.path.startswith('/api/'):
            self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    # ── Routing ───────────────────────────────────────────────────────────────
    def do_GET(self):
        path = self.path.split('?', 1)[0]
        qs   = _parse_qs(self.path)

        if   path == '/api/news':         self.handle_news(qs.get('type',   ['tradfi'])[0])
        elif path == '/api/forecast':     self.handle_forecast(qs.get('symbol', ['BTCUSDT'])[0].upper())
        elif path == '/api/calendar':     self.handle_calendar()
        elif path == '/api/openinterest': self.handle_openinterest(qs.get('symbol', ['BTCUSDT'])[0].upper())
        elif path == '/api/sentiment':    self.handle_sentiment()
        elif path == '/api/quant':        self.handle_quant()
        elif path.startswith('/api/stream/'):
            self.handle_stream(path[len('/api/stream/'):].strip('/'))
        elif path.startswith('/api/proxy/'):
            self.handle_proxy(urllib.parse.unquote(path[len('/api/proxy/'):]))
        else:
            super().do_GET()

    # ── /api/news?type=tradfi|crypto ─────────────────────────────────────────
    TRADFI_FEEDS = [
        ('CNBC',        'https://www.cnbc.com/id/100003114/device/rss/rss.html'),
        ('CNBC MKTS',   'https://www.cnbc.com/id/10000664/device/rss/rss.html'),
        ('REUTERS',     'https://feeds.reuters.com/reuters/businessNews'),
        ('MARKETWATCH', 'https://feeds.marketwatch.com/marketwatch/topstories/'),
        ('FT',          'https://www.ft.com/?format=rss'),
    ]
    CRYPTO_FEEDS = [
        ('COINTELEGRAPH', 'https://cointelegraph.com/rss'),
        ('COINDESK',      'https://www.coindesk.com/arc/outboundfeeds/rss/'),
        ('DECRYPT',       'https://decrypt.co/feed'),
        ('THE BLOCK',     'https://www.theblock.co/rss.xml'),
        ('BTC MAGAZINE',  'https://bitcoinmagazine.com/.rss/full/'),
    ]

    def handle_news(self, category):
        feeds = self.CRYPTO_FEEDS if category == 'crypto' else self.TRADFI_FEEDS
        for source, url in feeds:
            try:
                items = self._fetch_rss(url)
                if items:
                    print(f'[MEEZUS] News ({category}): {len(items)} items from {source}')
                    self.send_json({'source': source, 'items': items[:35]})
                    return
            except Exception as e:
                print(f'[MEEZUS] RSS {source} failed: {str(e)[:80]}')
        self.send_json({'error': 'All feeds unavailable'}, 503)

    def _fetch_rss(self, url):
        with _http_get(url, extra_headers={
            'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        }) as resp:
            data = resp.read()

        root  = ET.fromstring(data)
        items = []

        # RSS 2.0
        for item in root.findall('.//item'):
            title = (item.findtext('title') or '').strip()
            link  = (item.findtext('link')  or '').strip()
            date  = (item.findtext('pubDate') or '').strip()
            if title:
                items.append({'title': title, 'link': link, 'date': date})

        # Atom 1.0
        if not items:
            atom = 'http://www.w3.org/2005/Atom'
            for entry in root.findall(f'{{{atom}}}entry'):
                title   = (entry.findtext(f'{{{atom}}}title') or '').strip()
                link_el = entry.find(f'{{{atom}}}link')
                link    = link_el.get('href', '') if link_el is not None else ''
                date    = (entry.findtext(f'{{{atom}}}updated') or '').strip()
                if title:
                    items.append({'title': title, 'link': link, 'date': date})

        return items

    # ── /api/forecast?symbol=BTCUSDT|ETHUSDT ─────────────────────────────────
    def handle_forecast(self, symbol):
        if not _FORECAST_AVAILABLE:
            self.send_json({
                'status':  'no_model',
                'symbol':  symbol,
                'message': 'Run: python3 forecast_setup.py  then restart the server.',
            })
            return
        result = _kf.get_forecast(symbol)
        self.send_json(result)

    # ── /api/calendar ────────────────────────────────────────────────────────
    def handle_calendar(self):
        """
        Fetch ForexFactory calendar from the faireconomy.media CDN.
        - Cache for 90 minutes so we never hammer the CDN.
        - On 429 (rate-limited) or any network error, serve the stale cache
          rather than returning an error to the client.
        """
        global _cal_cache, _cal_cache_ts

        now = time.time()

        # Return cached data if still fresh
        with _cal_cache_lock:
            if _cal_cache and (now - _cal_cache_ts) < CAL_CACHE_TTL:
                age = int(now - _cal_cache_ts)
                print(f'[MEEZUS] Calendar cache hit (age {age}s)')
                self._send_calendar_data(_cal_cache)
                return

        # Try to refresh from upstream
        urls = [
            'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
            'https://nfs.faireconomy.media/ff_calendar_nextweek.json',
        ]
        fresh = None
        for url in urls:
            try:
                with _http_get(url, timeout=15, extra_headers={
                    'Referer': 'https://www.forexfactory.com/',
                    'Origin' : 'https://www.forexfactory.com',
                }) as resp:
                    candidate = resp.read()
                if candidate and candidate.strip() not in (b'[]', b''):
                    fresh = candidate
                    print(f'[MEEZUS] Calendar refreshed from {url.split("/")[-1]}')
                    break
            except urllib.error.HTTPError as e:
                print(f'[MEEZUS] Calendar upstream HTTP {e.code} ({url.split("/")[-1]})')
            except Exception as e:
                print(f'[MEEZUS] Calendar upstream error: {e}')

        if fresh:
            with _cal_cache_lock:
                _cal_cache    = fresh
                _cal_cache_ts = now
            self._send_calendar_data(fresh)
        elif _cal_cache:
            # Upstream failed — serve stale cache rather than an error
            age = int(now - _cal_cache_ts)
            print(f'[MEEZUS] Calendar serving stale cache (age {age}s)')
            self._send_calendar_data(_cal_cache)
        else:
            self.send_json({'error': 'Calendar unavailable — no cache yet'}, 503)

    def _send_calendar_data(self, data):
        self._send_bytes(data, 'application/json', cache='max-age=300')

    # ── /api/openinterest?symbol=BTCUSDT|ETHUSDT ─────────────────────────────
    def handle_openinterest(self, symbol):
        """
        Proxy Binance futures open-interest history.
        Correct endpoint: /futures/data/openInterestHist (not /fapi/v1/...).
        Cached for 5 min to avoid hammering Binance on every panel refresh.
        """
        global _oi_cache
        now = time.time()

        with _oi_cache_lock:
            if symbol in _oi_cache:
                data, ts = _oi_cache[symbol]
                if now - ts < OI_CACHE_TTL:
                    print(f'[MEEZUS] OI cache hit: {symbol}')
                    self._send_raw_json(data)
                    return

        url = (
            f'https://fapi.binance.com/futures/data/openInterestHist'
            f'?symbol={symbol}&period=1h&limit=48'
        )
        try:
            with _http_get(url) as resp:
                data = resp.read()

            with _oi_cache_lock:
                _oi_cache[symbol] = (data, now)

            print(f'[MEEZUS] OI fetched: {symbol} ({len(data)} bytes)')
            self._send_raw_json(data)

        except Exception as e:
            print(f'[MEEZUS] OI fetch error ({symbol}): {e}')
            # Serve stale cache if available
            with _oi_cache_lock:
                if symbol in _oi_cache:
                    self._send_raw_json(_oi_cache[symbol][0])
                    return
            self.send_json({'error': str(e)}, 502)

    def _send_raw_json(self, data):
        self._send_bytes(data, 'application/json', cache='max-age=60')

    # ── /api/sentiment ───────────────────────────────────────────────────────
    # Social sources for the Pulse. Reddit's unauthenticated .json API now hard-
    # blocks (403), so retail social comes from StockTwits (traders self-tag
    # posts Bullish/Bearish — an explicit signal) plus Lemmy crypto communities.
    PULSE_ST_SYMBOLS = [('BTC.X', '$BTC'), ('ETH.X', '$ETH')]
    PULSE_LEMMY      = ['cryptocurrency', 'bitcoin']
    PULSE_UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36')

    # Crypto-relevant keyword filter for non-crypto sources (HN, macro RSS).
    PULSE_CRYPTO_RE = re.compile(
        r'\b(bitcoin|btc|ethereum|eth|crypto|blockchain|defi|stablecoin|usdc|usdt|solana|sol|altcoin|memecoin|nft|cbdc|coin\s?base|binance|tether|sec|fed|fomc|cpi|inflation|interest rate|powell|treasury yield)\b',
        re.IGNORECASE
    )

    def handle_sentiment(self):
        """
        Multi-source crypto sentiment, scored server-side (VADER + finance/crypto
        lexicon) and aggregated into a single index plus trend, divergence,
        topic breakdown and movers:
          • StockTwits — retail traders, explicit Bullish/Bearish self-tags (social)
          • Lemmy      — decentralised crypto communities (social)
          • RSS        — crypto-native headlines (CoinDesk, Cointelegraph, …) (news)
          • RSS        — tradfi headlines filtered for crypto/macro relevance (news)
          • HN         — front-page stories filtered for crypto/macro (news)
        Persists each reading to pulse_history.json for the trend sparkline.
        Cached 4h; serves stale cache on upstream failure.
        """
        global _pulse_cache
        now = time.time()

        with _pulse_cache_lock:
            if _pulse_cache:
                data, ts = _pulse_cache
                if now - ts < PULSE_CACHE_TTL:
                    print('[MEEZUS] Pulse cache hit')
                    self._send_raw_json(data)
                    return

        items   = []
        sources = []

        # ── 1. StockTwits — retail trader stream w/ explicit bull/bear tags ─
        for sym, label in self.PULSE_ST_SYMBOLS:
            try:
                with _http_get(
                    f'https://api.stocktwits.com/api/2/streams/symbol/{sym}.json',
                    timeout=10,
                    extra_headers={'User-Agent': self.PULSE_UA, 'Accept': 'application/json'},
                ) as resp:
                    raw = json.loads(resp.read())
                count = 0
                for msg in raw.get('messages', []):
                    body = (msg.get('body') or '').strip()
                    if not body:
                        continue
                    tag   = ((msg.get('entities') or {}).get('sentiment') or {}).get('basic')  # Bullish/Bearish/None
                    if len(re.findall(r'\$[A-Za-z]', body)) >= 5:   # cross-posted multi-ticker spam
                        continue
                    clean = re.sub(r'\$[A-Za-z.]+', '', body).strip()
                    if not tag and len(clean) < 8:          # drop pure-cashtag noise
                        continue
                    items.append({
                        'src':          'social',
                        'platform':     'stocktwits',
                        'sub':          label,
                        'title':        body,
                        'selftext':     '',
                        'score':        int((msg.get('likes') or {}).get('total') or 0),
                        'comments':     0,
                        'upvote_ratio': 1.0,
                        'created':      _iso_date_ms(msg.get('created_at')),
                        'permalink':    f'https://stocktwits.com/symbol/{sym}',
                        'src_weight':   1.0,
                        'tag':          tag,
                    })
                    count += 1
                sources.append(f'ST {label} ({count})')
            except Exception as e:
                print(f'[MEEZUS] Pulse StockTwits {sym} failed: {str(e)[:80]}')

        # ── 1b. Lemmy — decentralised social, crypto communities ───────────
        for comm in self.PULSE_LEMMY:
            try:
                with _http_get(
                    f'https://lemmy.world/api/v3/post/list?community_name={comm}&limit=20&sort=Hot',
                    timeout=10,
                    extra_headers={'User-Agent': self.PULSE_UA, 'Accept': 'application/json'},
                ) as resp:
                    raw = json.loads(resp.read())
                count = 0
                for p in raw.get('posts', []):
                    post  = p.get('post') or {}
                    title = (post.get('name') or '').strip()
                    if not title or len(title) < 6:
                        continue
                    counts = p.get('counts') or {}
                    items.append({
                        'src':          'social',
                        'platform':     'lemmy',
                        'sub':          'Lemmy',
                        'title':        title,
                        'selftext':     (post.get('body') or '')[:300],
                        'score':        int(counts.get('score') or 0),
                        'comments':     int(counts.get('comments') or 0),
                        'upvote_ratio': 1.0,
                        'created':      _iso_date_ms(post.get('published')),
                        'permalink':    post.get('ap_id') or '',
                        'src_weight':   0.9,
                        'tag':          None,
                    })
                    count += 1
                if count:
                    sources.append(f'Lemmy/{comm} ({count})')
            except Exception as e:
                print(f'[MEEZUS] Pulse Lemmy {comm} failed: {str(e)[:80]}')

        # ── 2. Crypto RSS news ─────────────────────────────────────────────
        for source, url in self.CRYPTO_FEEDS:
            try:
                rss_items = self._fetch_rss(url)
                count = 0
                for it in rss_items[:20]:
                    title = (it.get('title') or '').strip()
                    if not title or len(title) < 8:
                        continue
                    items.append({
                        'src':        'news',
                        'sub':        source,
                        'title':      title,
                        'selftext':   '',
                        'score':      0,
                        'comments':   0,
                        'upvote_ratio': 1.0,
                        'created':    _rss_date_ms(it.get('date', '')),
                        'permalink':  it.get('link') or '',
                        'src_weight': 1.2,   # curated headlines weigh slightly more
                    })
                    count += 1
                sources.append(f'{source} ({count})')
            except Exception as e:
                print(f'[MEEZUS] Pulse RSS {source} failed: {str(e)[:80]}')

        # ── 3. TradFi RSS — filtered for crypto/macro relevance ────────────
        for source, url in self.TRADFI_FEEDS:
            try:
                rss_items = self._fetch_rss(url)
                count = 0
                for it in rss_items[:25]:
                    title = (it.get('title') or '').strip()
                    if not title or not self.PULSE_CRYPTO_RE.search(title):
                        continue
                    items.append({
                        'src':        'macro',
                        'sub':        source,
                        'title':      title,
                        'selftext':   '',
                        'score':      0,
                        'comments':   0,
                        'upvote_ratio': 1.0,
                        'created':    _rss_date_ms(it.get('date', '')),
                        'permalink':  it.get('link') or '',
                        'src_weight': 1.0,
                    })
                    count += 1
                if count:
                    sources.append(f'{source}-macro ({count})')
            except Exception as e:
                print(f'[MEEZUS] Pulse macro {source} failed: {str(e)[:80]}')

        # ── 4. Hacker News — top stories filtered for crypto/macro ─────────
        try:
            with _http_get('https://hacker-news.firebaseio.com/v0/topstories.json', timeout=8) as resp:
                top_ids = json.loads(resp.read())[:60]
            hn_count = 0
            for sid in top_ids:
                try:
                    with _http_get(f'https://hacker-news.firebaseio.com/v0/item/{sid}.json', timeout=6) as r:
                        story = json.loads(r.read()) or {}
                except Exception:
                    continue
                title = (story.get('title') or '').strip()
                if not title or not self.PULSE_CRYPTO_RE.search(title):
                    continue
                items.append({
                    'src':        'hn',
                    'sub':        'HN',
                    'title':      title,
                    'selftext':   '',
                    'score':      int(story.get('score') or 0),
                    'comments':   int(story.get('descendants') or 0),
                    'upvote_ratio': 1.0,
                    'created':    int(story.get('time') or 0) * 1000,
                    'permalink':  story.get('url') or f'https://news.ycombinator.com/item?id={sid}',
                    'src_weight': 0.85,
                })
                hn_count += 1
                if hn_count >= 8:
                    break
            if hn_count:
                sources.append(f'HN ({hn_count})')
        except Exception as e:
            print(f'[MEEZUS] Pulse HN failed: {str(e)[:80]}')

        # ── 5. Score every item (VADER + finance/crypto lexicon) ───────────
        now_ms = int(now * 1000)
        scored = 0
        for it in items:
            text = (it['title'] + ' ' + (it.get('selftext') or '')).strip()
            comp, hh = _vader_compound(text)
            # StockTwits posts carry an explicit self-tag — a high-confidence
            # prior; anchor at ±0.6 and let the text nuance refine within band.
            tag = it.get('tag')
            if tag == 'Bullish':
                comp = min(1.0,  0.6 + 0.4 * max(0.0, comp)); hh = max(hh, 1)
            elif tag == 'Bearish':
                comp = max(-1.0, -0.6 + 0.4 * min(0.0, comp)); hh = max(hh, 1)
            it['compound'] = comp
            it['hits']     = hh
            it['entities'] = _tag_entities(text)
            if hh > 0:
                scored += 1
            # recency decay (half-life PULSE_HALFLIFE_H, capped at 4 days)
            age_h = max(0.0, (now_ms - (it.get('created') or now_ms)) / 3_600_000.0)
            rec   = 0.5 ** (min(age_h, 96.0) / PULSE_HALFLIFE_H)
            if it['src'] == 'social':
                reach = math.log(max(2, it.get('score', 0) + 2)) * (it.get('upvote_ratio') or 1.0)
            elif it['src'] == 'hn':
                reach = math.log(max(2, it.get('score', 0) + 1)) * 0.6
            else:                                  # curated headlines — fixed reach
                reach = 2.0
            it['weight'] = reach * (it.get('src_weight') or 1.0) * rec

        # ── 6. Aggregate (reach × recency weighted mean of compounds) ──────
        def _agg(subset):
            tw = sum(x['weight'] for x in subset)
            if tw <= 0:
                return 0.0, len(subset)
            return sum(x['compound'] * x['weight'] for x in subset) / tw, len(subset)

        def _to100(c):
            return int(max(-100, min(100, round(c * PULSE_SENSITIVITY))))

        overall_c, total   = _agg(items)
        social_items       = [x for x in items if x['src'] == 'social']
        news_items         = [x for x in items if x['src'] in ('news', 'macro', 'hn')]
        social_c, social_n = _agg(social_items)
        news_c,   news_n   = _agg(news_items)

        score100   = _to100(overall_c)
        label, cls = _pulse_classify(score100)

        # ── 7. Confidence — coverage × volume × agreement ──────────────────
        coverage = scored / total if total else 0.0
        volume   = min(1.0, total / 80.0)
        comps    = [x['compound'] for x in items if x['hits'] > 0]
        if len(comps) > 1:
            mean = sum(comps) / len(comps)
            std  = (sum((c - mean) ** 2 for c in comps) / len(comps)) ** 0.5
            agreement = max(0.0, 1.0 - min(1.0, std / 0.6))
        else:
            agreement = 0.3
        confidence = int(round(100 * (0.40 * coverage + 0.30 * volume + 0.30 * agreement)))

        # ── 8. Topic / entity breakdown ────────────────────────────────────
        topics = []
        for name, _pat in _ENTITY_PATTERNS:
            sub = [x for x in items if name in x['entities']]
            if len(sub) >= 2:
                c, _ = _agg(sub)
                topics.append({'name': name, 'score': _to100(c), 'count': len(sub)})
        topics.sort(key=lambda t: t['count'], reverse=True)
        topics = topics[:6]

        # ── 9. History + deltas (persist this reading) ─────────────────────
        prev   = _pulse_history_load()
        d_last = (score100 - prev[-1]['overall']) if prev else None
        d_24   = (score100 - prev[-6]['overall']) if len(prev) >= 6 else None
        hist   = _pulse_history_append({
            'ts': now_ms, 'overall': score100, 'social': _to100(social_c),
            'news': _to100(news_c), 'confidence': confidence,
        })
        recent   = [h['overall'] for h in hist[-6:]]
        momentum = round((recent[-1] - recent[0]) / max(1, len(recent) - 1), 1) if len(recent) >= 2 else None

        # ── 10. Divergence — intra-batch mood slope vs BTC 24h price ───────
        dated   = [x for x in items if x['hits'] > 0 and x.get('created')]
        rec_set = [x for x in dated if (now_ms - x['created']) / 3_600_000.0 <= 8]
        old_set = [x for x in dated if 8 < (now_ms - x['created']) / 3_600_000.0 <= 30]
        if len(rec_set) >= 3 and len(old_set) >= 3:
            sent_slope = (sum(x['compound'] for x in rec_set) / len(rec_set)
                          - sum(x['compound'] for x in old_set) / len(old_set))
        elif momentum is not None:
            sent_slope = momentum / 100.0
        else:
            sent_slope = 0.0
        price24 = 0.0
        try:
            with _http_get('https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=1d&limit=2') as r:
                kl = json.loads(r.read())
            if len(kl) >= 2:
                c_prev, c_now = float(kl[-2][4]), float(kl[-1][4])
                price24 = (c_now - c_prev) / c_prev * 100 if c_prev else 0.0
        except Exception as e:
            print(f'[MEEZUS] Pulse price fetch failed: {str(e)[:80]}')
        divergence = _pulse_divergence(price24, sent_slope)

        # ── 11. Top movers ─────────────────────────────────────────────────
        def _mover(x):
            return {
                'title':      x['title'][:140],
                'url':        x.get('permalink') or '',
                'src':        x['src'],
                'platform':   x.get('platform') or x['src'],
                'sub':        x.get('sub') or '',
                'tagged':     bool(x.get('tag')),
                'score':      int(round(x['compound'] * 100)),
                'engagement': int(x.get('score', 0)) if x['src'] in ('social', 'hn') else 0,
            }
        # Movers must be on-topic (carry a crypto/macro entity) to avoid surfacing
        # off-topic feed noise that merely trips a sentiment word.
        movable = [x for x in items if x['hits'] > 0 and x['entities']]
        ranked  = sorted(movable, key=lambda x: x['compound'] * x['weight'])
        bear    = [_mover(x) for x in ranked if x['compound'] < 0][:4]
        bull    = [_mover(x) for x in reversed(ranked) if x['compound'] > 0][:4]

        payload = json.dumps({
            'generated_at': now_ms,
            'overall':      {'score': score100, 'label': label, 'cls': cls, 'confidence': confidence},
            'social':       {'score': _to100(social_c), 'count': social_n},
            'news':         {'score': _to100(news_c),   'count': news_n},
            'delta':        {'last': d_last, 'h24': d_24, 'momentum': momentum},
            'history':      [{'t': h['ts'], 'v': h['overall']} for h in hist[-42:]],
            'topics':       topics,
            'divergence':   divergence,
            'movers':       {'bull': bull, 'bear': bear},
            'sources':      sources,
            'total':        total,
            'scored':       scored,
        }).encode()

        with _pulse_cache_lock:
            _pulse_cache = (payload, now)

        print(f'[MEEZUS] Pulse: {score100:+d} {label} ({scored}/{total} scored, '
              f'conf {confidence}%, {divergence["label"]})')
        self._send_raw_json(payload)

    # ── /api/quant ────────────────────────────────────────────────────────────────
    def handle_quant(self):
        """
        Fetches Binance klines + derivatives data for BTC and ETH, computes
        technical indicators server-side, and returns a structured quant analysis
        with narrative text. Cached for 4 hours; serves stale on error.
        """
        global _quant_cache
        now = time.time()

        with _quant_lock:
            if _quant_cache["data"] and (now - _quant_cache["ts"]) < QUANT_CACHE_TTL:
                print("[MEEZUS] Quant cache hit")
                self._send_raw_json(_quant_cache["data"])
                return

        results = {}

        for sym, label in [("BTCUSDT", "BTC"), ("ETHUSDT", "ETH")]:
            try:
                # 500 daily klines (enough for accurate EMA200 with SMA seed)
                with _http_get(
                    f"https://fapi.binance.com/fapi/v1/klines?symbol={sym}&interval=1d&limit=500"
                ) as r:
                    klines_d = json.loads(r.read())

                # 100 x 4-hour klines for short-term RSI
                with _http_get(
                    f"https://fapi.binance.com/fapi/v1/klines?symbol={sym}&interval=4h&limit=100"
                ) as r:
                    klines_4h = json.loads(r.read())

                # Binance kline: [open_time, open, high, low, close, volume, ...]
                def _parse(raw):
                    return [(float(k[1]), float(k[2]), float(k[3]), float(k[4]), float(k[5])) for k in raw]

                dk  = _parse(klines_d)
                k4h = _parse(klines_4h)

                closes_d  = [k[3] for k in dk]
                volumes_d = [k[4] for k in dk]
                price     = closes_d[-1]

                ema20  = _ema(closes_d, 20)
                ema50  = _ema(closes_d, 50)
                ema200 = _ema(closes_d, 200)
                rsi_d  = _rsi(closes_d[-30:], 14)
                macd_l, macd_sig, macd_hist = _macd(closes_d[-60:])
                bb_up, bb_mid, bb_lo, _   = _bb(closes_d, 20, 2.0)
                atr = _atr([(k[0], k[1], k[2], k[3]) for k in dk], 14)

                vol20     = sum(volumes_d[-20:]) / 20 if len(volumes_d) >= 20 else volumes_d[-1]
                vol_ratio = volumes_d[-1] / vol20 if vol20 else 1.0

                rsi_4h = _rsi([k[3] for k in k4h[-30:]], 14)

                # Funding rate
                funding = 0.0
                try:
                    with _http_get(
                        f"https://fapi.binance.com/fapi/v1/fundingRate?symbol={sym}&limit=1"
                    ) as r:
                        fd = json.loads(r.read())
                    funding = float(fd[0].get("fundingRate", 0)) * 100 if fd else 0.0
                except Exception as ef:
                    print(f"[MEEZUS] Quant funding {sym}: {ef}")

                # OI 24h change
                oi_change_pct = 0.0
                try:
                    with _http_get(
                        f"https://fapi.binance.com/futures/data/openInterestHist?symbol={sym}&period=1h&limit=25"
                    ) as r:
                        oi_data = json.loads(r.read())
                    if len(oi_data) >= 2:
                        oi_cur = float(oi_data[-1]["sumOpenInterestValue"])
                        oi_old = float(oi_data[0]["sumOpenInterestValue"])
                        oi_change_pct = ((oi_cur - oi_old) / oi_old * 100) if oi_old else 0.0
                except Exception as eo:
                    print(f"[MEEZUS] Quant OI {sym}: {eo}")

                # L/S ratio
                ls_ratio = 1.0
                try:
                    with _http_get(
                        f"https://fapi.binance.com/futures/data/globalLongShortAccountRatio"
                        f"?symbol={sym}&period=5m&limit=1"
                    ) as r:
                        ls_data = json.loads(r.read())
                    ls_ratio = float(ls_data[0]["longShortRatio"]) if ls_data else 1.0
                except Exception as els:
                    print(f"[MEEZUS] Quant L/S {sym}: {els}")

                results[label] = _quant_analysis(
                    sym=sym, price=price,
                    rsi=rsi_d, ema20=ema20, ema50=ema50, ema200=ema200,
                    macd=macd_l, macd_sig=macd_sig, macd_hist=macd_hist,
                    bb_upper=bb_up, bb_mid=bb_mid, bb_lower=bb_lo,
                    atr=atr, vol_ratio=vol_ratio,
                    funding=funding, oi_change_pct=oi_change_pct,
                    ls_ratio=ls_ratio, rsi_4h=rsi_4h,
                )
                print(f"[MEEZUS] Quant {label}: {results[label]['regime']} "
                      f"(score {results[label]['score_raw']:+d})")

            except Exception as e:
                print(f"[MEEZUS] Quant {label} failed: {e}")
                results[label] = {"error": str(e)}

        payload = json.dumps({
            "symbols":      results,
            "generated_at": int(now * 1000),
        }).encode()

        with _quant_lock:
            _quant_cache = {"ts": now, "data": payload}

        self._send_raw_json(payload)

    # ── /api/stream/<video_id> ────────────────────────────────────────────────
    def handle_stream(self, video_id):
        if not re.match(r'^[A-Za-z0-9_-]{11}$', video_id):
            self.send_json({'error': 'Invalid video ID'}, 400)
            return
        try:
            raw_url = get_stream_url(video_id)

            is_hls = (
                '.m3u8'            in raw_url or
                'manifest.googlevideo' in raw_url or
                '/manifest/'       in raw_url
            )

            if is_hls:
                proxied = '/api/proxy/' + urllib.parse.quote(raw_url, safe='')
                self.send_json({'type': 'hls', 'url': proxied})
            else:
                # Direct MP4 — pass straight through
                self.send_json({'type': 'mp4', 'url': raw_url})

        except FileNotFoundError:
            self.send_json({'error': 'yt-dlp not found. Run: pip install yt-dlp'}, 500)
        except subprocess.TimeoutExpired:
            self.send_json({'error': 'yt-dlp timed out — YouTube may be slow'}, 504)
        except Exception as e:
            self.send_json({'error': str(e)[:200]}, 500)

    # ── /api/proxy/<encoded-url> ──────────────────────────────────────────────
    def handle_proxy(self, url):
        """Fetch any URL and pipe it to the client, rewriting m3u8 manifests."""
        try:
            with _http_get(url, timeout=20, extra_headers={
                'Referer': 'https://www.youtube.com/',
                'Origin' : 'https://www.youtube.com',
            }) as resp:
                ct   = resp.headers.get('Content-Type', 'application/octet-stream')
                data = resp.read()

            # Detect and rewrite HLS manifests
            is_manifest = (
                'mpegurl'  in ct.lower() or
                url.endswith('.m3u8') or
                (len(data) < 16_384 and data.lstrip()[:7] == b'#EXTM3U')
            )

            if is_manifest:
                data = self._rewrite_m3u8(data, url)
                ct   = 'application/vnd.apple.mpegurl'

            self._send_bytes(data, ct, cache='no-cache, no-store')

        except urllib.error.HTTPError as e:
            print(f'[MEEZUS] Proxy HTTP {e.code}: {url[-80:]}')
            self.send_error(e.code, str(e))
        except Exception as e:
            print(f'[MEEZUS] Proxy error: {e}')
            self.send_error(502, str(e))

    # ── m3u8 rewriter ─────────────────────────────────────────────────────────
    def _rewrite_m3u8(self, data, base_url):
        """Prefix every URL in the manifest with /api/proxy/ so segments
        flow through this server (bypasses CORS and SSL issues)."""
        base  = base_url.rsplit('/', 1)[0] + '/'
        lines = []

        for line in data.decode('utf-8', errors='replace').splitlines():
            s = line.strip()

            if s and not s.startswith('#'):
                # Plain URL line — segment or sub-manifest
                abs_url = s if s.startswith('http') else urllib.parse.urljoin(base, s)
                line    = '/api/proxy/' + urllib.parse.quote(abs_url, safe='')

            elif s.startswith('#') and 'URI="' in s:
                # Inline URI= attribute (encryption key, etc.)
                def _repl(m):
                    inner   = m.group(1)
                    abs_url = inner if inner.startswith('http') else urllib.parse.urljoin(base, inner)
                    return 'URI="/api/proxy/' + urllib.parse.quote(abs_url, safe='') + '"'
                line = re.sub(r'URI="([^"]+)"', _repl, s)

            lines.append(line)

        return '\n'.join(lines).encode('utf-8')

    # ── Helpers ───────────────────────────────────────────────────────────────
    def _send_bytes(self, data, content_type, status=200, cache=None):
        """Single response writer — JSON, m3u8, segments all go through here."""
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Access-Control-Allow-Origin', '*')
        if cache:
            self.send_header('Cache-Control', cache)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def send_json(self, data, status=200):
        self._send_bytes(json.dumps(data).encode(), 'application/json', status=status)

    def log_message(self, fmt, *args):
        msg = fmt % args if args else fmt
        if '/api/' in msg:
            print(f'[MEEZUS] {self.address_string()} {msg}')


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == '__main__':
    # Start Kronos forecast scheduler (no-op if model not installed)
    if _FORECAST_AVAILABLE:
        _kf.start_background_refresh(symbols=('BTCUSDT', 'ETHUSDT'), pred_len=12, n_samples=30)

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(('', PORT), MeezusHandler) as httpd:
        print(f'\n  ◈ MEEZUS TERMINAL')
        print(f'  → http://localhost:{PORT}')
        print(f'  → Serving : {DIRECTORY}')
        print(f'  → Ctrl+C to stop\n')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\n[MEEZUS] Server stopped.')
