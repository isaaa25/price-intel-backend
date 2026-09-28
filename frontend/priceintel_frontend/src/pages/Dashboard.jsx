import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ScatterChart, Scatter, ZAxis, ReferenceLine,
} from "recharts";
import Layout from "../components/Layout";
import { useStore } from "../context/StoreContext";
import {
  getProductsByStore, getPortfolioHealth, getActiveOpportunities,
  getActivePriceWars, getMarketMovement, getAttentionItems,
} from "../api/products";

function getPortfolioTrendData(timeframe) {
  if (timeframe === "1d") return [
    { time: "4 AM", yourAvg: 12380, marketAvg: 13050, cheapest: 11180 },
    { time: "8 AM", yourAvg: 12350, marketAvg: 12980, cheapest: 11140 },
    { time: "12 PM", yourAvg: 12310, marketAvg: 12920, cheapest: 11090 },
    { time: "4 PM", yourAvg: 12270, marketAvg: 12870, cheapest: 11050 },
    { time: "8 PM", yourAvg: 12240, marketAvg: 12840, cheapest: 11020 },
    { time: "Now", yourAvg: 12200, marketAvg: 12800, cheapest: 10990 },
  ];
  if (timeframe === "7d") return [
    { time: "Mon", yourAvg: 12400, marketAvg: 13100, cheapest: 11200 },
    { time: "Tue", yourAvg: 12350, marketAvg: 12950, cheapest: 11100 },
    { time: "Wed", yourAvg: 12200, marketAvg: 12800, cheapest: 10900 },
    { time: "Thu", yourAvg: 12100, marketAvg: 12600, cheapest: 10800 },
    { time: "Fri", yourAvg: 12000, marketAvg: 12500, cheapest: 10750 },
    { time: "Sat", yourAvg: 11900, marketAvg: 12400, cheapest: 10700 },
    { time: "Sun", yourAvg: 11850, marketAvg: 12350, cheapest: 10650 },
  ];
  return [
    { time: "Week 1", yourAvg: 13200, marketAvg: 14000, cheapest: 12000 },
    { time: "Week 2", yourAvg: 12900, marketAvg: 13700, cheapest: 11700 },
    { time: "Week 3", yourAvg: 12500, marketAvg: 13300, cheapest: 11400 },
    { time: "Week 4", yourAvg: 11850, marketAvg: 12800, cheapest: 10650 },
  ];
}

const TREND_INSIGHTS = {
  "1d": "Your portfolio stayed 4.1% below market average price throughout today.",
  "7d": "Your portfolio became 4.2% more competitive this week compared to market average.",
  "30d": "Your average price dropped 10.2% relative to the market over the last 30 days.",
};

const SCATTER_FALLBACK = [
  { name: "Galaxy A17", x: 24, y: 82 },
  { name: "Galaxy S24 Ultra", x: 68, y: 71 },
  { name: "Galaxy Buds Live", x: 47, y: 38 },
  { name: "Galaxy Z Fold3 Cover", x: 75, y: 58 },
  { name: 'Samsung 65" QLED TV', x: 19, y: 63 },
  { name: "Galaxy Tab S9", x: 84, y: 22 },
  { name: "Galaxy Watch 6", x: 57, y: 14 },
  { name: "Galaxy A55", x: 35, y: 76 },
];

function quadrantColor(x, y) {
  if (y >= 50 && x < 50) return "#ef4444";
  if (y >= 50 && x >= 50) return "#f59e0b";
  if (y < 50 && x < 50) return "#4f7ef7";
  return "#10B981";
}

function CustomScatterDot(props) {
  const { cx, cy, payload } = props;
  const c = quadrantColor(payload.x, payload.y);
  return (
    <g>
      <circle cx={cx} cy={cy} r={9} fill={c} fillOpacity={0.15} stroke={c} strokeWidth={0} />
      <circle cx={cx} cy={cy} r={5} fill={c} fillOpacity={0.9} />
      <circle cx={cx} cy={cy} r={5} fill="none" stroke={c} strokeWidth={2} />
    </g>
  );
}

