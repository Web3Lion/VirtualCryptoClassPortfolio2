'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const fmtUSD = (n) => {
  const num = parseFloat(n);
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
};
const fmtPct = (n) => {
  const num = parseFloat(n);
  if (isNaN(num)) return '0.00%';
  return (num >= 0 ? '+' : '') + num.toFixed(2) + '%';
};
const fmtNum = (n) => {
  const num = parseFloat(n);
  if (isNaN(num)) return '0';
  if (num >= 1000) return num.toLocaleString('en-US', { maximumFractionDigits: 4 });
  return num.toFixed(6).replace(/\.?0+$/, '');
};
const clean = s => parseFloat(String(s).replace(/[$,%]/g, '')) || 0;

const COIN_COLORS = {
  BTC:'#f7931a',ETH:'#627eea',SOL:'#9945ff',ADA:'#0033ad',DOGE:'#c2a633',
  AVAX:'#e84142',DOT:'#e6007a',LINK:'#2a5ada',MATIC:'#8247e5',XRP:'#00aae4',
  BNB:'#f3ba2f',SHIB:'#ff0000',LTC:'#bfbbbb',UNI:'#ff007a',ATOM:'#6f7390',
  DEFAULT:'#00e5a0',
};
const getCoinColor = (ticker) => COIN_COLORS[ticker?.toUpperCase()] || COIN_COLORS.DEFAULT;

// ── Mini sparkline SVG ────────────────────────────────────────────
function Sparkline({ data, color = '#00e5a0', width = 80, height = 32 }) {
  if (!data || data.length < 2) return <span style={{fontSize:10,color:'#475569'}}>—</span>;
  const vals = data.map(d => parseFloat(d));
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  const isUp = vals[vals.length - 1] >= vals[0];
  const lineColor = isUp ? '#00e5a0' : '#f43f5e';
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={pts} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Portfolio line chart ──────────────────────────────────────────
function LineChart({ data, width = '100%', height = 160 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || data.length < 2) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth || 600;
    const H = height;
    canvas.width = W; canvas.height = H;
    ctx.clearRect(0, 0, W, H);
    const vals = data.map(d => d.v);
    const min = Math.min(...vals), max = Math.max(...vals);
    const range = max - min || 1;
    const pad = { t:10, b:24, l:8, r:8 };
    const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;
    const xScale = i => pad.l + (i / (data.length - 1)) * iW;
    const yScale = v => pad.t + iH - ((v - min) / range) * iH;

    // Gradient fill
    const grad = ctx.createLinearGradient(0, pad.t, 0, H - pad.b);
    grad.addColorStop(0, 'rgba(0,229,160,0.2)');
    grad.addColorStop(1, 'rgba(0,229,160,0)');
    ctx.beginPath();
    data.forEach((d, i) => i === 0 ? ctx.moveTo(xScale(i), yScale(d.v)) : ctx.lineTo(xScale(i), yScale(d.v)));
    ctx.lineTo(xScale(data.length - 1), H - pad.b);
    ctx.lineTo(xScale(0), H - pad.b);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    data.forEach((d, i) => i === 0 ? ctx.moveTo(xScale(i), yScale(d.v)) : ctx.lineTo(xScale(i), yScale(d.v)));
    ctx.strokeStyle = '#00e5a0';
    ctx.lineWidth = 2;
    ctx.stroke();

    // End dot
    const lx = xScale(data.length - 1), ly = yScale(vals[vals.length - 1]);
    ctx.beginPath(); ctx.arc(lx, ly, 3, 0, 2 * Math.PI);
    ctx.fillStyle = '#00e5a0'; ctx.fill();

    // X labels (first, middle, last)
    ctx.fillStyle = '#475569'; ctx.font = '10px DM Mono, monospace'; ctx.textAlign = 'center';
    [[0, data[0].t], [Math.floor(data.length/2), data[Math.floor(data.length/2)].t], [data.length-1, data[data.length-1].t]].forEach(([i, label]) => {
      const short = String(label).substring(0, 8);
      ctx.fillText(short, xScale(i), H - 6);
    });
  }, [data, height]);

  if (!data || data.length < 2) return (
    <div style={{height, display:'flex', alignItems:'center', justifyContent:'center', color:'#475569', fontSize:13}}>
      No history data yet
    </div>
  );
  return <canvas ref={canvasRef} style={{width, height, display:'block'}} />;
}

