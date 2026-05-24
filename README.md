# MEEZUS TERMINAL

A self-hosted crypto market intelligence dashboard. Live prices, funding, open
interest, a native liquidation heatmap, an AI quant analysis engine, social
sentiment, an economic calendar, world clocks, and (optionally) an ML price
forecast — all in a draggable macOS-style "liquid glass" grid.

Runs entirely on your own machine via a small Python proxy server. No accounts,
no paid APIs required.

---

## Quick start (with Claude Code)

If you have Claude Code, the fastest path is to open this folder and ask:

> "Set up and run this dashboard."

Claude Code will read this README and handle the steps below for you. Otherwise,
follow along manually:

### 1. Requirements
- **Python 3.9+** (`python3 --version`)
- **yt-dlp** — used to proxy the YouTube Bookmap streams:
  ```bash
  python3 -m pip install yt-dlp
  ```

### 2. (Recommended) Create a virtual environment
```bash
cd dashboard
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
python3 -m pip install yt-dlp
```

### 3. Run the server
```bash
python3 server.py
```
Then open **http://localhost:8080** in your browser (Chrome or Safari).

That's it — most panels (prices, funding, L/S, OI, heatmap, quant analysis,
sentiment, news, calendar, clocks) work immediately.

---

## Optional: enable the ML price forecast

The **Kronos Forecast** panel uses a transformer model (PyTorch). It's optional —
without it the panel just shows "model not installed". To enable it:

```bash
python3 forecast_setup.py
```
This clones the Kronos model repo into `kronos_src/`, installs the Python deps
(`torch`, `transformers`, etc.), and pre-downloads the model weights (~300 MB,
cached in `~/.cache/huggingface/`). Restart `server.py` afterwards.

> Note: `kronos_src/` is intentionally **not** in this repo — `forecast_setup.py`
> recreates it. First forecast after setup takes ~1–2 min to warm up.

---

## Configuration — `config.js`

| Field | What it does |
|-------|--------------|
| `youtube.btcStreamId` / `ethStreamId` | YouTube video IDs for the Bookmap streams. When a stream changes, grab the new ID from the URL: `youtube.com/watch?v=`**`VIDEO_ID`** |
| `finnhubApiKey` | Optional. Free key from [finnhub.io](https://finnhub.io) — only needed if you wire up extra calendar data. |
| `refresh.*` | Polling intervals (ms) for each data source. |

Edit `config.js` and refresh the browser — no server restart needed.

---

## Optional: auto-start on login (macOS)

To keep the dashboard running in the background, ask Claude Code to "set up
auto-start on login" — it'll create a `launchd` launch agent pointing at your
local `server.py`. (The agent file is machine-specific and is git-ignored.)

---

## Data sources

| Panel | Source | Refresh |
|-------|--------|---------|
| BTC/ETH price, funding, L/S ratio | Binance Futures API | 10s / 30s |
| Open Interest | Binance Futures API | 5 min |
| Liquidation Heatmap | Binance kline + live `forceOrder` websocket | live |
| Quant Analysis | Binance klines → server-computed indicators (RSI/MACD/EMA/BB/ATR) + narrative | 4 h |
| Crypto Pulse | Reddit + crypto/macro RSS + Hacker News (VADER-style scoring) | 4 h |
| Fear & Greed | alternative.me | 5 min |
| BTC Dominance | CoinGecko | 5 min |
| VIX / Put-Call | Yahoo Finance / CBOE (via proxy) | 1 min / on load |
| Economic Calendar | ForexFactory (faireconomy CDN, server-cached) | 10 min |
| News | CNBC / crypto RSS feeds | 2 min |
| Streams | YouTube live via yt-dlp + HLS proxy | manual |
| Kronos Forecast | Kronos transformer model (optional) | hourly |

---

## Layout

Drag panels by their headers; resize from any edge. Layout auto-saves to
`localStorage`. Use **Reset** in the header to restore the default arrangement,
or **Layouts** to save/load named arrangements.

---

## Troubleshooting

- **Panels say "is server.py running?"** — the Python server isn't up. Run `python3 server.py`.
- **Streams won't load** — update the video IDs in `config.js` (streams go offline); make sure `yt-dlp` is installed and current (`pip install -U yt-dlp`).
- **Don't see a new panel after an update** — hard refresh: `⌘⇧R` (Safari) / `⌘⇧R` (Chrome).
- **Forecast panel blank** — run `python3 forecast_setup.py`, then restart the server.
