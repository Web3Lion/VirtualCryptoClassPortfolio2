'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const CAT_COLORS = {
  milestone:   { bg:'rgba(245,158,11,.12)',  border:'rgba(245,158,11,.3)',  text:'#f59e0b',  label:'Milestone' },
  performance: { bg:'rgba(0,229,160,.12)',   border:'rgba(0,229,160,.3)',   text:'#00e5a0',  label:'Performance' },
  strategy:    { bg:'rgba(59,130,246,.12)',  border:'rgba(59,130,246,.3)',  text:'#3b82f6',  label:'Strategy' },
  learning:    { bg:'rgba(168,85,247,.12)',  border:'rgba(168,85,247,.3)',  text:'#a855f7',  label:'Learning' },
  situational: { bg:'rgba(244,63,94,.12)',   border:'rgba(244,63,94,.3)',   text:'#f43f5e',  label:'Situational' },
  simulation:  { bg:'rgba(20,184,166,.12)',  border:'rgba(20,184,166,.3)',  text:'#14b8a6',  label:'Simulation' },
};

export default function Badges() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [badges, setBadges] = useState([]);
  const [earnedCount, setEarnedCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [studentName, setStudentName] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/');
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/badges')
      .then(r => r.json())
      .then(data => {
        if (data.badges) {
          setBadges(data.badges);
          setEarnedCount(data.earnedCount);
          setTotal(data.total);
          setStudentName(data.studentName || '');
        }
      })
      .finally(() => setLoading(false));
  }, [status]);

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div style={{ background:'#080c14', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#475569', fontFamily:'monospace' }}>
        Checking session...
      </div>
    );
  }

  const cats = ['all', ...Object.keys(CAT_COLORS)];
  const filtered = filter === 'all' ? badges : badges.filter(b => b.cat === filter);
  const earned = filtered.filter(b => b.earned);
  const locked = filtered.filter(b => !b.earned);
  const pct = total > 0 ? Math.round((earnedCount / total) * 100) : 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        :root { --bg:#080c14; --surface:#0f172a; --surface2:#1a2235; --border:#1e293b; --accent:#00e5a0; --text:#e2e8f0; --muted:#475569; --gold:#f59e0b; }
        body { background:var(--bg); color:var(--text); font-family:'DM Mono',monospace; min-height:100vh;
          background-image:radial-gradient(ellipse 80% 50% at 50% -20%, rgba(245,158,11,0.04) 0%, transparent 60%); }
        .page { max-width:1100px; margin:0 auto; padding:24px 16px; }
        .nav { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; margin-bottom:28px;
          background:rgba(15,23,42,0.8); border:1px solid var(--border); border-radius:16px; backdrop-filter:blur(12px); }
        .nav-logo { font-family:'Syne',sans-serif; font-weight:800; font-size:16px; }
        .nav-logo span { color:var(--accent); }
        .nav-links { display:flex; gap:8px; }
        .nav-link { padding:6px 14px; border-radius:8px; font-size:11px; text-decoration:none; color:var(--muted); letter-spacing:1px; transition:all .2s; text-transform:uppercase; }
        .nav-link:hover { color:var(--accent); }
        .nav-link.active { background:rgba(245,158,11,.1); color:var(--gold); border:1px solid rgba(245,158,11,.2); }

        .header { text-align:center; margin-bottom:32px; }
        .title { font-family:'Syne',sans-serif; font-weight:800; font-size:36px; letter-spacing:-1.5px; margin-bottom:6px; }
        .title span { color:var(--gold); }
        .subtitle { font-size:12px; color:var(--muted); }

        .progress-card { background:var(--surface); border:1px solid var(--border); border-radius:20px; padding:24px; margin-bottom:24px; }
        .progress-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; }
        .progress-label { font-family:'Syne',sans-serif; font-weight:700; font-size:15px; }
        .progress-count { font-size:13px; color:var(--gold); font-weight:500; }
        .progress-bar-bg { height:10px; background:var(--surface2); border-radius:6px; overflow:hidden; margin-bottom:10px; }
        .progress-bar-fill { height:100%; border-radius:6px; background:linear-gradient(90deg,var(--gold),#f97316); transition:width .8s ease; }
        .progress-pct { font-size:11px; color:var(--muted); }

        .filter-tabs { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:24px; }
        .filter-btn { padding:6px 14px; border-radius:20px; border:1px solid var(--border); background:transparent;
          font-family:'DM Mono',monospace; font-size:11px; color:var(--muted); cursor:pointer; transition:all .2s; letter-spacing:.5px; }
        .filter-btn:hover { color:var(--text); }
        .filter-btn.active { background:rgba(245,158,11,.1); color:var(--gold); border-color:rgba(245,158,11,.3); }

        .section-title { font-family:'Syne',sans-serif; font-weight:700; font-size:13px; color:var(--muted);
          text-transform:uppercase; letter-spacing:2px; margin-bottom:14px; margin-top:24px; }

        .badge-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(200px,1fr)); gap:12px; }
        .badge-card { border-radius:16px; padding:16px; border:1px solid; transition:all .2s; cursor:default; }
        .badge-card:hover { transform:translateY(-2px); }
        .badge-card.earned { }
        .badge-card.locked { background:rgba(30,41,59,.5); border-color:var(--border); opacity:.6; }
        .badge-emoji { font-size:28px; margin-bottom:8px; display:block; }
        .badge-emoji.locked-icon { filter:grayscale(1); opacity:.4; font-size:24px; }
        .badge-name { font-family:'Syne',sans-serif; font-weight:700; font-size:13px; margin-bottom:4px; }
        .badge-hint { font-size:11px; line-height:1.4; }
        .badge-date { font-size:10px; margin-top:6px; opacity:.6; }
        .badge-cat { display:inline-block; font-size:9px; padding:2px 7px; border-radius:6px; margin-top:6px; letter-spacing:1px; text-transform:uppercase; font-weight:500; }

        .empty { text-align:center; padding:40px; color:var(--muted); font-size:13px; }

        .skeleton { background:linear-gradient(90deg,var(--surface) 25%,var(--surface2) 50%,var(--surface) 75%);
          background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:16px; height:120px; }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes pulse { 0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(245,158,11,0.4)} 50%{opacity:.6;box-shadow:0 0 0 6px rgba(245,158,11,0)} }

        @media(max-width:640px) { .title{font-size:26px} .badge-grid{grid-template-columns:1fr 1fr} }
      `}</style>

      <div className="page">
        <nav className="nav">
          <div className="nav-logo">CRYPTO<span>CLASS</span></div>
          <div className="nav-links">
            <Link href="/dashboard" className="nav-link">Wallet</Link>
            <Link href="/leaderboard" className="nav-link">Leaderboard</Link>
            <Link href="/market" className="nav-link">Market</Link>
            <a href="/badges" className="nav-link active">Badges</a>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:'var(--gold)',animation:'pulse 2s infinite'}} />
            <span style={{fontSize:10,color:'var(--muted)',letterSpacing:1}}>LIVE</span>
          </div>
        </nav>

        <div className="header">
          <div className="title">🏅 Achievement <span>Badges</span></div>
          <div className="subtitle">{studentName ? `${studentName}'s achievements` : 'Your achievements'}</div>
        </div>

        {loading ? (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12}}>
            {[...Array(12)].map((_,i) => <div key={i} className="skeleton" />)}
          </div>
        ) : (
          <>
            {/* PROGRESS BAR */}
            <div className="progress-card">
              <div className="progress-top">
                <div className="progress-label">Overall Progress</div>
                <div className="progress-count">{earnedCount} / {total} earned</div>
              </div>
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{width:`${pct}%`}} />
              </div>
              <div className="progress-pct">{pct}% complete</div>
            </div>

            {/* CATEGORY FILTERS */}
            <div className="filter-tabs">
              {cats.map(c => (
                <button key={c} className={`filter-btn${filter===c?' active':''}`} onClick={()=>setFilter(c)}>
                  {c === 'all' ? `All (${badges.length})` : `${CAT_COLORS[c]?.label} (${badges.filter(b=>b.cat===c).length})`}
                </button>
              ))}
            </div>

            {/* EARNED BADGES */}
            {earned.length > 0 && (
              <>
                <div className="section-title">✅ Earned ({earned.length})</div>
                <div className="badge-grid">
                  {earned.map(b => {
                    const c = CAT_COLORS[b.cat] || CAT_COLORS.milestone;
                    return (
                      <div key={b.id} className="badge-card earned" style={{background:c.bg, borderColor:c.border}}>
                        <span className="badge-emoji">{b.emoji}</span>
                        <div className="badge-name" style={{color:c.text}}>{b.name}</div>
                        <div className="badge-hint" style={{color:c.text, opacity:.8}}>{b.hint}</div>
                        {b.earnedDate && (
                          <div className="badge-date" style={{color:c.text}}>
                            Earned {new Date(b.earnedDate).toLocaleDateString()}
                          </div>
                        )}
                        <div className="badge-cat" style={{background:`${c.border}`, color:c.text}}>{c.label}</div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* LOCKED BADGES */}
            {locked.length > 0 && (
              <>
                <div className="section-title">🔒 Locked ({locked.length})</div>
                <div className="badge-grid">
                  {locked.map(b => (
                    <div key={b.id} className="badge-card locked">
                      <span className="badge-emoji locked-icon">{b.emoji}</span>
                      <div className="badge-name" style={{color:'var(--muted)'}}>{b.name}</div>
                      <div className="badge-hint" style={{color:'var(--muted)'}}>{b.hint}</div>
                      <div className="badge-cat" style={{background:'var(--surface2)',color:'var(--muted)'}}>
                        {CAT_COLORS[b.cat]?.label}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {filtered.length === 0 && (
              <div className="empty">No badges in this category yet.</div>
            )}
          </>
        )}
      </div>
    </>
  );
}
