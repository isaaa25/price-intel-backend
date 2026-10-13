import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import LoadingSpinner from "../components/LoadingSpinner";
import { useStore } from "../context/StoreContext";
import { getProductsByStore, getAlerts, markAlertsRead } from "../api/products";

/* ── alert type → icon + colors ───────────────────────────── */
function alertMeta(category, urgency) {
  if (category === "flash_sale") return { color: "#f59e0b", bg: "rgba(245,158,11,0.08)", label: "Flash Sale" };
  if (category === "price_drop") return { color: "#3b82f6", bg: "rgba(59,130,246,0.08)", label: "Price Drop" };
  if (category === "undercut") return { color: "#ef4444", bg: "rgba(239,68,68,0.08)", label: "Undercut" };
  if (category === "win") return { color: "#10B981", bg: "rgba(16,185,129,0.08)", label: "Win" };
  if (category === "stock_out") return { color: "#8b5cf6", bg: "rgba(139,92,246,0.08)", label: "Stock Out" };
  if (category === "price_war") return { color: "#ef4444", bg: "rgba(239,68,68,0.08)", label: "Price War" };
  if (category === "new_competitor") return { color: "#06b6d4", bg: "rgba(6,182,212,0.08)", label: "New Competitor" };
  return { color: "var(--d-text-3)", bg: "var(--d-bg)", label: "Alert" };
}

