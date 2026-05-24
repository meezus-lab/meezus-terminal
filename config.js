// ─── MEEZUS TERMINAL Config ───────────────────────────────────────────────────
// YouTube: grab the video ID from the URL → youtube.com/watch?v=VIDEO_ID_HERE

const CONFIG = {

  // ── Finnhub API key (free) ──────────────────────────────────────────────────
  // Sign up at https://finnhub.io — free tier, no credit card needed.
  // Paste your token here to enable the Economic Calendar widget.
  finnhubApiKey: '',
  youtube: {
    btcStreamId: 'hFSVrJEldlo',
    ethStreamId: '1gcTeXRm0ec',

    // Invidious instance used to bypass YouTube's embed restrictions.
    // If streams stop loading, try swapping to another instance:
    //   https://yewtu.be  |  https://invidious.kavin.rocks  |  https://inv.riverside.rocks
    invidiousInstance: 'https://yewtu.be',
  },

  // ── Coinglass heatmap ───────────────────────────────────────────────────────
  // cropTop / cropBottom: hide Coinglass chrome so only the chart is visible.
  // Fine-tune in ~5px steps if content is cut off or chrome bleeds in.
  heatmap: {
    coin:        'BTC',  // default coin on load ('BTC' or 'ETH')
    cropTop:     110,    // px — hides Coinglass navbar + tab bar
    cropBottom:  36,     // px — hides Coinglass footer controls
  },

  refresh: {
    prices:    10_000,   // BTC/ETH price (ms)
    funding:   30_000,   // funding rate + L/S ratio (ms)
    fearGreed: 300_000,  // fear & greed index (ms)
    dominance: 300_000,  // BTC dominance (ms)
    news:      120_000,  // news feed (ms)
    vix:        60_000,  // VIX (ms)
  }
};
