"""
Kronos forecast runner — imported by server.py.

Requires forecast_setup.py to have been run first.

Public API
----------
is_available()  -> bool          True once the model is loaded
get_forecast(symbol, pred_len, n_samples) -> dict

The returned dict always has a 'status' key:
  'ok'       — forecast ready
  'pending'  — first run still computing (widget shows spinner)
  'error'    — something went wrong; 'message' has details
  'no_model' — setup hasn't been run yet
"""

import os
import sys
import ssl
import json
import time
import threading
import urllib.request

import numpy as np
import pandas as pd

# ── Paths ─────────────────────────────────────────────────────────────────────
HERE       = os.path.dirname(os.path.abspath(__file__))
KRONOS_SRC = os.path.join(HERE, 'kronos_src')

# ── Model state ───────────────────────────────────────────────────────────────
_predictor  = None
_load_error = None
_load_lock  = threading.Lock()
_model_ok   = False

# ── SSL context (reuse server.py's pattern) ───────────────────────────────────
_SSL = ssl.create_default_context()
_SSL.check_hostname = False
_SSL.verify_mode    = ssl.CERT_NONE


def is_available():
    return _model_ok


def _load_model():
    """Load model weights (called once, lazily)."""
    global _predictor, _load_error, _model_ok

    with _load_lock:
        if _model_ok:
            return True
        if _load_error:
            return False

        if not os.path.isdir(KRONOS_SRC):
            _load_error = (
                'kronos_src/ not found. '
                'Run:  python3 forecast_setup.py'
            )
            return False

        try:
            sys.path.insert(0, KRONOS_SRC)
            from model import Kronos, KronosTokenizer, KronosPredictor
            import torch

            device = (
                'mps' if torch.backends.mps.is_available() else
                'cuda' if torch.cuda.is_available() else
                'cpu'
            )

            print(f'[KRONOS] Loading Kronos-mini on {device}…')
            tokenizer  = KronosTokenizer.from_pretrained('NeoQuasar/Kronos-Tokenizer-2k')
            model_obj  = Kronos.from_pretrained('NeoQuasar/Kronos-mini')
            _predictor = KronosPredictor(
                model_obj, tokenizer,
                device=device,
                max_context=2048,
            )
            _model_ok = True
            print('[KRONOS] Kronos-mini ready.')
            return True

        except Exception as exc:
            _load_error = str(exc)[:300]
            print(f'[KRONOS] Model load failed: {exc}')
            return False


# ── Binance klines ─────────────────────────────────────────────────────────────
def _fetch_klines(symbol: str, interval: str = '1h', limit: int = 420) -> pd.DataFrame:
    url = (
        f'https://fapi.binance.com/fapi/v1/klines'
        f'?symbol={symbol}&interval={interval}&limit={limit}'
    )
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=20, context=_SSL) as r:
        raw = json.loads(r.read())

    rows = [{
        'timestamps': pd.Timestamp(k[0], unit='ms', tz='UTC'),
        'open':       float(k[1]),
        'high':       float(k[2]),
        'low':        float(k[3]),
        'close':      float(k[4]),
        'volume':     float(k[5]),
        'amount':     float(k[7]),   # quote asset volume
    } for k in raw]

    return pd.DataFrame(rows)


# ── Forecast cache ─────────────────────────────────────────────────────────────
_cache      = {}          # symbol -> {'ts': float, 'data': dict}
_cache_lock = threading.Lock()
CACHE_TTL   = 3600        # 1 hour