function AlertIcon({ category }) {
  const style = { flexShrink: 0 };
  if (category === "flash_sale") return (
    <svg style={style} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
  if (category === "price_drop") return (
    <svg style={style} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
    </svg>
  );
  if (category === "undercut") return (
    <svg style={style} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
  if (category === "win") return (
    <svg style={style} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
  if (category === "stock_out") return (
    <svg style={style} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
  if (category === "price_war") return (
    <svg style={style} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
  return (
    <svg style={style} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--d-text-3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function timeAgo(isoString) {
  if (!isoString) return "";
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

const TABS = [
  { key: "all", label: "All", categories: null },
  { key: "flash_sale", label: "Flash Sales", categories: ["flash_sale"] },
  { key: "price_drop", label: "Price Drops", categories: ["price_drop"] },
  { key: "undercut", label: "Undercuts", categories: ["undercut"] },
  { key: "win", label: "Wins", categories: ["win"] },
  { key: "stock_out", label: "Stock Out", categories: ["stock_out"] },
  { key: "new_competitor", label: "New Competitor", categories: ["new_competitor"] },
  { key: "price_war", label: "Price War", categories: ["price_war"] },
];

export default function Alerts() {
  const navigate = useNavigate();
  const { selectedStore } = useStore();

  const [products, setProducts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("all");

  /* ── fetch products list for dropdown ── */
  useEffect(() => {
    if (!selectedStore?.id) { setProducts([]); return; }
    getProductsByStore(selectedStore.id)
      .then((d) => setProducts(Array.isArray(d) ? d : []))
      .catch(() => setProducts([]));
  }, [selectedStore]);

  /* ── fetch real alerts ── */
  useEffect(() => {
    if (!selectedStore?.id) { setAlerts([]); setLoading(false); return; }
    setLoading(true);
    getAlerts(selectedStore.id)
      .then((d) => setAlerts(Array.isArray(d) ? d : []))
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false));
  }, [selectedStore]);

  /* ── mark all as read ── */
  async function handleMarkAllRead() {
    if (!selectedStore?.id) return;
    try {
      await markAlertsRead(selectedStore.id);
      setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
    } catch (err) {
      console.error("Failed to mark alerts as read:", err);
    }
  }

  /* ── derived counts for tab badges ── */
  const tabCounts = useMemo(() => {
    const counts = { all: alerts.length };
    TABS.slice(1).forEach((tab) => {
      counts[tab.key] = alerts.filter((a) => tab.categories.includes(a.category)).length;
    });
    return counts;
  }, [alerts]);

  const unreadCount = useMemo(() => alerts.filter((a) => !a.is_read).length, [alerts]);

  /* ── filtered list ── */
  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      const tab = TABS.find((t) => t.key === activeTab);
      const matchesTab = !tab?.categories || tab.categories.includes(a.category);
      const matchesProduct = selectedProductId === "all" || a.product_id === selectedProductId;
      const q = search.toLowerCase();
      const matchesSearch = !q ||
        (a.title || "").toLowerCase().includes(q) ||
        (a.description || "").toLowerCase().includes(q) ||
        (a.product_title || "").toLowerCase().includes(q) ||
        (a.competitor_name || "").toLowerCase().includes(q);
      return matchesTab && matchesProduct && matchesSearch;
    });
  }, [alerts, activeTab, selectedProductId, search]);

  const card = {
    background: "var(--d-surface)",
    border: "1px solid var(--d-border)",
    borderRadius: "12px",
    padding: "24px",
  };

  return (
    <Layout>
      {/* ── Page header ── */}
      <div className="res-page-header animate-in" style={{ marginBottom: "20px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--d-text)", letterSpacing: "-0.3px" }}>
            Alerts
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--d-text-2)" }}>
            Real-time notifications about competitor price changes and opportunities.
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "8px 16px",
              background: "var(--d-surface)",
              border: "1px solid var(--d-border)",
              borderRadius: "8px",
              fontSize: "12.5px", fontWeight: 600,
              color: "var(--d-accent)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Mark all as read ({unreadCount})
          </button>
        )}
      </div>

      {!selectedStore ? (
        <div style={{ ...card, textAlign: "center", padding: "60px 20px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--d-text)", margin: "0 0 8px" }}>No Store Connected</h2>
          <p style={{ fontSize: "13.5px", color: "var(--d-text-2)", maxWidth: "380px", margin: "0 auto 20px" }}>
            Connect a store to start receiving price alerts.
          </p>
          <button onClick={() => navigate("/account")} style={{ padding: "10px 20px", background: "var(--d-accent)", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
            + Go to Account
          </button>
        </div>
      ) : (
        <>
          {/* ── Search bar ── */}
          <div style={{ position: "relative", marginBottom: "14px" }}>
            <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--d-text-3)", display: "flex", alignItems: "center", pointerEvents: "none" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            </span>
            <input
              type="text"
              placeholder={`Search alerts in ${selectedStore.store_name}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", padding: "10px 14px 10px 38px", borderRadius: "8px", border: "1px solid var(--d-border)", background: "var(--d-surface)", color: "var(--d-text)", fontSize: "13px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
              onFocus={(e) => (e.target.style.borderColor = "var(--d-accent)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--d-border)")}
            />
          </div>

          {/* ── Product filter ── */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
            <label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--d-text-2)", whiteSpace: "nowrap" }}>Product:</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              style={{ flex: 1, padding: "9px 14px", borderRadius: "8px", border: "1px solid var(--d-border)", background: "var(--d-surface)", color: "var(--d-text)", fontSize: "13px", fontWeight: 500, fontFamily: "inherit", outline: "none", cursor: "pointer" }}
              onFocus={(e) => (e.target.style.borderColor = "var(--d-accent)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--d-border)")}
            >
              <option value="all">All Tracked Products ({products.length})</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>

          {/* ── Main card ── */}
          <div style={card}>
            {/* ── Tab bar ── */}
            <div style={{ display: "flex", gap: "6px", marginBottom: "20px", flexWrap: "wrap" }}>
              {TABS.map((tab) => {
                const count = tabCounts[tab.key] || 0;
                if (tab.key !== "all" && count === 0) return null;
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "20px",
                      border: "1px solid",
                      borderColor: active ? "var(--d-accent)" : "var(--d-border)",
                      background: active ? "var(--d-accent)" : "var(--d-surface)",
                      color: active ? "#fff" : "var(--d-text-2)",
                      fontSize: "12.5px",
                      fontWeight: active ? 700 : 500,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.12s",
                    }}
                  >
                    {tab.label}
                    <span style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      background: active ? "rgba(255,255,255,0.25)" : "var(--d-bg)",
                      color: active ? "#fff" : "var(--d-text-3)",
                      padding: "1px 6px",
                      borderRadius: "10px",
                    }}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* ── Loading ── */}
            {loading && (
              <div style={{ textAlign: "center", padding: "48px 0", color: "var(--d-text-3)", fontSize: "13px" }}>
                <div style={{ marginBottom: "10px", display: "flex", justifyContent: "center" }}>
                  <LoadingSpinner size={26} color="var(--d-text-3)" />
                </div>
                Loading alerts…
              </div>
            )}

            {/* ── Empty ── */}
            {!loading && filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: "48px 0", color: "var(--d-text-3)", fontSize: "13px" }}>
                <div style={{ fontSize: "28px", marginBottom: "10px", opacity: 0.4 }}>🔔</div>
                <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 600, color: "var(--d-text)" }}>
                  {alerts.length === 0 ? "No alerts yet" : "No alerts match your filter"}
                </p>
                <p style={{ margin: 0 }}>
                  {alerts.length === 0
                    ? "Alerts will appear here once your scraper detects competitor price changes."
                    : "Try changing the tab or search filter."}
                </p>
              </div>
            )}

            {/* ── Alert list ── */}
            {!loading && filtered.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                {filtered.map((alert, i) => {
                  const meta = alertMeta(alert.category, alert.urgency);
                  const isUrgent = alert.urgency === "urgent";
                  const isWinning = alert.urgency === "winning";
                  const isOpportunity = alert.urgency === "opportunity";
                  const shortProduct = alert.product_title?.length > 30
                    ? alert.product_title.slice(0, 28) + "…"
                    : alert.product_title;

                  return (
                    <div
                      key={alert.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        padding: "16px 4px",
                        borderBottom: i < filtered.length - 1 ? "1px solid var(--d-border)" : "none",
                        background: !alert.is_read ? "rgba(79,126,247,0.03)" : "transparent",
                        transition: "background 0.1s",
                        position: "relative",
                      }}
                    >
                      {/* Unread dot */}
                      {!alert.is_read && (
                        <div style={{ position: "absolute", left: "-12px", top: "50%", transform: "translateY(-50%)", width: "6px", height: "6px", borderRadius: "50%", background: "var(--d-accent)" }} />
                      )}

                      {/* Icon bubble */}
                      <div style={{
                        width: "36px", height: "36px", borderRadius: "10px",
                        background: meta.bg,
                        border: `1px solid ${meta.color}22`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        <AlertIcon category={alert.category} />
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--d-text)" }}>
                            {alert.title}
                          </span>
                          {shortProduct && (
                            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--d-text-2)", background: "var(--d-bg)", border: "1px solid var(--d-border)", padding: "1px 7px", borderRadius: "5px", whiteSpace: "nowrap" }}>
                              {shortProduct}
                            </span>
                          )}
                          {isUrgent && (
                            <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#ef4444", display: "flex", alignItems: "center", gap: "3px" }}>
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
                              Urgent
                            </span>
                          )}
                          {isWinning && (
                            <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#10B981", display: "flex", alignItems: "center", gap: "3px" }}>
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10B981", display: "inline-block" }} />
                              Winning
                            </span>
                          )}
                          {isOpportunity && (
                            <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#8b5cf6", display: "flex", alignItems: "center", gap: "3px" }}>
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#8b5cf6", display: "inline-block" }} />
                              Opportunity
                            </span>
                          )}
                        </div>
                        <p style={{ margin: 0, fontSize: "12.5px", color: "var(--d-text-2)", lineHeight: 1.5 }}>
                          {alert.description}
                        </p>
                      </div>

                      {/* Right side: time + action */}
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                        <span style={{ fontSize: "11.5px", color: "var(--d-text-3)", whiteSpace: "nowrap" }}>
                          {timeAgo(alert.created_at)}
                        </span>
                        <button
                          onClick={() => navigate("/products")}
                          style={{
                            padding: "6px 13px",
                            background: "var(--d-surface)",
                            border: "1px solid var(--d-border)",
                            borderRadius: "7px",
                            fontSize: "12px",
                            fontWeight: 600,
                            color: "var(--d-accent)",
                            cursor: "pointer",
                            fontFamily: "inherit",
                            whiteSpace: "nowrap",
                            transition: "all 0.12s",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--d-accent)"; e.currentTarget.style.background = "rgba(79,126,247,0.06)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--d-border)"; e.currentTarget.style.background = "var(--d-surface)"; }}
                        >
                          Reprice ↗
                        </button>
                        <button
                          onClick={() => setAlerts((prev) => prev.filter((a) => a.id !== alert.id))}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--d-text-3)", padding: "4px", display: "flex", alignItems: "center" }}
                          title="Dismiss"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Footer count ── */}
            {!loading && filtered.length > 0 && (
              <p style={{ margin: "14px 0 0", fontSize: "11px", color: "var(--d-text-3)", textAlign: "right" }}>
                Showing {filtered.length} alert{filtered.length !== 1 ? "s" : ""}
                {unreadCount > 0 ? ` · ${unreadCount} unread` : ""}
              </p>
            )}
          </div>
        </>
      )}
    </Layout>
  );
}