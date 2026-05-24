// ─── MEEZUS TERMINAL Dashboard ───────────────────────────────────────────────

// ─── Date + UTC ticker ───────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const dEl = document.getElementById('date');
  if (dEl) dEl.textContent = now.toLocaleDateString('en-GB', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
  const uEl = document.getElementById('utc-clock');
  if (uEl) uEl.textContent = now.toLocaleTimeString('en-GB', {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC'
  });
}
setInterval(updateClock, 1000);
updateClock();

// ─── Rotating quote stream ───────────────────────────────────────────────────
// Curated wisdom from traders, investors, philosophers. Cycles every ~12s
// with a soft crossfade. Picks are biased toward markets / discipline / mindset.
const QUOTES = [
  { t: 'The market can remain irrational longer than you can remain solvent.', a: 'John Maynard Keynes' },
  { t: 'Be fearful when others are greedy, and greedy when others are fearful.', a: 'Warren Buffett' },
  { t: 'Risk comes from not knowing what you\'re doing.', a: 'Warren Buffett' },
  { t: 'The four most dangerous words in investing are: this time it\'s different.', a: 'Sir John Templeton' },
  { t: 'In investing, what is comfortable is rarely profitable.', a: 'Robert Arnott' },
  { t: 'The stock market is a device for transferring money from the impatient to the patient.', a: 'Warren Buffett' },
  { t: 'It\'s not whether you\'re right or wrong that\'s important, but how much money you make when you\'re right.', a: 'George Soros' },
  { t: 'The biggest risk is not taking any risk.', a: 'Mark Zuckerberg' },
  { t: 'Markets can stay irrational longer than you can stay liquid.', a: 'Trader\'s adage' },
  { t: 'The trend is your friend until the end when it bends.', a: 'Ed Seykota' },
  { t: 'Cut your losses short and let your profits run.', a: 'David Ricardo' },
  { t: 'Plan the trade and trade the plan.', a: 'Trader\'s rule' },
  { t: 'Wide diversification is only required when investors do not understand what they are doing.', a: 'Warren Buffett' },
  { t: 'Time in the market beats timing the market.', a: 'Ken Fisher' },
  { t: 'The investor\'s chief problem — and even his worst enemy — is likely to be himself.', a: 'Benjamin Graham' },
  { t: 'In the short run, the market is a voting machine. In the long run, it is a weighing machine.', a: 'Benjamin Graham' },
  { t: 'I will tell you how to become rich. Be fearful when others are greedy.', a: 'Warren Buffett' },
  { t: 'You only have to do a very few things right in your life so long as you don\'t do too many things wrong.', a: 'Warren Buffett' },
  { t: 'The most important quality for an investor is temperament, not intellect.', a: 'Warren Buffett' },
  { t: 'October. This is one of the peculiarly dangerous months. The others are July, January, September…', a: 'Mark Twain' },
  { t: 'Bull markets are born on pessimism, grow on skepticism, mature on optimism, and die on euphoria.', a: 'Sir John Templeton' },
  { t: 'Know what you own, and know why you own it.', a: 'Peter Lynch' },
  { t: 'The four most expensive words in the English language are "this time it\'s different".', a: 'Sir John Templeton' },
  { t: 'Discipline is the bridge between goals and accomplishment.', a: 'Jim Rohn' },
  { t: 'How many millionaires do you know who have become wealthy by investing in savings accounts?', a: 'Robert G. Allen' },
  { t: 'Successful investing takes time, discipline and patience.', a: 'Warren Buffett' },
  { t: 'The goal of a successful trader is to make the best trades. Money is secondary.', a: 'Alexander Elder' },
  { t: 'Don\'t look for the needle in the haystack. Just buy the haystack.', a: 'John C. Bogle' },
  { t: 'The trick is not to learn to trust your gut feelings, but rather to discipline yourself to ignore them.', a: 'Peter Lynch' },
  { t: 'It\'s not how much money you make, but how much money you keep.', a: 'Robert Kiyosaki' },
  { t: 'The market does not beat them. They beat themselves.', a: 'Jesse Livermore' },
  { t: 'There is a time to go long, a time to go short and a time to go fishing.', a: 'Jesse Livermore' },
  { t: 'Every battle is won before it is ever fought.', a: 'Sun Tzu' },
  { t: 'Opportunities multiply as they are seized.', a: 'Sun Tzu' },
  { t: 'The way to get started is to quit talking and begin doing.', a: 'Walt Disney' },
  { t: 'Patience is a key element of success.', a: 'Bill Gates' },
  { t: 'Do not save what is left after spending, but spend what is left after saving.', a: 'Warren Buffett' },
  { t: 'The individual investor should act consistently as an investor and not as a speculator.', a: 'Benjamin Graham' },
  { t: 'I\'m only rich because I know when I\'m wrong.', a: 'George Soros' },
  { t: 'Markets are constantly in a state of uncertainty and flux.', a: 'George Soros' },
  { t: 'When you\'re wrong, the only thing to do is to be wrong in a hurry.', a: 'David Tepper' },
  { t: 'Big money is not in the buying and selling, but in the waiting.', a: 'Charlie Munger' },
  { t: 'The first rule is not to lose. The second rule is not to forget the first rule.', a: 'Warren Buffett' },
  { t: 'A market is the combined behaviour of thousands of people responding to information.', a: 'Bill Williams' },
  { t: 'Risk management is the most important thing to be well understood.', a: 'Bruce Kovner' },
];

let _quoteIdx   = -1;
let _quoteOrder = [];

function _shuffleQuotes() {
  _quoteOrder = QUOTES.map((_, i) => i);
  for (let i = _quoteOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [_quoteOrder[i], _quoteOrder[j]] = [_quoteOrder[j], _quoteOrder[i]];
  }
  _quoteIdx = -1;
}

function _nextQuote() {
  _quoteIdx++;
  if (_quoteIdx >= _quoteOrder.length) _shuffleQuotes(), _quoteIdx = 0;
  return QUOTES[_quoteOrder[_quoteIdx]];
}

function rotateQuote() {
  const box  = document.querySelector('.quote-box');
  const tEl  = document.getElementById('quote-text');
  const aEl  = document.getElementById('quote-attr');
  if (!box || !tEl || !aEl) return;

  const q = _nextQuote();
  box.classList.add('fading');
  setTimeout(() => {
    tEl.textContent = '“' + q.t + '”';
    aEl.textContent = '— ' + q.a;
    box.classList.remove('fading');
  }, 320);
}

_shuffleQuotes();
rotateQuote();
setInterval(rotateQuote, 12_000);

// ─── Helpers ─────────────────────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }

