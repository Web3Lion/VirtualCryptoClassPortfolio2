"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const fmtUSD = (n, dec = 2) => {
  const num = parseFloat(n);
  if (isNaN(num)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(num);
};
const fmtPct = (n) => {
  const num = parseFloat(n);
  if (isNaN(num)) return "—";
  return (num >= 0 ? "+" : "") + num.toFixed(2) + "%";
};

const heatColor = (pct) => {
  const n = parseFloat(pct);
  if (isNaN(n)) return { bg: "rgba(71,85,105,.2)", text: "#475569" };
  if (n > 5) return { bg: "rgba(0,229,160,.25)", text: "#00e5a0" };
  if (n > 2) return { bg: "rgba(0,229,160,.15)", text: "#6ee7b7" };
  if (n > 0) return { bg: "rgba(0,229,160,.07)", text: "#a7f3d0" };
  if (n > -2) return { bg: "rgba(244,63,94,.07)", text: "#fca5a5" };
  if (n > -5) return { bg: "rgba(244,63,94,.15)", text: "#f87171" };
  return { bg: "rgba(244,63,94,.25)", text: "#f43f5e" };
};

export default function Market() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("rank");
  const [sortDir, setSortDir] = useState("asc");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [view, setView] = useState("table");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/");
    }
  }, [status, router]);

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

  const fetchPrices = async () => {
    try {
      const res = await fetch("/api/prices?full=true");
      if (res.ok) {
        const data = await res.json();
        setPrices(
          Array.isArray(data)
            ? data
            : Object.entries(data).map(([ticker, v]) => ({ ticker, ...v }))
        );
        setLastUpdated(new Date());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchPrices();
      const iv = setInterval(fetchPrices, 60000);
      return () => clearInterval(iv);
    }
  }, [status]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = [...prices]
    .filter(
      (p) => !search || p.ticker?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      let av = a[sortKey],
        bv = b[sortKey];
      if (["price", "change1h", "change24h", "change7d"].includes(sortKey)) {
        av = parseFloat(av) || 0;
        bv = parseFloat(bv) || 0;
      }
      if (sortDir === "asc") return av > bv ? 1 : -1;
      return av < bv ? 1 : -1;
    });

  const bySector = {};
  prices.forEach((p) => {
    const s = p.sector || "Other";
    if (!bySector[s]) bySector[s] = [];
    bySector[s].push(p);
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        :root { --bg:#080c14; --surface:#0f172a; --surface2:#1a2235; --border:#1e293b; --accent:#00e5a0; --up:#00e5a0; --down:#f43f5e; --text:#e2e8f0; --muted:#475569; }
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
        .page-title { font-family:'Syne',sans-serif; font-weight:800; font-size:32px; letter-spacing:-1px; margin-bottom:6px; }
        .page-title span { color:var(--accent); }
        .page-sub { font-size:11px; color:var(--muted); margin-bottom:24px; }
        .controls { display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap; align-items:center; }
        .search-input { flex:1; min-width:180px; background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:10px 16px; color:var(--text); font-family:'DM Mono',monospace; font-size:12px; outline:none; transition:border-color .2s; }
        .search-input:focus { border-color:var(--accent); }
        .view-toggle { display:flex; gap:4px; background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:4px; }
        .view-btn { padding:7px 14px; border-radius:8px; border:none; background:transparent; font-family:'DM Mono',monospace; font-size:11px; color:var(--muted); cursor:pointer; transition:all .2s; }
        .view-btn.active { background:var(--surface2); color:var(--accent); border:1px solid var(--border); }
        .table-wrap { overflow-x:auto; }
        .price-table { width:100%; border-collapse:collapse; min-width:600px; }
        .price-table th { font-size:9px; color:var(--muted); letter-spacing:2px; text-transform:uppercase; padding:10px 14px; text-align:left; border-bottom:1px solid var(--border); white-space:nowrap; cursor:pointer; user-select:none; }
        .price-table th:hover { color:var(--accent); }
        .price-row { border-bottom:1px solid rgba(30,41,59,.4); transition:background .15s; }
        .price-row:hover { background:rgba(0,229,160,.03); }
        .price-row td { padding:12px 14px; font-size:13px; white-space:nowrap; }
        .coin-cell { display:flex; align-items:center; gap:10px; }
        .coin-badge { width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; font-family:'Syne',sans-serif; }
        .coin-name { font-family:'Syne',sans-serif; font-weight:700; font-size:13px; }
        .coin-sector { font-size:10px; color:var(--muted); }
        .change-cell { font-weight:500; }
        .change-cell.up { color:var(--up); }
        .change-cell.down { color:var(--down); }
        .change-cell.neutral { color:var(--muted); }
        .heatmap { display:flex; flex-direction:column; gap:20px; }
        .sector-label { font-family:'Syne',sans-serif; font-weight:700; font-size:13px; margin-bottom:10px; color:var(--muted); letter-spacing:1px; text-transform:uppercase; }
        .sector-coins { display:flex; flex-wrap:wrap; gap:8px; }
        .heat-tile { border-radius:12px; padding:10px 14px; cursor:default; transition:transform .15s; display:flex; flex-direction:column; gap:3px; min-width:80px; border:1px solid rgba(255,255,255,.04); }
        .heat-tile:hover { transform:scale(1.03); }
        .heat-ticker { font-family:'Syne',sans-serif; font-weight:800; font-size:13px; }
        .heat-price { font-size:10px; opacity:.7; }
        .heat-pct { font-size:11px; font-weight:600; }
        .skeleton { background:linear-gradient(90deg,var(--surface) 25%,var(--surface2) 50%,var(--surface) 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:8px; }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes pulse { 0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(0,229,160,0.4)} 50%{opacity:.6;box-shadow:0 0 0 6px rgba(0,229,160,0)} }
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
            <a href="/market" className="nav-link active">
              Market
            </a>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "var(--accent)",
                animation: "pulse 2s infinite",
              }}
            />
            <span
              style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 1 }}
            >
              LIVE
            </span>
          </div>
        </nav>

        <div className="page-title">
          📈 <span>Market</span> Prices
        </div>
        <div className="page-sub">
          {lastUpdated
            ? `Updated ${lastUpdated.toLocaleTimeString()} · ${
                prices.length
              } coins tracked`
            : "Loading..."}
        </div>

        <div className="controls">
          <input
            className="search-input"
            placeholder="Search coins..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="view-toggle">
            <button
              className={`view-btn${view === "table" ? " active" : ""}`}
              onClick={() => setView("table")}
            >
              Table
            </button>
            <button
              className={`view-btn${view === "heatmap" ? " active" : ""}`}
              onClick={() => setView("heatmap")}
            >
              Heatmap
            </button>
          </div>
          <button
            onClick={fetchPrices}
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--muted)",
              fontFamily: "'DM Mono',monospace",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            ↻
          </button>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...Array(8)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 48 }} />
            ))}
          </div>
        ) : view === "table" ? (
          <div className="table-wrap">
            <table className="price-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort("rank")}>#</th>
                  <th onClick={() => handleSort("ticker")}>
                    Coin{" "}
                    {sortKey === "ticker"
                      ? sortDir === "asc"
                        ? "↑"
                        : "↓"
                      : ""}
                  </th>
                  <th onClick={() => handleSort("price")}>
                    Price{" "}
                    {sortKey === "price" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                  </th>
                  <th onClick={() => handleSort("change1h")}>
                    1h{" "}
                    {sortKey === "change1h"
                      ? sortDir === "asc"
                        ? "↑"
                        : "↓"
                      : ""}
                  </th>
                  <th onClick={() => handleSort("change24h")}>
                    24h{" "}
                    {sortKey === "change24h"
                      ? sortDir === "asc"
                        ? "↑"
                        : "↓"
                      : ""}
                  </th>
                  <th onClick={() => handleSort("change7d")}>
                    7d{" "}
                    {sortKey === "change7d"
                      ? sortDir === "asc"
                        ? "↑"
                        : "↓"
                      : ""}
                  </th>
                  <th>Sector</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((coin, i) => {
                  const c24 = parseFloat(coin.change24h || 0);
                  const c1 = parseFloat(coin.change1h || 0);
                  const c7 = parseFloat(coin.change7d || 0);
                  const priceNum = parseFloat(coin.price || 0);
                  const dec = priceNum < 0.01 ? 6 : priceNum < 1 ? 4 : 2;
                  const hc = heatColor(c24);
                  return (
                    <tr className="price-row" key={coin.ticker}>
                      <td style={{ color: "var(--muted)", fontSize: 11 }}>
                        {coin.rank || i + 1}
                      </td>
                      <td>
                        <div className="coin-cell">
                          <div
                            className="coin-badge"
                            style={{ background: hc.bg, color: hc.text }}
                          >
                            {coin.ticker?.slice(0, 3)}
                          </div>
                          <div>
                            <div className="coin-name">{coin.ticker}</div>
                            <div className="coin-sector">
                              {coin.sector || "—"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td
                        style={{
                          fontFamily: "'Syne',sans-serif",
                          fontWeight: 700,
                        }}
                      >
                        {fmtUSD(coin.price, dec)}
                      </td>
                      <td
                        className={`change-cell ${
                          c1 > 0 ? "up" : c1 < 0 ? "down" : "neutral"
                        }`}
                      >
                        {fmtPct(c1)}
                      </td>
                      <td
                        className={`change-cell ${
                          c24 > 0 ? "up" : c24 < 0 ? "down" : "neutral"
                        }`}
                      >
                        {fmtPct(c24)}
                      </td>
                      <td
                        className={`change-cell ${
                          c7 > 0 ? "up" : c7 < 0 ? "down" : "neutral"
                        }`}
                      >
                        {fmtPct(c7)}
                      </td>
                      <td style={{ fontSize: 11, color: "var(--muted)" }}>
                        {coin.sector || "—"}
                      </td>
                      <td style={{ fontSize: 10, color: "var(--muted)" }}>
                        {coin.updatedAt || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="heatmap">
            {Object.entries(bySector)
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([sector, coins]) => (
                <div key={sector}>
                  <div className="sector-label">{sector}</div>
                  <div className="sector-coins">
                    {coins
                      .filter(
                        (c) =>
                          !search ||
                          c.ticker?.toLowerCase().includes(search.toLowerCase())
                      )
                      .map((coin) => {
                        const c24 = parseFloat(coin.change24h || 0);
                        const { bg, text } = heatColor(c24);
                        const priceNum = parseFloat(coin.price || 0);
                        const dec = priceNum < 0.01 ? 5 : priceNum < 1 ? 3 : 2;
                        return (
                          <div
                            className="heat-tile"
                            key={coin.ticker}
                            style={{ background: bg }}
                          >
                            <div
                              className="heat-ticker"
                              style={{ color: text }}
                            >
                              {coin.ticker}
                            </div>
                            <div className="heat-price" style={{ color: text }}>
                              {fmtUSD(coin.price, dec)}
                            </div>
                            <div className="heat-pct" style={{ color: text }}>
                              {fmtPct(c24)}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </>
  );
}
