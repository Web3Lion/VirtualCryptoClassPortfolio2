"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const fmtUSD = (n) => {
  const num = parseFloat(n);
  return isNaN(num)
    ? "$0.00"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(num);
};
const fmtPct = (n) => {
  const num = parseFloat(n);
  return isNaN(num) ? "0.00%" : (num >= 0 ? "+" : "") + num.toFixed(2) + "%";
};

export default function Teacher() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marketStatus, setMarketStatus] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);
  const [activeSection, setActiveSection] = useState("overview");
  const [freezeMsg, setFreezeMsg] = useState("");
  const [headline, setHeadline] = useState("");
  const [headlineUrl, setHeadlineUrl] = useState("");
  const [flashCoin, setFlashCoin] = useState("");
  const [flashPct, setFlashPct] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/");
    }
    if (
      status === "authenticated" &&
      session?.user?.email !== process.env.NEXT_PUBLIC_TEACHER_EMAIL
    ) {
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div
        style={{
          background: "#080c14",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#475569",
          fontFamily: "monospace",
        }}
      >
        Checking session...
      </div>
    );
  }

  const fetchData = async () => {
    try {
      const [lbRes, mktRes] = await Promise.all([
        fetch("/api/leaderboard"),
        fetch("/api/teacher/market-status"),
      ]);
      if (lbRes.ok) setStudents(await lbRes.json());
      if (mktRes.ok) setMarketStatus(await mktRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") fetchData();
  }, [status]);

  const teacherAction = async (endpoint, body = {}) => {
    setActionMsg({ type: "pending", msg: "Processing..." });
    try {
      const res = await fetch(`/api/teacher/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg({ type: "success", msg: data.message || "✓ Done" });
        fetchData();
      } else {
        setActionMsg({ type: "error", msg: data.error || "Action failed." });
      }
    } catch {
      setActionMsg({ type: "error", msg: "Network error." });
    }
    setTimeout(() => setActionMsg(null), 4000);
  };

  const classAvg = students.length
    ? students
        .filter((s) => !s.isBot)
        .reduce((s, r) => s + parseFloat(r.returnPct || 0), 0) /
      students.filter((s) => !s.isBot).length
    : 0;
  const profitable = students.filter(
    (s) => !s.isBot && parseFloat(s.pl || 0) > 0
  ).length;
  const humans = students.filter((s) => !s.isBot);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        :root { --bg:#080c14; --surface:#0f172a; --surface2:#1a2235; --border:#1e293b; --accent:#00e5a0; --up:#00e5a0; --down:#f43f5e; --text:#e2e8f0; --muted:#475569; --gold:#f59e0b; --warn:#f59e0b; }
        body { background:var(--bg); color:var(--text); font-family:'DM Mono',monospace; min-height:100vh; }
        .page { max-width:1100px; margin:0 auto; padding:24px 16px; }
        .nav { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; margin-bottom:28px; background:rgba(15,23,42,0.8); border:1px solid var(--border); border-radius:16px; backdrop-filter:blur(12px); }
        .nav-logo { font-family:'Syne',sans-serif; font-weight:800; font-size:16px; }
        .nav-logo span { color:var(--accent); }
        .nav-links { display:flex; gap:8px; }
        .nav-link { padding:6px 14px; border-radius:8px; font-size:11px; text-decoration:none; color:var(--muted); letter-spacing:1px; transition:all .2s; text-transform:uppercase; }
        .nav-link:hover { color:var(--accent); }
        .nav-link.active { background:rgba(0,229,160,.1); color:var(--accent); border:1px solid rgba(0,229,160,.2); }
        .teacher-badge { padding:4px 10px; background:rgba(245,158,11,.15); color:var(--gold); border-radius:8px; font-size:10px; border:1px solid rgba(245,158,11,.3); }
        .page-title { font-family:'Syne',sans-serif; font-weight:800; font-size:32px; letter-spacing:-1px; margin-bottom:4px; }
        .page-title span { color:var(--accent); }
        .page-sub { font-size:11px; color:var(--muted); margin-bottom:24px; }
        .section-tabs { display:flex; gap:4px; background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:4px; margin-bottom:24px; }
        .stab { flex:1; padding:9px; text-align:center; border-radius:10px; border:none; background:transparent; font-family:'DM Mono',monospace; font-size:11px; color:var(--muted); cursor:pointer; transition:all .2s; letter-spacing:.5px; text-transform:capitalize; }
        .stab.active { background:var(--surface2); color:var(--gold); border:1px solid var(--border); }
        .stab:hover:not(.active) { color:var(--text); }
        .stats-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:24px; }
        .stat-card { background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:18px; }
        .stat-label { font-size:9px; color:var(--muted); letter-spacing:2px; text-transform:uppercase; margin-bottom:6px; }
        .stat-value { font-family:'Syne',sans-serif; font-weight:700; font-size:24px; }
        .stat-value.up { color:var(--up); }
        .stat-value.down { color:var(--down); }
        .stat-value.gold { color:var(--gold); }
        .controls-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        .control-card { background:var(--surface); border:1px solid var(--border); border-radius:20px; padding:22px; }
        .control-title { font-family:'Syne',sans-serif; font-weight:700; font-size:15px; margin-bottom:6px; }
        .control-desc { font-size:11px; color:var(--muted); margin-bottom:16px; line-height:1.6; }
        .control-status { display:inline-flex; align-items:center; gap:6px; font-size:11px; padding:4px 10px; border-radius:8px; margin-bottom:14px; }
        .control-status.on { background:rgba(0,229,160,.1); color:var(--up); }
        .control-status.off { background:rgba(71,85,105,.2); color:var(--muted); }
        .control-status.warn { background:rgba(245,158,11,.1); color:var(--warn); }
        .btn { padding:10px 18px; border-radius:10px; border:none; font-family:'DM Mono',monospace; font-size:11px; font-weight:500; cursor:pointer; transition:all .2s; letter-spacing:.5px; }
        .btn-green { background:rgba(0,229,160,.15); color:var(--up); border:1px solid rgba(0,229,160,.3); }
        .btn-green:hover { background:rgba(0,229,160,.25); }
        .btn-red { background:rgba(244,63,94,.15); color:var(--down); border:1px solid rgba(244,63,94,.3); }
        .btn-red:hover { background:rgba(244,63,94,.25); }
        .btn-gold { background:rgba(245,158,11,.15); color:var(--gold); border:1px solid rgba(245,158,11,.3); }
        .btn-gold:hover { background:rgba(245,158,11,.25); }
        .btn-muted { background:var(--surface2); color:var(--text); border:1px solid var(--border); }
        .btn-muted:hover { border-color:var(--accent); color:var(--accent); }
        .btn-row { display:flex; gap:8px; flex-wrap:wrap; }
        .text-input { width:100%; background:var(--surface2); border:1px solid var(--border); border-radius:10px; padding:10px 14px; color:var(--text); font-family:'DM Mono',monospace; font-size:12px; outline:none; transition:border-color .2s; margin-bottom:10px; }
        .text-input:focus { border-color:var(--accent); }
        .action-msg { position:fixed; bottom:24px; right:24px; padding:14px 20px; border-radius:14px; font-size:13px; z-index:999; border:1px solid; }
        .action-msg.success { background:rgba(0,229,160,.1); color:var(--up); border-color:rgba(0,229,160,.3); }
        .action-msg.error { background:rgba(244,63,94,.1); color:var(--down); border-color:rgba(244,63,94,.3); }
        .action-msg.pending { background:rgba(59,130,246,.1); color:#60a5fa; border-color:rgba(59,130,246,.3); }
        .student-table { width:100%; border-collapse:collapse; }
        .student-table th { font-size:9px; color:var(--muted); letter-spacing:2px; text-transform:uppercase; padding:10px 14px; text-align:left; border-bottom:1px solid var(--border); }
        .student-row { border-bottom:1px solid rgba(30,41,59,.4); transition:background .15s; }
        .student-row:hover { background:rgba(0,229,160,.03); }
        .student-row td { padding:12px 14px; font-size:12px; }
        .student-name { font-family:'Syne',sans-serif; font-weight:600; font-size:13px; }
        .progress-bar { background:var(--surface2); border-radius:4px; height:6px; overflow:hidden; width:80px; }
        .progress-fill { height:100%; border-radius:4px; }
        .news-section { display:flex; flex-direction:column; gap:16px; }
        .news-composer { background:var(--surface); border:1px solid var(--border); border-radius:20px; padding:22px; }
        .news-composer h3 { font-family:'Syne',sans-serif; font-weight:700; font-size:15px; margin-bottom:16px; }
        .skeleton { background:linear-gradient(90deg,var(--surface) 25%,var(--surface2) 50%,var(--surface) 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:8px; }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        @media(max-width:640px) { .stats-grid{grid-template-columns:1fr 1fr} .controls-grid{grid-template-columns:1fr} }
      `}</style>

      <div className="page">
        <nav className="nav">
          <div className="nav-logo">
            CRYPTO<span>CLASS</span>
          </div>
          <div className="nav-links">
            <Link href="/dashboard" className="nav-link">
              Wallet
            </Link>
            <Link href="/leaderboard" className="nav-link">
              Leaderboard
            </Link>
            <Link href="/market" className="nav-link">
              Market
            </Link>
            <a href="/teacher" className="nav-link active">
              Teacher
            </a>
          </div>
          <div className="teacher-badge">👨‍🏫 TEACHER</div>
        </nav>

        <div className="page-title">
          🎓 Teacher <span>Dashboard</span>
        </div>
        <div className="page-sub">
          Manage your simulation, control the market, and monitor student
          progress.
        </div>

        <div className="section-tabs">
          {["overview", "controls", "students", "news"].map((s) => (
            <button
              key={s}
              className={`stab${activeSection === s ? " active" : ""}`}
              onClick={() => setActiveSection(s)}
            >
              {s}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 80 }} />
            ))}
          </div>
        ) : (
          <>
            {activeSection === "overview" && (
              <>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-label">Students</div>
                    <div className="stat-value gold">{humans.length}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Profitable</div>
                    <div
                      className={`stat-value ${
                        profitable / humans.length >= 0.5 ? "up" : "down"
                      }`}
                    >
                      {profitable}/{humans.length}
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Class Avg Return</div>
                    <div
                      className={`stat-value ${classAvg >= 0 ? "up" : "down"}`}
                    >
                      {classAvg >= 0 ? "+" : ""}
                      {classAvg.toFixed(2)}%
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Market</div>
                    <div
                      className={`stat-value ${
                        marketStatus?.frozen ? "down" : "up"
                      }`}
                    >
                      {marketStatus?.frozen ? "🔒 FROZEN" : "✓ OPEN"}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 20,
                    padding: 22,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Syne',sans-serif",
                      fontWeight: 700,
                      fontSize: 15,
                      marginBottom: 16,
                    }}
                  >
                    Quick Actions
                  </div>
                  <div className="btn-row">
                    <button className="btn btn-muted" onClick={fetchData}>
                      ↻ Refresh Data
                    </button>
                    <button
                      className="btn btn-gold"
                      onClick={() => setActiveSection("controls")}
                    >
                      ⚙ Market Controls
                    </button>
                    <button
                      className="btn btn-muted"
                      onClick={() => setActiveSection("students")}
                    >
                      👥 View Students
                    </button>
                    <button
                      className="btn btn-muted"
                      onClick={() => setActiveSection("news")}
                    >
                      📰 Post News
                    </button>
                    <Link
                      href="/leaderboard"
                      style={{ textDecoration: "none" }}
                    >
                      <button className="btn btn-muted">🏆 Leaderboard</button>
                    </Link>
                  </div>
                </div>
              </>
            )}

            {activeSection === "controls" && (
              <div className="controls-grid">
                <div className="control-card">
                  <div className="control-title">🚫 Market Freeze</div>
                  <div className="control-desc">
                    Suspend all trading. Students will see your message.
                  </div>
                  <div
                    className={`control-status ${
                      marketStatus?.frozen ? "warn" : "off"
                    }`}
                  >
                    <span>{marketStatus?.frozen ? "🔴" : "⚪"}</span>
                    {marketStatus?.frozen ? "FROZEN" : "MARKET OPEN"}
                  </div>
                  {!marketStatus?.frozen && (
                    <input
                      className="text-input"
                      placeholder="Freeze reason (e.g. Class discussion)"
                      value={freezeMsg}
                      onChange={(e) => setFreezeMsg(e.target.value)}
                    />
                  )}
                  <div className="btn-row">
                    {marketStatus?.frozen ? (
                      <button
                        className="btn btn-green"
                        onClick={() => teacherAction("unfreeze")}
                      >
                        ▶ Unfreeze Market
                      </button>
                    ) : (
                      <button
                        className="btn btn-red"
                        onClick={() =>
                          teacherAction("freeze", {
                            reason: freezeMsg || "Market temporarily closed",
                          })
                        }
                      >
                        🔒 Freeze Market
                      </button>
                    )}
                  </div>
                </div>

                <div className="control-card">
                  <div className="control-title">🐂 Bull Run Event</div>
                  <div className="control-desc">
                    Amplify all price changes to simulate a bull market.
                  </div>
                  <div
                    className={`control-status ${
                      marketStatus?.bullRun ? "on" : "off"
                    }`}
                  >
                    <span>{marketStatus?.bullRun ? "🟢" : "⚪"}</span>
                    {marketStatus?.bullRun
                      ? `ACTIVE — ${marketStatus.bullMult}× multiplier`
                      : "INACTIVE"}
                  </div>
                  <div className="btn-row">
                    {marketStatus?.bullRun ? (
                      <button
                        className="btn btn-red"
                        onClick={() => teacherAction("bull-run/stop")}
                      >
                        ⏹ End Bull Run
                      </button>
                    ) : (
                      <>
                        <button
                          className="btn btn-gold"
                          onClick={() =>
                            teacherAction("bull-run/start", { multiplier: 2 })
                          }
                        >
                          🐂 Start 2×
                        </button>
                        <button
                          className="btn btn-red"
                          onClick={() =>
                            teacherAction("bull-run/start", { multiplier: 3 })
                          }
                        >
                          🚀 Start 3×
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="control-card">
                  <div className="control-title">⚡ Flash Sale</div>
                  <div className="control-desc">
                    Drop the price of one coin temporarily to create a buying
                    opportunity.
                  </div>
                  <div
                    className={`control-status ${
                      marketStatus?.flashSale ? "warn" : "off"
                    }`}
                  >
                    <span>{marketStatus?.flashSale ? "🟡" : "⚪"}</span>
                    {marketStatus?.flashSale
                      ? `ACTIVE — ${marketStatus.flashCoin}`
                      : "NONE ACTIVE"}
                  </div>
                  {!marketStatus?.flashSale && (
                    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                      <input
                        className="text-input"
                        placeholder="Coin (e.g. BTC)"
                        value={flashCoin}
                        onChange={(e) => setFlashCoin(e.target.value)}
                        style={{ marginBottom: 0 }}
                      />
                      <input
                        className="text-input"
                        placeholder="% off (e.g. 20)"
                        value={flashPct}
                        onChange={(e) => setFlashPct(e.target.value)}
                        style={{ marginBottom: 0 }}
                      />
                    </div>
                  )}
                  <div className="btn-row">
                    {marketStatus?.flashSale ? (
                      <button
                        className="btn btn-muted"
                        onClick={() => teacherAction("flash-sale/stop")}
                      >
                        ⏹ End Flash Sale
                      </button>
                    ) : (
                      <button
                        className="btn btn-gold"
                        onClick={() => {
                          if (flashCoin && flashPct)
                            teacherAction("flash-sale/start", {
                              coin: flashCoin.toUpperCase(),
                              discountPct: parseFloat(flashPct),
                            });
                        }}
                      >
                        ⚡ Start Flash Sale
                      </button>
                    )}
                  </div>
                </div>

                <div className="control-card">
                  <div className="control-title">🏁 Simulation</div>
                  <div className="control-desc">
                    Pause for class discussion or end the simulation and
                    generate the final report.
                  </div>
                  <div
                    className="btn-row"
                    style={{
                      flexDirection: "column",
                      alignItems: "flex-start",
                    }}
                  >
                    <button
                      className="btn btn-gold"
                      style={{ width: "100%", marginBottom: 8 }}
                      onClick={() => teacherAction("pause")}
                    >
                      ⏸ Pause Simulation
                    </button>
                    <button
                      className="btn btn-green"
                      style={{ width: "100%", marginBottom: 8 }}
                      onClick={() => teacherAction("resume")}
                    >
                      ▶ Resume Simulation
                    </button>
                    <button
                      className="btn btn-red"
                      style={{ width: "100%" }}
                      onClick={() => {
                        if (
                          confirm("End simulation and generate final report?")
                        )
                          teacherAction("end");
                      }}
                    >
                      🏁 End Simulation
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "students" && (
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 20,
                  padding: 22,
                  overflowX: "auto",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 18,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Syne',sans-serif",
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                  >
                    All Students ({humans.length})
                  </div>
                  <button className="btn btn-muted" onClick={fetchData}>
                    ↻ Refresh
                  </button>
                </div>
                <table className="student-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Name</th>
                      <th>Portfolio</th>
                      <th>Return</th>
                      <th>P/L</th>
                      <th>Cash</th>
                      <th>Coins</th>
                      <th>Fees</th>
                      <th>Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, i) => {
                      const ret = parseFloat(s.returnPct || 0);
                      const pl = parseFloat(s.pl || 0);
                      const isProfit = ret >= 0;
                      return (
                        <tr className="student-row" key={i}>
                          <td
                            style={{ color: "var(--muted)", fontWeight: 700 }}
                          >
                            {i + 1}
                          </td>
                          <td>
                            <div className="student-name">{s.name}</div>
                            {s.isBot && (
                              <div
                                style={{ fontSize: 9, color: "var(--gold)" }}
                              >
                                BOT
                              </div>
                            )}
                          </td>
                          <td
                            style={{
                              fontFamily: "'Syne',sans-serif",
                              fontWeight: 700,
                            }}
                          >
                            {fmtUSD(s.total)}
                          </td>
                          <td
                            style={{
                              color: isProfit ? "var(--up)" : "var(--down)",
                              fontWeight: 500,
                            }}
                          >
                            {fmtPct(ret)}
                          </td>
                          <td
                            style={{
                              color: isProfit ? "var(--up)" : "var(--down)",
                            }}
                          >
                            {isProfit ? "+" : ""}
                            {fmtUSD(pl)}
                          </td>
                          <td style={{ color: "var(--muted)" }}>
                            {fmtUSD(s.cash)}
                          </td>
                          <td
                            style={{
                              color: "var(--muted)",
                              textAlign: "center",
                            }}
                          >
                            {s.coinCount || 0}
                          </td>
                          <td style={{ color: "var(--muted)" }}>
                            {fmtUSD(s.fees)}
                          </td>
                          <td>
                            <div className="progress-bar">
                              <div
                                className="progress-fill"
                                style={{
                                  width: `${Math.min(100, Math.abs(ret) * 2)}%`,
                                  background: isProfit
                                    ? "var(--up)"
                                    : "var(--down)",
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {activeSection === "news" && (
              <div className="news-section">
                <div className="news-composer">
                  <h3>📰 Post a News Headline</h3>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--muted)",
                      marginBottom: 16,
                      lineHeight: 1.6,
                    }}
                  >
                    Post a headline to all student portfolio banners. Use it to
                    simulate real market events.
                  </div>
                  <input
                    className="text-input"
                    placeholder="Headline (e.g. 🚀 Elon Musk tweets about DOGE — price surging!)"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                  />
                  <input
                    className="text-input"
                    placeholder="Optional URL (https://...)"
                    value={headlineUrl}
                    onChange={(e) => setHeadlineUrl(e.target.value)}
                  />
                  <div className="btn-row">
                    <button
                      className="btn btn-gold"
                      onClick={() => {
                        if (headline) {
                          teacherAction("post-headline", {
                            headline,
                            url: headlineUrl,
                          });
                          setHeadline("");
                          setHeadlineUrl("");
                        }
                      }}
                    >
                      📰 Post to All Students
                    </button>
                    <button
                      className="btn btn-muted"
                      onClick={() => teacherAction("clear-headlines")}
                    >
                      🗑 Clear Headlines
                    </button>
                  </div>
                </div>

                <div className="control-card">
                  <div className="control-title">
                    📅 Fetch Daily Crypto News
                  </div>
                  <div className="control-desc">
                    Pull today's headlines from CoinDesk, CoinTelegraph, and
                    Decrypt RSS feeds.
                  </div>
                  <button
                    className="btn btn-muted"
                    onClick={() => teacherAction("fetch-news")}
                  >
                    📡 Fetch Now
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {actionMsg && (
        <div className={`action-msg ${actionMsg.type}`}>{actionMsg.msg}</div>
      )}
    </>
  );
}