function setEl(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function fmtNumber(n, decimals = 2) {
  if (n === null || n === undefined || isNaN(n)) return '──';
  return parseFloat(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function fmtPrice(n) {
  const v = parseFloat(n);
  if (v >= 10000) return '$' + fmtNumber(v, 0);
  if (v >= 1000)  return '$' + fmtNumber(v, 1);
  return '$' + fmtNumber(v, 2);
}

function setSentiment(baseId, val, label, cls) {
  const valEl  = $(`${baseId}-val`);
  const badge  = $(`${baseId}-badge`);
  if (valEl)  valEl.textContent = val;
  if (badge) { badge.textContent = label; badge.className = `s-badge ${cls}`; }
}

function fundingClass(rate) {
  if (rate > 0.05)  return { cls: 'bullish',  label: 'High' };
  if (rate > 0.01)  return { cls: 'elevated', label: 'Pos' };
  if (rate > -0.01) return { cls: 'neutral',  label: 'Flat' };
  if (rate > -0.05) return { cls: 'warning',  label: 'Neg' };
  return                   { cls: 'bearish',  label: 'Low' };
}

// ─── Canvas helpers ──────────────────────────────────────────────────────────
// Single DPR-aware setup used by every canvas widget (gauge, forecast, OI, sparklines).
// Returns {ctx, W, H} or null if the canvas isn't laid out yet.
function setupCanvas(canvas) {
  if (!canvas) return null;
  const W = canvas.offsetWidth, H = canvas.offsetHeight;
  if (!W || !H) return null;
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  return { ctx, W, H };
}

// Toggles the active state on BTC/ETH coin buttons (used by heatmap, OI, forecast).
function setActiveCoinBtn(prefix, coin) {
  ['BTC', 'ETH'].forEach(c => {
    const b = document.getElementById(`${prefix}-${c.toLowerCase()}`);
    if (b) b.classList.toggle('active', c === coin);
  });
}

// ─── Sentiment AI engine ──────────────────────────────────────────────────────
// Tracks raw values from every metric fetch; after each update runs a
// cross-signal analysis to generate a market regime badge + 2-line narrative.

const _ss = {           // _sentimentState — raw numbers, null until fetched
  vix:      null,
  btcDom:   null,
  btcLS:    null,  ethLS:    null,
  btcFund:  null,  ethFund:  null,
  putCall:  null,
};

function _sentimentAnalysis() {
  const s = _ss;
  const ready = Object.values(s).filter(v => v !== null).length;
  if (ready < 2) return;   // not enough data yet

  // ── Score each signal (-2 … +2) ──────────────────────────────────────────
  let bull = 0, bear = 0;

  if (s.vix     !== null) { if (s.vix < 15) bull++; else if (s.vix > 25) bear++; if (s.vix > 32) bear++; }
  if (s.btcFund !== null) { if (s.btcFund > 0.05) bear++; else if (s.btcFund > 0 && s.btcFund < 0.03) bull++; else if (s.btcFund < -0.01) bear++; }
  if (s.btcLS   !== null) { if (s.btcLS > 1.2) bull++; else if (s.btcLS < 0.82) bear++; }
  if (s.putCall !== null) { if (s.putCall > 1.15) bear++; else if (s.putCall < 0.72) bull++; }
  if (s.btcDom  !== null) { if (s.btcDom > 56) bull++; else if (s.btcDom < 42) bear++; }

  const net = bull - bear;
  let regime, cls;
  if      (net >=  3) { regime = 'Risk On';      cls = 'bullish';  }
  else if (net >=  1) { regime = 'Bullish Lean'; cls = 'elevated'; }
  else if (net <=  -3) { regime = 'Risk Off';    cls = 'bearish';  }
  else if (net <=  -1) { regime = 'Bearish Lean';cls = 'warning';  }
  else                 { regime = 'Neutral';      cls = 'neutral';  }

  // ── Narrative (pick the 2 most informative sentences) ─────────────────────
  const lines = [];

  // Funding — almost always the primary crypto-native signal
  if (s.btcFund !== null) {
    const f = s.btcFund;
    if (f > 0.06)
      lines.push(`Funding is overheating at ${f.toFixed(4)}% — crowded longs are at high risk of a forced unwind.`);
    else if (f > 0.02)
      lines.push(`Positive funding (${f.toFixed(4)}%) reflects a healthy bullish tilt without excessive leverage buildup.`);
    else if (f >= 0 && f <= 0.02)
      lines.push(`Flat funding near zero signals no strong directional conviction in the futures market.`);
    else if (f < -0.02)
      lines.push(`Negative funding (${f.toFixed(4)}%) — shorts are dominant; any bullish catalyst risks a sharp short squeeze.`);
    else
      lines.push(`Mildly negative funding — perps lean short, watch for a squeeze if spot demand picks up.`);
  }

  // Cross-signal combos (high information, picked before individual signals)
  if (s.vix !== null && s.btcFund !== null) {
    if (s.vix > 25 && s.btcFund > 0.03)
      lines.push(`Dangerous combo: macro stress (VIX ${s.vix.toFixed(1)}) alongside overleveraged longs — a risk-off move could cascade quickly.`);
    else if (s.vix > 25 && s.btcFund < 0)
      lines.push(`VIX elevated at ${s.vix.toFixed(1)} with negative funding — macro headwinds and short-side control; caution warranted.`);
    else if (s.vix < 16 && s.btcFund > 0.04)
      lines.push(`Calm macro (VIX ${s.vix.toFixed(1)}) but funding running hot — complacent longs are the key vulnerability here.`);
    else if (s.vix < 16 && s.btcFund < 0)
      lines.push(`Low VIX (${s.vix.toFixed(1)}) and negative funding together are a classic short-squeeze setup.`);
  }

  // Fallback individual signals if we have fewer than 2 lines
  if (lines.length < 2 && s.vix !== null) {
    if (s.vix > 28)
      lines.push(`VIX at ${s.vix.toFixed(1)} reflects significant macro stress — crypto tends to correlate with equity sell-offs at these levels.`);
    else if (s.vix < 14)
      lines.push(`Subdued VIX (${s.vix.toFixed(1)}) signals calm macro conditions, broadly supportive of risk assets.`);
  }
  if (lines.length < 2 && s.btcLS !== null) {
    const ls = s.btcLS;
    if (ls > 1.25)
      lines.push(`L/S ratio at ${ls.toFixed(2)} shows retail is heavily long — a potential stop-hunt zone below current price.`);
    else if (ls < 0.80)
      lines.push(`L/S at ${ls.toFixed(2)} shows a majority positioned short — mechanical squeeze risk if price reclaims key levels.`);
  }
  if (lines.length < 2 && s.putCall !== null) {
    const pc = s.putCall;
    if (pc > 1.1)
      lines.push(`Put/call at ${pc.toFixed(2)} — options traders are skewing defensively; institutional hedging activity is elevated.`);
    else if (pc < 0.72)
      lines.push(`Put/call at ${pc.toFixed(2)} with calls dominating — speculative optimism in derivatives, watch for complacency.`);
  }

  // ── Update DOM ─────────────────────────────────────────────────────────────
  const regimeEl = document.getElementById('sent-ai-regime');
  const textEl   = document.getElementById('sent-ai-text');
  if (regimeEl) { regimeEl.textContent = regime; regimeEl.className = `sent-ai-regime ${cls}`; }
  if (textEl)   textEl.textContent = lines.slice(0, 2).join(' ') || 'Insufficient data for analysis.';
}

// ─── Binance: prices ──────────────────────────────────────────────────────────
async function fetchPrices() {
  try {
    const [btcR, ethR] = await Promise.all([
      fetch('https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=BTCUSDT'),
      fetch('https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=ETHUSDT')
    ]);
    const btc = await btcR.json();
    const eth = await ethR.json();

    // BTC
    setEl('btc-price', fmtPrice(btc.lastPrice));
    const btcPct = parseFloat(btc.priceChangePercent);
    const btcChEl = $('btc-change');
    if (btcChEl) {
      btcChEl.textContent = (btcPct >= 0 ? '▲ +' : '▼ ') + fmtNumber(btcPct) + '%';
      btcChEl.className = 'panel-change ' + (btcPct >= 0 ? 'positive' : 'negative');
    }
    setEl('btc-high', fmtPrice(btc.highPrice));
    setEl('btc-low',  fmtPrice(btc.lowPrice));

    // ETH
    setEl('eth-price', fmtPrice(eth.lastPrice));
    const ethPct = parseFloat(eth.priceChangePercent);
    const ethChEl = $('eth-change');
    if (ethChEl) {
      ethChEl.textContent = (ethPct >= 0 ? '▲ +' : '▼ ') + fmtNumber(ethPct) + '%';
      ethChEl.className = 'panel-change ' + (ethPct >= 0 ? 'positive' : 'negative');
    }
    setEl('eth-high', fmtPrice(eth.highPrice));
    setEl('eth-low',  fmtPrice(eth.lowPrice));
  } catch (e) {
    console.warn('[MEEZUS] Price fetch failed:', e.message);
  }
}

// ─── Binance: funding rates ───────────────────────────────────────────────────
async function fetchFunding() {
  try {
    const [btcR, ethR] = await Promise.all([
      fetch('https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=1'),
      fetch('https://fapi.binance.com/fapi/v1/fundingRate?symbol=ETHUSDT&limit=1')
    ]);
    const btcD = await btcR.json();
    const ethD = await ethR.json();

    if (btcD[0]) {
      const rate = parseFloat(btcD[0].fundingRate) * 100;
      const el = $('btc-funding');
      if (el) { el.textContent = fmtNumber(rate, 4) + '%'; el.className = rate >= 0 ? 'positive' : 'negative'; }
      const { cls, label } = fundingClass(rate);
      setSentiment('btc-fund', fmtNumber(rate, 4) + '%', label, cls);
      _ss.btcFund = rate;
    }
    if (ethD[0]) {
      const rate = parseFloat(ethD[0].fundingRate) * 100;
      const el = $('eth-funding');
      if (el) { el.textContent = fmtNumber(rate, 4) + '%'; el.className = rate >= 0 ? 'positive' : 'negative'; }
      const { cls, label } = fundingClass(rate);
      setSentiment('eth-fund', fmtNumber(rate, 4) + '%', label, cls);
      _ss.ethFund = rate;
    }
    _sentimentAnalysis();
  } catch (e) {
    console.warn('[MEEZUS] Funding fetch failed:', e.message);
  }
}

// ─── Binance: long/short ratio ────────────────────────────────────────────────
async function fetchLongShort() {
  try {
    const [btcR, ethR] = await Promise.all([
      fetch('https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=5m&limit=1'),
      fetch('https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=ETHUSDT&period=5m&limit=1')
    ]);
    const btcD = await btcR.json();
    const ethD = await ethR.json();

    function applyLS(data, panelId, sentimentId) {
      if (!data[0]) return;
      const ratio   = parseFloat(data[0].longShortRatio);
      const longPct = (parseFloat(data[0].longAccount) * 100).toFixed(1);
      const el = $(panelId);
      if (el) {
        el.textContent = fmtNumber(ratio, 2) + ' (' + longPct + '%L)';
        el.className = ratio >= 1 ? 'positive' : 'negative';
      }
      const cls   = ratio > 1.15 ? 'bullish' : ratio < 0.85 ? 'bearish' : 'neutral';
      const label = ratio > 1.15 ? 'Longs'   : ratio < 0.85 ? 'Shorts'  : 'Even';
      setSentiment(sentimentId, fmtNumber(ratio, 2), label, cls);
    }

    if (btcD[0]) _ss.btcLS = parseFloat(btcD[0].longShortRatio);
    if (ethD[0]) _ss.ethLS = parseFloat(ethD[0].longShortRatio);
    applyLS(btcD, 'btc-ls', 'btc-ls');
    applyLS(ethD, 'eth-ls', 'eth-ls');
    _sentimentAnalysis();
  } catch (e) {
    console.warn('[MEEZUS] L/S fetch failed:', e.message);
  }
}

// ─── Fear & Greed ─────────────────────────────────────────────────────────────
// ─── Fear & Greed gauge ────────────────────────────────────────────────────────
const FG_SEGS = [
  [0,  25,  '#e03030'],  // extreme fear
  [25, 45,  '#ff7800'],  // fear
  [45, 55,  '#ffc400'],  // neutral
  [55, 75,  '#82c91e'],  // greed
  [75, 100, '#00d68f'],  // extreme greed
];

function _fgColor(val) {
  return (FG_SEGS.find(([lo, hi]) => val >= lo && val <= hi) ?? FG_SEGS[2])[2];
}

// Gauge angle: value 0 → left (π), value 100 → right (2π).
// Traversal: clockwise in canvas (left → top → right).
function _fgAngle(v) { return Math.PI * (1 + v / 100); }

let _fgAnimFrame = null;
let _fgCurrent   = 0;   // animated display value

function _drawFGGauge(targetVal) {
  const setup = setupCanvas(document.getElementById('fg-canvas'));
  if (!setup) return;
  const { ctx, W, H } = setup;
  ctx.save();

  // Pivot sits near the bottom-centre; arc rises above it
  const cx   = W / 2;
  const cy   = H * 0.90;
  const R    = Math.min(W * 0.40, cy * 0.88);
  const ARC  = R * 0.155;         // arc stroke width
  const RMID = R;                  // stroke drawn at radius R (centre of stroke)

  // ── Background ring ──────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.arc(cx, cy, RMID, Math.PI, 2 * Math.PI, false);
  ctx.strokeStyle = '#0c1823';
  ctx.lineWidth   = ARC + 4;
  ctx.lineCap     = 'butt';
  ctx.stroke();

  // ── Colored segments ─────────────────────────────────────────────────────
  ctx.lineWidth = ARC;
  FG_SEGS.forEach(([v1, v2, color]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, RMID, _fgAngle(v1), _fgAngle(v2), false);
    ctx.strokeStyle = color;
    ctx.lineCap     = 'butt';
    ctx.stroke();
  });

  // Rounded end caps (circles at left=0 and right=100 endpoints)
  function capAt(v, color) {
    const a = _fgAngle(v);
    ctx.beginPath();
    ctx.arc(cx + RMID * Math.cos(a), cy + RMID * Math.sin(a), ARC / 2 - 0.5, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  }
  capAt(0,   FG_SEGS[0][2]);
  capAt(100, FG_SEGS[4][2]);

  // ── Zone divider ticks ───────────────────────────────────────────────────
  [25, 45, 55, 75].forEach(v => {
    const a  = _fgAngle(v);
    const r0 = RMID - ARC / 2 - 1;
    const r1 = RMID + ARC / 2 + 1;
    ctx.beginPath();
    ctx.moveTo(cx + r0 * Math.cos(a), cy + r0 * Math.sin(a));
    ctx.lineTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
    ctx.strokeStyle = '#09111a';
    ctx.lineWidth   = 2;
    ctx.lineCap     = 'butt';
    ctx.stroke();
  });

  // ── Needle ───────────────────────────────────────────────────────────────
  const needleAngle = _fgAngle(_fgCurrent);
  const nLen  = RMID - ARC * 0.6;
  const nx    = cx + nLen * Math.cos(needleAngle);
  const ny    = cy + nLen * Math.sin(needleAngle);

  // Needle shadow
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(nx, ny);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth   = 4;
  ctx.lineCap     = 'round';
  ctx.stroke();

  // Needle line
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(nx, ny);
  ctx.strokeStyle = '#c8ddf0';
  ctx.lineWidth   = 2.5;
  ctx.stroke();

  // Pivot circle
  const pivR = ARC * 0.32;
  ctx.beginPath();
  ctx.arc(cx, cy, pivR + 2, 0, 2 * Math.PI);
  ctx.fillStyle = '#060a0f';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, pivR, 0, 2 * Math.PI);
  ctx.fillStyle = '#c8ddf0';
  ctx.fill();

  // ── Value badge on needle ────────────────────────────────────────────────
  const bLen  = RMID * 0.62;
  const bx    = cx + bLen * Math.cos(needleAngle);
  const by    = cy + bLen * Math.sin(needleAngle);
  const bR    = ARC * 0.80;
  const bCol  = _fgColor(Math.round(_fgCurrent));

  ctx.beginPath();
  ctx.arc(bx, by, bR + 1.5, 0, 2 * Math.PI);
  ctx.fillStyle = '#060a0f';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(bx, by, bR, 0, 2 * Math.PI);
  ctx.fillStyle   = bCol + '22';    // tinted fill
  ctx.fill();
  ctx.strokeStyle = bCol;
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  ctx.fillStyle    = '#ffffff';
  ctx.font         = `bold ${Math.round(bR * 1.05)}px JetBrains Mono, monospace`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(Math.round(_fgCurrent), bx, by);

  ctx.restore();
}

// Animate needle from current position to target
function _fgAnimateTo(target) {
  if (_fgAnimFrame) cancelAnimationFrame(_fgAnimFrame);
  const start = _fgCurrent;
  const delta = target - start;
  const dur   = 900;   // ms
  const t0    = performance.now();

  function step(now) {
    const p = Math.min(1, (now - t0) / dur);
    // Ease out cubic
    const e = 1 - Math.pow(1 - p, 3);
    _fgCurrent = start + delta * e;
    _drawFGGauge(target);
    if (p < 1) _fgAnimFrame = requestAnimationFrame(step);
  }
  _fgAnimFrame = requestAnimationFrame(step);
}

async function fetchFearGreed() {
  try {
    const res  = await fetch('https://api.alternative.me/fng/?limit=1');
    const data = await res.json();
    if (!data.data?.[0]) return;

    const val   = parseInt(data.data[0].value);
    const label = data.data[0].value_classification.replace(/\b\w/g, c => c.toUpperCase());
    const color = _fgColor(val);

    // Update text elements
    const valEl = $('fg-value');
    if (valEl) { valEl.textContent = val; valEl.style.color = color; }

    const lblEl = $('fg-label');
    if (lblEl) { lblEl.textContent = label; lblEl.style.color = color; }

    // Header quick-read
    const hdr = $('fear-greed-header');
    if (hdr) {
      hdr.textContent = val + ' · ' + label.split(' ')[0];
      hdr.style.color = color;
    }

    // Animate gauge needle
    _fgAnimateTo(val);

  } catch (e) {
    console.warn('[MEEZUS] F&G fetch failed:', e.message);
  }
}

// ─── CoinGecko: BTC dominance ─────────────────────────────────────────────────
async function fetchDominance() {
  try {
    const res  = await fetch('https://api.coingecko.com/api/v3/global');
    const data = await res.json();
    const dom  = data.data.market_cap_percentage.btc.toFixed(1);
    setEl('btc-dominance', dom + '%');
    const cls   = parseFloat(dom) > 55 ? 'bullish' : parseFloat(dom) < 45 ? 'bearish' : 'neutral';
    const label = parseFloat(dom) > 55 ? 'HIGH'    : parseFloat(dom) < 45 ? 'LOW'     : 'MID';
    setSentiment('dom', dom + '%', label, cls);
    _ss.btcDom = parseFloat(dom);
    _sentimentAnalysis();
  } catch (e) {
    console.warn('[MEEZUS] Dominance fetch failed:', e.message);
  }
}

// ─── VIX (via Yahoo Finance proxy) ───────────────────────────────────────────
async function fetchVIX() {
  try {
    const proxy = 'https://api.allorigins.win/raw?url=';
    const url   = encodeURIComponent('https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=1d');
    const res   = await fetch(proxy + url);
    const data  = await res.json();
    const price = data.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (!price) return;

    const cls   = price < 15 ? 'bullish' : price < 20 ? 'neutral' : price < 30 ? 'elevated' : 'bearish';
    const label = price < 15 ? 'Low'     : price < 20 ? 'Normal'  : price < 30 ? 'High'     : 'Crit';
    setSentiment('vix', fmtNumber(price, 2), label, cls);
    _ss.vix = price;
    _sentimentAnalysis();
  } catch (e) {
    console.warn('[MEEZUS] VIX fetch failed:', e.message);
    setSentiment('vix', 'N/A', 'N/A', 'neutral');
  }
}

// ─── Put/Call ratio (CBOE) ────────────────────────────────────────────────────
async function fetchPutCall() {
  try {
    const proxy = 'https://api.allorigins.win/raw?url=';
    const url   = encodeURIComponent('https://cdn.cboe.com/api/global/us_options_api/overview/options_volume.json');
    const res   = await fetch(proxy + url);
    const data  = await res.json();

    // Try to find total P/C ratio in response
    const items = data?.data ?? data;
    if (Array.isArray(items)) {
      const total = items.find(d => (d.name || d.symbol || '').toLowerCase().includes('total'));
      if (total && total.put_volume && total.call_volume) {
        const ratio = (total.put_volume / total.call_volume).toFixed(2);
        const cls   = parseFloat(ratio) > 1.2 ? 'bearish' : parseFloat(ratio) < 0.7 ? 'bullish' : 'neutral';
        const label = parseFloat(ratio) > 1.2 ? 'Puts'    : parseFloat(ratio) < 0.7 ? 'Calls'   : 'Neutral';
        setSentiment('pc', ratio, label, cls);
        _ss.putCall = parseFloat(ratio);
        _sentimentAnalysis();
        return;
      }
    }
    setSentiment('pc', 'N/A', 'N/A', 'neutral');
  } catch (e) {
    console.warn('[MEEZUS] P/C fetch failed:', e.message);
    setSentiment('pc', 'N/A', 'N/A', 'neutral');
  }
}

// ─── News panels — fetched via server.py /api/news ───────────────────────────
// server.py handles RSS parsing in Python (no CORS, no allorigins.win flakiness)

function _renderNewsFeed(feedElId, tagElId, data) {
  const feedEl = $(feedElId);
  const tagEl  = $(tagElId);
  if (!feedEl) return;

  if (tagEl && data.source) tagEl.textContent = data.source;

  if (!data.items?.length) {
    feedEl.innerHTML = '<div class="feed-error">No items in feed</div>';
    return;
  }

  feedEl.innerHTML = data.items.map(item => {
    const d    = item.date ? new Date(item.date) : null;
    const time = d && !isNaN(d) ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : '--:--';
    const date = d && !isNaN(d) ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }) : '';
    const safe = (item.link || '#').replace(/"/g, '&quot;');
    const ts   = date ? `${date} · ${time} UTC` : '';
    return `<div class="news-item" onclick="window.open('${safe}','_blank')">
      ${ts ? `<div class="news-time">${ts}</div>` : ''}
      <div class="news-title">${item.title || ''}</div>
    </div>`;
  }).join('');
}

async function _fetchNewsPanel(type, feedElId, tagElId) {
  const feedEl = $(feedElId);
  if (!feedEl) return;
  feedEl.innerHTML = '<div class="feed-loading">FETCHING FEED…</div>';

  try {
    const res  = await fetch(`/api/news?type=${type}`, { cache: 'no-store' });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    _renderNewsFeed(feedElId, tagElId, data);
  } catch (e) {
    console.warn(`[MEEZUS] News (${type}) failed:`, e.message);
    $(feedElId).innerHTML = '<div class="feed-error">Feed unavailable — is server.py running?</div>';
  }
}

function fetchNews()       { return _fetchNewsPanel('tradfi', 'news-feed',       'news-feed-tag');  }
function fetchCryptoNews() { return _fetchNewsPanel('crypto', 'crypto-news-feed','crypto-news-tag'); }

// ─── YouTube streams — hls.js in-dashboard via local proxy ───────────────────
// Requires server.py to be running: python3 server.py
// server.py calls yt-dlp to extract HLS URLs and proxies all segments.

const _hlsInstances   = {};
const _retryTimers    = {};
const STREAM_RETRY_MS = 20_000;  // auto-retry after fatal error

async function initStream(asset) {
  const videoId = asset === 'btc'
    ? CONFIG?.youtube?.btcStreamId?.trim()
    : CONFIG?.youtube?.ethStreamId?.trim();

  const video   = $(`${asset}-stream-video`);
  const overlay = $(`${asset}-stream-overlay`);
  const msg     = $(`${asset}-stream-msg`);
  const dot     = $(`${asset}-stream-dot`);

  // Destroy any existing hls instance first
  if (_hlsInstances[asset]) {
    _hlsInstances[asset].destroy();
    delete _hlsInstances[asset];
  }
  clearTimeout(_retryTimers[asset]);

  if (!video) return;

  if (!videoId) {
    if (msg) msg.textContent = 'No stream ID set in config.js';
    return;
  }

  if (msg)     msg.textContent = 'Fetching stream URL…';
  if (overlay) overlay.style.display = '';
  if (dot)     { dot.style.background = 'var(--text-faint)'; dot.classList.remove('blink'); }

  let data;
  try {
    const res = await fetch(`/api/stream/${videoId}`);
    data = await res.json();
  } catch (e) {
    if (msg) msg.textContent = 'Server offline — run: python3 server.py';
    scheduleRetry(asset);
    return;
  }

  if (data.error) {
    if (msg) msg.textContent = data.error.slice(0, 80);
    scheduleRetry(asset);
    return;
  }

  if (data.type === 'hls') {
    if (!window.Hls || !Hls.isSupported()) {
      if (msg) msg.textContent = 'HLS not supported — use Chrome or Edge';
      return;
    }

    const hls = new Hls({
      enableWorker:         true,
      lowLatencyMode:       true,
      liveSyncDurationCount: 3,
      liveMaxLatencyDurationCount: 6,
    });
    _hlsInstances[asset] = hls;

    hls.loadSource(data.url);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(() => {});
      if (overlay) overlay.style.display = 'none';
      if (dot) { dot.style.background = 'var(--green)'; dot.classList.add('blink'); }
      console.log(`[MEEZUS] ${asset.toUpperCase()} stream playing`);
    });

    hls.on(Hls.Events.ERROR, (_, errData) => {
      if (!errData.fatal) return;
      console.warn(`[MEEZUS] HLS fatal error (${asset}):`, errData.type, errData.details);
      if (msg) msg.textContent = 'Stream error — refreshing URL…';
      if (overlay) overlay.style.display = '';
      if (dot) { dot.style.background = 'var(--red)'; dot.classList.remove('blink'); }
      hls.destroy();
      delete _hlsInstances[asset];
      // Re-fetch the stream URL (it may have expired) after a short delay
      scheduleRetry(asset, STREAM_RETRY_MS);
    });

  } else if (data.type === 'mp4') {
    video.src = data.url;
    video.play().catch(() => {});
    if (overlay) overlay.style.display = 'none';
    if (dot) { dot.style.background = 'var(--green)'; dot.classList.add('blink'); }
  }
}

function scheduleRetry(asset, delay = STREAM_RETRY_MS) {
  clearTimeout(_retryTimers[asset]);
  _retryTimers[asset] = setTimeout(() => initStream(asset), delay);
}

/** Called by the RETRY button in the overlay */
function retryStream(asset) {
  clearTimeout(_retryTimers[asset]);
  const msg = $(`${asset}-stream-msg`);
  if (msg) msg.textContent = 'Reconnecting…';
  initStream(asset);
}

function loadStreams() {
  initStream('btc');
  initStream('eth');
}

// ─── TradFi panel (Binance Futures) ──────────────────────────────────────────
const TRADFI_ASSETS = [
  { id: 'cl',     symbol: 'CLUSDT',     label: 'CL',     decimals: 3 },
  { id: 'natgas', symbol: 'NATGASUSDT', label: 'NATGAS', decimals: 4 },
  { id: 'spy',    symbol: 'SPYUSDT',    label: 'SPY',    decimals: 2 },
  { id: 'qqq',    symbol: 'QQQUSDT',    label: 'QQQ',    decimals: 2 },
  { id: 'xau',    symbol: 'XAUUSDT',    label: 'XAU',    decimals: 2 },
  { id: 'xag',    symbol: 'XAGUSDT',    label: 'XAG',    decimals: 3 },
];

function drawSparkline(canvasId, closes, isUp) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const rect    = canvas.getBoundingClientRect();
  canvas.width  = rect.width  || canvas.offsetWidth  || 120;
  canvas.height = rect.height || canvas.offsetHeight || 42;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const pts = closes.filter(v => v != null && !isNaN(v));
  if (pts.length < 2) return;

  const min   = Math.min(...pts);
  const max   = Math.max(...pts);
  const range = max - min || 1;
  const pad   = 4;
  const drawH = H - pad * 2;

  const coords = pts.map((v, i) => ({
    x: (i / (pts.length - 1)) * W,
    y: pad + drawH - ((v - min) / range) * drawH
  }));

  const rgb  = isUp ? '0,214,143' : '240,32,80';
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0,   `rgba(${rgb},0.22)`);
  grad.addColorStop(1,   `rgba(${rgb},0)`);

  ctx.beginPath();
  ctx.moveTo(coords[0].x, H);
  coords.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(coords[coords.length - 1].x, H);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(coords[0].x, coords[0].y);
  coords.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.strokeStyle = isUp ? '#00d68f' : '#f02050';
  ctx.lineWidth   = 1.5;
  ctx.lineJoin    = 'round';
  ctx.stroke();

  const last = coords[coords.length - 1];
  ctx.beginPath();
  ctx.arc(last.x, last.y, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = isUp ? '#00d68f' : '#f02050';
  ctx.fill();
}

async function fetchTradFiKlines(symbol) {
  try {
    const res  = await fetch(
      `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=15m&limit=96`
    );
    const data = await res.json();
    return Array.isArray(data) ? data.map(k => parseFloat(k[4])) : []; // close prices
  } catch (_) { return []; }
}