def _compute_forecast(symbol: str, pred_len: int, n_samples: int) -> dict:
    """Run model and return result dict. Called in a background thread."""
    t0 = time.time()
    print(f'[KRONOS] Forecast start: {symbol}  pred={pred_len}h  samples={n_samples}')

    # Fetch context (400 candles to give the model full 2 048-step window)
    df = _fetch_klines(symbol, limit=420)

    x_df  = df[['open', 'high', 'low', 'close', 'volume', 'amount']].copy()
    x_ts  = df['timestamps']

    last_ts = df['timestamps'].iloc[-1]
    y_ts    = pd.Series([
        last_ts + pd.Timedelta(hours=i + 1) for i in range(pred_len)
    ])

    # Monte Carlo: call predict once per sample (sample_count=1 is safest)
    paths = []
    for i in range(n_samples):
        pred = _predictor.predict(
            df           = x_df,
            x_timestamp  = x_ts,
            y_timestamp  = y_ts,
            pred_len     = pred_len,
            T            = 1.0,
            top_p        = 0.9,
            sample_count = 1,
        )
        paths.append(pred['close'].tolist())
        if (i + 1) % 5 == 0:
            print(f'[KRONOS]   {i+1}/{n_samples} paths done…')

    arr  = np.array(paths)          # (n_samples, pred_len)
    mean = arr.mean(axis=0)
    p10  = np.percentile(arr, 10, axis=0)
    p90  = np.percentile(arr, 90, axis=0)

    # Keep last 72 h of history for the chart (3 days)
    hist_df = df.tail(72)
    history = [
        {
            'ts': int(row['timestamps'].timestamp() * 1000),
            'o':  round(row['open'],   2),
            'h':  round(row['high'],   2),
            'l':  round(row['low'],    2),
            'c':  round(row['close'],  2),
        }
        for _, row in hist_df.iterrows()
    ]

    elapsed = round(time.time() - t0, 1)
    print(f'[KRONOS] Forecast done in {elapsed}s')

    return {
        'status':       'ok',
        'symbol':       symbol,
        'generated_at': int(time.time() * 1000),
        'elapsed_s':    elapsed,
        'history':      history,
        'forecast': {
            'timestamps': [int(ts.timestamp() * 1000) for ts in y_ts],
            'mean': [round(v, 2) for v in mean],
            'p10':  [round(v, 2) for v in p10],
            'p90':  [round(v, 2) for v in p90],
        },
    }


# ── Background refresh thread ──────────────────────────────────────────────────
_bg_lock     = threading.Lock()
_bg_running  = set()    # symbols currently being computed


def _refresh_bg(symbol: str, pred_len: int, n_samples: int):
    """Run forecast in background and store result in cache."""
    with _bg_lock:
        if symbol in _bg_running:
            return          # already computing this symbol
        _bg_running.add(symbol)
    try:
        if not _load_model():
            return
        result = _compute_forecast(symbol, pred_len, n_samples)
        with _cache_lock:
            _cache[symbol] = {'ts': time.time(), 'data': result}
    except Exception as exc:
        print(f'[KRONOS] Background forecast error ({symbol}): {exc}')
        err = {'status': 'error', 'symbol': symbol, 'message': str(exc)[:200]}
        with _cache_lock:
            _cache[symbol] = {'ts': time.time(), 'data': err}
    finally:
        with _bg_lock:
            _bg_running.discard(symbol)


def get_forecast(symbol: str = 'BTCUSDT',
                 pred_len: int = 12,
                 n_samples: int = 30) -> dict:
    """
    Return the cached forecast for *symbol*, triggering a background
    refresh if the cache is stale (or empty).
    """
    # Quick path — return valid cache immediately
    with _cache_lock:
        entry = _cache.get(symbol)
        if entry and (time.time() - entry['ts']) < CACHE_TTL:
            return entry['data']

    # Model not installed?
    if not os.path.isdir(KRONOS_SRC):
        return {
            'status':  'no_model',
            'symbol':  symbol,
            'message': 'Run python3 forecast_setup.py first.',
        }

    # Start background compute (returns stale cache if available)
    t = threading.Thread(
        target   = _refresh_bg,
        args     = (symbol, pred_len, n_samples),
        daemon   = True,
        name     = f'forecast-{symbol}',
    )
    t.start()

    # If we have stale data, return it while the refresh runs
    with _cache_lock:
        if symbol in _cache:
            stale = dict(_cache[symbol]['data'])
            stale['stale'] = True
            return stale

    # Nothing at all yet → pending
    return {'status': 'pending', 'symbol': symbol, 'message': 'Computing first forecast…'}


def start_background_refresh(symbols=('BTCUSDT', 'ETHUSDT'),
                              pred_len=12, n_samples=30):
    """
    Called once at server start.  Kicks off an immediate forecast for each
    symbol, then re-runs every hour.
    """
    def _loop():
        # Stagger BTC and ETH by 5 minutes so they don't run concurrently
        for sym in symbols:
            _refresh_bg(sym, pred_len, n_samples)
            time.sleep(300)
        # Hourly thereafter
        while True:
            time.sleep(CACHE_TTL)
            for sym in symbols:
                _refresh_bg(sym, pred_len, n_samples)
                time.sleep(300)

    t = threading.Thread(target=_loop, daemon=True, name='forecast-scheduler')
    t.start()
    print('[KRONOS] Forecast scheduler started.')