function LineTip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--d-surface)", border: "1px solid var(--d-border)", borderRadius: "8px", padding: "10px 14px", boxShadow: "0 6px 20px rgba(0,0,0,0.14)", fontSize: "11.5px" }}>
      <p style={{ margin: "0 0 7px", fontWeight: 700, color: "var(--d-text)", fontSize: "12px" }}>{label}</p>
      {payload.map((e) => (
        <div key={e.name} style={{ display: "flex", justifyContent: "space-between", gap: "16px", color: e.color, margin: "3px 0", fontWeight: 600 }}>
          <span>{e.name}</span>
          <span>{currency} {Number(e.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function ScatterTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  const c = quadrantColor(d?.x, d?.y);
  const quadLabel = d?.y >= 50 && d?.x < 50 ? "Risk Zone" : d?.y >= 50 && d?.x >= 50 ? "Monitor Closely" : d?.y < 50 && d?.x < 50 ? "Improve Pricing" : "Healthy Position";
  return (
    <div style={{ background: "var(--d-surface)", border: "1px solid var(--d-border)", borderRadius: "8px", padding: "10px 14px", boxShadow: "0 6px 20px rgba(0,0,0,0.14)", fontSize: "11.5px", maxWidth: "200px" }}>
      <p style={{ margin: "0 0 6px", fontWeight: 700, color: "var(--d-text)", fontSize: "12px" }}>{d?.name}</p>
      <div style={{ color: "var(--d-text-2)", lineHeight: 1.7 }}>
        <div>Competitiveness: <strong style={{ color: "var(--d-text)" }}>{d?.x} / 100</strong></div>
        <div>Market Volatility: <strong style={{ color: "var(--d-text)" }}>{d?.y} / 100</strong></div>
      </div>
      <div style={{ marginTop: "6px", paddingTop: "6px", borderTop: "1px solid var(--d-border)" }}>
        <span style={{ fontSize: "10.5px", fontWeight: 700, color: c }}>{quadLabel}</span>
      </div>
    </div>
  );
}

// ── CHANGED: real attention item icon by level ─────────────────
function AttentionIcon({ level }) {
  if (level === "HIGH") return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
  if (level === "OPPORTUNITY") return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
  if (level === "WATCH") return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--d-text-3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

// ── CHANGED: maps level string to display label + colors ───────
function levelMeta(level) {
  if (level === "HIGH") return { label: "High Priority", color: "#ef4444", bg: "rgba(239,68,68,0.07)" };
  if (level === "OPPORTUNITY") return { label: "Opportunity", color: "#10B981", bg: "rgba(16,185,129,0.07)" };
  if (level === "WATCH") return { label: "Watch", color: "#f59e0b", bg: "rgba(245,158,11,0.07)" };
  if (level === "HEALTHY") return { label: "Healthy", color: "#10B981", bg: "rgba(16,185,129,0.07)" };
  return { label: "No data", color: "var(--d-text-3)", bg: "var(--d-bg)" };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedStore, currency, refreshStores, loading: storeLoading } = useStore();

  const [storeProducts, setStoreProducts] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [opportunities, setOpportunities] = useState(null);
  const [priceWars, setPriceWars] = useState(null);
  const [marketMovement, setMarketMovement] = useState(null);
  const [attentionItems, setAttentionItems] = useState([]); // CHANGED: real attention data
  const [loading, setLoading] = useState(true);
  const [trendTimeframe, setTrendTimeframe] = useState("1d");
  const [selectedTrendProduct, setSelectedTrendProduct] = useState("all");

  useEffect(() => { refreshStores(); }, [location.pathname]); // eslint-disable-line

  // CHANGED: added getAttentionItems to the parallel fetch
  useEffect(() => {
    let isCurrent = true;

    if (!selectedStore?.id) {
      setStoreProducts([]); setPortfolio(null); setOpportunities(null);
      setPriceWars(null); setMarketMovement(null); setAttentionItems([]);
      setLoading(false); return;
    }
    setLoading(true);
    setSelectedTrendProduct("all");
    Promise.all([
      getProductsByStore(selectedStore.id),
      getPortfolioHealth(selectedStore.id).catch(() => null),
      getActiveOpportunities(selectedStore.id).catch(() => null),
      getActivePriceWars(selectedStore.id).catch(() => null),
      getMarketMovement(selectedStore.id).catch(() => null),
      getAttentionItems(selectedStore.id).catch(() => []),  // CHANGED
    ])
      .then(([products, health, opps, wars, movement, attention]) => {
        if (!isCurrent) return;
        setStoreProducts(Array.isArray(products) ? products : []);
        setPortfolio(health);
        setOpportunities(opps);
        setPriceWars(wars);
        setMarketMovement(movement);
        setAttentionItems(Array.isArray(attention) ? attention : []); // CHANGED
      })
      .catch(() => {
        if (!isCurrent) return;
        setStoreProducts([]); setPortfolio(null); setOpportunities(null);
        setPriceWars(null); setMarketMovement(null); setAttentionItems([]);
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [selectedStore?.id]);

  const curr = currency || (selectedStore?.country === "Pakistan" || selectedStore?.country === "PK" ? "PKR" : "AED");
  const trendData = getPortfolioTrendData(trendTimeframe);
  const trendInsight = TREND_INSIGHTS[trendTimeframe];

  const scatterData = storeProducts.length >= 3
    ? storeProducts.slice(0, 9).map((p, i) => ({
      name: p.search_keyword || p.title,
      x: Math.round(((i * 37 + 23) % 78) + 10),
      y: Math.round(((i * 53 + 41) % 72) + 12),
    }))
    : SCATTER_FALLBACK;

  const marketValue = marketMovement?.pct_change != null
    ? `${marketMovement.direction === "down" ? "↓" : "↑"} ${Math.abs(marketMovement.pct_change)}%`
    : "—";
  const marketSub = marketMovement?.pct_change != null
    ? marketMovement.direction === "down" ? "Market prices decreased today" : "Market prices increased today"
    : "Not enough history yet";

  const card = { background: "var(--d-surface)", borderRadius: "12px", padding: "22px 24px", border: "1px solid var(--d-border)", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", boxSizing: "border-box", minWidth: 0, maxWidth: "100%" };
  const sectionTitle = { fontSize: "15px", fontWeight: 700, color: "var(--d-text)", margin: "0 0 3px", letterSpacing: "-0.2px" };
  const sectionSub = { margin: 0, fontSize: "12px", color: "var(--d-text-3)", lineHeight: 1.5 };

  function TfBtn({ value, label }) {
    const active = trendTimeframe === value;
    return (
      <button onClick={() => setTrendTimeframe(value)} style={{ padding: "5px 14px", borderRadius: "6px", border: "none", background: active ? "var(--d-surface)" : "transparent", color: active ? "var(--d-accent)" : "var(--d-text-3)", fontWeight: active ? 700 : 500, fontSize: "12px", cursor: "pointer", boxShadow: active ? "0 1px 3px rgba(0,0,0,0.10)" : "none", transition: "all 0.15s ease", fontFamily: "inherit" }}>
        {label}
      </button>
    );
  }

  const portfolioKpis = [
    { id: "health", label: "PORTFOLIO HEALTH", value: portfolio?.portfolio_health_pct != null ? `${portfolio.portfolio_health_pct} / 100` : "—", sub: portfolio?.portfolio_health_pct != null ? (portfolio.portfolio_health_pct >= 70 ? "Healthy competitive position" : "Needs attention") : "Not enough data yet", accent: "#4f7ef7" },
    { id: "action", label: "NEEDS ACTION", value: portfolio?.needs_action != null ? `${portfolio.needs_action} Products` : "—", sub: "Require pricing review", accent: "#ef4444" },
    { id: "opp", label: "ACTIVE OPPORTUNITIES", value: opportunities?.active_opportunities != null ? opportunities.active_opportunities : "—", sub: opportunities?.active_opportunities != null ? (opportunities.active_opportunities > 0 ? "Competitors out of stock" : "No out-of-stock competitors") : "Not enough data yet", accent: "#10B981" },
    { id: "wars", label: "ACTIVE PRICE WARS", value: priceWars?.active_price_wars != null ? priceWars.active_price_wars : "—", sub: priceWars?.active_price_wars != null ? (priceWars.active_price_wars > 0 ? "Aggressive repricing detected" : "No aggressive repricing") : "Not enough history yet", accent: "#f59e0b" },
    { id: "market", label: "MARKET MOVEMENT", value: marketValue, sub: marketSub, accent: "#10B981" },
  ];

  return (
    <Layout>
      <div className="res-page-header" style={{ marginBottom: "26px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "var(--d-text)", margin: "0 0 3px", letterSpacing: "-0.4px" }}>Dashboard</h1>
          <p style={{ margin: 0, fontSize: "12.5px", color: "var(--d-text-3)" }}>Portfolio intelligence &amp; actionable pricing decisions</p>
        </div>
        <button onClick={() => navigate("/alerts")} style={{ display: "flex", alignItems: "center", gap: "7px", padding: "8px 16px", background: "var(--d-surface)", border: "1px solid var(--d-border)", borderRadius: "8px", fontSize: "12.5px", fontWeight: 600, color: "var(--d-text)", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
          View All Alerts
        </button>
      </div>

      {loading || (storeLoading && !selectedStore) ? (
        <div style={{ textAlign: "center", padding: "90px 0", color: "var(--d-text-3)" }}>
          <div style={{ fontSize: "30px", marginBottom: "14px", opacity: 0.5 }}>⏳</div>
          <p style={{ margin: 0, fontSize: "14px" }}>Loading portfolio intelligence…</p>
        </div>
      ) : !selectedStore ? (
        <div style={{ ...card, textAlign: "center", padding: "80px 20px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--d-text)", margin: "0 0 8px" }}>No Store Connected</h2>
          <p style={{ fontSize: "13.5px", color: "var(--d-text-2)", maxWidth: "380px", margin: "0 auto 22px", lineHeight: 1.65 }}>Connect your marketplace store in Account &amp; Stores to view live price intelligence.</p>
          <button onClick={() => navigate("/account")} style={{ padding: "10px 24px", background: "var(--d-accent)", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13.5px", fontWeight: 600, cursor: "pointer" }}>+ Go to Account &amp; Add Store</button>
        </div>
      ) : storeProducts.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: "80px 20px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--d-text)", margin: "0 0 8px" }}>No Tracked Products in {selectedStore.store_name}</h2>
          <p style={{ fontSize: "13.5px", color: "var(--d-text-2)", maxWidth: "380px", margin: "0 auto 22px", lineHeight: 1.65 }}>Add products to start monitoring competitor prices.</p>
          <button onClick={() => navigate("/products/add")} style={{ padding: "10px 24px", background: "var(--d-accent)", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13.5px", fontWeight: 600, cursor: "pointer" }}>+ Add Products</button>
        </div>
      ) : (
        <>
          {/* ── KPI cards ── */}
          <div className="res-grid-5" style={{ marginBottom: "22px" }}>
            {portfolioKpis.map((kpi) => (
              <div key={kpi.id} style={{ ...card, textAlign: "center", padding: "18px 12px" }}>
                <div style={{ marginBottom: "14px" }}>
                  <span style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--d-text-3)", letterSpacing: "0.7px", textTransform: "uppercase" }}>{kpi.label}</span>
                </div>
                <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--d-text)", marginBottom: "5px", letterSpacing: "-0.3px", lineHeight: 1.2 }}>{kpi.value}</div>
                <div style={{ fontSize: "11px", color: "var(--d-text-3)", lineHeight: 1.45 }}>{kpi.sub}</div>
              </div>
            ))}
          </div>

          {/* ── Trend chart ── */}
          <div style={{ ...card, marginBottom: "22px", overflow: "hidden", minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: selectedTrendProduct !== "all" ? "10px" : "22px", flexWrap: "wrap", gap: "12px" }}>
              <h2 style={sectionTitle}>Product Price Trend Analysis</h2>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <select value={selectedTrendProduct} onChange={(e) => setSelectedTrendProduct(e.target.value)} style={{ padding: "5px 32px 5px 12px", borderRadius: "7px", border: "1px solid var(--d-border)", background: "var(--d-surface-2)", color: "var(--d-text)", fontSize: "12.5px", fontWeight: 500, fontFamily: "inherit", cursor: "pointer", outline: "none", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", minWidth: "160px", maxWidth: "240px" }}>
                  <option value="all">All Tracked Products</option>
                  {storeProducts.map((p) => { const dispName = p.search_keyword || p.title; const short = dispName?.length > 28 ? dispName.slice(0, 26).trim() + "…" : dispName; return <option key={p.id} value={p.id} title={dispName}>{short}</option>; })}
                </select>
                <div style={{ display: "flex", background: "var(--d-surface-2)", padding: "3px", borderRadius: "8px", border: "1px solid var(--d-border)", gap: "2px" }}>
                  <TfBtn value="1d" label="1 Day" /><TfBtn value="7d" label="7 Days" /><TfBtn value="30d" label="30 Days" />
                </div>
              </div>
            </div>
            {selectedTrendProduct !== "all" && (
              <div style={{ marginBottom: "16px", fontSize: "12px", color: "var(--d-text-2)", lineHeight: 1.4, wordBreak: "break-word" }}>
                <span style={{ color: "var(--d-text-3)", fontWeight: 500 }}>Active Product: </span>
                <span style={{ color: "var(--d-text)", fontWeight: 600 }}>{storeProducts.find((p) => String(p.id) === String(selectedTrendProduct))?.title}</span>
              </div>
            )}
            <div style={{ width: "100%", height: "290px", minWidth: 0, maxWidth: "100%", overflow: "hidden", position: "relative" }}>
              <div style={{ position: "absolute", inset: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 8, right: 20, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--d-border)" />
                    <XAxis dataKey="time" stroke="var(--d-text-3)" fontSize={11} tickLine={false} axisLine={{ stroke: "var(--d-border)" }} />
                    <YAxis stroke="var(--d-text-3)" fontSize={11} tickLine={false} axisLine={false} width={88} domain={["dataMin - 400", "dataMax + 400"]} tickFormatter={(v) => `${curr} ${Number(v).toLocaleString()}`} />
                    <Tooltip content={<LineTip currency={curr} />} />
                    <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: "12px", fontSize: "11.5px", fontWeight: 600 }} />
                    <Line type="monotone" dataKey="yourAvg" name="Your Avg Price" stroke="var(--d-accent)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--d-accent)", stroke: "var(--d-surface)", strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="marketAvg" name="Market Average" stroke="#94a3b8" strokeWidth={1.8} strokeDasharray="5 4" dot={{ r: 3, fill: "#94a3b8" }} />
                    <Line type="monotone" dataKey="cheapest" name="Cheapest in Market" stroke="#10B981" strokeWidth={1.8} strokeDasharray="3 3" dot={{ r: 3, fill: "#10B981" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div style={{ marginTop: "18px", padding: "11px 16px", borderRadius: "8px", background: "rgba(79,126,247,0.06)", border: "1px solid rgba(79,126,247,0.15)", display: "flex", alignItems: "center", gap: "10px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--d-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              <p style={{ margin: 0, fontSize: "12.5px", color: "var(--d-text-2)", lineHeight: 1.5 }}>
                <strong style={{ color: "var(--d-accent)", fontWeight: 700 }}>Trend Insight — </strong>{trendInsight}
              </p>
            </div>
          </div>

          {/* ── CHANGED: What Needs Your Attention — now 100% real data ── */}
          <div style={{ ...card, marginBottom: "22px", overflow: "hidden", minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <h2 style={{ ...sectionTitle, margin: 0 }}>What Needs Your Attention</h2>
              <span onClick={() => navigate("/alerts")} style={{ fontSize: "12px", fontWeight: 600, color: "var(--d-accent)", cursor: "pointer", flexShrink: 0 }}>View all alerts →</span>
            </div>

            {attentionItems.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "var(--d-text-3)", fontSize: "13px" }}>
                No actionable items right now — your portfolio looks clean.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {attentionItems
                  .filter((item) => item.level !== "HEALTHY" && item.level !== "NO_DATA")
                  .concat(attentionItems.filter((item) => item.level === "NO_DATA"))
                  .map((item) => {
                    const meta = levelMeta(item.level);
                    const shortTitle = item.title?.length > 60 ? item.title.slice(0, 58).trim() + "…" : item.title;
                    return (
                      <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", borderRadius: "10px", background: "var(--d-surface-2)", border: "1px solid var(--d-border)", transition: "opacity 0.15s ease" }}>
                        {/* Icon bubble */}
                        <div style={{ width: "34px", height: "34px", borderRadius: "9px", background: "var(--d-surface)", border: "1px solid var(--d-border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <AttentionIcon level={item.level} />
                        </div>
                        {/* Text */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "9.5px", fontWeight: 700, color: meta.color, background: meta.bg, padding: "1.5px 7px", borderRadius: "4px", letterSpacing: "0.5px", textTransform: "uppercase", flexShrink: 0 }}>
                              {meta.label}
                            </span>
                            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--d-text)" }} title={item.title}>
                              {shortTitle}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: "12px", color: "var(--d-text-2)", lineHeight: 1.55 }}>
                            {item.explanation}
                          </p>
                        </div>
                        {/* Action button */}
                        <button
                          onClick={() => navigate(item.action_nav)}
                          style={{ padding: "7px 15px", background: "var(--d-surface)", border: "1px solid var(--d-border)", borderRadius: "7px", fontSize: "12px", fontWeight: 600, color: "var(--d-text)", cursor: "pointer", fontFamily: "inherit", flexShrink: 0, whiteSpace: "nowrap", transition: "all 0.15s ease" }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = meta.color; e.currentTarget.style.color = meta.color; e.currentTarget.style.background = meta.bg; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--d-border)"; e.currentTarget.style.color = "var(--d-text)"; e.currentTarget.style.background = "var(--d-surface)"; }}
                        >
                          {item.action} →
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* ── Product Insights scatter ── */}
          <div style={{ ...card, overflow: "hidden", minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <h2 style={sectionTitle}>Product Insights</h2>
                <p style={sectionSub}>Price competitiveness vs market volatility — each point represents one tracked product</p>
              </div>
              <span onClick={() => navigate("/products")} style={{ fontSize: "12px", fontWeight: 600, color: "var(--d-accent)", cursor: "pointer", flexShrink: 0 }}>View products →</span>
            </div>
            <div style={{ width: "100%", height: "340px", position: "relative", minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 30, left: "12%", fontSize: "12px", fontWeight: 700, color: "#d42b2b", pointerEvents: "none", zIndex: 2 }}>⚠ Risk Zone</div>
              <div style={{ position: "absolute", top: 30, right: "7%", fontSize: "12px", fontWeight: 700, color: "#c97d00", pointerEvents: "none", zIndex: 2 }}>👁 Monitor Closely</div>
              <div style={{ position: "absolute", bottom: 68, left: "12%", fontSize: "12px", fontWeight: 700, color: "#3b6ae8", pointerEvents: "none", zIndex: 2 }}>💡 Improve Pricing</div>
              <div style={{ position: "absolute", bottom: 68, right: "7%", fontSize: "12px", fontWeight: 700, color: "#0a9668", pointerEvents: "none", zIndex: 2 }}>✓ Healthy Position</div>
              <div style={{ position: "absolute", inset: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 24, right: 34, left: 4, bottom: 28 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--d-border)" />
                    <XAxis dataKey="x" type="number" domain={[0, 100]} name="Price Competitiveness" stroke="var(--d-text-3)" fontSize={11} tickLine={false} axisLine={{ stroke: "var(--d-border)" }} label={{ value: "← Overpriced    Price Competitiveness    Cheapest →", position: "insideBottom", offset: -16, style: { fontSize: "11px", fill: "var(--d-text-3)", fontWeight: 500 } }} />
                    <YAxis dataKey="y" type="number" domain={[0, 100]} name="Market Volatility" stroke="var(--d-text-3)" fontSize={11} tickLine={false} axisLine={false} width={48} label={{ value: "Market Volatility ↑", angle: -90, position: "insideLeft", offset: 18, style: { fontSize: "11px", fill: "var(--d-text-3)", fontWeight: 500 } }} />
                    <ZAxis range={[64, 64]} />
                    <Tooltip content={<ScatterTip />} cursor={{ strokeDasharray: "3 3", stroke: "var(--d-border)" }} />
                    <ReferenceLine x={50} stroke="var(--d-border)" strokeDasharray="5 3" strokeWidth={1.5} />
                    <ReferenceLine y={50} stroke="var(--d-border)" strokeDasharray="5 3" strokeWidth={1.5} />
                    <Scatter name="Products" data={scatterData} shape={<CustomScatterDot />} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="res-grid-2" style={{ marginTop: "18px", paddingTop: "18px", borderTop: "1px solid var(--d-border)" }}>
              {[
                { color: "#ef4444", label: "Risk Zone", desc: "High volatility · Weak position" },
                { color: "#f59e0b", label: "Monitor Closely", desc: "High volatility · Strong position" },
                { color: "#4f7ef7", label: "Improve Pricing", desc: "Low volatility · Weak position" },
                { color: "#10B981", label: "Healthy Position", desc: "Low volatility · Strong position" },
              ].map((l) => (
                <div key={l.label} style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "10px 12px", borderRadius: "8px", background: `${l.color}08`, border: `1px solid ${l.color}1a` }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: l.color, flexShrink: 0, marginTop: "3px" }} />
                  <div>
                    <div style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--d-text)", marginBottom: "2px" }}>{l.label}</div>
                    <div style={{ fontSize: "11px", color: "var(--d-text-3)", lineHeight: 1.4 }}>{l.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}