async function updateTradFi() {
  try {
    // Batch 24hr tickers
    const symbols  = TRADFI_ASSETS.map(a => `"${a.symbol}"`).join(',');
    const res      = await fetch(
      `https://fapi.binance.com/fapi/v1/ticker/24hr`
    );
    const allTickers = await res.json();
    const tickerMap  = {};
    allTickers.forEach(t => { tickerMap[t.symbol] = t; });

    // Fetch klines for all assets in parallel
    const klineResults = await Promise.allSettled(
      TRADFI_ASSETS.map(a => fetchTradFiKlines(a.symbol))
    );

    TRADFI_ASSETS.forEach((asset, i) => {
      const t = tickerMap[asset.symbol];
      if (!t) return;

      const price  = parseFloat(t.lastPrice);
      const pct    = parseFloat(t.priceChangePercent);
      const high   = parseFloat(t.highPrice);
      const low    = parseFloat(t.lowPrice);
      const isUp   = pct >= 0;
      const d      = asset.decimals;

      setEl(`tf-${asset.id}-price`, price.toLocaleString('en-US', {
        minimumFractionDigits: d, maximumFractionDigits: d
      }));

      const chEl = $(`tf-${asset.id}-change`);
      if (chEl) {
        chEl.textContent = `${isUp ? '▲ +' : '▼ '}${pct.toFixed(2)}%`;
        chEl.className   = `tf-change ${isUp ? 'positive' : 'negative'}`;
      }

      setEl(`tf-${asset.id}-high`, high.toLocaleString('en-US', {
        minimumFractionDigits: d, maximumFractionDigits: d
      }));
      setEl(`tf-${asset.id}-low`, low.toLocaleString('en-US', {
        minimumFractionDigits: d, maximumFractionDigits: d
      }));

      // Sparkline
      if (klineResults[i].status === 'fulfilled') {
        requestAnimationFrame(() =>
          drawSparkline(`tf-${asset.id}-spark`, klineResults[i].value, isUp)
        );
      }
    });

    // Timestamp
    setEl('tradfi-updated', 'Updated ' + new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC'
    }) + ' UTC');

  } catch (e) {
    console.warn('[MEEZUS] TradFi fetch failed:', e.message);
  }
}

// ─── Native Liquidation Heatmap ──────────────────────────────────────────────
// Model (Coinglass-style approximation):
//   1. Pull historical klines at the chosen timeframe.
//   2. For each candle, assume positions were opened at its volume-weighted
//      typical price (HLC/3) — sized by candle volume.
//   3. Distribute that volume across retail-popular leverage tiers
//      (25x / 50x / 75x / 100x / 125x), with weights matching Binance's
//      observed retail distribution.
//   4. Liquidation prices use Binance's actual maintenance-margin schedule
//      for each tier (long: P*(1-1/L + MMR), short: P*(1+1/L - MMR)).
//   5. Each position contributes a horizontal "band" of heat starting at
//      its open and extending forward, decaying exponentially with an
//      expected-holding-time scale that depends on the timeframe
//      (scalpers hold minutes; swing traders hold days/weeks).
//   6. Grid is normalised against 95th-percentile, log-compressed, and
//      rendered via ImageData with a viridis-style colormap.
//   7. White price line + last-price tag overlay on top.

// Retail leverage distribution on Binance USDⓈ-M futures (50–100x dominates).
// MMR is bracket-based, not leverage-based — bracket 0 (notional ≤ 50K USDT,
// where retail lives) is a flat 0.4%. Source: Binance public "Maintenance
// margin tier" tables. So:
//     long_liq  = entry * (1 - 1/L + MMR)
//     short_liq = entry * (1 + 1/L - MMR)
// gives ~0.4% offset at 125x, ~3.6% at 25x — matches what you see on Coinglass.
const HM_MMR = 0.004;
const HM_LEV_TIERS = [
  { L:  25, w: 0.85 },
  { L:  50, w: 1.30 },
  { L:  75, w: 1.05 },
  { L: 100, w: 1.50 },
  { L: 125, w: 0.95 },
];

// Timeframe presets — limit chosen so each TF gives a useful lookback window.
// `holdScale` controls how long forward each position smears (in candles).
const HM_TFS = {
  '1m':  { interval: '1m',  limit: 360, label: '6h',  holdScale: 30,  xLabels: 'time'  },
  '15m': { interval: '15m', limit: 192, label: '48h', holdScale: 24,  xLabels: 'time'  },
  '1h':  { interval: '1h',  limit: 168, label: '7d',  holdScale: 36,  xLabels: 'date'  },
  '4h':  { interval: '4h',  limit: 180, label: '30d', holdScale: 30,  xLabels: 'date'  },
  '1d':  { interval: '1d',  limit: 180, label: '6mo', holdScale: 30,  xLabels: 'month' },
};

let _hmSymbol = (CONFIG?.heatmap?.coin === 'ETH') ? 'ETHUSDT' : 'BTCUSDT';
let _hmTF     = '1h';
let _hmKlines = null;
let _hmReqId  = 0;   // race-guard: drop stale fetches

// User controls
let _hmMode    = 'unswept';   // 'unswept' | 'all'
let _hmSens    = 3;           // 1..5  (3 = neutral)
let _hmMinLev  = 25;          // show only tiers ≥ this leverage
let _hmShowLiq = true;        // overlay real liquidation events

// ── Live liquidation feed ──────────────────────────────────────────────────
// Inspired by MYMDO/CryptoTradingLiquidationMap (MIT). We subscribe to
// Binance's `!forceOrder@arr` stream — every real liquidation across the
// entire Binance Futures market flows through here in real time, free, no
// API key needed. We keep a rolling buffer and overlay them as dots on the
// heatmap (red = long liquidated, green = short liquidated), with size
// proportional to USD value. Auto-reconnects on disconnect.
const _hmLiqs    = [];          // rolling buffer of events
const HM_LIQ_CAP = 10_000;      // hard cap on buffer size
let   _hmWS      = null;
let   _hmWSRetry = 0;

function _hmConnectWS() {
  if (_hmWS) { _hmWS._intentional = true; try { _hmWS.close(); } catch (_) {} _hmWS = null; }
  const ws = new WebSocket('wss://fstream.binance.com/ws/!forceOrder@arr');
  _hmWS = ws;
  ws._intentional = false;

  ws.onopen = () => {
    _hmWSRetry = 0;
    console.log('[MEEZUS] Liquidation feed: connected');
    _hmUpdateLiqDot('live');
  };
  ws.onerror = () => _hmUpdateLiqDot('err');
  ws.onclose = () => {
    if (ws._intentional) return _hmUpdateLiqDot('off');
    _hmUpdateLiqDot('off');
    const delay = Math.min(30_000, 1000 * Math.pow(1.6, _hmWSRetry++));
    console.warn(`[MEEZUS] Liquidation feed reconnecting in ${delay}ms`);
    setTimeout(_hmConnectWS, delay);
  };
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.e !== 'forceOrder') return;
      const o = msg.o;
      // Only keep BTC/ETH USDT-perps — keeps buffer tight + relevant
      if (o.s !== 'BTCUSDT' && o.s !== 'ETHUSDT') return;
      const price = parseFloat(o.ap || o.p);
      const qty   = parseFloat(o.q);
      if (!isFinite(price) || !isFinite(qty)) return;
      _hmLiqs.push({
        symbol: o.s,
        // Binance side semantics:
        //   o.S = 'BUY'  → liquidation order is buying → a SHORT got liquidated
        //   o.S = 'SELL' → liquidation order is selling → a LONG got liquidated
        side: o.S === 'BUY' ? 'short' : 'long',
        price,
        qty,
        usd: price * qty,
        ts:  msg.E || Date.now(),
      });
      if (_hmLiqs.length > HM_LIQ_CAP) _hmLiqs.splice(0, _hmLiqs.length - HM_LIQ_CAP);
      if (o.s === _hmSymbol) {
        _hmUpdateLiqTicker();
        _renderHeatmapThrottled();
      }
    } catch (_) { /* swallow */ }
  };
}

function _hmUpdateLiqDot(state) {
  const el = document.getElementById('hm-liq-dot');
  if (!el) return;
  el.classList.toggle('live', state === 'live');
  el.classList.toggle('off',  state !== 'live');
  el.title = state === 'live' ? 'Live liquidation feed connected'
           : state === 'err'  ? 'Liquidation feed error'
           : 'Liquidation feed disconnected';
}

function _hmUpdateLiqTicker() {
  const el = document.getElementById('hm-liq-ticker');
  if (!el) return;
  const now = Date.now();
  const win = _hmLiqs.filter(e => e.symbol === _hmSymbol && now - e.ts < 60_000);
  if (!win.length) { el.innerHTML = '<span class="hm-liq-mute">no liqs · 60s</span>'; return; }
  let longs = 0, shorts = 0;
  for (const e of win) e.side === 'long' ? longs += e.usd : shorts += e.usd;
  const fmt = v =>
    v >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M'
    : v >= 1e3 ? '$' + (v / 1e3).toFixed(0) + 'K'
    : '$' + v.toFixed(0);
  el.innerHTML =
    `<span class="hm-liq-red">${fmt(longs)} L</span> · ` +
    `<span class="hm-liq-green">${fmt(shorts)} S</span> ` +
    `<span class="hm-liq-mute">60s</span>`;
}

function setHeatmapShowLiq(on) {
  _hmShowLiq = on;
  document.querySelectorAll('.hm-liq-btn').forEach(b =>
    b.classList.toggle('active', (b.dataset.on === 'true') === !!on));
  _renderHeatmap();
}

// View state. Default is auto-anchored to current price ±N% (Coinglass-style).
// `_hmAutoPct` controls the default range; range-preset buttons set this.
// When user pans/zooms manually, _hmViewLo/Hi take over.
let _hmViewLo   = null;
let _hmViewHi   = null;
let _hmAutoPct  = 5;        // default ±5% around current price

function _hmCurrentPrice() {
  return _hmKlines && _hmKlines.length ? _hmKlines[_hmKlines.length - 1].close : null;
}

function _hmGetView() {
  if (!_hmKlines || !_hmKlines.length) return null;
  if (_hmViewLo !== null && _hmViewHi !== null) {
    return { pLo: _hmViewLo, pHi: _hmViewHi };
  }
  const cp = _hmCurrentPrice();
  const margin = cp * (_hmAutoPct / 100);
  return { pLo: cp - margin, pHi: cp + margin };
}

function setHeatmapRange(pct) {
  _hmAutoPct = pct;
  _hmViewLo  = null;
  _hmViewHi  = null;
  document.querySelectorAll('.hm-range-btn').forEach(b =>
    b.classList.toggle('active', +b.dataset.pct === pct));
  _hmUpdateResetBtn();
  _renderHeatmap();
}

function _hmResetView() {
  _hmViewLo = null;
  _hmViewHi = null;
  _hmUpdateResetBtn();
  _renderHeatmap();
}

function _hmUpdateResetBtn() {
  const btn = document.getElementById('hm-reset-view');
  if (!btn) return;
  btn.style.display = (_hmViewLo === null && _hmViewHi === null) ? 'none' : '';
}

// rAF-throttled render — used during wheel/drag for smoothness
let _hmRenderPending = false;
function _renderHeatmapThrottled() {
  if (_hmRenderPending) return;
  _hmRenderPending = true;
  requestAnimationFrame(() => {
    _hmRenderPending = false;
    _renderHeatmap();
  });
}

// ── Cursor overlay (crosshair + price/time pills) ────────────────────────
// The heatmap render fills in `_hmViewport` with the geometry it just used.
// The cursor overlay reads from that to compute price/time at the mouse and
// draws on a separate canvas layered above the heatmap.
let _hmViewport      = null;
let _hmCursorClient  = null;
let _hmCursorPending = false;

function _hmScheduleCursor() {
  if (_hmCursorPending) return;
  _hmCursorPending = true;
  requestAnimationFrame(() => {
    _hmCursorPending = false;
    _hmDrawCursor();
  });
}

function _hmDrawCursor() {
  const canvas = document.getElementById('heatmap-cursor-canvas');
  const setup  = setupCanvas(canvas);    // clears + DPR
  if (!setup) return;
  if (!_hmCursorClient || !_hmViewport)   return;   // off-canvas or no render yet

  const { ctx } = setup;
  const vp = _hmViewport;
  const rect = canvas.getBoundingClientRect();
  const mx = _hmCursorClient.x - rect.left;
  const my = _hmCursorClient.y - rect.top;

  // Bail if cursor is in the axis gutters, not over the plot
  if (mx < vp.PAD.l || mx > vp.PAD.l + vp.plotW ||
      my < vp.PAD.t || my > vp.PAD.t + vp.plotH) return;

  // Reverse-map cursor → price + timestamp
  const yFrac = (my - vp.PAD.t) / vp.plotH;
  const price = vp.pHi - yFrac * (vp.pHi - vp.pLo);
  const xFrac = (mx - vp.PAD.l) / vp.plotW;
  const ts    = vp.tStart + xFrac * (vp.tEnd - vp.tStart);
  const pct   = ((price - vp.cp) / vp.cp) * 100;

  const sysFont = getComputedStyle(document.body).fontFamily;

  // ── Crosshair lines (thin, dashed, low-alpha) ─────────────────────────
  ctx.save();
  ctx.setLineDash([2, 3]);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth   = 0.7;
  ctx.beginPath();
  ctx.moveTo(vp.PAD.l, my);                    ctx.lineTo(vp.PAD.l + vp.plotW, my);
  ctx.moveTo(mx,        vp.PAD.t);             ctx.lineTo(mx, vp.PAD.t + vp.plotH);
  ctx.stroke();
  ctx.restore();

  // ── Price pill at cursor ──────────────────────────────────────────────
  const sign     = pct >= 0 ? '+' : '';
  const priceStr = _hmPriceLabel(price, vp.pHi - vp.pLo);
  const pctStr   = `${sign}${pct.toFixed(Math.abs(pct) < 1 ? 2 : 1)}%`;
  const text     = `${priceStr}  ${pctStr}`;

  ctx.font = `600 11px ${sysFont}`;
  const textW = ctx.measureText(text).width;
  const pillW = textW + 14;
  const pillH = 20;
  // Flip side if too close to right edge
  const flip  = (mx + 12 + pillW) > (vp.PAD.l + vp.plotW);
  const pillX = flip ? (mx - 12 - pillW) : (mx + 12);
  const pillY = Math.max(vp.PAD.t + 1, Math.min(vp.PAD.t + vp.plotH - pillH - 1, my - pillH / 2));

  ctx.fillStyle   = 'rgba(10,4,25,0.94)';
  ctx.strokeStyle = pct > 0 ? 'rgba(48,217,123,0.7)' : pct < 0 ? 'rgba(255,69,58,0.7)' : 'rgba(100,210,255,0.7)';
  ctx.lineWidth   = 1;
  if (ctx.roundRect) {
    ctx.beginPath(); ctx.roundRect(pillX, pillY, pillW, pillH, 5);
    ctx.fill(); ctx.stroke();
  } else {
    ctx.fillRect(pillX, pillY, pillW, pillH);
  }

  // Two-tone text: price in white, % in directional color
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = '#fff';
  ctx.fillText(priceStr, pillX + 7, pillY + pillH / 2);
  const priceW = ctx.measureText(priceStr).width;
  ctx.fillStyle = pct > 0 ? '#30d97b' : pct < 0 ? '#ff453a' : '#64d2ff';
  ctx.fillText('  ' + pctStr, pillX + 7 + priceW, pillY + pillH / 2);

  // ── Time pill below cursor on X axis ──────────────────────────────────
  const d = new Date(ts);
  const cfg = HM_TFS[_hmTF];
  let timeStr;
  if (cfg.xLabels === 'time') {
    timeStr = d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  } else if (cfg.xLabels === 'date') {
    timeStr = d.toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  } else {
    timeStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  ctx.font = `500 10px ${sysFont}`;
  const tW    = ctx.measureText(timeStr).width;
  const tPW   = tW + 12;
  const tPH   = 16;
  const tPX   = Math.max(vp.PAD.l + 2, Math.min(vp.PAD.l + vp.plotW - tPW - 2, mx - tPW / 2));
  const tPY   = vp.PAD.t + vp.plotH + 3;

  ctx.fillStyle   = 'rgba(10,4,25,0.94)';
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth   = 0.7;
  if (ctx.roundRect) {
    ctx.beginPath(); ctx.roundRect(tPX, tPY, tPW, tPH, 4);
    ctx.fill(); ctx.stroke();
  } else {
    ctx.fillRect(tPX, tPY, tPW, tPH);
  }
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(timeStr, tPX + tPW / 2, tPY + tPH / 2);
}

function _hmAttachInteractions() {
  const canvas = document.getElementById('heatmap-canvas');
  if (!canvas || canvas.dataset.bound === '1') return;
  canvas.dataset.bound = '1';
  canvas.style.cursor = 'grab';

  // ── Wheel = zoom (centered on cursor) ────────────────────────────────────
  canvas.addEventListener('wheel', e => {
    if (!_hmKlines) return;
    e.preventDefault();
    const view = _hmGetView();
    if (!view) return;
    const rect = canvas.getBoundingClientRect();
    const yFrac = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const range = view.pHi - view.pLo;
    const priceAtCursor = view.pHi - yFrac * range;

    const factor   = e.deltaY > 0 ? 1.18 : 1 / 1.18;
    const newRange = Math.max(range * factor, 0.0001 * priceAtCursor);

    _hmViewHi = priceAtCursor + yFrac * newRange;
    _hmViewLo = _hmViewHi - newRange;
    _hmUpdateResetBtn();
    _renderHeatmapThrottled();
  }, { passive: false });

  // ── Drag = pan ─────────────────────────────────────────────────────────
  let dragging = false;
  let dragStartY = 0;
  let dragLo = 0, dragHi = 0;

  canvas.addEventListener('mousedown', e => {
    if (e.button !== 0 || !_hmKlines) return;
    e.preventDefault();
    const view = _hmGetView();
    if (!view) return;
    dragging   = true;
    dragStartY = e.clientY;
    dragLo     = view.pLo;
    dragHi     = view.pHi;
    canvas.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const rect = canvas.getBoundingClientRect();
    const dyFrac = (e.clientY - dragStartY) / rect.height;
    const range  = dragHi - dragLo;
    // Drag down → content follows cursor down → top reveals higher prices
    _hmViewHi = dragHi + dyFrac * range;
    _hmViewLo = _hmViewHi - range;
    _hmUpdateResetBtn();
    _renderHeatmapThrottled();
  });

  window.addEventListener('mouseup', () => {
    if (dragging) {
      dragging = false;
      canvas.style.cursor = 'grab';
    }
  });

  // Double-click = reset auto-fit
  canvas.addEventListener('dblclick', () => _hmResetView());

  // ── Crosshair tracking ───────────────────────────────────────────────
  canvas.addEventListener('mousemove', e => {
    _hmCursorClient = { x: e.clientX, y: e.clientY };
    _hmScheduleCursor();
  });
  canvas.addEventListener('mouseleave', () => {
    _hmCursorClient = null;
    _hmScheduleCursor();
  });
}

function setHeatmapResetView() { _hmResetView(); }

function setHeatmapMode(mode) {
  _hmMode = mode;
  document.querySelectorAll('.hm-mode-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === mode));
  _renderHeatmap();
}
function setHeatmapSens(v) {
  _hmSens = v;
  document.querySelectorAll('.hm-sens-dot').forEach(b =>
    b.classList.toggle('active', +b.dataset.v === v));
  _renderHeatmap();
}
function setHeatmapMinLev(L) {
  _hmMinLev = L;
  document.querySelectorAll('.hm-lev-btn').forEach(b =>
    b.classList.toggle('active', +b.dataset.lev === L));
  _renderHeatmap();
}

function setHeatmapCoin(coin) {
  _hmSymbol = coin === 'ETH' ? 'ETHUSDT' : 'BTCUSDT';
  setActiveCoinBtn('hm', coin);
  _hmViewLo = _hmViewHi = null;   // reset view on coin switch
  _hmUpdateResetBtn();
  fetchHeatmap();
}

function setHeatmapTF(tf) {
  if (!HM_TFS[tf]) return;
  _hmTF = tf;
  document.querySelectorAll('#hm-tf-group .tf-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tf === tf);
  });
  _hmViewLo = _hmViewHi = null;   // reset view on TF switch
  _hmUpdateResetBtn();
  fetchHeatmap();
}

async function fetchHeatmap() {
  const reqId = ++_hmReqId;
  const cfg   = HM_TFS[_hmTF];
  _drawHmStatus(`Loading ${cfg.label} · ${_hmSymbol.replace('USDT','')}…`);
  try {
    const res = await fetch(
      `https://fapi.binance.com/fapi/v1/klines?symbol=${_hmSymbol}&interval=${cfg.interval}&limit=${cfg.limit}`,
      { cache: 'no-store' }
    );
    const raw = await res.json();
    if (reqId !== _hmReqId) return;   // stale response, ignore
    if (!Array.isArray(raw) || raw.length < 4) throw new Error('bad response');
    _hmKlines = raw.map(k => ({
      ts:    k[0],
      open:  parseFloat(k[1]),
      high:  parseFloat(k[2]),
      low:   parseFloat(k[3]),
      close: parseFloat(k[4]),
      vol:   parseFloat(k[5]),
    }));
    _hmLastFetch = Date.now();
    _renderHeatmap();
  } catch (e) {
    if (reqId !== _hmReqId) return;
    console.warn('[MEEZUS] Heatmap fetch failed:', e.message);
    _drawHmStatus('Data unavailable · ' + e.message);
  }
}

// Coinglass-style colormap: deep magenta → magenta-pink → orange → yellow → white-hot
// Higher contrast, brighter mid-tones, clearer hot zones.
function _hmColor(t) {
  t = Math.max(0, Math.min(1, t));
  const stops = [
    [0.00, [ 20,   0,  40,   0]],   // transparent
    [0.08, [ 50,   5,  90, 110]],   // deep magenta-purple
    [0.22, [110,  15, 140, 175]],   // magenta
    [0.40, [180,  30, 130, 210]],   // pink
    [0.58, [220,  70,  90, 230]],   // pink-red
    [0.74, [240, 140,  50, 245]],   // orange
    [0.88, [255, 215,  60, 255]],   // gold
    [1.00, [255, 255, 200, 255]],   // white-hot
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i], [t1, c1] = stops[i + 1];
    if (t <= t1) {
      const f = (t - t0) / (t1 - t0);
      const r = Math.round(c0[0] + (c1[0] - c0[0]) * f);
      const g = Math.round(c0[1] + (c1[1] - c0[1]) * f);
      const b = Math.round(c0[2] + (c1[2] - c0[2]) * f);
      const a = Math.round(c0[3] + (c1[3] - c0[3]) * f);
      return [r, g, b, a];
    }
  }
  return [0, 0, 0, 0];
}