// ── Donut chart ───────────────────────────────────────────────────
function DonutChart({ slices, total, size = 160 }) {
  const cx = size / 2, cy = size / 2, r = size * 0.38, inner = size * 0.24;
  let cumAngle = -Math.PI / 2;
  const paths = slices.map((s, i) => {
    const sweep = (s.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(cumAngle), y1 = cy + r * Math.sin(cumAngle);
    const x2 = cx + r * Math.cos(cumAngle + sweep), y2 = cy + r * Math.sin(cumAngle + sweep);
    const xi1 = cx + inner * Math.cos(cumAngle + sweep), yi1 = cy + inner * Math.sin(cumAngle + sweep);
    const xi2 = cx + inner * Math.cos(cumAngle), yi2 = cy + inner * Math.sin(cumAngle);
    const large = sweep > Math.PI ? 1 : 0;
    const d = `M${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} L${xi1},${yi1} A${inner},${inner} 0 ${large},0 ${xi2},${yi2} Z`;
    cumAngle += sweep;
    return <path key={i} d={d} fill={s.color} opacity={0.9} />;
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {paths}
      <circle cx={cx} cy={cy} r={inner - 2} fill="#0f172a" />
      <text x={cx} y={cy - 6} textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="'DM Mono',monospace">{slices.length - 1}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#e2e8f0" fontSize="9" fontFamily="'DM Mono',monospace">assets</text>
    </svg>
  );
}

// ── P/L bar chart ─────────────────────────────────────────────────
function PLBarChart({ holdings }) {
  if (!holdings || holdings.length === 0) return (
    <div style={{textAlign:'center',color:'#475569',fontSize:13,padding:'24px 0'}}>No holdings data</div>
  );
  const maxAbs = Math.max(...holdings.map(h => Math.abs(h.plPct)), 1);
  return (
    <div style={{display:'flex',flexDirection:'column',gap:8}}>
      {holdings.map((h, i) => {
        const isPos = h.plPct >= 0;
        const barW = Math.abs(h.plPct) / maxAbs * 100;
        return (
          <div key={i} style={{display:'grid',gridTemplateColumns:'60px 1fr 60px',alignItems:'center',gap:8}}>
            <div style={{fontSize:11,fontFamily:"'Syne',sans-serif",fontWeight:700,color:getCoinColor(h.ticker),textAlign:'right'}}>{h.ticker}</div>
            <div style={{background:'var(--surface2)',borderRadius:4,height:8,overflow:'hidden'}}>
              <div style={{width:`${barW}%`,height:'100%',borderRadius:4,background:isPos?'var(--up)':'var(--down)',transition:'width .6s ease'}} />
            </div>
            <div style={{fontSize:11,color:isPos?'var(--up)':'var(--down)',fontWeight:500}}>{fmtPct(h.plPct)}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [portfolio, setPortfolio] = useState(null);
  const [prices, setPrices] = useState({});
  const [history, setHistory] = useState({ intraday:[], daily:[] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('holdings');
  const [chartRange, setChartRange] = useState('intraday');
  const [tradeForm, setTradeForm] = useState({ action:'BUY', coin:'', amountType:'Dollar Amount', amount:'' });
  const [tradeStatus, setTradeStatus] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [portRes, priceRes, histRes] = await Promise.all([
        fetch('/api/portfolio'),
        fetch('/api/prices'),
        fetch('/api/history'),
      ]);
      if (portRes.ok)  { const d = await portRes.json();  setPortfolio(d); setLastUpdated(new Date()); }
      if (priceRes.ok) { const d = await priceRes.json(); setPrices(d); }
      if (histRes.ok)  { const d = await histRes.json();  setHistory(d); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/');
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData();
      const iv = setInterval(fetchData, 60000);
      return () => clearInterval(iv);
    }
  }, [status, fetchData]);

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div style={{background:'#080c14',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#475569',fontFamily:'monospace'}}>
        Checking session...
      </div>
    );
  }

  const executeTrade = async () => {
    if (!tradeForm.coin || !tradeForm.amount) { setTradeStatus({type:'error',msg:'Please fill in all fields.'}); return; }
    setExecuting(true); setTradeStatus({type:'pending',msg:'Executing trade...'});
    try {
      const res = await fetch('/api/trade', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(tradeForm) });
      const data = await res.json();
      if (res.ok) { setTradeStatus({type:'success',msg:`✓ ${tradeForm.action} order placed for ${tradeForm.coin}`}); setTradeForm(f=>({...f,amount:''})); setTimeout(()=>{fetchData();setTradeStatus(null);},3000); }
      else setTradeStatus({type:'error',msg:data.error||'Trade failed.'});
    } catch { setTradeStatus({type:'error',msg:'Network error.'}); }
    finally { setExecuting(false); }
  };

  const sellAll = async () => {
    if (!confirm('Sell ALL holdings? Cannot be undone.')) return;
    setExecuting(true); setTradeStatus({type:'pending',msg:'Liquidating...'});
    try {
      const res = await fetch('/api/trade/sellall', {method:'POST'});
      const data = await res.json();
      if (res.ok) { setTradeStatus({type:'success',msg:'✓ All positions liquidated.'}); setTimeout(()=>{fetchData();setTradeStatus(null);},3000); }
      else setTradeStatus({type:'error',msg:data.error||'Failed.'});
    } catch { setTradeStatus({type:'error',msg:'Network error.'}); }
    finally { setExecuting(false); }
  };

  const { summary, holdings = [] } = portfolio || {};
  const totalVal   = clean(summary?.totalVal);
  const cash       = clean(summary?.cash);
  const pl         = clean(summary?.pl);
  const returnPct  = clean(summary?.returnPct);
  const fees       = clean(summary?.fees);
  const isProfitable = pl >= 0;

  const holdingsWithVal = holdings.map(h => ({
    ticker:   h[0],
    qty:      clean(h[1]),
    avgBuy:   clean(h[2]),
    curPrice: clean(h[3]),
    curVal:   clean(h[4]) || (clean(h[1]) * clean(h[3])),
    plPct:    clean(h[7]),
  }));

  const totalPortVal = holdingsWithVal.reduce((s,h) => s + h.curVal, 0) + cash;
  const allSlices = [
    ...holdingsWithVal.map(h => ({ label:h.ticker, value:h.curVal, color:getCoinColor(h.ticker) })),
    { label:'Cash', value:cash, color:'#334155' },
  ].filter(s => s.value > 0);

  const chartData = chartRange === 'daily' ? history.daily : history.intraday;
  const availableCoins = Object.keys(prices).length > 0 ? Object.keys(prices) : holdingsWithVal.map(h => h.ticker);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        :root { --bg:#080c14; --surface:#0f172a; --surface2:#1a2235; --border:#1e293b; --accent:#00e5a0; --accent2:#3b82f6; --up:#00e5a0; --down:#f43f5e; --text:#e2e8f0; --muted:#475569; --gold:#f59e0b; }
        body { background:var(--bg); color:var(--text); font-family:'DM Mono',monospace; min-height:100vh;
          background-image:radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0,229,160,0.05) 0%, transparent 60%),
          repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(0,229,160,0.015) 39px, rgba(0,229,160,0.015) 40px); }
        .page { max-width:1100px; margin:0 auto; padding:24px 16px; }
        .nav { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; margin-bottom:28px; background:rgba(15,23,42,0.8); border:1px solid var(--border); border-radius:16px; backdrop-filter:blur(12px); }
        .nav-logo { font-family:'Syne',sans-serif; font-weight:800; font-size:16px; letter-spacing:-0.5px; }
        .nav-logo span { color:var(--accent); }
        .nav-links { display:flex; gap:8px; }
        .nav-link { padding:6px 14px; border-radius:8px; font-size:11px; text-decoration:none; color:var(--muted); letter-spacing:1px; transition:all .2s; text-transform:uppercase; }
        .nav-link:hover { color:var(--accent); }
        .nav-link.active { background:rgba(0,229,160,.1); color:var(--accent); border:1px solid rgba(0,229,160,.2); }
        .nav-dot { width:7px; height:7px; border-radius:50%; background:var(--accent); animation:pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(0,229,160,0.4)} 50%{opacity:.6;box-shadow:0 0 0 6px rgba(0,229,160,0)} }
        .hero { background:linear-gradient(135deg,#0f172a 0%,#1a2235 60%,#0a1628 100%); border:1px solid var(--border); border-radius:24px; padding:32px; margin-bottom:20px; position:relative; overflow:hidden; }
        .hero::before { content:''; position:absolute; top:-80px; right:-80px; width:280px; height:280px; background:radial-gradient(circle,rgba(0,229,160,.07) 0%,transparent 70%); pointer-events:none; }
        .hero-label { font-size:10px; color:var(--muted); letter-spacing:3px; text-transform:uppercase; margin-bottom:8px; }
        .hero-value { font-family:'Syne',sans-serif; font-weight:800; font-size:52px; letter-spacing:-2px; line-height:1; margin-bottom:8px; }
        .hero-change { display:inline-flex; align-items:center; gap:6px; font-size:13px; margin-bottom:28px; padding:4px 10px; border-radius:8px; }
        .hero-change.up { color:var(--up); background:rgba(0,229,160,.1); }
        .hero-change.down { color:var(--down); background:rgba(244,63,94,.1); }
        .hero-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:24px; }
        .stat { background:rgba(255,255,255,.03); border:1px solid var(--border); border-radius:12px; padding:14px; }
        .stat-label { font-size:9px; color:var(--muted); letter-spacing:2px; text-transform:uppercase; margin-bottom:4px; }
        .stat-value { font-size:15px; font-weight:500; }
        .stat-value.up { color:var(--up); }
        .stat-value.down { color:var(--down); }
        .hero-actions { display:flex; gap:10px; flex-wrap:wrap; }
        .btn { padding:10px 20px; border-radius:12px; border:none; font-family:'DM Mono',monospace; font-size:11px; font-weight:500; cursor:pointer; transition:all .2s; letter-spacing:.5px; text-decoration:none; display:inline-block; }
        .btn-primary { background:var(--accent); color:#000; }
        .btn-primary:hover { background:#00ffb0; transform:translateY(-1px); box-shadow:0 4px 20px rgba(0,229,160,.3); }
        .btn-primary:disabled { opacity:.5; cursor:not-allowed; transform:none; }
        .btn-secondary { background:var(--surface2); color:var(--text); border:1px solid var(--border); }
        .btn-secondary:hover { border-color:var(--accent); color:var(--accent); }
        .btn-danger { background:transparent; color:var(--down); border:1px solid rgba(244,63,94,.3); }
        .btn-danger:hover { background:rgba(244,63,94,.1); }
        .tabs { display:flex; gap:4px; margin-bottom:20px; background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:4px; }
        .tab { flex:1; padding:9px; text-align:center; border-radius:10px; border:none; background:transparent; font-family:'DM Mono',monospace; font-size:11px; color:var(--muted); cursor:pointer; transition:all .2s; letter-spacing:.5px; }
        .tab.active { background:var(--surface2); color:var(--accent); border:1px solid var(--border); }
        .tab:hover:not(.active) { color:var(--text); }
        .panel { animation:fadeIn .25s ease; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .card { background:var(--surface); border:1px solid var(--border); border-radius:20px; padding:22px; }
        .card-title { font-family:'Syne',sans-serif; font-weight:700; font-size:14px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; }
        .holdings-list { display:flex; flex-direction:column; gap:10px; }
        .holding-row { background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:14px 18px; display:grid; grid-template-columns:40px 1fr auto auto auto; align-items:center; gap:14px; transition:all .2s; }
        .holding-row:hover { border-color:rgba(0,229,160,.2); transform:translateX(2px); }
        .coin-icon { width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-family:'Syne',sans-serif; font-weight:800; font-size:12px; }
        .holding-name { font-family:'Syne',sans-serif; font-weight:700; font-size:13px; }
        .holding-ticker { font-size:11px; color:var(--muted); margin-top:2px; }
        .holding-value { text-align:right; }
        .holding-val-main { font-family:'Syne',sans-serif; font-weight:700; font-size:13px; }
        .holding-val-qty { font-size:10px; color:var(--muted); margin-top:2px; }
        .pct-badge { font-size:11px; font-weight:500; padding:3px 8px; border-radius:7px; white-space:nowrap; }
        .pct-badge.up { color:var(--up); background:rgba(0,229,160,.1); }
        .pct-badge.down { color:var(--down); background:rgba(244,63,94,.1); }
        .cash-row { background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:14px 18px; display:flex; align-items:center; justify-content:space-between; margin-top:10px; }
        .cash-icon { width:40px; height:40px; border-radius:10px; background:rgba(71,85,105,.3); display:flex; align-items:center; justify-content:center; font-size:18px; }
        .empty { text-align:center; padding:48px 0; color:var(--muted); font-size:13px; }
        .chart-card { background:var(--surface); border:1px solid var(--border); border-radius:20px; padding:22px; margin-bottom:16px; }
        .chart-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
        .chart-title { font-family:'Syne',sans-serif; font-weight:700; font-size:14px; }
        .range-btns { display:flex; gap:4px; }
        .range-btn { padding:4px 10px; border-radius:8px; border:1px solid var(--border); background:transparent; font-family:'DM Mono',monospace; font-size:11px; color:var(--muted); cursor:pointer; transition:all .2s; }
        .range-btn.active { background:var(--accent); color:#000; border-color:var(--accent); }
        .two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
        .alloc-inner { display:flex; align-items:center; gap:24px; flex-wrap:wrap; }
        .legend { flex:1; display:flex; flex-direction:column; gap:8px; min-width:140px; }
        .legend-row { display:flex; align-items:center; gap:8px; }
        .legend-dot { width:10px; height:10px; border-radius:3px; flex-shrink:0; }
        .legend-name { flex:1; font-size:11px; }
        .legend-pct { font-size:11px; color:var(--muted); }
        .trade-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        .trade-card { background:var(--surface); border:1px solid var(--border); border-radius:20px; padding:22px; }
        .trade-card h3 { font-family:'Syne',sans-serif; font-weight:700; font-size:15px; margin-bottom:16px; }
        .form-group { margin-bottom:12px; }
        .form-label { font-size:10px; color:var(--muted); letter-spacing:2px; text-transform:uppercase; display:block; margin-bottom:5px; }
        .form-select, .form-input { width:100%; background:var(--surface2); border:1px solid var(--border); border-radius:10px; padding:10px 13px; color:var(--text); font-family:'DM Mono',monospace; font-size:12px; outline:none; transition:border-color .2s; appearance:none; }
        .form-select:focus, .form-input:focus { border-color:var(--accent); }
        .form-select option { background:var(--surface2); }
        .action-toggle { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:12px; }
        .action-btn { padding:9px; border-radius:10px; border:1px solid var(--border); background:transparent; font-family:'DM Mono',monospace; font-size:12px; color:var(--muted); cursor:pointer; transition:all .2s; }
        .action-btn.active-buy { background:rgba(0,229,160,.1); color:var(--up); border-color:rgba(0,229,160,.3); }
        .action-btn.active-sell { background:rgba(244,63,94,.1); color:var(--down); border-color:rgba(244,63,94,.3); }
        .trade-status { padding:10px 14px; border-radius:10px; font-size:12px; margin-top:10px; }
        .trade-status.success { background:rgba(0,229,160,.1); color:var(--up); border:1px solid rgba(0,229,160,.2); }
        .trade-status.error { background:rgba(244,63,94,.1); color:var(--down); border:1px solid rgba(244,63,94,.2); }
        .trade-status.pending { background:rgba(59,130,246,.1); color:var(--accent2); border:1px solid rgba(59,130,246,.2); }
        .sell-all-card { background:rgba(244,63,94,.04); border:1px solid rgba(244,63,94,.2); border-radius:20px; padding:18px; margin-top:16px; display:flex; align-items:center; justify-content:space-between; gap:16px; }
        .sell-all-info { font-size:12px; }
        .sell-all-info strong { color:var(--down); display:block; margin-bottom:3px; font-family:'Syne',sans-serif; }
        .sell-all-info span { color:var(--muted); }
        .history-list { display:flex; flex-direction:column; gap:8px; }
        .history-row { background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:13px 16px; display:grid; grid-template-columns:34px 1fr auto; align-items:center; gap:12px; }
        .tx-icon { width:34px; height:34px; border-radius:9px; display:flex; align-items:center; justify-content:center; font-size:14px; }
        .tx-buy { background:rgba(0,229,160,.1); }
        .tx-sell { background:rgba(244,63,94,.1); }
        .tx-desc { font-family:'Syne',sans-serif; font-weight:600; font-size:13px; }
        .tx-date { font-size:10px; color:var(--muted); margin-top:2px; }
        .tx-amount { text-align:right; font-size:12px; font-weight:500; }
        .tx-amount.up { color:var(--up); }
        .tx-amount.down { color:var(--down); }
        .tx-sub { font-size:10px; color:var(--muted); margin-top:2px; }
        .skeleton { background:linear-gradient(90deg,var(--surface) 25%,var(--surface2) 50%,var(--surface) 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:8px; }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        .last-updated { font-size:10px; color:var(--muted); text-align:right; margin-bottom:16px; letter-spacing:.5px; }
        @media(max-width:640px) { .hero-value{font-size:36px} .hero-stats{grid-template-columns:1fr 1fr} .trade-grid{grid-template-columns:1fr} .two-col{grid-template-columns:1fr} .holding-row{grid-template-columns:36px 1fr auto auto} }
      `}</style>

      <div className="page">
        <nav className="nav">
          <div className="nav-logo">CRYPTO<span>CLASS</span></div>
          <div className="nav-links">
            <a href="/dashboard" className="nav-link active">Wallet</a>
            <Link href="/leaderboard" className="nav-link">Leaderboard</Link>
            <Link href="/market" className="nav-link">Market</Link>
            <Link href="/badges" className="nav-link">Badges</Link>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div className="nav-dot" />
            <span style={{fontSize:10,color:'var(--muted)',letterSpacing:1}}>LIVE</span>
          </div>
        </nav>

        {lastUpdated && <div className="last-updated">Updated {lastUpdated.toLocaleTimeString()} — auto-refreshes every 60s</div>}

        {loading ? (
          <>
            <div className="skeleton" style={{height:220,marginBottom:20}} />
            <div className="skeleton" style={{height:44,marginBottom:20}} />
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {[1,2,3].map(i=><div key={i} className="skeleton" style={{height:70}} />)}
            </div>
          </>
        ) : (
          <>
            {/* HERO */}
            <div className="hero">
              <div className="hero-label">Total Portfolio Value</div>
              <div className="hero-value" style={{color:isProfitable?'var(--up)':'var(--down)'}}>
                ${Math.floor(totalVal).toLocaleString()}
                <span style={{fontSize:30,opacity:.6}}>.{totalVal.toFixed(2).split('.')[1]}</span>
              </div>
              <div className={`hero-change ${isProfitable?'up':'down'}`}>
                <span>{isProfitable?'▲':'▼'}</span>
                <span>{isProfitable?'+':''}{fmtUSD(pl)} &nbsp;({fmtPct(returnPct)})</span>
              </div>
              <div className="hero-stats">
                <div className="stat"><div className="stat-label">Cash</div><div className="stat-value">{fmtUSD(cash)}</div></div>
                <div className="stat"><div className="stat-label">Holdings</div><div className="stat-value">{fmtUSD(clean(summary?.holdingsVal))}</div></div>
                <div className="stat"><div className="stat-label">Return</div><div className={`stat-value ${isProfitable?'up':'down'}`}>{fmtPct(returnPct)}</div></div>
                <div className="stat"><div className="stat-label">Fees Paid</div><div className="stat-value" style={{color:'var(--muted)'}}>{fmtUSD(fees)}</div></div>
              </div>
              <div className="hero-actions">
                <button className="btn btn-primary" onClick={()=>setActiveTab('trade')}>+ New Trade</button>
                <button className="btn btn-secondary" onClick={fetchData}>↻ Refresh</button>
                <Link href="/leaderboard" className="btn btn-secondary">🏆 Leaderboard</Link>
                <Link href="/badges" className="btn btn-secondary">🏅 Badges</Link>
              </div>
            </div>

            {/* TABS */}
            <div className="tabs">
              {['holdings','charts','allocation','trade','history'].map(t=>(
                <button key={t} className={`tab${activeTab===t?' active':''}`} onClick={()=>setActiveTab(t)}>
                  {t.charAt(0).toUpperCase()+t.slice(1)}
                </button>
              ))}
            </div>

            {/* HOLDINGS TAB */}
            {activeTab === 'holdings' && (
              <div className="panel">
                {holdingsWithVal.length === 0 ? (
                  <div className="empty">No holdings yet — make a trade to get started!</div>
                ) : (
                  <div className="holdings-list">
                    {holdingsWithVal.map((h,i) => {
                      const sparkPrices = prices[h.ticker] ? [h.avgBuy, h.curPrice] : [];
                      return (
                        <div className="holding-row" key={i}>
                          <div className="coin-icon" style={{background:`${getCoinColor(h.ticker)}22`,color:getCoinColor(h.ticker)}}>
                            {h.ticker.slice(0,3)}
                          </div>
                          <div>
                            <div className="holding-name">{h.ticker}</div>
                            <div className="holding-ticker">{prices[h.ticker]?`$${parseFloat(prices[h.ticker].price).toLocaleString()}`:`Avg $${h.avgBuy.toFixed(4)}`}</div>
                          </div>
                          <Sparkline data={[h.avgBuy, h.avgBuy*(1+h.plPct*0.003), h.curPrice]} />
                          <div className="holding-value">
                            <div className="holding-val-main">{fmtUSD(h.curVal)}</div>
                            <div className="holding-val-qty">{fmtNum(h.qty)} {h.ticker}</div>
                          </div>
                          <div className={`pct-badge ${h.plPct>=0?'up':'down'}`}>
                            {h.plPct>=0?'▲':'▼'} {Math.abs(h.plPct).toFixed(2)}%
                          </div>
                        </div>
                      );
                    })}
                    <div className="cash-row">
                      <div style={{display:'flex',alignItems:'center',gap:12}}>
                        <div className="cash-icon">💵</div>
                        <div>
                          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13}}>Cash</div>
                          <div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>Available to trade</div>
                        </div>
                      </div>
                      <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15}}>{fmtUSD(cash)}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CHARTS TAB */}
            {activeTab === 'charts' && (
              <div className="panel">
                {/* Portfolio value over time */}
                <div className="chart-card">
                  <div className="chart-header">
                    <div className="chart-title">Portfolio Value Over Time</div>
                    <div className="range-btns">
                      <button className={`range-btn${chartRange==='intraday'?' active':''}`} onClick={()=>setChartRange('intraday')}>Intraday</button>
                      <button className={`range-btn${chartRange==='daily'?' active':''}`} onClick={()=>setChartRange('daily')}>Daily</button>
                    </div>
                  </div>
                  <LineChart data={chartData} height={160} />
                </div>

                {/* P/L by coin */}
                <div className="chart-card">
                  <div className="chart-header">
                    <div className="chart-title">P/L by Coin</div>
                  </div>
                  <PLBarChart holdings={holdingsWithVal} />
                </div>
              </div>
            )}

            {/* ALLOCATION TAB */}
            {activeTab === 'allocation' && (
              <div className="panel">
                <div className="card">
                  {allSlices.length === 0 ? (
                    <div className="empty">No allocation data yet.</div>
                  ) : (
                    <div className="alloc-inner">
                      <DonutChart slices={allSlices} total={totalPortVal} />
                      <div className="legend">
                        {allSlices.map((s,i) => (
                          <div className="legend-row" key={i}>
                            <div className="legend-dot" style={{background:s.color}} />
                            <div className="legend-name">{s.label}</div>
                            <div className="legend-pct">{((s.value/totalPortVal)*100).toFixed(1)}%</div>
                            <div style={{fontSize:11,color:'var(--muted)',marginLeft:4}}>{fmtUSD(s.value)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TRADE TAB */}
            {activeTab === 'trade' && (
              <div className="panel">
                <div className="trade-grid">
                  <div className="trade-card">
                    <h3>Execute Trade</h3>
                    <div className="action-toggle">
                      <button className={`action-btn${tradeForm.action==='BUY'?' active-buy':''}`} onClick={()=>setTradeForm(f=>({...f,action:'BUY'}))}>▲ BUY</button>
                      <button className={`action-btn${tradeForm.action==='SELL'?' active-sell':''}`} onClick={()=>setTradeForm(f=>({...f,action:'SELL'}))}>▼ SELL</button>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Coin</label>
                      <select className="form-select" value={tradeForm.coin} onChange={e=>setTradeForm(f=>({...f,coin:e.target.value}))}>
                        <option value="">Select a coin...</option>
                        {availableCoins.map(c=><option key={c} value={c}>{c}{prices[c]?` — $${parseFloat(prices[c].price).toLocaleString()}`:''}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Amount Type</label>
                      <select className="form-select" value={tradeForm.amountType} onChange={e=>setTradeForm(f=>({...f,amountType:e.target.value}))}>
                        <option value="Dollar Amount">Dollar Amount ($)</option>
                        <option value="# of Coins"># of Coins</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">{tradeForm.amountType==='Dollar Amount'?'Amount (USD)':'Quantity'}</label>
                      <input type="number" className="form-input" placeholder={tradeForm.amountType==='Dollar Amount'?'100.00':'0.001'} min="0" step="any" value={tradeForm.amount} onChange={e=>setTradeForm(f=>({...f,amount:e.target.value}))} />
                    </div>
                    {tradeForm.coin && tradeForm.amount && prices[tradeForm.coin] && (
                      <div style={{fontSize:11,color:'var(--muted)',marginBottom:10,padding:'7px 11px',background:'var(--surface2)',borderRadius:8}}>
                        Est: {tradeForm.amountType==='Dollar Amount'?`${(parseFloat(tradeForm.amount)/parseFloat(prices[tradeForm.coin].price)).toFixed(6)} ${tradeForm.coin}`:fmtUSD(parseFloat(tradeForm.amount)*parseFloat(prices[tradeForm.coin].price))}
                        &nbsp;·&nbsp;Fee: {fmtUSD((parseFloat(tradeForm.amount)||0)*0.005)}
                      </div>
                    )}
                    <button className="btn btn-primary" style={{width:'100%'}} onClick={executeTrade} disabled={executing}>
                      {executing?'Processing...':`${tradeForm.action} ${tradeForm.coin||'—'}`}
                    </button>
                    {tradeStatus && <div className={`trade-status ${tradeStatus.type}`}>{tradeStatus.msg}</div>}
                  </div>

                  <div className="trade-card">
                    <h3>Portfolio Summary</h3>
                    {[['Starting Cash',fmtUSD(10000),''],['Cash Remaining',fmtUSD(cash),''],['Holdings Value',fmtUSD(clean(summary?.holdingsVal)),''],['Total Value',fmtUSD(totalVal),''],['Profit / Loss',fmtUSD(pl),isProfitable?'up':'down'],['Return %',fmtPct(returnPct),isProfitable?'up':'down'],['Total Fees',fmtUSD(fees),'']].map(([label,val,cls])=>(
                      <div key={label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                        <span style={{fontSize:11,color:'var(--muted)'}}>{label}</span>
                        <span style={{fontSize:12,fontWeight:500,color:cls==='up'?'var(--up)':cls==='down'?'var(--down)':'var(--text)'}}>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="sell-all-card">
                  <div className="sell-all-info">
                    <strong>⚠ Sell All Holdings</strong>
                    <span>Liquidates every position at market price (0.5% fee). Cannot be undone.</span>
                  </div>
                  <button className="btn btn-danger" onClick={sellAll} disabled={executing||holdingsWithVal.length===0}>
                    {executing?'Processing...':'Sell All'}
                  </button>
                </div>
              </div>
            )}

            {/* HISTORY TAB */}
            {activeTab === 'history' && (
              <div className="panel">
                {portfolio?.history?.length === 0 ? (
                  <div className="empty">No trades yet.</div>
                ) : (
                  <div className="history-list">
                    {[...(portfolio?.history||[])].reverse().slice(0,50).map((row,i) => {
                      const isBuy = row[1]==='BUY';
                      const val = clean(row[5]);
                      return (
                        <div className="history-row" key={i}>
                          <div className={`tx-icon ${isBuy?'tx-buy':'tx-sell'}`}>{isBuy?'💰':'📤'}</div>
                          <div>
                            <div className="tx-desc">{row[1]} {row[2]}</div>
                            <div className="tx-date">{row[0]} · {clean(row[3]).toFixed(4)} {row[2]} @ ${clean(row[4]).toLocaleString()}</div>
                          </div>
                          <div>
                            <div className={`tx-amount ${isBuy?'down':'up'}`}>{isBuy?'-':'+'}{fmtUSD(val)}</div>
                            <div className="tx-sub">Fee: {fmtUSD(clean(row[6]))}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
