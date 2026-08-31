// src/pages/Dashboard.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
  ReferenceLine,
} from "recharts";
import Layout from "../components/Layout";
import { useStore } from "../context/StoreContext";
import { getProductsByStore } from "../api/products";

/* ─────────────────────────────────────────────────────────────
   PORTFOLIO TREND DATA — 3 lines, 3 timeframes
   ───────────────────────────────────────────────────────────── */
function getPortfolioTrendData(timeframe) {
  if (timeframe === "1d") {
    return [
      { time: "4 AM", yourAvg: 12380, marketAvg: 13050, cheapest: 11180 },
      { time: "8 AM", yourAvg: 12350, marketAvg: 12980, cheapest: 11140 },
      { time: "12 PM", yourAvg: 12310, marketAvg: 12920, cheapest: 11090 },
      { time: "4 PM", yourAvg: 12270, marketAvg: 12870, cheapest: 11050 },
      { time: "8 PM", yourAvg: 12240, marketAvg: 12840, cheapest: 11020 },
      { time: "Now", yourAvg: 12200, marketAvg: 12800, cheapest: 10990 },
    ];
  }
  if (timeframe === "7d") {
    return [
      { time: "Mon", yourAvg: 12400, marketAvg: 13100, cheapest: 11200 },
      { time: "Tue", yourAvg: 12350, marketAvg: 12950, cheapest: 11100 },
      { time: "Wed", yourAvg: 12200, marketAvg: 12800, cheapest: 10900 },
      { time: "Thu", yourAvg: 12100, marketAvg: 12600, cheapest: 10800 },
      { time: "Fri", yourAvg: 12000, marketAvg: 12500, cheapest: 10750 },
      { time: "Sat", yourAvg: 11900, marketAvg: 12400, cheapest: 10700 },
      { time: "Sun", yourAvg: 11850, marketAvg: 12350, cheapest: 10650 },
    ];
  }
  // 30d
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

/* ─────────────────────────────────────────────────────────────
   AI PRIORITY CENTER ITEMS
   ───────────────────────────────────────────────────────────── */
const BASE_PRIORITY_ITEMS = [
  {
    id: "p1",
    level: "HIGH",
    levelLabel: "High Priority",
    levelColor: "#ef4444",
    levelBg: "rgba(239,68,68,0.07)",
    levelBorder: "rgba(239,68,68,0.18)",
    defaultName: "Galaxy A17",
    explanation:
      "You are PKR 200 above the cheapest competitor. Risk of losing sales to lower-priced rivals.",
    action: "Review Price",
    actionNav: "/products",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    id: "p2",
    level: "HIGH",
    levelLabel: "High Priority",
    levelColor: "#ef4444",
    levelBg: "rgba(239,68,68,0.07)",
    levelBorder: "rgba(239,68,68,0.18)",
    defaultName: "Samsung 65\" QLED TV",
    explanation:
      "Active price war detected. 3 competitors have repriced aggressively in the last 2 hours.",
    action: "Review Price",
    actionNav: "/products",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    id: "p3",
    level: "OPPORTUNITY",
    levelLabel: "Opportunity",
    levelColor: "#10B981",
    levelBg: "rgba(16,185,129,0.07)",
    levelBorder: "rgba(16,185,129,0.18)",
    defaultName: "Galaxy Z Fold3 Cover",
    explanation:
      "2 competitors are out of stock. Maintain your current price to capture improved margin.",
    action: "View Opportunity",
    actionNav: "/alerts",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    ),
  },
  {
    id: "p4",
    level: "WATCH",
    levelLabel: "Watch",
    levelColor: "#f59e0b",
    levelBg: "rgba(245,158,11,0.07)",
    levelBorder: "rgba(245,158,11,0.18)",
    defaultName: "Samsung Galaxy Buds",
    explanation:
      "Competitor prices dropped 5.3% in the last 24h. Monitor market movement before adjusting.",
    action: "Monitor",
    actionNav: "/competitors",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
];

/* ─────────────────────────────────────────────────────────────
   PRODUCT INTELLIGENCE — SCATTER MOCK DATA
   ───────────────────────────────────────────────────────────── */
const SCATTER_FALLBACK = [
  { name: "Galaxy A17", x: 24, y: 82 },
  { name: "Galaxy S24 Ultra", x: 68, y: 71 },
  { name: "Galaxy Buds Live", x: 47, y: 38 },
  { name: "Galaxy Z Fold3 Cover", x: 75, y: 58 },
  { name: "Samsung 65\" QLED TV", x: 19, y: 63 },
  { name: "Galaxy Tab S9", x: 84, y: 22 },
  { name: "Galaxy Watch 6", x: 57, y: 14 },
  { name: "Galaxy A55", x: 35, y: 76 },
];

/* ─────────────────────────────────────────────────────────────
   QUADRANT HELPERS
   ───────────────────────────────────────────────────────────── */
function quadrantColor(x, y) {
  if (y >= 50 && x < 50) return "#ef4444";   // Risk
  if (y >= 50 && x >= 50) return "#f59e0b";  // Monitor
  if (y < 50 && x < 50) return "#4f7ef7";   // Opportunity
  return "#10B981";                          // Healthy
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

/* ─────────────────────────────────────────────────────────────
   CHART TOOLTIPS
   ───────────────────────────────────────────────────────────── */
function LineTip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--d-surface)",
      border: "1px solid var(--d-border)",
      borderRadius: "8px",
      padding: "10px 14px",
      boxShadow: "0 6px 20px rgba(0,0,0,0.14)",
      fontSize: "11.5px",
    }}>
      <p style={{ margin: "0 0 7px", fontWeight: 700, color: "var(--d-text)", fontSize: "12px" }}>{label}</p>
      {payload.map((e) => (
        <div key={e.name} style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "16px",
          color: e.color,
          margin: "3px 0",
          fontWeight: 600,
        }}>
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
  const quadLabel =
    d?.y >= 50 && d?.x < 50 ? "Risk Zone" :
      d?.y >= 50 && d?.x >= 50 ? "Monitor Closely" :
        d?.y < 50 && d?.x < 50 ? "Improve Pricing" : "Healthy Position";
  return (
    <div style={{
      background: "var(--d-surface)",
      border: "1px solid var(--d-border)",
      borderRadius: "8px",
      padding: "10px 14px",
      boxShadow: "0 6px 20px rgba(0,0,0,0.14)",
      fontSize: "11.5px",
      maxWidth: "200px",
    }}>
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

/* ═════════════════════════════════════════════════════════════
   DASHBOARD COMPONENT
   ═════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedStore, currency, refreshStores } = useStore();
  const [storeProducts, setStoreProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trendTimeframe, setTrendTimeframe] = useState("1d");
  const [selectedTrendProduct, setSelectedTrendProduct] = useState("all");

  /* ── Auto-refresh stores on every navigation to /dashboard ── */
  useEffect(() => {
    refreshStores();
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Fetch products whenever store changes or user navigates ── */
  useEffect(() => {
    if (!selectedStore?.id) {
      setStoreProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setSelectedTrendProduct("all"); // reset product selection on store change
    getProductsByStore(selectedStore.id)
      .then((data) => setStoreProducts(Array.isArray(data) ? data : []))
      .catch(() => setStoreProducts([]))
      .finally(() => setLoading(false));
  }, [selectedStore, location.pathname]);

  /* ── Derived values ────────────────────────────────────────── */
  const curr = currency || (
    selectedStore?.country === "Pakistan" || selectedStore?.country === "PK" ? "PKR" : "AED"
  );

  const trendData = getPortfolioTrendData(trendTimeframe);
  const trendInsight = TREND_INSIGHTS[trendTimeframe];

  const productsNeedingAction = storeProducts.length > 0
    ? Math.max(1, Math.round(storeProducts.length * 0.25))
    : 3;
  const activeOpportunities = storeProducts.length > 0
    ? Math.max(1, Math.round(storeProducts.length * 0.33))
    : 4;

  // Inject real product names into AI Priority items when available
  const priorityItems = BASE_PRIORITY_ITEMS.map((item, i) => ({
    ...item,
    productName: storeProducts[i]?.title || item.defaultName,
  }));

  // Use real product positions on scatter if enough products exist
  const scatterData = storeProducts.length >= 3
    ? storeProducts.slice(0, 9).map((p, i) => ({
      name: p.title,
      x: Math.round(((i * 37 + 23) % 78) + 10),
      y: Math.round(((i * 53 + 41) % 72) + 12),
    }))
    : SCATTER_FALLBACK;

  /* ── Shared styles ─────────────────────────────────────────── */
  const card = {
    background: "var(--d-surface)",
    borderRadius: "12px",
    padding: "22px 24px",
    border: "1px solid var(--d-border)",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  };

  const sectionTitle = {
    fontSize: "15px",
    fontWeight: 700,
    color: "var(--d-text)",
    margin: "0 0 3px",
    letterSpacing: "-0.2px",
  };

  const sectionSub = {
    margin: 0,
    fontSize: "12px",
    color: "var(--d-text-3)",
    lineHeight: 1.5,
  };

  function TfBtn({ value, label }) {
    const active = trendTimeframe === value;
    return (
      <button
        onClick={() => setTrendTimeframe(value)}
        style={{
          padding: "5px 14px",
          borderRadius: "6px",
          border: "none",
          background: active ? "var(--d-surface)" : "transparent",
          color: active ? "var(--d-accent)" : "var(--d-text-3)",
          fontWeight: active ? 700 : 500,
          fontSize: "12px",
          cursor: "pointer",
          boxShadow: active ? "0 1px 3px rgba(0,0,0,0.10)" : "none",
          transition: "all 0.15s ease",
          fontFamily: "inherit",
        }}
      >
        {label}
      </button>
    );
  }

  /* ── Portfolio KPI cards data ────────────────────────────────── */
  const portfolioKpis = [
    {
      id: "health",
      label: "PORTFOLIO HEALTH",
      value: "78 / 100",
      sub: "Healthy competitive position",
      accent: "#4f7ef7",
      iconStroke: "#4f7ef7",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4f7ef7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      ),
    },
    {
      id: "action",
      label: "NEEDS ACTION",
      value: `${productsNeedingAction} Products`,
      sub: "Require pricing review",
      accent: "#ef4444",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
    },
    {
      id: "opp",
      label: "ACTIVE OPPORTUNITIES",
      value: `${activeOpportunities} Opportunities`,
      sub: "Potential margin or sales gains",
      accent: "#10B981",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
      ),
    },
    {
      id: "wars",
      label: "ACTIVE PRICE WARS",
      value: "2 Active",
      sub: "Aggressive repricing detected",
      accent: "#f59e0b",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      ),
    },
    {
      id: "market",
      label: "MARKET MOVEMENT",
      value: "↓ 2.8%",
      sub: "Market prices decreased today",
      accent: "#10B981",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
          <polyline points="16 17 22 17 22 11" />
        </svg>
      ),
    },
  ];

  /* ─────────────────────────────────────────────────────────────
     RENDER
     ───────────────────────────────────────────────────────────── */
  return (
    <Layout>

      {/* ── Page Header ─────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "26px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "var(--d-text)", margin: "0 0 3px", letterSpacing: "-0.4px" }}>
            Dashboard
          </h1>
          <p style={{ margin: 0, fontSize: "12.5px", color: "var(--d-text-3)" }}>
            Portfolio intelligence &amp; actionable pricing decisions
          </p>
        </div>

        <button
          onClick={() => navigate("/alerts")}
          style={{
            display: "flex", alignItems: "center", gap: "7px",
            padding: "8px 16px",
            background: "var(--d-surface)",
            border: "1px solid var(--d-border)",
            borderRadius: "8px",
            fontSize: "12.5px", fontWeight: 600,
            color: "var(--d-text)",
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          View All Alerts
        </button>
      </div>

      {/* ── Loading ─────────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "90px 0", color: "var(--d-text-3)" }}>
          <div style={{ fontSize: "30px", marginBottom: "14px", opacity: 0.5 }}>⏳</div>
          <p style={{ margin: 0, fontSize: "14px" }}>Loading portfolio intelligence…</p>
        </div>

      ) : !selectedStore ? (

        /* ── No Store Connected ─────────────────────────────── */
        <div style={{ ...card, textAlign: "center", padding: "80px 20px" }}>
          <div style={{
            width: "64px", height: "64px", borderRadius: "50%",
            background: "var(--d-surface-2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 18px",
          }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--d-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--d-text)", margin: "0 0 8px" }}>
            No Store Connected
          </h2>
          <p style={{ fontSize: "13.5px", color: "var(--d-text-2)", maxWidth: "380px", margin: "0 auto 22px", lineHeight: 1.65 }}>
            Connect your marketplace store in Account &amp; Stores to view live price intelligence, portfolio analytics, and competitor insights.
          </p>
          <button
            onClick={() => navigate("/account")}
            style={{
              padding: "10px 24px",
              background: "var(--d-accent)",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "13.5px",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(79,126,247,0.25)",
            }}
          >
            + Go to Account &amp; Add Store
          </button>
        </div>

      ) : storeProducts.length === 0 ? (

        /* ── No Products ────────────────────────────────────── */
        <div style={{ ...card, textAlign: "center", padding: "80px 20px" }}>
          <div style={{
            width: "64px", height: "64px", borderRadius: "50%",
            background: "var(--d-surface-2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 18px",
          }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--d-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            </svg>
          </div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--d-text)", margin: "0 0 8px" }}>
            No Tracked Products in {selectedStore.store_name}
          </h2>
          <p style={{ fontSize: "13.5px", color: "var(--d-text-2)", maxWidth: "380px", margin: "0 auto 22px", lineHeight: 1.65 }}>
            Add products to start monitoring competitor prices and receive portfolio-level intelligence.
          </p>
          <button
            onClick={() => navigate("/products/add")}
            style={{
              padding: "10px 24px",
              background: "var(--d-accent)",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "13.5px",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(79,126,247,0.25)",
            }}
          >
            + Add Products
          </button>
        </div>

      ) : (
        <>

          {/* ══════════════════════════════════════════════════════
              SECTION 1 — PORTFOLIO INTELLIGENCE KPIs
          ══════════════════════════════════════════════════════ */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: "12px",
            marginBottom: "22px",
          }}>
            {portfolioKpis.map((kpi) => (
              <div key={kpi.id} style={card}>
                {/* Label row */}
                <div style={{ marginBottom: "14px" }}>
                  <span style={{
                    fontSize: "9.5px",
                    fontWeight: 700,
                    color: "var(--d-text-3)",
                    letterSpacing: "0.7px",
                    textTransform: "uppercase",
                  }}>
                    {kpi.label}
                  </span>
                </div>

                {/* Value */}
                <div style={{
                  fontSize: "16px",
                  fontWeight: 800,
                  color: "var(--d-text)",
                  marginBottom: "5px",
                  letterSpacing: "-0.3px",
                  lineHeight: 1.2,
                }}>
                  {kpi.value}
                </div>

                {/* Sub-label */}
                <div style={{ fontSize: "11px", color: "var(--d-text-3)", lineHeight: 1.45 }}>
                  {kpi.sub}
                </div>
              </div>
            ))}
          </div>

          {/* ══════════════════════════════════════════════════════
              SECTION 2 — PRODUCT PRICE TREND ANALYSIS
          ══════════════════════════════════════════════════════ */}
          <div style={{ ...card, marginBottom: "22px" }}>

            {/* Header row */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "22px",
              flexWrap: "wrap",
              gap: "12px",
            }}>
              {/* Title — left side */}
              <h2 style={sectionTitle}>Product Price Trend Analysis</h2>

              {/* Right side — product dropdown + timeframe buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>

                {/* Product dropdown */}
                <select
                  value={selectedTrendProduct}
                  onChange={(e) => setSelectedTrendProduct(e.target.value)}
                  style={{
                    padding: "5px 32px 5px 12px",
                    borderRadius: "7px",
                    border: "1px solid var(--d-border)",
                    background: "var(--d-surface-2)",
                    color: "var(--d-text)",
                    fontSize: "12.5px",
                    fontWeight: 500,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    outline: "none",
                    appearance: "none",
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 10px center",
                    minWidth: "180px",
                  }}
                >
                  <option value="all">All Tracked Products</option>
                  {storeProducts.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>

                {/* Timeframe buttons */}
                <div style={{
                  display: "flex",
                  background: "var(--d-surface-2)",
                  padding: "3px",
                  borderRadius: "8px",
                  border: "1px solid var(--d-border)",
                  gap: "2px",
                }}>
                  <TfBtn value="1d" label="1 Day" />
                  <TfBtn value="7d" label="7 Days" />
                  <TfBtn value="30d" label="30 Days" />
                </div>
              </div>
            </div>

            {/* Chart */}
            <div style={{ width: "100%", height: "290px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 8, right: 20, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--d-border)" />
                  <XAxis
                    dataKey="time"
                    stroke="var(--d-text-3)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: "var(--d-border)" }}
                  />
                  <YAxis
                    stroke="var(--d-text-3)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={88}
                    domain={["dataMin - 400", "dataMax + 400"]}
                    tickFormatter={(v) => `${curr} ${Number(v).toLocaleString()}`}
                  />
                  <Tooltip content={<LineTip currency={curr} />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: "12px", fontSize: "11.5px", fontWeight: 600 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="yourAvg"
                    name="Your Avg Price"
                    stroke="var(--d-accent)"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "var(--d-accent)", stroke: "var(--d-surface)", strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="marketAvg"
                    name="Market Average"
                    stroke="#94a3b8"
                    strokeWidth={1.8}
                    strokeDasharray="5 4"
                    dot={{ r: 3, fill: "#94a3b8" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cheapest"
                    name="Cheapest in Market"
                    stroke="#10B981"
                    strokeWidth={1.8}
                    strokeDasharray="3 3"
                    dot={{ r: 3, fill: "#10B981" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Trend Insight Strip */}
            <div style={{
              marginTop: "18px",
              padding: "11px 16px",
              borderRadius: "8px",
              background: "rgba(79,126,247,0.06)",
              border: "1px solid rgba(79,126,247,0.15)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--d-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p style={{ margin: 0, fontSize: "12.5px", color: "var(--d-text-2)", lineHeight: 1.5 }}>
                <strong style={{ color: "var(--d-accent)", fontWeight: 700 }}>Trend Insight — </strong>
                {trendInsight}
              </p>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════
              SECTION 3 — AI PRIORITY CENTER
          ══════════════════════════════════════════════════════ */}
          <div style={{ ...card, marginBottom: "22px" }}>

            {/* Header */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "20px",
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "3px" }}>
                  <h2 style={{ ...sectionTitle, margin: 0 }}>What Needs Your Attention</h2>
                </div>
              </div>

              <span
                onClick={() => navigate("/alerts")}
                style={{ fontSize: "12px", fontWeight: 600, color: "var(--d-accent)", cursor: "pointer", flexShrink: 0 }}
              >
                View all alerts →
              </span>
            </div>

            {/* Priority Items */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {priorityItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    padding: "14px 16px",
                    borderRadius: "10px",
                    background: "var(--d-surface-2)",
                    border: "1px solid var(--d-border)",
                    transition: "opacity 0.15s ease",
                  }}
                >
                  {/* Priority icon bubble */}
                  <div style={{
                    width: "34px",
                    height: "34px",
                    borderRadius: "9px",
                    background: "var(--d-surface)",
                    border: "1px solid var(--d-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--icon-color)",
                    flexShrink: 0,
                  }}>
                    {item.icon}
                  </div>

                  {/* Text content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                      {/* Priority badge */}
                      <span style={{
                        fontSize: "9.5px",
                        fontWeight: 700,
                        color: item.levelColor,
                        background: "var(--d-surface)",
                        border: "1px solid var(--d-border)",
                        padding: "1.5px 7px",
                        borderRadius: "4px",
                        letterSpacing: "0.5px",
                        textTransform: "uppercase",
                        flexShrink: 0,
                      }}>
                        {item.levelLabel}
                      </span>
                      {/* Product name */}
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--d-text)" }}>
                        {item.productName}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "12px", color: "var(--d-text-2)", lineHeight: 1.55 }}>
                      {item.explanation}
                    </p>
                  </div>

                  {/* Action button */}
                  <button
                    onClick={() => navigate(item.actionNav)}
                    style={{
                      padding: "7px 15px",
                      background: "var(--d-surface)",
                      border: "1px solid var(--d-border)",
                      borderRadius: "7px",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--d-text)",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = item.levelColor;
                      e.currentTarget.style.color = item.levelColor;
                      e.currentTarget.style.background = item.levelBg;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--d-border)";
                      e.currentTarget.style.color = "var(--d-text)";
                      e.currentTarget.style.background = "var(--d-surface)";
                    }}
                  >
                    {item.action} →
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════
              SECTION 4 — PRODUCT INTELLIGENCE
          ══════════════════════════════════════════════════════ */}
          <div style={card}>

            {/* Header */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "20px",
            }}>
              <div>
                <h2 style={sectionTitle}>Product Insights</h2>
                <p style={sectionSub}>
                  Price competitiveness vs market volatility — each point represents one tracked product
                </p>
              </div>
              <span
                onClick={() => navigate("/products")}
                style={{ fontSize: "12px", fontWeight: 600, color: "var(--d-accent)", cursor: "pointer", flexShrink: 0 }}
              >
                View products →
              </span>
            </div>

            {/* Scatter Chart */}
            <div style={{ width: "100%", height: "340px", position: "relative" }}>

              {/* Quadrant corner labels */}
              <div style={{ position: "absolute", top: 8, left: "12%", fontSize: "10.5px", fontWeight: 600, color: "#ef4444", opacity: 0.55, pointerEvents: "none", zIndex: 2 }}>
                ⚠ Risk Zone
              </div>
              <div style={{ position: "absolute", top: 8, right: "7%", fontSize: "10.5px", fontWeight: 600, color: "#f59e0b", opacity: 0.55, pointerEvents: "none", zIndex: 2 }}>
                👁 Monitor Closely
              </div>
              <div style={{ position: "absolute", bottom: 48, left: "12%", fontSize: "10.5px", fontWeight: 600, color: "#4f7ef7", opacity: 0.55, pointerEvents: "none", zIndex: 2 }}>
                💡 Improve Pricing
              </div>
              <div style={{ position: "absolute", bottom: 48, right: "7%", fontSize: "10.5px", fontWeight: 600, color: "#10B981", opacity: 0.55, pointerEvents: "none", zIndex: 2 }}>
                ✓ Healthy Position
              </div>

              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 24, right: 34, left: 4, bottom: 28 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--d-border)" />
                  <XAxis
                    dataKey="x"
                    type="number"
                    domain={[0, 100]}
                    name="Price Competitiveness"
                    stroke="var(--d-text-3)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: "var(--d-border)" }}
                    label={{
                      value: "← Overpriced    Price Competitiveness    Cheapest →",
                      position: "insideBottom",
                      offset: -16,
                      style: { fontSize: "11px", fill: "var(--d-text-3)", fontWeight: 500 },
                    }}
                  />
                  <YAxis
                    dataKey="y"
                    type="number"
                    domain={[0, 100]}
                    name="Market Volatility"
                    stroke="var(--d-text-3)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    label={{
                      value: "Market Volatility ↑",
                      angle: -90,
                      position: "insideLeft",
                      offset: 18,
                      style: { fontSize: "11px", fill: "var(--d-text-3)", fontWeight: 500 },
                    }}
                  />
                  <ZAxis range={[64, 64]} />
                  <Tooltip content={<ScatterTip />} cursor={{ strokeDasharray: "3 3", stroke: "var(--d-border)" }} />

                  {/* Quadrant divider lines */}
                  <ReferenceLine x={50} stroke="var(--d-border)" strokeDasharray="5 3" strokeWidth={1.5} />
                  <ReferenceLine y={50} stroke="var(--d-border)" strokeDasharray="5 3" strokeWidth={1.5} />

                  <Scatter
                    name="Products"
                    data={scatterData}
                    shape={<CustomScatterDot />}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "8px",
              marginTop: "18px",
              paddingTop: "18px",
              borderTop: "1px solid var(--d-border)",
            }}>
              {[
                { color: "#ef4444", label: "Risk Zone", desc: "High volatility · Weak position" },
                { color: "#f59e0b", label: "Monitor Closely", desc: "High volatility · Strong position" },
                { color: "#4f7ef7", label: "Improve Pricing", desc: "Low volatility · Weak position" },
                { color: "#10B981", label: "Healthy Position", desc: "Low volatility · Strong position" },
              ].map((l) => (
                <div
                  key={l.label}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    background: `${l.color}08`,
                    border: `1px solid ${l.color}1a`,
                  }}
                >
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: l.color, flexShrink: 0, marginTop: "3px" }} />
                  <div>
                    <div style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--d-text)", marginBottom: "2px" }}>
                      {l.label}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--d-text-3)", lineHeight: 1.4 }}>
                      {l.desc}
                    </div>
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