function _renderHeatmap() {
  if (!_hmKlines || _hmKlines.length < 4) return;
  const canvas = document.getElementById('heatmap-canvas');
  const setup  = setupCanvas(canvas);
  if (!setup) return;
  const { ctx, W, H } = setup;
  const cfg = HM_TFS[_hmTF];

  // Coinglass-style deep purple-black background
  ctx.fillStyle = '#0a0419';
  ctx.fillRect(0, 0, W, H);

  const PAD   = { l: 64, r: 52, t: 12, b: 28 };
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  if (plotW < 40 || plotH < 40) return;

  const k      = _hmKlines;
  const N      = k.length;
  const tStart = k[0].ts;
  const tEnd   = k[N - 1].ts;
  const tSpan  = tEnd - tStart || 1;

  // Price range — user-controlled view if set, else auto-fit
  const view   = _hmGetView();
  const pLo    = view.pLo;
  const pHi    = view.pHi;
  const pRange = pHi - pLo;

  // ── PRECOMPUTE: forward min/max for sweep detection ─────────────────────
  // futureLow[i]  = min of low[i+1..N-1]
  // futureHigh[i] = max of high[i+1..N-1]
  // A long-liq at price L from candle i is "swept" if futureLow[i]  <= L.
  // A short-liq at price S from candle i is "swept" if futureHigh[i] >= S.
  const futureLow  = new Float32Array(N);
  const futureHigh = new Float32Array(N);
  futureLow[N - 1]  = Infinity;     // nothing in the future of last candle
  futureHigh[N - 1] = -Infinity;
  for (let i = N - 2; i >= 0; i--) {
    futureLow[i]  = Math.min(k[i + 1].low,  futureLow[i + 1]);
    futureHigh[i] = Math.max(k[i + 1].high, futureHigh[i + 1]);
  }

  // Grid resolution
  const NX = Math.max(80, Math.min(360, Math.floor(plotW / 2)));
  const NY = Math.max(140, Math.min(480, Math.floor(plotH / 1.2)));
  const grid = new Float32Array(NX * NY);

  // ── Accumulate liquidation pressure (with sweep filtering) ──────────────
  const holdSpan      = cfg.holdScale;
  const unsweptOnly   = _hmMode === 'unswept';
  const activeTiers   = HM_LEV_TIERS.filter(t => t.L >= _hmMinLev);
  const colsPerCandle = Math.max(1, NX / N);
  // In "unswept" mode positions are still live → much slower decay (or none).
  // In "all" mode we use the full per-TF decay.
  const decayK = unsweptOnly ? 0.05 : (1 / (holdSpan * colsPerCandle));

  for (let ci = 0; ci < N; ci++) {
    const c = k[ci];
    const entry = (c.high + c.low + c.close) / 3;
    const ti    = Math.floor((c.ts - tStart) / tSpan * (NX - 1));

    for (const tier of activeTiers) {
      const L = tier.L, w = tier.w;
      const longLiq  = entry * (1 - 1 / L + HM_MMR);
      const shortLiq = entry * (1 + 1 / L - HM_MMR);

      const longSwept  = unsweptOnly && longLiq  >= futureLow[ci];
      const shortSwept = unsweptOnly && shortLiq <= futureHigh[ci];

      // Long band
      if (!longSwept && longLiq >= pLo && longLiq <= pHi) {
        const yi   = Math.round((longLiq - pLo) / pRange * (NY - 1));
        const base = c.vol * w;
        const xEnd = unsweptOnly ? NX : Math.min(NX, ti + Math.floor(holdSpan * colsPerCandle) + 6);
        for (let xi = ti; xi < xEnd; xi++) {
          const dx = xi - ti;
          grid[yi * NX + xi] += base * Math.exp(-dx * decayK);
        }
      }
      // Short band
      if (!shortSwept && shortLiq >= pLo && shortLiq <= pHi) {
        const yi   = Math.round((shortLiq - pLo) / pRange * (NY - 1));
        const base = c.vol * w;
        const xEnd = unsweptOnly ? NX : Math.min(NX, ti + Math.floor(holdSpan * colsPerCandle) + 6);
        for (let xi = ti; xi < xEnd; xi++) {
          const dx = xi - ti;
          grid[yi * NX + xi] += base * Math.exp(-dx * decayK);
        }
      }
    }
  }

  // ── Tight 3-tap vertical thickener: bands stay SHARP but visible ────────
  // Replaces previous heavy blur. Bands now look like clean Coinglass stripes
  // instead of fuzzy clouds.
  const blurred = new Float32Array(grid.length);
  const K = [0.22, 0.56, 0.22];
  for (let xi = 0; xi < NX; xi++) {
    for (let yi = 0; yi < NY; yi++) {
      let s = 0;
      for (let d = -1; d <= 1; d++) {
        const y2 = yi + d;
        if (y2 < 0 || y2 >= NY) continue;
        s += grid[y2 * NX + xi] * K[d + 1];
      }
      blurred[yi * NX + xi] = s;
    }
  }

  // Normalize: sensitivity adjusts the percentile clip point.
  // sens=1 (least)  → clip at 99th percentile (only the hottest stuff lights up)
  // sens=5 (most)   → clip at 80th percentile (faint pools also visible)
  const sensPct = [0.99, 0.95, 0.90, 0.85, 0.78][_hmSens - 1] ?? 0.90;
  const nonzero = [];
  for (let i = 0; i < blurred.length; i++) if (blurred[i] > 0) nonzero.push(blurred[i]);
  if (!nonzero.length) {
    _drawHmStatus(unsweptOnly ? 'All clusters swept · try "All" mode' : 'No liquidation data in range');
    return;
  }
  nonzero.sort((a, b) => a - b);
  const pNorm = nonzero[Math.floor(nonzero.length * sensPct)] || 1;

  // ── Detect top clusters for right-edge labels ───────────────────────────
  // Sum intensity per row; pick top 5 local maxima with min-distance separation.
  const rowSum = new Float32Array(NY);
  for (let yi = 0; yi < NY; yi++) {
    let s = 0;
    for (let xi = 0; xi < NX; xi++) s += blurred[yi * NX + xi];
    rowSum[yi] = s;
  }
  const rowMax = Math.max(...rowSum);
  const minDist = Math.max(5, Math.floor(NY * 0.03));   // ~3% of height apart
  const peaks = [];
  for (let yi = 1; yi < NY - 1; yi++) {
    if (rowSum[yi] < rowMax * 0.18) continue;
    if (rowSum[yi] <= rowSum[yi - 1] || rowSum[yi] <= rowSum[yi + 1]) continue;
    if (peaks.some(p => Math.abs(p.yi - yi) < minDist)) continue;
    peaks.push({ yi, intensity: rowSum[yi] });
  }
  peaks.sort((a, b) => b.intensity - a.intensity);
  const topPeaks = peaks.slice(0, 5);
  topPeaks.forEach(p => {
    p.price = pLo + (p.yi / (NY - 1)) * pRange;
    p.score = p.intensity / rowMax;   // 0..1
  });

  // Use blurred grid going forward
  const final = blurred;
  const p95 = pNorm;

  // ── Render heatmap via ImageData ────────────────────────────────────────
  const off = document.createElement('canvas');
  off.width  = NX;
  off.height = NY;
  const offCtx  = off.getContext('2d');
  const imgData = offCtx.createImageData(NX, NY);
  for (let yi = 0; yi < NY; yi++) {
    const flipY = NY - 1 - yi;
    for (let xi = 0; xi < NX; xi++) {
      const v = final[yi * NX + xi] / p95;
      if (v < 0.01) continue;
      const t = Math.log(1 + 9 * Math.min(1, v)) / Math.log(10);
      const [r, g, b, a] = _hmColor(t);
      const idx = (flipY * NX + xi) * 4;
      imgData.data[idx]     = r;
      imgData.data[idx + 1] = g;
      imgData.data[idx + 2] = b;
      imgData.data[idx + 3] = a;
    }
  }
  offCtx.putImageData(imgData, 0, 0);
  // Slight smoothing — areas should look like soft zones, not pixel art
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'low';
  ctx.drawImage(off, PAD.l, PAD.t, plotW, plotH);

  // ── Mapping helpers ─────────────────────────────────────────────────────
  const toX = ts => PAD.l + (ts - tStart) / tSpan * plotW;
  const toY = p  => PAD.t + (1 - (p - pLo) / pRange) * plotH;

  // ── Y-axis gridlines + dual $ / % labels ────────────────────────────────
  const last     = k[N - 1];
  const cp       = last.close;
  const yLabels  = _hmNicePriceTicks(pLo, pHi, 7);
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth   = 0.5;
  yLabels.forEach(p => {
    const y = toY(p);
    ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(PAD.l + plotW, y); ctx.stroke();
  });

  // ── Current-price reference line (cyan, dashed, full glow) ───────────────
  // This is the central "you are here" — every band above is short liquidity,
  // every band below is long liquidity. The line spans the full chart.
  const cy = toY(cp);
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = 'rgba(100,210,255,0.55)';
  ctx.lineWidth   = 1.1;
  ctx.shadowColor = 'rgba(100,210,255,0.6)';
  ctx.shadowBlur  = 6;
  ctx.beginPath();
  ctx.moveTo(PAD.l, cy);
  ctx.lineTo(PAD.l + plotW, cy);
  ctx.stroke();
  ctx.restore();

  // ── Price line over time (white, soft glow) ─────────────────────────────
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const x = toX(k[i].ts), y = toY(k[i].close);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.shadowColor = 'rgba(255,255,255,0.5)';
  ctx.shadowBlur  = 4;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth   = 1.4;
  ctx.lineJoin    = 'round';
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Current price dot
  ctx.beginPath();
  ctx.arc(toX(last.ts), cy, 4, 0, Math.PI * 2);
  ctx.fillStyle   = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#0a0419';
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  // ── Y-axis labels — left side: $ price, right side: % offset from CP ────
  const sysFont = getComputedStyle(document.body).fontFamily;
  ctx.font         = `10px ${sysFont}`;
  ctx.fillStyle    = 'rgba(255,255,255,0.5)';
  ctx.textBaseline = 'middle';

  // Left labels: dollar prices
  ctx.textAlign = 'right';
  yLabels.forEach(p => {
    if (Math.abs(toY(p) - cy) < 11) return;   // don't clash with the CP tag
    ctx.fillText(_hmPriceLabel(p, pRange), PAD.l - 6, toY(p));
  });

  // Right labels: % offset from current price
  ctx.textAlign = 'left';
  yLabels.forEach(p => {
    if (Math.abs(toY(p) - cy) < 11) return;
    const pct = ((p - cp) / cp) * 100;
    const sign = pct >= 0 ? '+' : '';
    const col  = pct > 0 ? 'rgba(48,217,123,0.55)' : 'rgba(255,69,58,0.55)';
    ctx.fillStyle = col;
    ctx.fillText(`${sign}${pct.toFixed(Math.abs(pct) < 1 ? 2 : 1)}%`, PAD.l + plotW + 6, toY(p));
  });

  // Current-price tag on the LEFT axis (cyan pill — anchor reference)
  const tagW = PAD.l - 10;
  ctx.fillStyle = '#64d2ff';
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(4, cy - 9, tagW, 18, 6);
    ctx.fill();
  } else {
    ctx.fillRect(4, cy - 9, tagW, 18);
  }
  ctx.fillStyle    = '#06121a';
  ctx.textAlign    = 'right';
  ctx.font         = `700 10px ${sysFont}`;
  ctx.fillText(_hmPriceLabel(cp, pRange), 4 + tagW - 5, cy);

  // 0% tag on the RIGHT axis
  ctx.fillStyle = 'rgba(100,210,255,0.85)';
  ctx.font      = `700 10px ${sysFont}`;
  ctx.textAlign = 'left';
  ctx.fillText('0.00%', PAD.l + plotW + 6, cy);

  // ── X-axis tick labels (smart per-TF) ───────────────────────────────────
  ctx.fillStyle    = 'rgba(255,255,255,0.5)';
  ctx.font         = `10px ${sysFont}`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  const xTicks = _hmXTicks(tStart, tEnd, cfg.xLabels, plotW);
  let lastX = -999;
  xTicks.forEach(({ ts, label }) => {
    const x = toX(ts);
    if (x - lastX < 60) return;
    lastX = x;
    ctx.fillText(label, x, PAD.t + plotH + 6);
  });

  // ── Legend (top-left, very subtle) ─────────────────────────────────────
  ctx.font         = `9px ${sysFont}`;
  ctx.fillStyle    = 'rgba(255,255,255,0.4)';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'top';
  const modeLbl = unsweptOnly ? 'Untaken' : 'All';
  ctx.fillText(`${cfg.label} · ${_hmSymbol.replace('USDT','')} · ${_hmMinLev}–125x · ${modeLbl}`, PAD.l + 4, PAD.t + 4);

  // ── Top "magnet" cluster pills ─────────────────────────────────────────
  // Pinned inside the right edge of the plot — show price + %ΔFromPrice +
  // intensity bar. Sorted by intensity, de-overlapped by Y.
  if (topPeaks.length) {
    ctx.font         = `600 10px ${sysFont}`;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    const labelW = 92;
    const xLbl   = PAD.l + plotW - labelW - 4;

    const labels = topPeaks.map(p => ({
      ...p,
      pct:     ((p.price - cp) / cp) * 100,
      y:       toY(p.price),
      desired: toY(p.price),
    })).sort((a, b) => a.y - b.y);

    const minGap = 18;
    for (let i = 1; i < labels.length; i++) {
      if (labels[i].y - labels[i - 1].y < minGap) labels[i].y = labels[i - 1].y + minGap;
    }
    for (let i = labels.length - 2; i >= 0; i--) {
      if (labels[i + 1].y - labels[i].y < minGap) labels[i].y = labels[i + 1].y - minGap;
    }

    labels.forEach(p => {
      const x = xLbl;
      // Leader line back to the actual band
      ctx.strokeStyle = `rgba(255,235,140,${0.20 + p.score * 0.55})`;
      ctx.lineWidth   = 0.7;
      ctx.beginPath();
      ctx.moveTo(PAD.l + 2, p.desired);
      ctx.lineTo(x - 2, p.y);
      ctx.stroke();

      // Pill bg
      const bgAlpha = 0.6 + p.score * 0.3;
      ctx.fillStyle = `rgba(20,5,30,${bgAlpha})`;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, p.y - 8, labelW, 16, 4); ctx.fill(); }
      else               { ctx.fillRect(x, p.y - 8, labelW, 16); }

      // Intensity bar (gradient from hot orange → bright yellow)
      const barW = Math.round(labelW * Math.min(1, p.score));
      const grad = ctx.createLinearGradient(x, 0, x + labelW, 0);
      grad.addColorStop(0, 'rgba(255,140,40,0.65)');
      grad.addColorStop(1, 'rgba(255,235,80,0.85)');
      ctx.fillStyle = grad;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, p.y - 8, barW, 16, 4); ctx.fill(); }
      else               { ctx.fillRect(x, p.y - 8, barW, 16); }

      // Text: price + % offset from current
      const sign = p.pct >= 0 ? '+' : '';
      const pctStr = `${sign}${p.pct.toFixed(Math.abs(p.pct) < 1 ? 2 : 1)}%`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${_hmPriceLabel(p.price, pRange)}  ${pctStr}`, x + 5, p.y);
    });
  }

  // ── Real liquidation events overlay ────────────────────────────────────
  if (_hmShowLiq && _hmLiqs.length) {
    const now = Date.now();
    // Only events in the active symbol AND visible in the current view window
    for (const e of _hmLiqs) {
      if (e.symbol !== _hmSymbol) continue;
      if (e.ts < tStart || e.ts > tEnd) continue;
      if (e.price < pLo || e.price > pHi) continue;

      const x   = toX(e.ts);
      const y   = toY(e.price);
      // Size ∝ log10(usd) — $100 → r≈2, $10K → r≈4, $1M → r≈6, $100M → r≈8
      const r   = Math.max(1.8, Math.min(9, Math.log10(Math.max(10, e.usd)) - 1));
      // Recency boost — events under 30s pulse brighter
      const age = now - e.ts;
      const fresh = age < 30_000;
      const alpha = Math.max(0.45, 1 - age / (12 * 3600e3));   // 12h fade

      // Apple-style red/green for long/short liquidations
      const rgb = e.side === 'long' ? '255,69,58' : '48,217,123';

      // Outer glow
      ctx.beginPath();
      ctx.arc(x, y, r * (fresh ? 2.4 : 1.7), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb},${alpha * (fresh ? 0.30 : 0.18)})`;
      ctx.fill();

      // Solid dot
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb},${Math.min(1, alpha + 0.15)})`;
      ctx.fill();

      // Crisp ring for contrast against bright heatmap zones
      ctx.lineWidth   = 0.7;
      ctx.strokeStyle = 'rgba(10,4,25,0.85)';
      ctx.stroke();
    }
  }

  // Cache the geometry the cursor overlay needs to map mouse → price/time
  _hmViewport = { PAD, plotW, plotH, W, H, pLo, pHi, tStart, tEnd, cp };
  // Redraw cursor over the fresh heatmap (in case it was on-screen during render)
  _hmScheduleCursor();
}

// "Nice" round-number price ticks (1/2/2.5/5 × 10^n)
function _hmNicePriceTicks(lo, hi, target) {
  const range = hi - lo;
  const rawStep = range / target;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const ticks = [];
  for (let p = Math.ceil(lo / step) * step; p <= hi; p += step) ticks.push(p);
  return ticks;
}

function _hmPriceLabel(p, range) {
  // Choose decimals based on the panel's range — small ETH moves need precision
  if (p >= 10000) return '$' + (p / 1000).toFixed(range < 5000 ? 2 : 1) + 'K';
  if (p >= 1000)  return '$' + p.toFixed(0);
  if (p >= 100)   return '$' + p.toFixed(1);
  return '$' + p.toFixed(2);
}

function _hmXTicks(tStart, tEnd, mode, plotW) {
  // Generate ~6-8 ticks at sensible intervals
  const span = tEnd - tStart;
  let stepMs, fmt;
  if (mode === 'time') {
    // hours within a day
    stepMs = span > 24*3600e3 ? 6*3600e3 : span > 6*3600e3 ? 60*60e3 : 15*60e3;
    fmt = d => `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;
  } else if (mode === 'date') {
    stepMs = span > 21*86400e3 ? 7*86400e3 : 24*86400e3 > span ? 86400e3 : 2*86400e3;
    fmt = d => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
  } else {  // 'month'
    stepMs = 30 * 86400e3;
    fmt = d => d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  }
  const ticks = [];
  // Anchor first tick to a round time
  const startD = new Date(tStart);
  startD.setUTCMinutes(0, 0, 0);
  const start = startD.getTime();
  for (let t = start; t <= tEnd; t += stepMs) {
    if (t < tStart) continue;
    ticks.push({ ts: t, label: fmt(new Date(t)) });
  }
  return ticks;
}

