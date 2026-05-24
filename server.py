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
    base_args = [
        'yt-dlp', '--no-playlist', '--no-warnings',
        '--format', 'best[protocol=m3u8_native]/best[protocol=m3u8]/best',
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
    # Subreddits scraped for the Pulse. Crypto-native subs dominate; we also
    # pull a couple of macro/tradfi subs because rate news, equity panics etc.
    # drive crypto sentiment heavily.
    PULSE_SUBS = [
        ('CryptoCurrency',  1.00),
        ('Bitcoin',         1.00),
        ('CryptoMarkets',   1.00),
        ('ethereum',        0.85),
        ('SatoshiStreetBets', 0.65),
        ('wallstreetbets',  0.50),   # tradfi vibes leak into crypto
        ('StockMarket',     0.45),
    ]

    # Crypto-relevant keyword filter for non-crypto sources (HN, macro RSS).
    PULSE_CRYPTO_RE = re.compile(
        r'\b(bitcoin|btc|ethereum|eth|crypto|blockchain|defi|stablecoin|usdc|usdt|solana|sol|altcoin|memecoin|nft|cbdc|coin\s?base|binance|tether|sec|fed|fomc|cpi|inflation|interest rate|powell|treasury yield)\b',
        re.IGNORECASE
    )

    def handle_sentiment(self):
        """
        Aggregates multi-source crypto sentiment:
          • Reddit  — 7 subs (crypto-native + tradfi adjacent), weighted
          • RSS     — crypto-native headlines (CoinDesk, Cointelegraph, etc.)
          • RSS     — tradfi headlines filtered for crypto/macro keywords
          • HN      — front page top stories filtered for crypto/macro keywords
        Browser still does the scoring; we just deliver normalised items.
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

        # ── 1. Reddit ──────────────────────────────────────────────────────
        for sub, weight in self.PULSE_SUBS:
            url = f'https://www.reddit.com/r/{sub}/hot.json?limit=30'
            try:
                with _http_get(url, timeout=10, extra_headers={
                    'User-Agent': 'MeezusTerminal/1.0 (sentiment-pulse)',
                    'Accept':     'application/json',
                }) as resp:
                    raw = json.loads(resp.read())
                count = 0
                for c in raw.get('data', {}).get('children', []):
                    d = c.get('data') or {}
                    if d.get('stickied') or d.get('over_18'):
                        continue
                    title = (d.get('title') or '').strip()
                    if not title or len(title) < 6:
                        continue
                    # For tradfi-leaning subs, only keep crypto/macro-tagged posts
                    if weight < 0.6 and not self.PULSE_CRYPTO_RE.search(title + ' ' + (d.get('selftext') or '')):
                        continue
                    items.append({
                        'src':          'reddit',
                        'sub':          sub,
                        'title':        title,
                        'selftext':     (d.get('selftext') or '')[:400],
                        'score':        int(d.get('score') or 0),
                        'comments':     int(d.get('num_comments') or 0),
                        'upvote_ratio': float(d.get('upvote_ratio') or 0.5),
                        'created':      int(d.get('created_utc') or 0) * 1000,
                        'permalink':    'https://reddit.com' + (d.get('permalink') or ''),
                        'src_weight':   weight,
                    })
                    count += 1
                sources.append(f'r/{sub} ({count})')
            except Exception as e:
                print(f'[MEEZUS] Pulse fetch /r/{sub} failed: {str(e)[:80]}')

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

        payload = json.dumps({
            'items':        items,
            'generated_at': int(now * 1000),
            'sources':      sources,
        }).encode()

        with _pulse_cache_lock:
            _pulse_cache = (payload, now)

        print(f'[MEEZUS] Pulse fetched: {len(items)} items from {len(sources)} sources')
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
