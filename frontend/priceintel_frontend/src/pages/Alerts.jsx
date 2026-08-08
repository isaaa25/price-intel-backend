import Layout from "../components/Layout";

const card = {
  background: "var(--d-surface)",
  border: "1px solid var(--d-border)",
  borderRadius: "12px",
  padding: "24px",
};

/* ── Placeholder alert data ─────────────────────────────── */
const placeholderAlerts = [
  {
    type: "price_drop",
    icon: "↓",
    color: "var(--d-danger)",
    bg: "var(--d-danger-bg)",
    title: "Competitor price drop",
    message: "TechHub Store dropped price of Samsung Galaxy Buds 2 Pro by 5.3% — now AED 189.",
    time: "2 min ago",
    product: "Samsung Galaxy Buds 2 Pro",
  },
  {
    type: "undercut",
    icon: "⚠",
    color: "var(--d-warning)",
    bg: "var(--d-warning-bg)",
    title: "You've been undercut",
    message: "GadgetWorld UAE is now selling iPhone 15 Pro Max at AED 3,799 — AED 200 below your price.",
    time: "1 hr ago",
    product: "iPhone 15 Pro Max",
  },
  {
    type: "win",
    icon: "✓",
    color: "var(--d-success)",
    bg: "var(--d-success-bg)",
    title: "You're the cheapest",
    message: "You now have the lowest price on AirPods Pro 2 across all tracked marketplaces.",
    time: "3 hrs ago",
    product: "AirPods Pro 2",
  },
  {
    type: "stock_out",
    icon: "!",
    color: "#7C3AED",
    bg: "#F5F3FF",
    title: "Competitor out of stock",
    message: "Noon Store went out of stock on Samsung 65\" QLED TV. Opportunity to capture sales.",
    time: "5 hrs ago",
    product: "Samsung 65\" QLED TV",
  },
];

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "price_drop", label: "Price Drops" },
  { key: "undercut", label: "Undercuts" },
  { key: "win", label: "Wins" },
  { key: "stock_out", label: "Stock Out" },
];

import { useState } from "react";

function Alerts() {
  const [activeFilter, setActiveFilter] = useState("all");

  const filtered = activeFilter === "all"
    ? placeholderAlerts
    : placeholderAlerts.filter((a) => a.type === activeFilter);

  return (
    <Layout>
      {/* ── Page header ────────────────────────────────── */}
      <div className="animate-in" style={{ marginBottom: "28px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--d-text)", letterSpacing: "-0.3px" }}>
            Alerts
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--d-text-2)" }}>
            Real-time notifications about competitor price changes and opportunities.
          </p>
        </div>
      </div>

      {/* ── Summary stats ──────────────────────────────── */}
      <div className="animate-in" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px", animationDelay: "0.05s" }}>
        {[
          { label: "Total Alerts", value: "—", icon: "🔔", color: "var(--d-accent)", bg: "var(--d-accent-bg)" },
          { label: "Price Drops", value: "—", icon: "↓", color: "var(--d-danger)", bg: "var(--d-danger-bg)" },
          { label: "Undercuts", value: "—", icon: "⚠", color: "var(--d-warning)", bg: "var(--d-warning-bg)" },
          { label: "Wins", value: "—", icon: "✓", color: "var(--d-success)", bg: "var(--d-success-bg)" },
        ].map((s, i) => (
          <div key={s.label} className="animate-in" style={{ ...card, padding: "16px", animationDelay: `${i * 0.05}s` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ margin: 0, fontSize: "11px", fontWeight: 500, color: "var(--d-text-3)", textTransform: "uppercase", letterSpacing: "0.4px" }}>{s.label}</p>
              <span style={{ width: "28px", height: "28px", borderRadius: "7px", background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, color: s.color }}>{s.icon}</span>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: "26px", fontWeight: 700, color: "var(--d-text-3)", letterSpacing: "-1px" }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Alerts feed ────────────────────────────────── */}
      <div className="animate-in" style={{ ...card, animationDelay: "0.12s" }}>
        {/* Filter tabs */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "20px", flexWrap: "wrap" }}>
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              id={`btn-alert-filter-${tab.key}`}
              onClick={() => setActiveFilter(tab.key)}
              style={{
                padding: "6px 14px",
                border: "1px solid",
                borderColor: activeFilter === tab.key ? "var(--d-accent)" : "var(--d-border)",
                borderRadius: "8px",
                background: activeFilter === tab.key ? "var(--d-accent-bg)" : "transparent",
                color: activeFilter === tab.key ? "var(--d-accent)" : "var(--d-text-2)",
                fontSize: "12px",
                fontWeight: activeFilter === tab.key ? 600 : 500,
                fontFamily: "inherit",
                cursor: "pointer",
                transition: "all 0.12s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>


        {/* Alert feed */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filtered.map((alert, i) => (
            <div
              key={i}
              className="animate-in"
              style={{
                display: "flex", alignItems: "flex-start", gap: "14px",
                padding: "16px", borderRadius: "10px",
                border: "1px solid var(--d-border)", background: "var(--d-bg)",
                animationDelay: `${i * 0.04}s`,
                opacity: 0.7,
                transition: "opacity 0.12s, border-color 0.12s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.borderColor = "var(--d-accent)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.7"; e.currentTarget.style.borderColor = "var(--d-border)"; }}
            >
              {/* Icon */}
              <div style={{
                width: "36px", height: "36px", borderRadius: "9px",
                background: alert.bg, color: alert.color,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "14px", fontWeight: 700, flexShrink: 0,
              }}>
                {alert.icon}
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "var(--d-text)" }}>{alert.title}</p>
                  <span style={{ fontSize: "11px", color: "var(--d-text-3)", background: "var(--d-surface)", border: "1px solid var(--d-border)", padding: "1px 8px", borderRadius: "999px" }}>
                    {alert.product}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--d-text-2)", lineHeight: 1.5 }}>{alert.message}</p>
              </div>

              {/* Timestamp */}
              <span style={{ fontSize: "11px", color: "var(--d-text-3)", whiteSpace: "nowrap", flexShrink: 0 }}>{alert.time}</span>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}

export default Alerts;