function _drawHmStatus(msg) {
  const setup = setupCanvas(document.getElementById('heatmap-canvas'));
  if (!setup) return;
  const { ctx, W, H } = setup;
  ctx.fillStyle = '#08101a';
  ctx.fillRect(0, 0, W, H);
  const sysFont = getComputedStyle(document.body).fontFamily;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `12px ${sysFont}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(msg, W / 2, H / 2);
}

function initHeatmap() {
  const coin = _hmSymbol.replace('USDT', '');
  setActiveCoinBtn('hm', coin);
  document.querySelectorAll('#hm-tf-group .tf-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tf === _hmTF);
  });
  _hmAttachInteractions();
  _hmUpdateResetBtn();
  _hmConnectWS();                          // start live liquidation feed
  setInterval(_hmUpdateLiqTicker, 3_000);  // refresh 60s rolling stats
  _hmUpdateLiqTicker();
  _drawHmStatus('Loading heatmap…');
  fetchHeatmap();
  // Refresh cadence depends on TF — short TFs need faster updates
  setInterval(() => {
    const tf = _hmTF;
    const ms = tf === '1m' ? 60_000 : tf === '15m' ? 3 * 60_000 : 5 * 60_000;
    if (Date.now() - (_hmLastFetch || 0) >= ms) fetchHeatmap();
  }, 30_000);
  const canvas = document.getElementById('heatmap-canvas');
  if (canvas && window.ResizeObserver) {
    new ResizeObserver(() => _renderHeatmap()).observe(canvas);
  }
}
let _hmLastFetch = 0;

// ─── Meezus Forecast Chart ───────────────────────────────────────────────────
let _fcSymbol = 'BTCUSDT';
let _fcData   = null;

function setForecastSymbol(coin) {
  _fcSymbol = coin === 'ETH' ? 'ETHUSDT' : 'BTCUSDT';
  setActiveCoinBtn('fc', coin);
  const tag = document.getElementById('fc-tag');
  if (tag) tag.textContent = `12h · ${coin}`;
  fetchForecast();
}

// ── Canvas renderer ───────────────────────────────────────────────────────────
function _renderForecast() {
  const canvas  = document.getElementById('fc-canvas');
  const overlay = document.getElementById('fc-overlay');
  if (!canvas) return;

  const data = _fcData;

  // Show overlay for non-ok states
  if (!data || data.status !== 'ok') {
    if (overlay) overlay.style.display = 'flex';
    const msgEl = document.getElementById('fc-overlay-msg');
    const subEl = document.getElementById('fc-overlay-sub');
    if (data?.status === 'no_model') {
      if (msgEl) msgEl.textContent = 'Model not installed';
      if (subEl) subEl.textContent = 'Run: python3 forecast_setup.py';
    } else if (data?.status === 'pending') {
      if (msgEl) msgEl.textContent = 'Computing forecast…';
      if (subEl) subEl.textContent = 'First run takes ~2 min · polling every 15s';
    } else if (data?.status === 'error') {
      if (msgEl) msgEl.textContent = 'Forecast error';
      if (subEl) subEl.textContent = data.message ?? '';
    } else {
      if (msgEl) msgEl.textContent = 'Loading…';
      if (subEl) subEl.textContent = '';
    }
    return;
  }

  if (overlay) overlay.style.display = 'none';

  const setup = setupCanvas(canvas);
  if (!setup) return;
  const { ctx, W, H } = setup;
  ctx.save();

  const PAD  = { l: 64, r: 12, t: 18, b: 30 };
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;

  const hist = data.history;
  const fc   = data.forecast;

  // ── Price range ─────────────────────────────────────────────────────────
  const allP = [
    ...hist.map(h => h.c),
    ...fc.mean, ...fc.p10, ...fc.p90,
  ];
  const rawLo = Math.min(...allP), rawHi = Math.max(...allP);
  const pad   = (rawHi - rawLo) * 0.06;
  const pLo   = rawLo - pad,  pHi = rawHi + pad;

  // ── Time range ───────────────────────────────────────────────────────────
  const tStart = hist[0].ts;
  const tEnd   = fc.timestamps[fc.timestamps.length - 1];
  const tNow   = hist[hist.length - 1].ts;

  function toX(ts) { return PAD.l + (ts - tStart) / (tEnd - tStart) * plotW; }
  function toY(p)  { return PAD.t + (1 - (p - pLo) / (pHi - pLo)) * plotH; }

  // ── Background ───────────────────────────────────────────────────────────
  ctx.fillStyle = '#060a0f';
  ctx.fillRect(0, 0, W, H);

  // ── Horizontal grid lines ────────────────────────────────────────────────
  const rawStep = (pHi - pLo) / 6;
  const mag     = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const pStep   = Math.ceil(rawStep / mag) * mag;
  const pStart  = Math.ceil(pLo / pStep) * pStep;

  ctx.strokeStyle = '#0c1823';
  ctx.lineWidth   = 0.5;
  for (let p = pStart; p <= pHi; p += pStep) {
    const y = toY(p);
    ctx.beginPath();
    ctx.moveTo(PAD.l, y);
    ctx.lineTo(PAD.l + plotW, y);
    ctx.stroke();
  }

  // ── Vertical time grid ───────────────────────────────────────────────────
  const spanH = (tEnd - tStart) / 3_600_000;
  const gridIntervalH = spanH > 60 ? 12 : 6;
  const gridMs = gridIntervalH * 3_600_000;

  const allTs = [...hist.map(h => h.ts), ...fc.timestamps];
  allTs.forEach(ts => {
    if (ts % gridMs < 3_600_000) {
      const x = toX(ts);
      ctx.strokeStyle = '#0c1823';
      ctx.lineWidth   = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, PAD.t);
      ctx.lineTo(x, PAD.t + plotH);
      ctx.stroke();
    }
  });

  // ── Forecast confidence band (p10–p90) ───────────────────────────────────
  ctx.beginPath();
  fc.timestamps.forEach((ts, i) => {
    const x = toX(ts), y = toY(fc.p90[i]);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  [...fc.timestamps].reverse().forEach((ts, i) => {
    const ri = fc.timestamps.length - 1 - i;
    ctx.lineTo(toX(ts), toY(fc.p10[ri]));
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,120,0,0.10)';
  ctx.fill();

  // Band border lines (subtle)
  ['p90','p10'].forEach(key => {
    ctx.beginPath();
    fc.timestamps.forEach((ts, i) => {
      const x = toX(ts), y = toY(fc[key][i]);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = 'rgba(255,120,0,0.22)';
    ctx.lineWidth   = 0.8;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  });

  // ── Historical price line (cyan) ─────────────────────────────────────────
  ctx.beginPath();
  hist.forEach((h, i) => {
    const x = toX(h.ts), y = toY(h.c);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#00b4f0';
  ctx.lineWidth   = 1.5;
  ctx.lineJoin    = 'round';
  ctx.stroke();

  // ── "Now" divider ────────────────────────────────────────────────────────
  const nowX = toX(tNow);
  ctx.strokeStyle = '#e03030';
  ctx.lineWidth   = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(nowX, PAD.t);
  ctx.lineTo(nowX, PAD.t + plotH);
  ctx.stroke();
  ctx.setLineDash([]);

  // ── Forecast mean line (orange), bridged from last historical close ───────
  ctx.beginPath();
  const lastH = hist[hist.length - 1];
  ctx.moveTo(toX(lastH.ts), toY(lastH.c));
  fc.timestamps.forEach((ts, i) => ctx.lineTo(toX(ts), toY(fc.mean[i])));
  ctx.strokeStyle = '#ff7800';
  ctx.lineWidth   = 1.8;
  ctx.lineJoin    = 'round';
  ctx.stroke();

  // ── Y-axis price labels ───────────────────────────────────────────────────
  const curClose = lastH.c;
  const fcClose  = fc.mean[fc.mean.length - 1];

  function priceLabel(p) {
    return p >= 10000 ? '$' + (p / 1000).toFixed(1) + 'K' :
           p >= 1000  ? '$' + (p / 1000).toFixed(2) + 'K' :
                        '$' + p.toFixed(1);
  }

  ctx.font         = '9px JetBrains Mono, monospace';
  ctx.textAlign    = 'right';
  ctx.textBaseline = 'middle';

  for (let p = pStart; p <= pHi; p += pStep) {
    const y = toY(p);
    const tooCloseCur = Math.abs(y - toY(curClose)) < 12;
    const tooCloseFc  = Math.abs(y - toY(fcClose))  < 12;
    if (tooCloseCur || tooCloseFc) continue;
    ctx.fillStyle = '#2a4a68';
    ctx.fillText(priceLabel(p), PAD.l - 4, y);
  }

  // Current price tag (cyan)
  const curY = toY(curClose);
  ctx.fillStyle = '#00b4f0';
  ctx.fillRect(2, curY - 8, PAD.l - 4, 16);
  ctx.fillStyle    = '#000d18';
  ctx.font         = 'bold 9px JetBrains Mono, monospace';
  ctx.fillText(priceLabel(curClose), PAD.l - 4, curY);

  // Forecast end price tag (orange)
  const fcY = toY(fcClose);
  if (Math.abs(fcY - curY) > 14) {
    ctx.fillStyle = '#ff7800';
    ctx.fillRect(2, fcY - 8, PAD.l - 4, 16);
    ctx.fillStyle = '#000d18';
    ctx.fillText(priceLabel(fcClose), PAD.l - 4, fcY);
  }

  // ── X-axis time labels ───────────────────────────────────────────────────
  ctx.fillStyle    = '#2a4a68';
  ctx.font         = '9px JetBrains Mono, monospace';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';

  const labelIntervalH = spanH > 60 ? 12 : 6;
  const labelMs        = labelIntervalH * 3_600_000;
  let   lastLabelX     = -999;

  allTs.forEach(ts => {
    if (ts % labelMs < 3_600_000) {
      const x = toX(ts);
      if (x - lastLabelX < 38) return;
      lastLabelX = x;
      const d  = new Date(ts);
      const hh = d.getUTCHours();
      const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dy = String(d.getUTCDate()).padStart(2, '0');
      ctx.fillText(hh === 0 ? `${mo}/${dy}` : `${String(hh).padStart(2,'0')}:00`,
                   x, PAD.t + plotH + 4);
    }
  });

  // ── Legend ───────────────────────────────────────────────────────────────
  const lx = PAD.l + 8, ly = PAD.t + 6;
  const legend = [
    { color: '#00b4f0', label: 'HIST CLOSE' },
    { color: '#ff7800', label: 'MEAN FORECAST' },
    { color: 'rgba(255,120,0,0.35)', label: 'P10–P90 RANGE' },
  ];
  ctx.font         = '9px JetBrains Mono, monospace';
  ctx.textBaseline = 'middle';
  let lxOff = lx;
  legend.forEach(({ color, label }) => {
    ctx.fillStyle = color;
    ctx.fillRect(lxOff, ly, 18, 2);
    ctx.fillStyle = '#2a4a68';
    ctx.textAlign = 'left';
    ctx.fillText(label, lxOff + 22, ly + 1);
    lxOff += ctx.measureText(label).width + 46;
  });

  ctx.restore();
}

// ── Fetch + poll ──────────────────────────────────────────────────────────────
async function fetchForecast() {
  try {
    const res = await fetch(`/api/forecast?symbol=${_fcSymbol}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    _fcData = data;

    // Update "generated at" timestamp
    const genEl = document.getElementById('fc-generated');
    if (genEl && data.generated_at) {
      const d = new Date(data.generated_at);
      genEl.textContent = `Generated ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')} UTC`;
      if (data.stale) genEl.textContent += ' (stale)';
    }

    _renderForecast();
  } catch (e) {
    console.warn('[MEEZUS] Forecast fetch failed:', e.message);
  }
}

function initForecast() {
  fetchForecast();

  // If pending, poll fast until the first result comes in
  let pendingInterval = null;
  pendingInterval = setInterval(() => {
    if (_fcData?.status === 'ok') {
      clearInterval(pendingInterval);
    } else {
      fetchForecast();
    }
  }, 15_000);

  // Hourly refresh once we have data
  setInterval(fetchForecast, 3_600_000);

  // Redraw on resize
  const body = document.getElementById('fc-body');
  if (body && window.ResizeObserver) {
    new ResizeObserver(() => _renderForecast()).observe(body);
  }
}

