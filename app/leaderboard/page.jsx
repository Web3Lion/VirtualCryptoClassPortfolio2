'use client';
import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const fmtUSD = n => {
  const num = parseFloat(n);
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
};
const fmtPct = n => {
  const num = parseFloat(n);
  if (isNaN(num)) return '—';
  return (num >= 0 ? '+' : '') + num.toFixed(2) + '%';
};

const MEDALS = ['🥇', '🥈', '🥉'];
const ROW_BG = ['rgba(245,158,11,.07)', 'rgba(148,163,184,.05)', 'rgba(180,120,60,.05)'];
const STUDENT_COLORS = ['#00e5a0','#3b82f6','#f59e0b','#f43f5e','#a855f7','#14b8a6','#f97316','#06b6d4','#84cc16','#ec4899','#6366f1','#ef4444','#10b981'];
const CHART_COLORS = ['#00e5a0','#3b82f6','#f59e0b','#f43f5e','#a855f7','#14b8a6','#f97316','#06b6d4','#84cc16','#ec4899'];

const SECTOR_MAP = {
  BTC:'Layer 1',ETH:'Layer 1',SOL:'Layer 1',ADA:'Layer 1',AVAX:'Layer 1',DOT:'Layer 1',ATOM:'Layer 1',NEAR:'Layer 1',
  MATIC:'Layer 2',ARB:'Layer 2',OP:'Layer 2',
  DOGE:'Memecoin',SHIB:'Memecoin',PEPE:'Memecoin',BONK:'Memecoin',FLOKI:'Memecoin',WIF:'Memecoin',
  USDT:'Stablecoin',USDC:'Stablecoin',DAI:'Stablecoin',
  UNI:'DeFi',AAVE:'DeFi',MKR:'DeFi',CRV:'DeFi',COMP:'DeFi',
  LINK:'Infrastructure',RENDER:'AI/Data',FET:'AI/Data',TAO:'AI/Data',
  SAND:'Gaming/NFT',MANA:'Gaming/NFT',AXS:'Gaming/NFT',
  BNB:'Exchange',OKB:'Exchange',
};

