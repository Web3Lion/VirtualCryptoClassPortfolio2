'use client';
import { useState, useEffect } from 'react';
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
  if (isNaN(num)) return '0.00%';
  return (num >= 0 ? '+' : '') + num.toFixed(2) + '%';
};

const MEDALS = ['🥇', '🥈', '🥉'];
const ROW_BG = ['rgba(245,158,11,.07)', 'rgba(148,163,184,.05)', 'rgba(180,120,60,.05)'];

export default function Leaderboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [sortKey, setSortKey] = useState('total');
  const [search, setSearch] = useState('');
  const [myName, setMyName] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/');
    }
  }, [status, router]);

  const fetchData = async () => {
    try {
      const [lbRes, meRes] = await Promise.all([
        fetch('/api/leaderboard'),
        fetch('/api/me'),
      ]);
      if (lbRes.ok) {
        const data = await lbRes.json();
        setRows(data);
        setLastUpdated(new Date());
      }
      if (meRes.ok) {
        const me = await meRes.json();
        setMyName(me.studentName);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData();
      const iv = setInterval(fetchData, 60000);
      return () => clearInterval(iv);
    }
  }, [status]);

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div style={{ background: '#080c14', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontFamily: 'monospace' }}>
        Checking session...
      </div>
    );
  }

  const sorted = [...rows]
    .filter(r => !search || r.name?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortKey === 'name') return a.name?.localeCompare(b.name);
      if (sortKey === 'return') return parseFloat(b.returnPct) - parseFloat(a.returnPct);
      if (sortKey === 'pl') return parseFloat(b.pl) - parseFloat(a.pl);
      return parseFloat(b.total) - parseFloat(a.total);
    });

  const classAvg = rows.length
    ? rows.reduce((s, r) => s + parseFloat(r.returnPct || 0), 0) / rows.length
    : 0;
  const profitable = rows.filter(r => parseFloat(r.pl || 0) > 0).length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        :root { --bg:#080c14; --surface:#0f172a; --surface2:#1a2235; --border:#1e293b; --accent:#00e5a0; --up:#00e5a0; --down:#f43f5e; --text:#e2e8f0; --muted:#475569; --gold:#f59e0b; }
        body { background:var(--bg); color:var(--text); font-family:'DM Mono',monospace; min-height:100vh;
          background-image:radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0,229,160,0.04) 0%, transparent 60%); }
        .page { max-width:1100px; margin:0 auto; padding:24px 16px; }
        .nav { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; margin-bottom:28px;
          background:rgba(15,23,42,0.8); border:1px solid var(--border); border-radius:16px; backdrop-filter:blur(12px); }
        .nav-logo { font-family:'Syne',sans-serif; font-weight:800; font-size:16px; }
        .nav-logo span { color:var(--accent); }
        .nav-links { display:flex; gap:8px; }
        .nav-link { padding:6px 14px; border-radius:8px; font-size:11px; text-decoration:none; color:var(--muted); letter-spacing:1px; transition:all .2s; text-transform:uppercase; }
        .nav-link:hover { color:var(--accent); }
        .nav-link.active { background:rgba(0,229,160,.1); color:var(--accent); border:1px solid rgba(0,229,160,.2); }
        .lb-header { text-align:center; margin-bottom:32px; }
        .lb-title { font-family:'Syne',sans-serif; font-weight:800; font-size:40px; letter-spacing:-2px; margin-bottom:6px; }
        .lb-title span { color:var(--accent); }
        .lb-sub { font-size:12px; color:var(--muted); letter-spacing:1px; }
        .class-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:24px; }
        .cs-card { background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:16px; text-align:center; }
        .cs-label { font-size:9px; color:var(--muted); letter-spacing:2px; text-transform:uppercase; margin-bottom:6px; }
        .cs-val { font-family:'Syne',sans-serif; font-weight:700; font-size:22px; }
        .cs-val.up { color:var(--up); }
        .cs-val.down { color:var(--down); }
        .cs-val.gold { color:var(--gold); }
        .controls { display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap; }
        .search-input { flex:1; min-width:180px; background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:10px 16px; color:var(--text); font-family:'DM Mono',monospace; font-size:12px; outline:none; transition:border-color .2s; }
        .search-input:focus { border-color:var(--accent); }
        .sort-btn { padding:10px 16px; border-radius:12px; border:1px solid var(--border); background:var(--surface); color:var(--muted); font-family:'DM Mono',monospace; font-size:11px; cursor:pointer; transition:all .2s; letter-spacing:.5px; }
        .sort-btn.active { background:rgba(0,229,160,.1); color:var(--accent); border-color:rgba(0,229,160,.3); }
        .sort-btn:hover:not(.active) { color:var(--text); }
        .table-wrap { overflow-x:auto; }
        .podium { display:grid; grid-template-columns:1fr 1.15fr 1fr; gap:12px; margin-bottom:24px; align-items:end; }
        .podium-card { background:var(--surface); border:1px solid var(--border); border-radius:20px; padding:20px; text-align:center; position:relative; overflow:hidden; transition:all .3s; }
        .podium-card:hover { transform:translateY(-2px); }
        .podium-card.first { border-color:rgba(245,158,11,.3); background:linear-gradient(160deg,rgba(245,158,11,.07) 0%,var(--surface) 100%); }
        .podium-medal { font-size:28px; display:block; margin-bottom:8px; }
        .podium-name { font-family:'Syne',sans-serif; font-weight:700; font-size:15px; margin-bottom:4px; }
        .podium-name.me { color:var(--accent); }
        .podium-val { font-family:'Syne',sans-serif; font-size:20px; font-weight:800; margin-bottom:4px; }
        .podium-ret { font-size:12px; }
        .podium-ret.up { color:var(--up); }
        .podium-ret.down { color:var(--down); }
        .podium-bar { position:absolute; bottom:0; left:0; right:0; height:3px; }
        .rank-table { width:100%; border-collapse:collapse; min-width:600px; }
        .rank-table th { font-size:9px; color:var(--muted); letter-spacing:2px; text-transform:uppercase; padding:10px 16px; text-align:left; border-bottom:1px solid var(--border); white-space:nowrap; }
        .rank-table th.sortable { cursor:pointer; }
        .rank-table th.sortable:hover { color:var(--accent); }
        .rank-row { border-bottom:1px solid rgba(30,41,59,.5); transition:background .2s; }
        .rank-row:hover { background:rgba(0,229,160,.03); }
        .rank-row.me-row { background:rgba(0,229,160,.05) !important; }
        .rank-row td { padding:13px 16px; font-size:13px; white-space:nowrap; }
        .rank-num { font-family:'Syne',sans-serif; font-weight:800; font-size:16px; width:44px; text-align:center; }
        .rank-name { font-family:'Syne',sans-serif; font-weight:600; }
        .rank-name.me { color:var(--accent); }
        .you-tag { font-size:9px; background:rgba(0,229,160,.15); color:var(--accent); padding:2px 6px; border-radius:4px; margin-left:6px; letter-spacing:1px; vertical-align:middle; }
        .profit-bar-bg { background:var(--surface2); border-radius:4px; height:6px; width:100px; overflow:hidden; }
        .profit-bar-fill { height:100%; border-radius:4px; transition:width .6s ease; }
        .skeleton { background:linear-gradient(90deg,var(--surface) 25%,var(--surface2) 50%,var(--surface) 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:8px; }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes pulse { 0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(0,229,160,0.4)} 50%{opacity:.6;box-shadow:0 0 0 6px rgba(0,229,160,0)} }
        @media(max-width:640px) { .lb-title{font-size:28px} .class-stats{grid-template-columns:1fr 1fr} .podium{grid-template-columns:1fr} }
      `}</style>

      <div className="page">
        <nav className="nav">
          <div className="nav-logo">CRYPTO<span>CLASS</span></div>
          <div className="nav-links">
            <Link href="/dashboard" className="nav-link">Wallet</Link>
            <a href="/leaderboard" className="nav-link active">Leaderboard</a>
            <Link href="/market" className="nav-link">Market</Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 1 }}>LIVE</span>
          </div>
        </nav>

        <div className="lb-header">
          <div className="lb-title">🏆 <span>Leader</span>board</div>
          <div className="lb-sub">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()} · auto-refreshes every 60s` : 'Loading...'}
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton" style={{ height: 56 }} />)}
          </div>
        ) : (
          <>
            <div className="class-stats">
              <div className="cs-card">
                <div className="cs-label">Students</div>
                <div className="cs-val gold">{rows.length}</div>
              </div>
              <div className="cs-card">
                <div className="cs-label">Profitable</div>
                <div className={`cs-val ${profitable / rows.length >= 0.5 ? 'up' : 'down'}`}>{profitable}/{rows.length}</div>
              </div>
              <div className="cs-card">
                <div className="cs-label">Class Avg Return</div>
                <div className={`cs-val ${classAvg >= 0 ? 'up' : 'down'}`}>{classAvg >= 0 ? '+' : ''}{classAvg.toFixed(2)}%</div>
              </div>
              <div className="cs-card">
                <div className="cs-label">Top Return</div>
                <div className="cs-val up">{rows.length ? fmtPct(Math.max(...rows.map(r => parseFloat(r.returnPct || 0)))) : '—'}</div>
              </div>
            </div>

            {sorted.length >= 3 && (
              <div className="podium">
                {[sorted[1], sorted[0], sorted[2]].map((s, i) => {
                  const origRank = i === 1 ? 0 : i === 0 ? 1 : 2;
                  const isProfit = parseFloat(s?.returnPct || 0) >= 0;
                  const podiumClass = origRank === 0 ? 'first' : origRank === 1 ? 'second' : 'third';
                  const barColor = origRank === 0 ? '#f59e0b' : origRank === 1 ? '#94a3b8' : '#b47c3c';
                  return (
                    <div className={`podium-card ${podiumClass}`} key={origRank}>
                      <span className="podium-medal">{MEDALS[origRank]}</span>
                      <div className={`podium-name${s?.name === myName ? ' me' : ''}`}>
                        {s?.name || '—'}
                        {s?.name === myName && <span style={{ fontSize: 9, color: 'var(--accent)', marginLeft: 6 }}>YOU</span>}
                      </div>
                      <div className="podium-val">{fmtUSD(s?.total)}</div>
                      <div className={`podium-ret ${isProfit ? 'up' : 'down'}`}>{fmtPct(s?.returnPct)}</div>
                      <div className="podium-bar" style={{ background: barColor }} />
                    </div>
                  );
                })}
              </div>
            )}

            <div className="controls">
              <input className="search-input" placeholder="Search students..." value={search} onChange={e => setSearch(e.target.value)} />
              {[['total', 'Portfolio Value'], ['return', 'Return %'], ['pl', 'Profit/Loss']].map(([k, l]) => (
                <button key={k} className={`sort-btn${sortKey === k ? ' active' : ''}`} onClick={() => setSortKey(k)}>{l}</button>
              ))}
              <button className="sort-btn" onClick={fetchData}>↻</button>
            </div>

            <div className="table-wrap">
              <table className="rank-table">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>Rank</th>
                    <th>Student</th>
                    <th className="sortable" onClick={() => setSortKey('total')}>Portfolio {sortKey === 'total' ? '↓' : ''}</th>
                    <th>Cash</th>
                    <th className="sortable" onClick={() => setSortKey('return')}>Return {sortKey === 'return' ? '↓' : ''}</th>
                    <th className="sortable" onClick={() => setSortKey('pl')}>P/L {sortKey === 'pl' ? '↓' : ''}</th>
                    <th>Progress</th>
                    <th>Fees</th>
                    <th>Streak</th>
                    <th>Coins</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s, i) => {
                    const isMe = s.name === myName;
                    const ret = parseFloat(s.returnPct || 0);
                    const pl = parseFloat(s.pl || 0);
                    const isProfit = ret >= 0;
                    const barWidth = Math.min(100, Math.abs(ret) * 2);
                    const medal = i < 3 ? MEDALS[i] : null;
                    return (
                      <tr key={i} className={`rank-row${isMe ? ' me-row' : ''}`} style={i < 3 ? { background: ROW_BG[i] } : {}}>
                        <td>
                          <div className="rank-num" style={{ color: i === 0 ? 'var(--gold)' : i === 1 ? '#94a3b8' : i === 2 ? '#b47c3c' : 'var(--muted)' }}>
                            {medal || (i + 1)}
                          </div>
                        </td>
                        <td>
                          <span className={`rank-name${isMe ? ' me' : ''}`}>
                            {s.name}
                            {isMe && <span className="you-tag">YOU</span>}
                            {s.isBot && <span style={{ fontSize: 9, color: '#f59e0b', marginLeft: 4 }}>BOT</span>}
                          </span>
                        </td>
                        <td style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700 }}>{fmtUSD(s.total)}</td>
                        <td style={{ color: 'var(--muted)', fontSize: 12 }}>{fmtUSD(s.cash)}</td>
                        <td style={{ color: isProfit ? 'var(--up)' : 'var(--down)', fontWeight: 500 }}>{fmtPct(ret)}</td>
                        <td style={{ color: isProfit ? 'var(--up)' : 'var(--down)', fontWeight: 500 }}>{isProfit ? '+' : ''}{fmtUSD(pl)}</td>
                        <td>
                          <div className="profit-bar-bg">
                            <div className="profit-bar-fill" style={{ width: `${barWidth}%`, background: isProfit ? 'var(--up)' : 'var(--down)' }} />
                          </div>
                        </td>
                        <td style={{ color: 'var(--muted)', fontSize: 11 }}>{fmtUSD(s.fees)}</td>
                        <td>
                          {s.streak && s.streak !== '0' ? (
                            <span style={{ fontSize: 11, color: s.streakType === 'win' ? 'var(--up)' : 'var(--down)' }}>
                              {s.streakType === 'win' ? '🔥' : '❌'} {s.streak}
                            </span>
                          ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                        </td>
                        <td style={{ color: 'var(--muted)', fontSize: 11, textAlign: 'center' }}>{s.coinCount || 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}