// ─── World Clock ─────────────────────────────────────────────────────────────
const WC_ZONES = [
  { timeId: 'wc-utc', dateId: 'wc-utc-date', tz: 'UTC' },
  { timeId: 'wc-ny',  dateId: 'wc-ny-date',  tz: 'America/New_York', offsetId: 'wc-ny-offset' },
  { timeId: 'wc-hk',  dateId: 'wc-hk-date',  tz: 'Asia/Hong_Kong' },
];

function updateWorldClock() {
  const now = new Date();
  WC_ZONES.forEach(z => {
    const timeEl = $(z.timeId), dateEl = $(z.dateId);
    if (!timeEl) return;
    timeEl.textContent = now.toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: z.tz
    });
    if (dateEl) dateEl.textContent = now.toLocaleDateString('en-GB', {
      weekday: 'short', day: '2-digit', month: 'short', timeZone: z.tz
    });
    if (z.offsetId) {
      const el = $(z.offsetId);
      if (el) {
        const tzName = new Intl.DateTimeFormat('en', { timeZoneName: 'short', timeZone: z.tz })
          .formatToParts(now).find(p => p.type === 'timeZoneName')?.value ?? 'ET';
        el.textContent = tzName;
      }
    }
  });
}

// ─── Market Sessions ──────────────────────────────────────────────────────────
const SESSIONS = [
  { name: 'Sydney',   open: 21, close:  6, color: '#00b4f0' },
  { name: 'Tokyo',    open:  0, close:  9, color: '#ff7800' },
  { name: 'London',   open:  7, close: 16, color: '#ffc400' },
  { name: 'New York', open: 12, close: 21, color: '#00d68f' },
];

function _sessionState(s, utcMins) {
  const openM = s.open * 60, closeM = s.close * 60;
  const total = s.close < s.open ? (1440 - openM) + closeM : closeM - openM;
  let open, elapsed;
  if (s.close < s.open) {
    open    = utcMins >= openM || utcMins < closeM;
    elapsed = utcMins >= openM ? utcMins - openM : (1440 - openM) + utcMins;
  } else {
    open    = utcMins >= openM && utcMins < closeM;
    elapsed = utcMins - openM;
  }
  const pct  = open ? Math.max(0, Math.min(100, (elapsed / total) * 100)) : 0;
  let diff   = open ? closeM - utcMins : openM - utcMins;
  if (diff <= 0) diff += 1440;
  const h = Math.floor(diff / 60), m = diff % 60;
  return { open, pct, timeStr: `${h}h ${String(m).padStart(2,'0')}m` };
}

function updateSessions() {
  const body = $('sessions-body');
  if (!body) return;
  const now     = new Date();
  const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const overlap = (utcMins >= 7*60 && utcMins < 16*60) && (utcMins >= 12*60 && utcMins < 21*60);

  body.innerHTML = SESSIONS.map(s => {
    const { open, pct, timeStr } = _sessionState(s, utcMins);
    const openStr  = String(s.open).padStart(2,'0')  + ':00';
    const closeStr = String(s.close).padStart(2,'0') + ':00';
    return `<div class="sess-row${open ? ' open' : ''}">
      <div class="sess-hd">
        <span class="sess-dot" style="background:${open ? s.color : 'var(--text-faint)'};box-shadow:${open ? `0 0 7px ${s.color}` : 'none'}"></span>
        <span class="sess-name">${s.name}</span>
        <span class="sess-hrs">${openStr} – ${closeStr}</span>
        <span class="sess-status ${open ? 'sopen' : 'sclosed'}">${open ? 'Open' : 'Closed'}</span>
      </div>
      <div class="sess-track">
        <div class="sess-fill" style="width:${pct.toFixed(1)}%;background:${s.color}"></div>
      </div>
      <div class="sess-meta">${open ? `${timeStr} remaining` : `Opens in ${timeStr}`}</div>
    </div>`;
  }).join('') + (overlap ? `<div class="sess-overlap">⚡ London / NY overlap — peak liquidity</div>` : '');
}

function initSessionsClock() {
  updateWorldClock();
  updateSessions();
  setInterval(updateWorldClock, 1000);
  setInterval(updateSessions,   30_000);
}

// ─── Economic Calendar ────────────────────────────────────────────────────────
// Fetches ForexFactory data from faireconomy.media CDN.
// Tried first from the browser directly (real Safari bypasses rate limits),
// then via server.py as fallback.

let _calEvents = [];