function ensureChart(cb) {
  if (window.Chart) { cb(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
  s.onload = cb;
  document.head.appendChild(s);
}

function DonutChart({ entries, canvasRef, chartRef }) {
  useEffect(() => {
    if (!canvasRef.current || !entries.length) return;
    const draw = () => {
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
      chartRef.current = new window.Chart(canvasRef.current, {
        type: 'doughnut',
        data: {
          labels: entries.map(e => e[0]),
          datasets: [{ data: entries.map(e => e[1]), backgroundColor: entries.map((_,i) => CHART_COLORS[i%CHART_COLORS.length]), borderWidth: 2, borderColor: '#0f172a' }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor:'#0f172a', titleColor:'#94a3b8', bodyColor:'#e2e8f0', borderColor:'#1e293b', borderWidth:1 } }, cutout: '65%' },
      });
    };
    ensureChart(draw);
  }, [entries]);

  if (!entries.length) return <div style={{textAlign:'center',color:'#475569',fontSize:13,padding:'24px 0'}}>No data yet</div>;
  return (
    <div style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
      <div style={{position:'relative',height:150,width:150,flexShrink:0}}>
        <canvas ref={canvasRef} role="img" aria-label="Donut chart" />
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column',gap:6}}>
        {entries.map(([label,count],i) => (
          <div key={label} style={{display:'flex',alignItems:'center',gap:8,fontSize:11}}>
            <div style={{width:10,height:10,borderRadius:3,background:CHART_COLORS[i%CHART_COLORS.length],flexShrink:0}} />
            <span style={{flex:1,color:'#e2e8f0'}}>{label}</span>
            <span style={{color:'#475569'}}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [sortKey, setSortKey] = useState('total');
  const [search, setSearch] = useState('');
  const [myName, setMyName] = useState(null);
  const [studentBadges, setStudentBadges] = useState({});
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [historyData, setHistoryData] = useState({ students:[], intraday:[], daily:[] });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [chartRange, setChartRange] = useState('daily');
  const [hiddenStudents, setHiddenStudents] = useState(new Set());

  const lineChartRef = useRef(null);
  const lineChartInstance = useRef(null);
  const tokenCanvasRef = useRef(null);
  const tokenChartRef = useRef(null);
  const sectorCanvasRef = useRef(null);
  const sectorChartRef = useRef(null);

  const fetchData = async () => {
    try {
      const [lbRes, meRes] = await Promise.all([fetch('/api/leaderboard'), fetch('/api/me')]);
      if (lbRes.ok) {
        const data = await lbRes.json();
        setRows(data);
        setLastUpdated(new Date());
        fetchAllBadges(data.filter(r => !r.isBot).map(r => r.name));
      }
      if (meRes.ok) { const me = await meRes.json(); setMyName(me.studentName); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchHistory = async () => {
    if (historyData.students.length > 0) return;
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/leaderboard-history');
      if (res.ok) setHistoryData(await res.json());
    } catch (e) { console.error(e); }
    finally { setHistoryLoading(false); }
  };

  const fetchAllBadges = async (names) => {
    const results = {};
    await Promise.all(names.map(async name => {
      try {
        const res = await fetch(`/api/badges?student=${encodeURIComponent(name)}`);
        if (res.ok) { const d = await res.json(); results[name] = (d.badges||[]).filter(b=>b.earned).slice(0,5); }
      } catch {}
    }));
    setStudentBadges(results);
  };

  useEffect(() => { if (status === 'unauthenticated') router.replace('/'); }, [status, router]);
  useEffect(() => {
    if (status === 'authenticated') { fetchData(); const iv = setInterval(fetchData, 60000); return () => clearInterval(iv); }
  }, [status]);
  useEffect(() => { if (activeTab === 'charts') fetchHistory(); }, [activeTab]);

  // Rebuild line chart when data/range/hidden changes
  useEffect(() => {
    if (activeTab !== 'charts' || !lineChartRef.current) return;
    const data = chartRange === 'daily' ? historyData.daily : historyData.intraday;
    if (!data || data.length === 0) return;

    const draw = () => {
      if (lineChartInstance.current) { lineChartInstance.current.destroy(); lineChartInstance.current = null; }
      const labels = data.map(d => String(d.t).substring(0, 10));
      const visStudents = historyData.students.filter(s => !hiddenStudents.has(s));
      const datasets = visStudents.map((name, i) => ({
        label: name,
        data: data.map(d => d[name] || null),
        borderColor: STUDENT_COLORS[i % STUDENT_COLORS.length],
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: data.length > 30 ? 0 : 3,
        pointHoverRadius: 5,
        tension: 0.3,
        spanGaps: true,
      }));
      lineChartInstance.current = new window.Chart(lineChartRef.current, {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#0f172a', borderColor: '#1e293b', borderWidth: 1,
              titleColor: '#94a3b8', bodyColor: '#e2e8f0',
              callbacks: { label: ctx => `${ctx.dataset.label}: $${(ctx.parsed.y||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}` },
            },
          },
          scales: {
            x: { ticks: { color:'#475569', font:{size:10}, maxTicksLimit:10 }, grid: { color:'rgba(30,41,59,.5)' } },
            y: { ticks: { color:'#475569', font:{size:10}, callback: v => '$'+(v/1000).toFixed(1)+'k' }, grid: { color:'rgba(30,41,59,.5)' } },
          },
        },
      });
    };
    ensureChart(draw);
  }, [activeTab, historyData, chartRange, hiddenStudents]);

  if (status === 'loading' || status === 'unauthenticated') {
    return <div style={{background:'#080c14',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#475569',fontFamily:'monospace'}}>Checking session...</div>;
  }

  const sorted = [...rows]
    .filter(r => !search || r.name?.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => {
      if (sortKey==='name') return a.name?.localeCompare(b.name);
      if (sortKey==='return') return parseFloat(b.returnPct)-parseFloat(a.returnPct);
      if (sortKey==='pl') return parseFloat(b.pl)-parseFloat(a.pl);
      return parseFloat(b.total)-parseFloat(a.total);
    });

  const classAvg = rows.length ? rows.reduce((s,r) => s+parseFloat(r.returnPct||0),0)/rows.length : 0;
  const profitable = rows.filter(r => parseFloat(r.pl||0)>0).length;

  // Build token and sector distributions from leaderboard bestTrade column
  const tokenCounts = {}, sectorCounts = {};
  rows.forEach(r => {
    if (r.bestTrade) {
      const match = r.bestTrade.match(/^([A-Z]+)/);
      if (match) {
        const ticker = match[1];
        tokenCounts[ticker] = (tokenCounts[ticker]||0) + 1;
        const sector = SECTOR_MAP[ticker] || 'Other';
        sectorCounts[sector] = (sectorCounts[sector]||0) + 1;
      }
    }
  });
  const tokenEntries = Object.entries(tokenCounts).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const sectorEntries = Object.entries(sectorCounts).sort((a,b)=>b[1]-a[1]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{--bg:#080c14;--surface:#0f172a;--surface2:#1a2235;--border:#1e293b;--accent:#00e5a0;--up:#00e5a0;--down:#f43f5e;--text:#e2e8f0;--muted:#475569;--gold:#f59e0b}
        body{background:var(--bg);color:var(--text);font-family:'DM Mono',monospace;min-height:100vh;background-image:radial-gradient(ellipse 80% 50% at 50% -20%,rgba(0,229,160,0.04) 0%,transparent 60%)}
        .page{max-width:1200px;margin:0 auto;padding:24px 16px}
        .nav{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;margin-bottom:28px;background:rgba(15,23,42,0.8);border:1px solid var(--border);border-radius:16px;backdrop-filter:blur(12px)}
        .nav-logo{font-family:'Syne',sans-serif;font-weight:800;font-size:16px}
        .nav-logo span{color:var(--accent)}
        .nav-links{display:flex;gap:8px}
        .nav-link{padding:6px 14px;border-radius:8px;font-size:11px;text-decoration:none;color:var(--muted);letter-spacing:1px;transition:all .2s;text-transform:uppercase}
        .nav-link:hover{color:var(--accent)}
        .nav-link.active{background:rgba(0,229,160,.1);color:var(--accent);border:1px solid rgba(0,229,160,.2)}
        .lb-header{text-align:center;margin-bottom:28px}
        .lb-title{font-family:'Syne',sans-serif;font-weight:800;font-size:40px;letter-spacing:-2px;margin-bottom:6px}
        .lb-title span{color:var(--accent)}
        .lb-sub{font-size:12px;color:var(--muted)}
        .class-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
        .cs-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:16px;text-align:center}
        .cs-label{font-size:9px;color:var(--muted);letter-spacing:2px;text-transform:uppercase;margin-bottom:6px}
        .cs-val{font-family:'Syne',sans-serif;font-weight:700;font-size:22px}
        .cs-val.up{color:var(--up)}.cs-val.down{color:var(--down)}.cs-val.gold{color:var(--gold)}
        .page-tabs{display:flex;gap:4px;margin-bottom:24px;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:4px}
        .page-tab{flex:1;padding:9px;text-align:center;border-radius:10px;border:none;background:transparent;font-family:'DM Mono',monospace;font-size:11px;color:var(--muted);cursor:pointer;transition:all .2s;letter-spacing:.5px}
        .page-tab.active{background:var(--surface2);color:var(--accent);border:1px solid var(--border)}
        .page-tab:hover:not(.active){color:var(--text)}
        .controls{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap}
        .search-input{flex:1;min-width:180px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:10px 16px;color:var(--text);font-family:'DM Mono',monospace;font-size:12px;outline:none;transition:border-color .2s}
        .search-input:focus{border-color:var(--accent)}
        .sort-btn{padding:10px 16px;border-radius:12px;border:1px solid var(--border);background:var(--surface);color:var(--muted);font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;transition:all .2s}
        .sort-btn.active{background:rgba(0,229,160,.1);color:var(--accent);border-color:rgba(0,229,160,.3)}
        .sort-btn:hover:not(.active){color:var(--text)}
        .podium{display:grid;grid-template-columns:1fr 1.15fr 1fr;gap:12px;margin-bottom:24px;align-items:end}
        .podium-card{background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:20px;text-align:center;position:relative;overflow:hidden}
        .podium-card.first{border-color:rgba(245,158,11,.3);background:rgba(245,158,11,.04)}
        .podium-medal{font-size:28px;display:block;margin-bottom:8px}
        .podium-name{font-family:'Syne',sans-serif;font-weight:700;font-size:15px;margin-bottom:4px}
        .podium-name.me{color:var(--accent)}
        .podium-val{font-family:'Syne',sans-serif;font-size:20px;font-weight:800;margin-bottom:4px}
        .podium-ret-up{font-size:12px;color:var(--up)}.podium-ret-down{font-size:12px;color:var(--down)}
        .podium-badges{display:flex;justify-content:center;gap:3px;margin-top:8px;flex-wrap:wrap}
        .podium-bar{position:absolute;bottom:0;left:0;right:0;height:3px}
        .rank-table{width:100%;border-collapse:collapse;min-width:700px}
        .rank-table th{font-size:9px;color:var(--muted);letter-spacing:2px;text-transform:uppercase;padding:10px 14px;text-align:left;border-bottom:1px solid var(--border);white-space:nowrap;cursor:pointer}
        .rank-table th:hover{color:var(--accent)}
        .rank-row{border-bottom:1px solid rgba(30,41,59,.5);transition:background .2s}
        .rank-row:hover{background:rgba(0,229,160,.03)}
        .rank-row.me-row{background:rgba(0,229,160,.05) !important}
        .rank-row td{padding:12px 14px;font-size:13px;white-space:nowrap}
        .rank-num{font-family:'Syne',sans-serif;font-weight:800;font-size:16px;text-align:center}
        .rank-name{font-family:'Syne',sans-serif;font-weight:600}
        .rank-name.me{color:var(--accent)}
        .you-tag{font-size:9px;background:rgba(0,229,160,.15);color:var(--accent);padding:2px 6px;border-radius:4px;margin-left:6px}
        .badge-row{display:flex;gap:3px;align-items:center}
        .profit-bar-bg{background:var(--surface2);border-radius:4px;height:6px;width:80px;overflow:hidden}
        .profit-bar-fill{height:100%;border-radius:4px}
        .chart-card{background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:22px;margin-bottom:16px}
        .chart-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px}
        .chart-title{font-family:'Syne',sans-serif;font-weight:700;font-size:15px}
        .range-btns{display:flex;gap:4px}
        .range-btn{padding:5px 12px;border-radius:8px;border:1px solid var(--border);background:transparent;font-family:'DM Mono',monospace;font-size:11px;color:var(--muted);cursor:pointer;transition:all .2s}
        .range-btn.active{background:var(--accent);color:#000;border-color:var(--accent)}
        .student-toggles{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
        .student-toggle{padding:5px 12px;border-radius:20px;border:1px solid;font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;transition:opacity .2s;background:transparent}
        .student-toggle.hidden{opacity:.25}
        .two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .skeleton{background:linear-gradient(90deg,var(--surface) 25%,var(--surface2) 50%,var(--surface) 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:8px}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(0,229,160,0.4)}50%{opacity:.6;box-shadow:0 0 0 6px rgba(0,229,160,0)}}
        @media(max-width:640px){.lb-title{font-size:28px}.class-stats{grid-template-columns:1fr 1fr}.podium{grid-template-columns:1fr}.two-col{grid-template-columns:1fr}}
      `}</style>

      <div className="page">
        <nav className="nav">
          <div className="nav-logo">CRYPTO<span>CLASS</span></div>
          <div className="nav-links">
            <Link href="/dashboard" className="nav-link">Wallet</Link>
            <a href="/leaderboard" className="nav-link active">Leaderboard</a>
            <Link href="/market" className="nav-link">Market</Link>
            <Link href="/badges" className="nav-link">Badges</Link>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:'var(--accent)',animation:'pulse 2s infinite'}} />
            <span style={{fontSize:10,color:'var(--muted)',letterSpacing:1}}>LIVE</span>
          </div>
        </nav>

        <div className="lb-header">
          <div className="lb-title">🏆 <span>Leader</span>board</div>
          <div className="lb-sub">{lastUpdated?`Updated ${lastUpdated.toLocaleTimeString()} · auto-refreshes every 60s`:'Loading...'}</div>
        </div>

        {loading ? (
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {[1,2,3,4,5].map(i=><div key={i} className="skeleton" style={{height:56}} />)}
          </div>
        ) : (
          <>
            <div className="class-stats">
              <div className="cs-card"><div className="cs-label">Students</div><div className="cs-val gold">{rows.length}</div></div>
              <div className="cs-card"><div className="cs-label">Profitable</div><div className={`cs-val ${profitable/rows.length>=0.5?'up':'down'}`}>{profitable}/{rows.length}</div></div>
              <div className="cs-card"><div className="cs-label">Class Avg Return</div><div className={`cs-val ${classAvg>=0?'up':'down'}`}>{classAvg>=0?'+':''}{classAvg.toFixed(2)}%</div></div>
              <div className="cs-card"><div className="cs-label">Top Return</div><div className="cs-val up">{rows.length?fmtPct(Math.max(...rows.map(r=>parseFloat(r.returnPct||0)))):'—'}</div></div>
            </div>

            <div className="page-tabs">
              <button className={`page-tab${activeTab==='leaderboard'?' active':''}`} onClick={()=>setActiveTab('leaderboard')}>🏆 Rankings</button>
              <button className={`page-tab${activeTab==='charts'?' active':''}`} onClick={()=>setActiveTab('charts')}>📈 Charts</button>
            </div>

            {activeTab === 'leaderboard' && (
              <>
                {sorted.length >= 3 && (
                  <div className="podium">
                    {[sorted[1],sorted[0],sorted[2]].map((s,i) => {
                      const origRank = i===1?0:i===0?1:2;
                      const isProfit = parseFloat(s?.returnPct||0)>=0;
                      const barColor = origRank===0?'#f59e0b':origRank===1?'#94a3b8':'#b47c3c';
                      const earnedBadges = studentBadges[s?.name]||[];
                      return (
                        <div key={origRank} className={`podium-card${origRank===0?' first':''}`}>
                          <span className="podium-medal">{MEDALS[origRank]}</span>
                          <div className={`podium-name${s?.name===myName?' me':''}`}>{s?.name||'—'}{s?.name===myName&&<span style={{fontSize:9,color:'var(--accent)',marginLeft:6}}>YOU</span>}</div>
                          <div className="podium-val">{fmtUSD(s?.total)}</div>
                          <div className={isProfit?'podium-ret-up':'podium-ret-down'}>{fmtPct(s?.returnPct)}</div>
                          {earnedBadges.length>0&&<div className="podium-badges">{earnedBadges.map((b,bi)=><span key={bi} title={b.name}>{b.emoji}</span>)}</div>}
                          <div className="podium-bar" style={{background:barColor}} />
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="controls">
                  <input className="search-input" placeholder="Search students..." value={search} onChange={e=>setSearch(e.target.value)} />
                  {[['total','Portfolio Value'],['return','Return %'],['pl','Profit/Loss']].map(([k,l])=>(
                    <button key={k} className={`sort-btn${sortKey===k?' active':''}`} onClick={()=>setSortKey(k)}>{l}</button>
                  ))}
                  <button className="sort-btn" onClick={fetchData}>↻</button>
                </div>

                <div style={{overflowX:'auto'}}>
                  <table className="rank-table">
                    <thead>
                      <tr>
                        <th style={{width:44}}>Rank</th>
                        <th>Student</th>
                        <th>Badges</th>
                        <th onClick={()=>setSortKey('total')}>Portfolio {sortKey==='total'?'↓':''}</th>
                        <th>Cash</th>
                        <th onClick={()=>setSortKey('return')}>Return {sortKey==='return'?'↓':''}</th>
                        <th onClick={()=>setSortKey('pl')}>P/L {sortKey==='pl'?'↓':''}</th>
                        <th>Progress</th>
                        <th>Fees</th>
                        <th>Streak</th>
                        <th>Coins</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((s,i) => {
                        const isMe=s.name===myName, ret=parseFloat(s.returnPct||0), pl=parseFloat(s.pl||0), isProfit=ret>=0;
                        const earnedBadges=studentBadges[s.name]||[];
                        return (
                          <tr key={i} className={`rank-row${isMe?' me-row':''}`} style={i<3?{background:ROW_BG[i]}:{}}>
                            <td><div className="rank-num" style={{color:i===0?'var(--gold)':i===1?'#94a3b8':i===2?'#b47c3c':'var(--muted)'}}>{i<3?MEDALS[i]:i+1}</div></td>
                            <td><span className={`rank-name${isMe?' me':''}`}>{s.name}{isMe&&<span className="you-tag">YOU</span>}{s.isBot&&<span style={{fontSize:9,color:'#f59e0b',marginLeft:4}}>BOT</span>}</span></td>
                            <td><div className="badge-row">{earnedBadges.slice(0,5).map((b,bi)=><span key={bi} title={b.name}>{b.emoji}</span>)}{earnedBadges.length>5&&<span style={{fontSize:10,color:'var(--muted)'}}>+{earnedBadges.length-5}</span>}{earnedBadges.length===0&&<span style={{fontSize:10,color:'var(--muted)'}}>—</span>}</div></td>
                            <td style={{fontFamily:"'Syne',sans-serif",fontWeight:700}}>{fmtUSD(s.total)}</td>
                            <td style={{color:'var(--muted)',fontSize:12}}>{fmtUSD(s.cash)}</td>
                            <td style={{color:isProfit?'var(--up)':'var(--down)',fontWeight:500}}>{fmtPct(ret)}</td>
                            <td style={{color:isProfit?'var(--up)':'var(--down)',fontWeight:500}}>{isProfit?'+':''}{fmtUSD(pl)}</td>
                            <td><div className="profit-bar-bg"><div className="profit-bar-fill" style={{width:`${Math.min(100,Math.abs(ret)*2)}%`,background:isProfit?'var(--up)':'var(--down)'}} /></div></td>
                            <td style={{color:'var(--muted)',fontSize:11}}>{fmtUSD(s.fees)}</td>
                            <td>{s.streak&&s.streak!=='0'?<span style={{fontSize:11,color:s.streakType==='win'?'var(--up)':'var(--down)'}}>{s.streakType==='win'?'🔥':'❌'} {s.streak}</span>:<span style={{color:'var(--muted)'}}>—</span>}</td>
                            <td style={{color:'var(--muted)',fontSize:11,textAlign:'center'}}>{s.coinCount||0}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {activeTab === 'charts' && (
              <>
                {historyLoading ? (
                  <div style={{display:'flex',flexDirection:'column',gap:12}}>
                    {[1,2,3].map(i=><div key={i} className="skeleton" style={{height:80}} />)}
                  </div>
                ) : (
                  <>
                    <div className="chart-card">
                      <div className="chart-header">
                        <div className="chart-title">Portfolio Value Over Time — All Students</div>
                        <div className="range-btns">
                          <button className={`range-btn${chartRange==='daily'?' active':''}`} onClick={()=>setChartRange('daily')}>Daily</button>
                          <button className={`range-btn${chartRange==='intraday'?' active':''}`} onClick={()=>setChartRange('intraday')}>Intraday</button>
                        </div>
                      </div>
                      <div className="student-toggles">
                        {historyData.students.map((name,i)=>(
                          <button key={name} className={`student-toggle${hiddenStudents.has(name)?' hidden':''}`}
                            style={{borderColor:STUDENT_COLORS[i%STUDENT_COLORS.length],color:hiddenStudents.has(name)?'var(--muted)':STUDENT_COLORS[i%STUDENT_COLORS.length]}}
                            onClick={()=>setHiddenStudents(prev=>{const n=new Set(prev);n.has(name)?n.delete(name):n.add(name);return n;})}>
                            {name}
                          </button>
                        ))}
                        <button className="sort-btn" style={{fontSize:10,padding:'5px 10px'}} onClick={()=>setHiddenStudents(new Set())}>Show all</button>
                        <button className="sort-btn" style={{fontSize:10,padding:'5px 10px'}} onClick={()=>setHiddenStudents(new Set(historyData.students.slice(3)))}>Top 3</button>
                      </div>
                      <div style={{position:'relative',height:340}}>
                        {(chartRange==='daily'?historyData.daily:historyData.intraday).length===0
                          ? <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'var(--muted)',fontSize:13}}>No history data yet</div>
                          : <canvas ref={lineChartRef} role="img" aria-label="Line chart of all student portfolio values over time" />
                        }
                      </div>
                    </div>

                    <div className="two-col">
                      <div className="chart-card">
                        <div className="chart-header"><div className="chart-title">Class Token Distribution</div></div>
                        <DonutChart entries={tokenEntries} canvasRef={tokenCanvasRef} chartRef={tokenChartRef} />
                      </div>
                      <div className="chart-card">
                        <div className="chart-header"><div className="chart-title">Class Sector Distribution</div></div>
                        <DonutChart entries={sectorEntries} canvasRef={sectorCanvasRef} chartRef={sectorChartRef} />
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