async function fetchCalendar() {
  const feedEl = $('cal-feed');
  if (!feedEl) return;
  feedEl.innerHTML = '<div class="feed-loading">FETCHING CALENDAR…</div>';

  // Always route through the local server — it caches 90 min and serves stale
  // data on upstream rate-limits (429), so this never fails after first load.
  // Direct browser fetch is intentionally skipped: Safari blocks cross-origin
  // requests from localhost:8080 to faireconomy.media (CORS).
  try {
    const res = await fetch('/api/calendar', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const events = Array.isArray(data) ? data : (data.events ?? []);
    if (!events.length) throw new Error('empty response');
    _calEvents = events;
    _renderCalendar();
    console.log(`[MEEZUS] Calendar loaded (${events.length} events)`);
    return;
  } catch (e) {
    console.warn('[MEEZUS] Calendar fetch failed:', e.message);
  }

  feedEl.innerHTML = `<div class="cal-error">
    <div class="cal-error-icon">◉</div>
    <div class="cal-error-msg">Calendar unavailable</div>
    <button class="stream-retry-btn" onclick="fetchCalendar()">Retry</button>
  </div>`;
}

// Builds a UTC epoch-ms timestamp from a normalised event (date YYYY-MM-DD + time HH:MM UTC)
function _calEventTs(ev) {
  if (!ev._dateKey || !ev._time || ev._time === '──:──') return null;
  const [h, m] = ev._time.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return Date.parse(`${ev._dateKey}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00Z`);
}

let _calCountdownTimer = null;
let _calNextEventTs    = null;
let _calNextEventKey   = null;   // `${dateKey}|${time}|${title}` — used to flag the row

function _formatCountdown(ms) {
  if (ms <= 0) return 'LIVE NOW';
  const totalMin = Math.floor(ms / 60000);
  const d  = Math.floor(totalMin / 1440);
  const h  = Math.floor((totalMin % 1440) / 60);
  const m  = totalMin % 60;
  if (d > 0) return `${d}D ${String(h).padStart(2,'0')}H ${String(m).padStart(2,'0')}M`;
  if (h > 0) return `${h}H ${String(m).padStart(2,'0')}M`;
  return `${m}M`;
}

function _tickCalCountdown() {
  const el = document.getElementById('cal-next-countdown');
  if (!el || !_calNextEventTs) return;
  const diff = _calNextEventTs - Date.now();
  el.textContent = _formatCountdown(diff);
  el.className = 'cal-next-countdown' + (diff <= 30 * 60 * 1000 ? ' imminent' : '');
  // If the event has just passed, re-render so the next one floats to the top
  if (diff <= -60_000) _renderCalendar();
}

function _renderCalendar() {
  const feedEl = $('cal-feed');
  if (!feedEl || !_calEvents.length) return;

  const todayUTC = new Date().toISOString().slice(0, 10);
  const nowTs    = Date.now();

  // Group events by date
  const groups = {};
  _calEvents.forEach(ev => {
    // Skip holidays / non-economic with no data
    const impact = (ev.impact || '').toLowerCase();
    if (impact === 'holiday' || impact === 'non-economic') return;

    // Date field can be ISO "2026-05-13T12:30:00+00:00" or plain "2026-05-13"
    let dateKey, timeDisplay;
    if (ev.date && ev.date.includes('T')) {
      const d     = new Date(ev.date);
      dateKey     = d.toISOString().slice(0, 10);
      timeDisplay = `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;
    } else {
      dateKey     = (ev.date || '').slice(0, 10);
      timeDisplay = _etToUtc(dateKey, ev.time || '');
    }

    if (!dateKey) return;
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push({ ...ev, _dateKey: dateKey, _time: timeDisplay });
  });

  const days = Object.keys(groups).sort();
  if (!days.length) {
    feedEl.innerHTML = '<div class="feed-loading">NO EVENTS THIS WEEK</div>';
    return;
  }

  // ── Find the next upcoming event (any impact, but timed) ──────────────────
  let nextEv = null;
  for (const dk of days) {
    for (const ev of groups[dk]) {
      const ts = _calEventTs(ev);
      if (ts === null || ts < nowTs) continue;
      if (!nextEv || ts < _calEventTs(nextEv)) nextEv = ev;
    }
  }
  _calNextEventTs  = nextEv ? _calEventTs(nextEv) : null;
  _calNextEventKey = nextEv ? `${nextEv._dateKey}|${nextEv._time}|${nextEv.title}` : null;

  // ── Build "NEXT UP" hero card ─────────────────────────────────────────────
  let heroHtml = '';
  if (nextEv) {
    const imp    = (nextEv.impact || '').toLowerCase();
    const impCls = imp === 'high' ? 'high' : imp === 'medium' ? 'med' : 'low';
    const impLbl = imp === 'high' ? 'HIGH'  : imp === 'medium' ? 'MED'  : 'LOW';
    const d      = new Date(nextEv._dateKey + 'T12:00:00Z');
    const dayLbl = d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
    const cd     = _formatCountdown(_calNextEventTs - nowTs);
    const imminent = (_calNextEventTs - nowTs) <= 30 * 60 * 1000 ? ' imminent' : '';

    heroHtml = `<div class="cal-next-card${imminent}">
      <div class="cal-next-head">
        <span class="cal-next-lbl">◆ NEXT UP</span>
        <span class="cal-next-countdown${imminent}" id="cal-next-countdown">${cd}</span>
      </div>
      <div class="cal-next-title">${nextEv.title || ''}</div>
      <div class="cal-next-meta">
        <span class="cal-next-dot ${impCls}"></span>
        <span class="cal-next-imp ${impCls}">${impLbl}</span>
        <span class="cal-next-sep">·</span>
        <span class="cal-next-ccy">${nextEv.country || ''}</span>
        <span class="cal-next-sep">·</span>
        <span class="cal-next-when">${dayLbl} · ${nextEv._time} UTC</span>
        ${nextEv.forecast ? `<span class="cal-next-fcst">FCST <strong>${nextEv.forecast}</strong></span>` : ''}
        ${nextEv.previous ? `<span class="cal-next-prev">PREV <strong>${nextEv.previous}</strong></span>` : ''}
      </div>
    </div>`;
  }

  // ── Build chronological day groups ────────────────────────────────────────
  const daysHtml = days.map(dateKey => {
    const isToday = dateKey === todayUTC;
    const d       = new Date(dateKey + 'T12:00:00Z');
    const label   = d.toLocaleDateString('en-GB', {
      weekday: 'long', day: '2-digit', month: 'long'
    });

    const rows = groups[dateKey].map(ev => {
      const imp    = (ev.impact || '').toLowerCase();
      const impCls = imp === 'high' ? 'high' : imp === 'medium' ? 'med' : 'low';

      const actual   = ev.actual   || '';
      const forecast = ev.forecast || '';
      const previous = ev.previous || '';

      let actualCls = '';
      if (actual && forecast) {
        const a = parseFloat(actual), f = parseFloat(forecast);
        if (!isNaN(a) && !isNaN(f)) actualCls = a >= f ? 'positive' : 'negative';
      }

      const evKey  = `${ev._dateKey}|${ev._time}|${ev.title}`;
      const isNext = evKey === _calNextEventKey;

      return `<div class="cal-row${isNext ? ' is-next' : ''}">
        <span class="cal-time">${ev._time || '──:──'}</span>
        <span class="cal-ccy">${ev.country || ''}</span>
        <span class="cal-dot ${impCls}"></span>
        <span class="cal-title">${isNext ? '▸ ' : ''}${ev.title || ''}</span>
        <span class="cal-f">${forecast || '──'}</span>
        <span class="cal-a ${actualCls}">${actual || '──'}</span>
        <span class="cal-p">${previous || '──'}</span>
      </div>`;
    }).join('');

    return `<div class="cal-day${isToday ? ' today' : ''}">
      <div class="cal-day-label">${isToday ? '▸ ' : ''}${label}</div>
      ${rows}
    </div>`;
  }).join('');

  feedEl.innerHTML = heroHtml + daysHtml;

  // ── Start countdown ticker (1/min is enough) ──────────────────────────────
  if (_calCountdownTimer) clearInterval(_calCountdownTimer);
  if (_calNextEventTs) {
    _calCountdownTimer = setInterval(_tickCalCountdown, 30_000);
  }
}

function _etToUtc(dateKey, timeStr) {
  if (!timeStr || /tentative|all day|flash/i.test(timeStr)) return '──:──';
  const m = timeStr.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!m) return '──:──';
  let h = parseInt(m[1]), min = parseInt(m[2]);
  if (m[3].toLowerCase() === 'pm' && h !== 12) h += 12;
  if (m[3].toLowerCase() === 'am' && h === 12) h  = 0;
  const mo     = dateKey ? parseInt(dateKey.slice(5, 7)) : new Date().getMonth() + 1;
  const offset = (mo >= 3 && mo <= 11) ? 4 : 5;
  return `${String((h + offset) % 24).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
}

// ─── GridStack layout ─────────────────────────────────────────────────────────
const DEFAULT_LAYOUT = [
  // ── Left bloc — Bookmap streams (dominant visual anchors) ─────────────────
  { id: 'ytbtc',        x: 0,  y: 0,  w: 5, h: 16 },
  { id: 'yteth',        x: 0,  y: 16, w: 5, h: 17 },

  // ── Center column — News / Sessions / OI ──────────────────────────────────
  { id: 'news',         x: 5,  y: 0,  w: 2, h: 9  },
  { id: 'cryptonews',   x: 5,  y: 9,  w: 2, h: 6  },
  { id: 'sessions',     x: 5,  y: 15, w: 2, h: 4  },
  { id: 'openinterest', x: 5,  y: 19, w: 2, h: 5  },

  // ── Right bloc — Market data ───────────────────────────────────────────────
  { id: 'btc',          x: 7,  y: 0,  w: 2, h: 4  },
  { id: 'eth',          x: 9,  y: 0,  w: 3, h: 4  },
  { id: 'worldclock',   x: 7,  y: 4,  w: 5, h: 2  },
  { id: 'feargreed',    x: 7,  y: 6,  w: 2, h: 5  },
  { id: 'sentiment',    x: 9,  y: 6,  w: 3, h: 5  },
  { id: 'tradfi',       x: 7,  y: 11, w: 5, h: 3  },
  { id: 'heatmap',      x: 7,  y: 14, w: 5, h: 7  },
  { id: 'forecast',     x: 7,  y: 21, w: 5, h: 3  },
  { id: 'quant',        x: 7,  y: 24, w: 5, h: 11 },

  // ── Bottom strip — Calendar + Social sentiment ─────────────────────────────
  { id: 'calendar',     x: 5,  y: 35, w: 7, h: 9  },
  { id: 'pulse',        x: 0,  y: 44, w: 12, h: 4 },
];

let grid;

// Bump this whenever the DEFAULT_LAYOUT changes significantly so stale
// localStorage positions are discarded and fresh defaults load automatically.
const LAYOUT_VERSION = 11;

function initGrid() {
  grid = GridStack.init({
    column:     12,
    cellHeight: 80,
    margin:     6,
    animate:    true,
    float:      true,
    handle:     '.panel-header',
    resizable:  { handles: 'all' },
  }, '#dashboard-grid');

  // Clear stale layout if version has changed
  const storedVer = parseInt(localStorage.getItem('kronos-layout-version') || '0', 10);
  if (storedVer < LAYOUT_VERSION) {
    localStorage.removeItem('kronos-layout');
    localStorage.setItem('kronos-layout-version', String(LAYOUT_VERSION));
  }

  // Restore saved layout — merge with DEFAULT_LAYOUT so newly added panels
  // always appear even if they're missing from an old saved layout.
  const saved = localStorage.getItem('kronos-layout');
  if (saved) {
    try {
      const savedLayout = JSON.parse(saved);
      const savedIds    = new Set(savedLayout.map(i => i.id));
      // Any panel in DEFAULT_LAYOUT that isn't in the saved data gets its default position
      const missing = DEFAULT_LAYOUT.filter(item => !savedIds.has(item.id));
      grid.load([...savedLayout, ...missing]);
    } catch (_) {
      // Corrupt save — just use defaults
      localStorage.removeItem('kronos-layout');
    }
  }

  // Save on move/resize
  grid.on('change', () => {
    localStorage.setItem('kronos-layout', JSON.stringify(grid.save(false)));
  });

  // Reset button — restore every panel to its default position
  const resetBtn = document.getElementById('reset-layout');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      localStorage.removeItem('kronos-layout');
      grid.batchUpdate();
      DEFAULT_LAYOUT.forEach(item => {
        const el = document.querySelector(`[gs-id="${item.id}"]`);
        if (el) grid.update(el, { x: item.x, y: item.y, w: item.w, h: item.h });
      });
      grid.commit();
    });
  }
}

// ─── Open Interest ────────────────────────────────────────────────────────────
let _oiSymbol = 'BTCUSDT';
let _oiData   = null;   // [{ts, oi}]

function setOiSymbol(coin) {
  _oiSymbol = coin === 'ETH' ? 'ETHUSDT' : 'BTCUSDT';
  setActiveCoinBtn('oi', coin);
  const tag = document.getElementById('oi-tag');
  if (tag) tag.textContent = `48h · ${coin}`;
  fetchOI();
}

function _fmtOI(v) {
  if (v >= 1e9)  return '$' + (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6)  return '$' + (v / 1e6).toFixed(1) + 'M';
  return '$' + v.toFixed(0);
}


function _renderOI() {
  if (!_oiData || _oiData.length < 2) return;
  const setup = setupCanvas(document.getElementById('oi-canvas'));
  if (!setup) return;
  const { ctx, W, H } = setup;
  ctx.save();

  const PAD    = { l: 60, r: 12, t: 16, b: 28 };
  const plotW  = W - PAD.l - PAD.r;
  const plotH  = H - PAD.t - PAD.b;
  const pts    = _oiData;
  const oiVals = pts.map(p => p.oi);

  const rawLo  = Math.min(...oiVals), rawHi = Math.max(...oiVals);
  const rangePad = (rawHi - rawLo) * 0.08 || rawHi * 0.02;
  const yLo    = rawLo - rangePad, yHi = rawHi + rangePad;

  const tStart = pts[0].ts, tEnd = pts[pts.length - 1].ts;
  function toX(ts) { return PAD.l + (ts - tStart) / (tEnd - tStart) * plotW; }
  function toY(v)  { return PAD.t + (1 - (v - yLo) / (yHi - yLo)) * plotH; }

  // ── Background ───────────────────────────────────────────────────────────────
  ctx.fillStyle = '#060a0f';
  ctx.fillRect(0, 0, W, H);

  // ── Horizontal grid lines + Y labels ────────────────────────────────────────
  const rawStep = (yHi - yLo) / 5;
  const mag     = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const yStep   = Math.ceil(rawStep / mag) * mag;
  const yStart  = Math.ceil(yLo / yStep) * yStep;

  ctx.strokeStyle = '#0c1823';
  ctx.lineWidth   = 0.5;
  ctx.font        = `9px 'JetBrains Mono', monospace`;
  ctx.fillStyle   = '#3a5a78';
  ctx.textAlign   = 'right';
  ctx.textBaseline = 'middle';
  for (let v = yStart; v <= yHi; v += yStep) {
    const y = toY(v);
    ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(PAD.l + plotW, y); ctx.stroke();
    ctx.fillText(_fmtOI(v), PAD.l - 4, y);
  }

  // ── Vertical time grid + X labels ───────────────────────────────────────────
  const spanH       = (tEnd - tStart) / 3_600_000;
  const gridIntervalH = spanH > 36 ? 12 : 6;
  const gridMs      = gridIntervalH * 3_600_000;
  ctx.textAlign     = 'center';
  ctx.textBaseline  = 'top';
  pts.forEach(p => {
    if (p.ts % gridMs < 3_600_000) {
      const x = toX(p.ts);
      ctx.strokeStyle = '#0c1823';
      ctx.lineWidth   = 0.5;
      ctx.beginPath(); ctx.moveTo(x, PAD.t); ctx.lineTo(x, PAD.t + plotH); ctx.stroke();
      const d = new Date(p.ts);
      const label = d.getUTCHours() === 0
        ? d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', timeZone: 'UTC' })
        : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
      ctx.fillStyle = '#3a5a78';
      ctx.fillText(label, x, PAD.t + plotH + 6);
    }
  });

  // ── 24h divider ──────────────────────────────────────────────────────────────
  const midTs = pts[Math.floor(pts.length / 2)]?.ts;
  if (midTs) {
    const xMid = toX(midTs);
    ctx.strokeStyle = '#1e3858';
    ctx.lineWidth   = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(xMid, PAD.t); ctx.lineTo(xMid, PAD.t + plotH); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle   = '#1e3858';
    ctx.font        = `bold 9px 'JetBrains Mono', monospace`;
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('24H AGO', xMid, PAD.t + 2);
  }

  // ── OI fill gradient ─────────────────────────────────────────────────────────
  const grad = ctx.createLinearGradient(0, PAD.t, 0, PAD.t + plotH);
  grad.addColorStop(0,   'rgba(0,180,240,0.18)');
  grad.addColorStop(1,   'rgba(0,180,240,0.00)');
  ctx.beginPath();
  ctx.moveTo(toX(pts[0].ts), toY(pts[0].oi));
  pts.forEach(p => ctx.lineTo(toX(p.ts), toY(p.oi)));
  ctx.lineTo(toX(pts[pts.length - 1].ts), PAD.t + plotH);
  ctx.lineTo(toX(pts[0].ts), PAD.t + plotH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // ── OI line ──────────────────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.strokeStyle = '#00b4f0';
  ctx.lineWidth   = 1.5;
  ctx.lineJoin    = 'round';
  pts.forEach((p, i) => {
    i === 0 ? ctx.moveTo(toX(p.ts), toY(p.oi)) : ctx.lineTo(toX(p.ts), toY(p.oi));
  });
  ctx.stroke();

  // ── Latest dot ───────────────────────────────────────────────────────────────
  const last = pts[pts.length - 1];
  ctx.beginPath();
  ctx.arc(toX(last.ts), toY(last.oi), 3.5, 0, Math.PI * 2);
  ctx.fillStyle   = '#00b4f0';
  ctx.fill();
  ctx.strokeStyle = '#060a0f';
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  ctx.restore();
}

async function fetchOI() {
  _drawOiStatus('Loading data…');
  try {
    // Try Binance directly first; fall back to local proxy if CORS blocks it
    let raw = null;
    const urls = [
      `https://fapi.binance.com/futures/data/openInterestHist?symbol=${_oiSymbol}&period=1h&limit=48`,
      `/api/openinterest?symbol=${_oiSymbol}`,
    ];
    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json();
        if (Array.isArray(j) && j.length) { raw = j; break; }
        throw new Error('empty');
      } catch (e) {
        console.warn('[OI] fetch attempt failed:', url, e.message);
      }
    }

    if (!raw) throw new Error('all sources failed');
    console.log('[OI] got', raw.length, 'points. Sample:', raw[0]);

    _oiData = raw.map(d => ({ ts: d.timestamp, oi: parseFloat(d.sumOpenInterestValue) }));

    // Header stats: current value + 24h change
    const cur  = _oiData[_oiData.length - 1].oi;
    const ago  = _oiData[Math.max(0, _oiData.length - 25)].oi;
    const pct  = ((cur - ago) / ago) * 100;
    const statsEl = document.getElementById('oi-header-stats');
    if (statsEl) {
      const sign = pct >= 0 ? '+' : '';
      statsEl.textContent = `${_fmtOI(cur)}  ${sign}${pct.toFixed(2)}% 24H`;
      statsEl.className   = 'oi-header-stats ' + (pct >= 0 ? 'positive' : 'negative');
    }

    _renderOI();
  } catch (e) {
    console.error('[MEEZUS] OI fetch failed:', e.message);
    _drawOiStatus('Data unavailable · ' + e.message);
  }
}

// Draw a text message directly onto the canvas (visible regardless of overlay CSS)
function _drawOiStatus(msg) {
  const setup = setupCanvas(document.getElementById('oi-canvas'));
  if (!setup) return;
  const { ctx, W, H } = setup;
  ctx.save();
  ctx.fillStyle = '#060a0f';
  ctx.fillRect(0, 0, W, H);
  ctx.font = `500 11px 'JetBrains Mono', monospace`;
  ctx.fillStyle = '#00b4f0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(msg, W / 2, H / 2);
  ctx.restore();
}

function initOI() {
  fetchOI();
  setInterval(fetchOI, 5 * 60_000);   // refresh every 5 min (Binance updates hourly hist)
  const canvas = document.getElementById('oi-canvas');
  if (canvas && window.ResizeObserver) {
    new ResizeObserver(() => _renderOI()).observe(canvas);
  }
}

// ─── Crypto Pulse (social sentiment) ──────────────────────────────────────────
// Methodology (VADER-inspired, adapted for crypto):
//   1. Server pulls Reddit hot posts from r/CryptoCurrency, r/Bitcoin,
//      r/CryptoMarkets.
//   2. We score each post's title+body with a crypto-aware lexicon, normalize
//      to [-1, +1] with a softmax-like compound, then weight by reach
//      (log(upvotes) * upvote_ratio).
//   3. Aggregate to a single -100..+100 market score, classify, and surface
//      the most-bullish / most-bearish posts.

// ~180 keywords tuned for crypto-Twitter / Reddit vocabulary.
const PULSE_LEX = {
  // Bullish — crypto-specific
  moon: 4, mooning: 4, lambo: 3, ath: 3, breakout: 3, breakouts: 3,
  pump: 3, pumping: 3, pumped: 2, rally: 3, rallies: 3, rallying: 3,
  surge: 3, surging: 3, surged: 3, soar: 3, soaring: 3, soared: 3,
  parabolic: 4, vertical: 2, melts: -2, melt: -1,
  bullish: 3, bull: 2, bulls: 2, bullrun: 4, supercycle: 3,
  long: 1, longs: 1, longing: 1, longed: 1,
  hodl: 1, hodling: 1, accumulate: 2, accumulating: 2, stacking: 2, stack: 1,
  buy: 1, buying: 1, bought: 1, buyers: 1,
  green: 1, gain: 1, gains: 2, gaining: 2, profit: 2, profits: 2, profitable: 2,
  win: 1, wins: 1, winning: 1, winner: 2, winners: 2, victory: 2,
  adoption: 3, adopting: 2, mainstream: 2, institutional: 2,
  etf: 2, approval: 2, approved: 3, breakthrough: 3, milestone: 2,
  upside: 2, upgrade: 2, upgraded: 2, halving: 2, halved: 1,
  recovery: 2, rebound: 2, reversal: 1, bounce: 2, bouncing: 2,
  support: 1, supported: 1, accumulation: 2, oversold: 1,
  rocket: 3, gem: 2, alpha: 2, beats: 1, beat: 1, beating: 1, beats: 1,
  innovative: 2, revolutionary: 3, disruptive: 2, growth: 2, growing: 1,
  surging: 3, exploded: 3, exploding: 3, blast: 2, blasting: 2,
  optimistic: 2, optimism: 2, hopeful: 1, confident: 2,

  // Bearish — crypto-specific
  crash: -4, crashing: -4, crashed: -4, plunge: -4, plunged: -4, plunging: -4,
  collapse: -5, collapsed: -5, collapsing: -5, meltdown: -4,
  dump: -3, dumping: -3, dumped: -3, tank: -3, tanking: -3, tanked: -3,
  bearish: -3, bear: -2, bears: -2, bearmarket: -4,
  short: -1, shorts: -1, shorting: -1, shorted: -1,
  liquidated: -3, liquidation: -3, liquidations: -3, liq: -2, liqs: -2,
  rekt: -3, capitulation: -4, capitulate: -4, capitulating: -4,
  rug: -4, rugged: -4, rugpull: -5, scam: -4, ponzi: -4, fraud: -4,
  hack: -3, hacked: -3, exploit: -3, exploited: -3, breach: -3,
  fud: -2, fear: -2, panic: -3, panicking: -3, crisis: -3,
  sell: -1, sells: -1, selling: -2, sold: -1, sellers: -1, dumping: -3,
  red: -1, loss: -2, losses: -2, losing: -2, loser: -2, losers: -2,
  drop: -2, dropped: -2, dropping: -2, decline: -2, declined: -2, declining: -2,
  falling: -2, fell: -2, fallen: -2, down: -1, downtrend: -2, downside: -2,
  resistance: -1, overbought: -2, bubble: -2, burst: -2, popped: -2,
  worthless: -4, dying: -3, dead: -3, doomed: -3, doom: -3, bleeding: -2,
  bagholder: -2, bagholders: -2, holding: 0, stuck: -1,
  warning: -1, warnings: -1, danger: -2, dangerous: -2, risk: -1, risky: -2,
  pessimistic: -2, bearish: -3, doubt: -1, doubts: -1, uncertain: -1,
  regulation: -1, ban: -3, banned: -3, restriction: -2, restrictive: -2,

  // General sentiment lifts/dampers
  great: 2, amazing: 3, awesome: 3, excellent: 3, fantastic: 3, brilliant: 3,
  best: 2, better: 1, good: 1, solid: 1, strong: 2, stronger: 2, strongest: 3,
  perfect: 3, incredible: 3, fire: 2, lit: 2, based: 1,
  bad: -1, terrible: -3, awful: -3, horrible: -3, worst: -3, worse: -2,
  weak: -2, weaker: -2, weakest: -3, poor: -1, fail: -2, failing: -2, failed: -2,
  pathetic: -3, joke: -2, garbage: -3, trash: -3, shit: -2, shitty: -2,
  bs: -2, lol: 0, lmao: 0,
};

// Negators flip the next token's contribution
const PULSE_NEGATORS = new Set([
  "not", "no", "never", "none", "nothing", "neither", "nor", "without",
  "isn", "isnt", "wasn", "wasnt", "aren", "arent", "weren", "werent",
  "don", "dont", "doesn", "doesnt", "didn", "didnt",
  "won", "wont", "wouldn", "wouldnt", "couldn", "couldnt", "shouldn", "shouldnt",
]);

function _pulseScoreText(text) {
  if (!text) return { score: 0, hits: 0 };
  const allCapsRuns = (text.match(/\b[A-Z]{2,}\b/g) || []).length;
  const exclaims    = (text.match(/!/g) || []).length;
  const intensity   = 1 + Math.min(0.6, allCapsRuns * 0.06 + exclaims * 0.08);

  const tokens = text.toLowerCase().replace(/[’']/g, '').match(/[a-z]+/g) || [];
  let sum = 0, hits = 0, negate = false, negateLife = 0;

  for (const t of tokens) {
    if (PULSE_NEGATORS.has(t)) { negate = true; negateLife = 3; continue; }
    const v = PULSE_LEX[t];
    if (v !== undefined) {
      sum += (negate ? -v * 0.6 : v) * intensity;
      hits++;
      negate = false;
    }
    if (negate && --negateLife <= 0) negate = false;
  }
  return { score: sum, hits, intensity };
}

// VADER-style normalization: maps any real score onto [-1, +1] using
//   compound = score / sqrt(score² + α)        — α=15 is the VADER default
function _pulseCompound(rawScore, alpha = 15) {
  return rawScore / Math.sqrt(rawScore * rawScore + alpha);
}

function _pulseClassify(s) {
  if (s >=  60) return { lbl: 'Euphoria',     cls: 'pulse-euphoria' };
  if (s >=  25) return { lbl: 'Bullish',      cls: 'pulse-bullish'  };
  if (s >=  10) return { lbl: 'Mild Bullish', cls: 'pulse-mild-bullish' };
  if (s >  -10) return { lbl: 'Neutral',      cls: 'pulse-neutral'  };
  if (s >  -25) return { lbl: 'Mild Bearish', cls: 'pulse-mild-bearish' };
  if (s >  -60) return { lbl: 'Bearish',      cls: 'pulse-bearish'  };
                return { lbl: 'Capitulation', cls: 'pulse-capitulation' };
}

function _pulseTimeAgo(ms) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60)      return `${s}s ago`;
  if (s < 3600)    return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)   return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

async function fetchPulse() {
  try {
    const res  = await fetch('/api/sentiment', { cache: 'no-store' });
    const data = await res.json();
    if (!data.items || !data.items.length) throw new Error('No posts');

    // Score every item.
    // Reach weight differs by source:
    //   reddit → log(upvotes+1) × upvote_ratio
    //   news/macro/hn → fixed baseline (curated → all headlines weigh equally)
    // Then multiply by per-item `src_weight` (set server-side per source).
    data.items.forEach(it => {
      const text  = it.title + ' ' + (it.selftext || '');
      const { score, hits } = _pulseScoreText(text);
      it.raw      = score;
      it.hits     = hits;
      it.compound = hits > 0 ? _pulseCompound(score) : 0;

      let baseReach;
      if (it.src === 'reddit') {
        baseReach = Math.log(Math.max(2, it.score + 1)) * (it.upvote_ratio || 0.5);
      } else if (it.src === 'hn') {
        baseReach = Math.log(Math.max(2, it.score + 1)) * 0.6;
      } else {
        // news / macro headlines — no engagement metric, fixed reach
        baseReach = 2.0;
      }
      it.reach    = baseReach * (it.src_weight || 1);
      it.weighted = it.compound * it.reach;
    });

    const totalReach   = data.items.reduce((s, it) => s + it.reach,    0);
    const weightedSum  = data.items.reduce((s, it) => s + it.weighted, 0);
    const compound     = totalReach > 0 ? weightedSum / totalReach : 0;
    const score100     = Math.round(compound * 100);

    const bullishCount = data.items.filter(it => it.compound >  0.05).length;
    const bearishCount = data.items.filter(it => it.compound < -0.05).length;
    const neutralCount = data.items.length - bullishCount - bearishCount;

    _renderPulse({
      score100,
      compound,
      bullishCount, bearishCount, neutralCount,
      total: data.items.length,
      items: data.items,
      generatedAt: data.generated_at,
    });
  } catch (e) {
    console.warn('[MEEZUS] Pulse fetch failed:', e.message);
    const lbl = document.getElementById('pulse-label');
    if (lbl) lbl.textContent = 'Unavailable';
  }
}

function _renderPulse({ score100, bullishCount, bearishCount, neutralCount, total, items, generatedAt }) {
  // Big score
  const scoreEl = document.getElementById('pulse-score');
  if (scoreEl) {
    const sign = score100 > 0 ? '+' : '';
    scoreEl.textContent = `${sign}${score100}`;
    scoreEl.className = 'pulse-score ' + (score100 > 10 ? 'pos' : score100 < -10 ? 'neg' : 'mid');
  }

  // Label + classification
  const cls = _pulseClassify(score100);
  const lblEl = document.getElementById('pulse-label');
  if (lblEl) {
    lblEl.textContent = cls.lbl;
    lblEl.className   = 'pulse-label ' + cls.cls;
  }

  // Bar fill + needle
  const fillEl   = document.getElementById('pulse-bar-fill');
  const needleEl = document.getElementById('pulse-bar-needle');
  if (fillEl && needleEl) {
    const pct = (score100 + 100) / 2;   // 0..100 from -100..+100
    needleEl.style.left = `${pct}%`;
    if (score100 >= 0) {
      fillEl.style.left  = '50%';
      fillEl.style.width = `${pct - 50}%`;
      fillEl.className   = 'pulse-bar-fill pos';
    } else {
      fillEl.style.left  = `${pct}%`;
      fillEl.style.width = `${50 - pct}%`;
      fillEl.className   = 'pulse-bar-fill neg';
    }
  }

  // Stats — polarity counts + source mix
  const statsEl = document.getElementById('pulse-stats');
  if (statsEl) {
    const srcMix = {};
    items.forEach(it => { srcMix[it.src] = (srcMix[it.src] || 0) + 1; });
    const srcStr = Object.entries(srcMix)
      .map(([s, n]) => `${n} ${s}`)
      .join(' · ');
    statsEl.innerHTML =
      `<span class="pulse-stat-pos">${bullishCount} bull</span> · ` +
      `<span class="pulse-stat-mid">${neutralCount} neutral</span> · ` +
      `<span class="pulse-stat-neg">${bearishCount} bear</span>` +
      `<br><span class="pulse-stat-sources">${srcStr}</span>`;
  }

  // Meta
  const metaEl = document.getElementById('pulse-meta');
  if (metaEl) {
    metaEl.textContent = `${total} posts · ${_pulseTimeAgo(generatedAt)}`;
  }

  // Top bullish / bearish lists (sort by absolute compound × reach)
  const ranked = [...items].sort((a, b) => Math.abs(b.weighted) - Math.abs(a.weighted));
  const topBull = ranked.filter(it => it.compound > 0).slice(0, 4);
  const topBear = ranked.filter(it => it.compound < 0).slice(0, 4);

  const renderList = (list, polarity) => {
    if (!list.length) return '<div class="pulse-item-empty">No clearly ' + polarity + ' posts.</div>';
    return list.map(it => {
      const score = Math.round(it.compound * 100);
      const sign  = score >= 0 ? '+' : '';
      const safeUrl = (it.permalink || '#').replace(/"/g, '&quot;');
      const safeTitle = (it.title || '').replace(/</g, '&lt;');
      const srcBadge = it.src === 'news'  ? 'NEWS'
                     : it.src === 'macro' ? 'MACRO'
                     : it.src === 'hn'    ? 'HN'
                     :                      'REDDIT';
      const engagement = it.src === 'reddit'
        ? `${it.score >= 1000 ? (it.score/1000).toFixed(1) + 'K' : it.score} ↑`
        : it.src === 'hn'
        ? `${it.score >= 1000 ? (it.score/1000).toFixed(1) + 'K' : it.score} pts`
        : '';
      return `<a class="pulse-item" href="${safeUrl}" target="_blank" rel="noopener">
        <span class="pulse-item-score ${polarity}">${sign}${score}</span>
        <span class="pulse-item-title">${safeTitle}</span>
        <span class="pulse-item-meta"><span class="pulse-src-${it.src}">${srcBadge}</span> · ${it.sub}${engagement ? ' · ' + engagement : ''}</span>
      </a>`;
    }).join('');
  };

  const bullList = document.getElementById('pulse-bull-list');
  const bearList = document.getElementById('pulse-bear-list');
  if (bullList) bullList.innerHTML = renderList(topBull, 'pos');
  if (bearList) bearList.innerHTML = renderList(topBear, 'neg');
}

function initPulse() {
  fetchPulse();
  setInterval(fetchPulse, 4 * 60 * 60_000);   // refresh every 4 hours
}

// ─── Quant Analysis ───────────────────────────────────────────────────────────
// Fetches /api/quant (server-side indicator computation + narrative generation).
// Cached 4 h server-side; browser polls on the same cadence.

let _quantData   = null;
let _quantSymbol = 'BTC';

function setQuantSymbol(coin) {
  _quantSymbol = coin;
  setActiveCoinBtn('quant', coin);
  if (_quantData) _renderQuant(_quantData);
}

function _quantAgo(ms) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 120)   return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function _qClamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function _qPrice(v) {
  if (v >= 1000) return '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 });
  return '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function _renderQuant(data) {
  const body = document.getElementById('quant-body');
  if (!body) return;

  const sym = data.symbols?.[_quantSymbol];
  if (!sym || sym.error) {
    body.innerHTML = `<div class="quant-loading">${sym?.error || 'Analysis unavailable'}</div>`;
    return;
  }

  const sig = sym.signals;
  const p   = sym.price;

  const rc   = sym.regime.toLowerCase();
  const rCls = rc.includes('bull') ? 'bull' : rc.includes('bear') ? 'bear' : 'neutral';

  // ── EMA alignment ───────────────────────────────────────────────────────
  const emaBull = [sig.ema20, sig.ema50, sig.ema200].filter(v => p > v).length;

  // ── Build signal rows ──────────────────────────────────────────────────
  // kind 'dir' → centre-anchored lean meter (marker at pos%, 0=bear …100=bull)
  // kind 'mag' → left-anchored magnitude bar (fill%)
  const dirRow = (pos, cls, status) => ({ kind: 'dir', pos: _qClamp(pos, 3, 97), cls, status });
  const magRow = (fill, cls, status) => ({ kind: 'mag', fill: _qClamp(fill, 4, 100), cls, status });

  const rsiCls  = v => v >= 70 ? 'bear' : v >= 58 ? 'bull' : v >= 45 ? 'neutral' : v >= 30 ? 'bear' : 'bull';
  const rsiStat = v => v >= 70 ? 'Overbought' : v >= 58 ? 'Bullish' : v >= 45 ? 'Neutral' : v >= 30 ? 'Weak' : 'Oversold';

  const signals = [
    { name: 'RSI', tag: '14D', val: sig.rsi.toFixed(1),
      ...dirRow(sig.rsi, rsiCls(sig.rsi), rsiStat(sig.rsi)) },
    { name: 'RSI', tag: '4H', val: sym.rsi_4h.toFixed(1),
      ...dirRow(sym.rsi_4h, rsiCls(sym.rsi_4h), rsiStat(sym.rsi_4h)) },
    { name: 'EMA Trend', tag: '20·50·200', val: `${emaBull}/3`,
      ...dirRow((emaBull / 3) * 100,
        emaBull >= 2 ? 'bull' : emaBull === 0 ? 'bear' : 'neutral',
        emaBull === 3 ? 'Aligned ↑' : emaBull === 0 ? 'Aligned ↓' : 'Mixed') },
    { name: 'MACD', tag: '12·26·9', val: sig.macd > sig.macd_signal ? 'Bull' : 'Bear',
      ...dirRow(sig.macd > sig.macd_signal ? 74 : 26,
        sig.macd > sig.macd_signal ? 'bull' : 'bear',
        sig.macd > sig.macd_signal ? 'Cross ↑' : 'Cross ↓') },
    { name: 'Funding', tag: 'PERP', val: (sig.funding > 0 ? '+' : '') + sig.funding.toFixed(4) + '%',
      ...dirRow(50 + sig.funding * 500,
        sig.funding > 0.05 ? 'bear' : sig.funding > 0.01 ? 'neutral' : sig.funding < -0.02 ? 'bull' : 'normal',
        sig.funding > 0.05 ? 'Crowded' : sig.funding < -0.02 ? 'Short skew' : 'Balanced') },
    { name: 'Open Interest', tag: '24H', val: (sig.oi_change > 0 ? '+' : '') + sig.oi_change.toFixed(1) + '%',
      ...dirRow(50 + sig.oi_change * 3,
        sig.oi_change > 3 ? (emaBull >= 2 ? 'bull' : 'bear') : sig.oi_change < -3 ? 'bear' : 'neutral',
        sig.oi_change > 3 ? 'Expanding' : sig.oi_change < -3 ? 'Unwinding' : 'Stable') },
    { name: 'L/S Ratio', tag: 'ACCTS', val: sig.ls_ratio.toFixed(2),
      ...dirRow((sig.ls_ratio - 1) * 90 + 50,
        sig.ls_ratio > 1.4 ? 'bear' : sig.ls_ratio < 0.85 ? 'bull' : 'neutral',
        sig.ls_ratio > 1.4 ? 'Crowded L' : sig.ls_ratio < 0.85 ? 'Net short' : 'Balanced') },
    { name: 'Volatility', tag: 'ATR', val: sig.atr_pct.toFixed(1) + '%',
      ...magRow(sig.atr_pct / 6 * 100,
        sig.atr_pct > 4 ? 'bear' : sig.atr_pct < 1.5 ? 'neutral' : 'cyan',
        sig.atr_pct > 4 ? 'Elevated' : sig.atr_pct < 1.5 ? 'Compressed' : 'Moderate') },
    { name: 'Volume', tag: 'vs 20D', val: sig.vol_ratio.toFixed(2) + '×',
      ...magRow(sig.vol_ratio / 2.5 * 100,
        sig.vol_ratio > 1.5 ? 'cyan' : sig.vol_ratio < 0.7 ? 'neutral' : 'cyan',
        sig.vol_ratio > 1.5 ? 'High' : sig.vol_ratio < 0.7 ? 'Thin' : 'Normal') },
  ];

  const signalRows = signals.map(s => {
    const meter = s.kind === 'dir'
      ? `<div class="qsig-track dir">
           <span class="qsig-mid"></span>
           <span class="qsig-marker ${s.cls}" style="left:${s.pos}%"></span>
         </div>`
      : `<div class="qsig-track mag">
           <span class="qsig-fill ${s.cls}" style="width:${s.fill}%"></span>
         </div>`;
    return `<div class="qsig">
      <div class="qsig-id">
        <span class="qsig-name">${s.name}</span>
        <span class="qsig-tag">${s.tag}</span>
      </div>
      <span class="qsig-val ${s.cls}">${s.val}</span>
      ${meter}
      <span class="qsig-status ${s.cls}">${s.status}</span>
    </div>`;
  }).join('');

  // ── Segmented LED bias gauge (10 segments) ──────────────────────────────
  const segs = Array.from({ length: 10 }, (_, i) =>
    `<span class="qseg ${i < sym.bias_score ? 'on ' + rCls : ''}"></span>`
  ).join('');

  // ── Analysis sections (split "Label: body") ─────────────────────────────
  const SECTIONS = ['Structure', 'Momentum', 'Derivatives', 'Verdict'];
  const sectionsHtml = (sym.paragraphs || []).map((txt, i) => {
    const isVerdict = (i === sym.paragraphs.length - 1);
    const label = SECTIONS[i] || `Note ${i + 1}`;
    const bodyTxt = txt.replace(/^[^:]*:\s*/, '');
    return `<div class="qsec${isVerdict ? ' verdict' : ''}">
      <div class="qsec-head">
        <span class="qsec-led ${isVerdict ? rCls : 'cyan'}"></span>
        <span class="qsec-label">${label}</span>
        <span class="qsec-rule"></span>
      </div>
      <p class="qsec-body">${bodyTxt}</p>
    </div>`;
  }).join('');

  // ── Key levels ──────────────────────────────────────────────────────────
  const supports    = (sym.key_levels?.support    || []);
  const resistances = (sym.key_levels?.resistance || []);
  const lvlHtml = (supports.length || resistances.length) ? `
    <div class="qlevels">
      <div class="qlvl-col">
        <div class="qlvl-head support">▼ Support</div>
        ${supports.length ? supports.map(l => `<span class="qlvl-item">${_qPrice(l)}</span>`).join('') : '<span class="qlvl-none">—</span>'}
      </div>
      <div class="qlvl-col">
        <div class="qlvl-head resistance">▲ Resistance</div>
        ${resistances.length ? resistances.map(l => `<span class="qlvl-item">${_qPrice(l)}</span>`).join('') : '<span class="qlvl-none">—</span>'}
      </div>
    </div>` : '';

  body.innerHTML = `
    <div class="quant-hero">
      <div class="quant-hero-l">
        <span class="quant-regime-badge ${rCls}">${sym.regime}</span>
        <span class="quant-hero-price">${_qPrice(p)}</span>
      </div>
      <div class="quant-gauge">
        <div class="qseg-row">${segs}</div>
        <span class="quant-gauge-num">${sym.bias_score}<span class="quant-gauge-den">/10</span></span>
      </div>
    </div>

    <div class="quant-sec-label">Signal Matrix · <span class="quant-sec-sub">9 indicators</span></div>
    <div class="quant-grid">${signalRows}</div>

    <div class="quant-sec-label">Engine Analysis</div>
    <div class="quant-sections">${sectionsHtml}</div>

    ${lvlHtml}
  `;

  const upd = document.getElementById('quant-updated');
  if (upd && data.generated_at) upd.textContent = _quantAgo(data.generated_at);
}

async function fetchQuant() {
  const body = document.getElementById('quant-body');
  try {
    const res = await fetch('/api/quant', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _quantData = await res.json();
    _renderQuant(_quantData);
    console.log('[MEEZUS] Quant loaded — BTC:', _quantData.symbols?.BTC?.regime,
                '· ETH:', _quantData.symbols?.ETH?.regime);
  } catch (e) {
    console.warn('[MEEZUS] Quant fetch failed:', e.message);
    if (body) body.innerHTML = '<div class="quant-loading">Analysis unavailable — is server.py running?</div>';
  }
}

function initQuant() {
  setActiveCoinBtn('quant', _quantSymbol);
  fetchQuant();
  setInterval(fetchQuant, 4 * 60 * 60_000);  // refresh every 4 hours
}


// ─── Layout slot manager ──────────────────────────────────────────────────────
const LAYOUTS_KEY  = 'kronos-saved-layouts';
const MAX_SLOTS    = 5;

function _getSlots() {
  try { return JSON.parse(localStorage.getItem(LAYOUTS_KEY)) || []; }
  catch (_) { return []; }
}
function _setSlots(slots) {
  localStorage.setItem(LAYOUTS_KEY, JSON.stringify(slots));
}

function saveLayoutSlot() {
  const slots = _getSlots();
  if (slots.length >= MAX_SLOTS) {
    // Flash the save button red to signal limit reached
    const btn = document.getElementById('layout-save-btn');
    if (btn) { btn.classList.add('layout-save-full'); setTimeout(() => btn.classList.remove('layout-save-full'), 1200); }
    return;
  }
  const now  = new Date();
  const name = `Layout ${slots.length + 1}  ·  ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  slots.push({ name, ts: now.toISOString(), layout: grid.save(false) });
  _setSlots(slots);
  _renderLayoutMenu();
  _flashSaveBtn();
}

function loadLayoutSlot(idx) {
  const slots = _getSlots();
  const slot  = slots[idx];
  if (!slot) return;
  const savedIds = new Set(slot.layout.map(i => i.id));
  const missing  = DEFAULT_LAYOUT.filter(item => !savedIds.has(item.id));
  grid.load([...slot.layout, ...missing]);
  localStorage.setItem('kronos-layout', JSON.stringify(grid.save(false)));
  closeLayoutMenu();
}

function deleteLayoutSlot(idx) {
  const slots = _getSlots();
  slots.splice(idx, 1);
  // Rename so numbers stay sequential
  slots.forEach((s, i) => {
    s.name = s.name.replace(/^Layout \d+/, `Layout ${i + 1}`);
  });
  _setSlots(slots);
  _renderLayoutMenu();
}

function _flashSaveBtn() {
  const btn = document.getElementById('layout-save-btn');
  if (!btn) return;
  btn.textContent = '✓ SAVED';
  btn.classList.add('layout-save-ok');
  setTimeout(() => {
    btn.textContent = '＋ SAVE CURRENT';
    btn.classList.remove('layout-save-ok');
  }, 1400);
}

function _renderLayoutMenu() {
  const list   = document.getElementById('layout-slot-list');
  const saveBtn = document.getElementById('layout-save-btn');
  if (!list) return;

  const slots = _getSlots();

  if (!slots.length) {
    list.innerHTML = '<div class="layout-empty-msg">No saved layouts yet.</div>';
  } else {
    list.innerHTML = slots.map((s, i) => `
      <div class="layout-slot-row">
        <span class="layout-slot-name">${s.name}</span>
        <button class="layout-slot-load" onclick="loadLayoutSlot(${i})">LOAD</button>
        <button class="layout-slot-del"  onclick="deleteLayoutSlot(${i})">✕</button>
      </div>
    `).join('');
  }

  // Disable save button at max capacity
  if (saveBtn) {
    saveBtn.disabled = slots.length >= MAX_SLOTS;
    saveBtn.title    = slots.length >= MAX_SLOTS ? `Max ${MAX_SLOTS} layouts reached — delete one first` : '';
  }
}

function closeLayoutMenu() {
  document.getElementById('layout-dropdown')?.classList.remove('open');
  document.getElementById('layout-menu-btn')?.classList.remove('active');
}

function initLayoutMenu() {
  const btn      = document.getElementById('layout-menu-btn');
  const dropdown = document.getElementById('layout-dropdown');
  const saveBtn  = document.getElementById('layout-save-btn');

  btn?.addEventListener('click', e => {
    e.stopPropagation();
    const open = dropdown.classList.toggle('open');
    btn.classList.toggle('active', open);
    if (open) _renderLayoutMenu();
  });

  saveBtn?.addEventListener('click', saveLayoutSlot);

  // Close when clicking outside
  document.addEventListener('click', e => {
    if (!document.getElementById('layout-menu-wrap')?.contains(e.target)) {
      closeLayoutMenu();
    }
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  initGrid();
  initLayoutMenu();
  initHeatmap();
  initSessionsClock();
  initForecast();
  initOI();
  initPulse();
  initQuant();
  loadStreams();

  // Redraw gauge on panel resize (GridStack resize or window resize)
  const fgCanvas = document.getElementById('fg-canvas');
  if (fgCanvas && window.ResizeObserver) {
    new ResizeObserver(() => _drawFGGauge(_fgCurrent)).observe(fgCanvas);
  }

  // First load
  fetchPrices();
  fetchFunding();
  fetchLongShort();
  fetchFearGreed();
  fetchDominance();
  fetchVIX();
  fetchPutCall();
  fetchNews();
  fetchCryptoNews();
  fetchCalendar();
  updateTradFi();

  // Polling
  const r = CONFIG?.refresh ?? {};
  setInterval(fetchPrices,    r.prices    ?? 10_000);
  setInterval(fetchFunding,   r.funding   ?? 30_000);
  setInterval(fetchLongShort, r.funding   ?? 30_000);
  setInterval(fetchFearGreed, r.fearGreed ?? 300_000);
  setInterval(fetchDominance, r.dominance ?? 300_000);
  setInterval(fetchVIX,       r.vix       ?? 60_000);
  setInterval(fetchNews,        r.news     ?? 120_000);
  setInterval(fetchCryptoNews,  r.news     ?? 120_000);
  setInterval(fetchCalendar,    r.calendar ?? 600_000); // every 10 min
  setInterval(updateTradFi,   30_000);
}

document.addEventListener('DOMContentLoaded', init);
