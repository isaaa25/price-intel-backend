import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import { useStore } from "../context/StoreContext";
import { getProductsByStore } from "../api/products";

const card = {
  background: "var(--d-surface)",
  border: "1px solid var(--d-border)",
  borderRadius: "12px",
  padding: "24px",
};

/* ── Alert Icons Helper ──────────────────────────────────── */
function AlertIcon({ type }) {
  const iconStyle = {
    width: "36px",
    height: "36px",
    borderRadius: "8px",
    background: "var(--d-surface-2)",
    border: "1px solid var(--d-border)",
    color: "var(--d-text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };

  switch (type) {
    case "flash_sale":
      return (
        <div style={iconStyle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
          </svg>
        </div>
      );
    case "price_drop":
      return (
        <div style={iconStyle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <polyline points="19 12 12 19 5 12" />
          </svg>
        </div>
      );
    case "undercut":
      return (
        <div style={iconStyle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
      );
    case "win":
      return (
        <div style={iconStyle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      );
    case "stock_out":
      return (
        <div style={iconStyle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
      );
    case "new_competitor":
      return (
        <div style={iconStyle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
        </div>
      );
    case "price_war":
      return (
        <div style={iconStyle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>
      );
    default:
      return (
        <div style={iconStyle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
      );
  }
}

/* ── Sample dataset (associated with Samsung store catalog) ─ */
const sampleAlerts = [
  {
    id: 1,
    type: "flash_sale",
    priority: "high",
    title: "Flash sale detected",
    seller: "TechHub Store",
    product: "Galaxy A17",
    message: "TechHub Store launched a limited-time flash deal on Galaxy A17 with a 28% discount (~4h remaining).",
    time: "Just now",
    isRead: false,
  },
  {
    id: 2,
    type: "price_drop",
    priority: "medium",
    title: "Competitor price drop",
    seller: "TechHub Store",
    product: "Samsung Galaxy Buds 2 Pro",
    message: "TechHub Store dropped price of Samsung Galaxy Buds 2 Pro by 5.3% — now AED 189.",
    time: "2 min ago",
    isRead: false,
  },
  {
    id: 3,
    type: "undercut",
    priority: "high",
    title: "You've been undercut",
    seller: "GadgetWorld UAE",
    product: "Galaxy A17",
    message: "GadgetWorld UAE is now selling Galaxy A17 at AED 3,799 — AED 200 below your price.",
    time: "1 hr ago",
    isRead: false,
  },
  {
    id: 4,
    type: "win",
    priority: "positive",
    title: "You're the cheapest",
    seller: "Your Store",
    product: "Samsung Galaxy Buds 2 Pro",
    message: "You now have the lowest price on Samsung Galaxy Buds 2 Pro across all tracked marketplaces.",
    time: "3 hrs ago",
    isRead: true,
  },
  {
    id: 5,
    type: "stock_out",
    priority: "opportunity",
    title: "Competitor out of stock",
    seller: "Noon Store",
    product: "Galaxy Z Fold3 Cover",
    message: "Noon Store went out of stock on Galaxy Z Fold3 Cover. Opportunity to capture sales.",
    time: "5 hrs ago",
    isRead: true,
  },
  {
    id: 6,
    type: "new_competitor",
    priority: "medium",
    title: "New competitor detected",
    seller: "PrimeDeals PK",
    product: "Galaxy Z Fold3 Cover",
    message: "PrimeDeals PK joined the listing for Galaxy Z Fold3 Cover at PKR 740.",
    time: "7 hrs ago",
    isRead: true,
  },
  {
    id: 7,
    type: "price_war",
    priority: "high",
    title: "Price war detected",
    seller: "Multiple sellers",
    product: "Galaxy A17",
    message: "Multiple sellers engaged in rapid undercutting on Galaxy A17.",
    time: "12 hrs ago",
    isRead: true,
  },
];

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "flash_sale", label: "Flash Sales" },
  { key: "price_drop", label: "Price Drops" },
  { key: "undercut", label: "Undercuts" },
  { key: "win", label: "Wins" },
  { key: "stock_out", label: "Stock Out" },
  { key: "new_competitor", label: "New Competitor" },
  { key: "price_war", label: "Price War" },
];

function Alerts() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedStore } = useStore();

  const [alerts, setAlerts] = useState(sampleAlerts);
  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("all");
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  /* ── Load products strictly for the selected store ──────── */
  useEffect(() => {
    setSelectedProductId("all");
    setSearch("");

    if (!selectedStore?.id) {
      setProducts([]);
      return;
    }

    setLoadingProducts(true);
    getProductsByStore(selectedStore.id)
      .then((data) => {
        const productList = Array.isArray(data) ? data : [];
        setProducts(productList);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false));
  }, [selectedStore]);

  /* ── Query parameter filter ──────────────────────────────── */
  useEffect(() => {
    const filterParam = searchParams.get("filter");
    if (filterParam && FILTER_TABS.some((t) => t.key === filterParam)) {
      setActiveFilter(filterParam);
    }
  }, [searchParams]);

  /* ── Dismiss alert handler ───────────────────────────────── */
  const handleDismiss = (id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  /* ── Mark all as read handler ────────────────────────────── */
  const handleMarkAllAsRead = () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
  };

  /* ── Filtered Alerts ─────────────────────────────────────── */
  const filtered = useMemo(() => {
    // If the selected store has 0 products, show 0 alerts for this store
    if (products.length === 0) {
      return [];
    }

    return alerts.filter((a) => {
      // 1. Type Tab Filter
      const matchesType = activeFilter === "all" || a.type === activeFilter;

      // 2. Search Keyword Filter
      const matchesSearch =
        !search ||
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.message.toLowerCase().includes(search.toLowerCase()) ||
        a.product.toLowerCase().includes(search.toLowerCase()) ||
        (a.seller && a.seller.toLowerCase().includes(search.toLowerCase()));

      // 3. Product Specific Filter
      let matchesProduct = false;
      if (selectedProductId === "all") {
        // Show alerts that match any product in this store's catalog
        matchesProduct = products.some((p) =>
          a.product.toLowerCase().includes(p.title.toLowerCase().slice(0, 7)) ||
          p.title.toLowerCase().includes(a.product.toLowerCase().slice(0, 7))
        );
      } else {
        const selectedProductObj = products.find((p) => String(p.id) === String(selectedProductId));
        if (selectedProductObj) {
          matchesProduct =
            a.product.toLowerCase().includes(selectedProductObj.title.toLowerCase().slice(0, 7)) ||
            selectedProductObj.title.toLowerCase().includes(a.product.toLowerCase().slice(0, 7));
        }
      }

      return matchesType && matchesSearch && matchesProduct;
    });
  }, [alerts, activeFilter, search, selectedProductId, products]);

  const unreadCount = useMemo(() => {
    return filtered.filter((a) => !a.isRead).length;
  }, [filtered]);

  return (
    <Layout>
      {/* ── Page header ────────────────────────────────── */}
      <div className="animate-in" style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--d-text)", letterSpacing: "-0.3px" }}>
            Alerts
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--d-text-2)" }}>
            Real-time notifications about competitor price changes and opportunities.
          </p>
        </div>

        {/* ── Mark All as Read Button (Always Visible) ─────── */}
        <button
          onClick={unreadCount > 0 ? handleMarkAllAsRead : undefined}
          disabled={unreadCount === 0}
          style={{
            padding: "7px 14px",
            background: "var(--d-surface)",
            border: "1px solid var(--d-border)",
            borderRadius: "8px",
            fontSize: "12.5px",
            fontWeight: 600,
            color: unreadCount > 0 ? "var(--d-accent)" : "var(--d-text-3)",
            cursor: unreadCount > 0 ? "pointer" : "default",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            opacity: unreadCount > 0 ? 1 : 0.7,
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            if (unreadCount > 0) {
              e.currentTarget.style.borderColor = "var(--d-accent)";
              e.currentTarget.style.background = "var(--d-bg)";
            }
          }}
          onMouseLeave={(e) => {
            if (unreadCount > 0) {
              e.currentTarget.style.borderColor = "var(--d-border)";
              e.currentTarget.style.background = "var(--d-surface)";
            }
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {unreadCount > 0 ? `Mark all as read (${unreadCount})` : "✓ All read"}
        </button>
      </div>

      {!selectedStore ? (
        <div
          className="animate-in"
          style={{
            ...card,
            textAlign: "center",
            padding: "60px 20px",
          }}
        >
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              background: "rgba(37, 99, 235, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
          </div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--d-text)", margin: "0 0 8px" }}>
            No Store Connected
          </h2>
          <p style={{ fontSize: "14px", color: "var(--d-text-2)", maxWidth: "420px", margin: "0 auto 20px", lineHeight: "1.5" }}>
            Connect your marketplace store in Account & Stores to receive real-time price change alerts and undercutting notifications.
          </p>
          <button
            onClick={() => navigate("/account")}
            style={{
              padding: "10px 20px",
              background: "var(--d-accent)",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(79,70,229,0.25)",
            }}
          >
            + Go to Account & Add Store
          </button>
        </div>
      ) : (
        <>
          {/* ── Summary stats ──────────────────────────────── */}
          <div className="animate-in" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", marginBottom: "18px", animationDelay: "0.05s" }}>
            {[
              { label: "Total Alerts", value: filtered.length },
              { label: "Flash Sales", value: filtered.filter((a) => a.type === "flash_sale").length },
              { label: "Price Drops", value: filtered.filter((a) => a.type === "price_drop").length },
              { label: "Undercuts", value: filtered.filter((a) => a.type === "undercut").length },
              { label: "New Competitors", value: filtered.filter((a) => a.type === "new_competitor").length },
            ].map((s, i) => (
              <div key={s.label} className="animate-in" style={{ ...card, padding: "14px 16px", animationDelay: `${i * 0.04}s` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ margin: 0, fontSize: "10.5px", fontWeight: 600, color: "var(--d-text-3)", textTransform: "uppercase", letterSpacing: "0.4px" }}>{s.label}</p>
                </div>
                <p style={{ margin: "8px 0 0", fontSize: "22px", fontWeight: 700, color: "var(--d-text)", letterSpacing: "-0.5px" }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* ── Search & Product Filter Bar ─────────────────── */}
          <div
            className="animate-in"
            style={{
              display: "flex",
              gap: "12px",
              marginBottom: "16px",
              flexWrap: "wrap",
              alignItems: "center",
              animationDelay: "0.08s",
            }}
          >
            {/* Search Input */}
            <div style={{ position: "relative", flex: "1", minWidth: "240px" }}>
              <span
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--d-text-3)",
                  display: "flex",
                  alignItems: "center",
                  pointerEvents: "none",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="text"
                placeholder={`Search alerts in ${selectedStore.store_name}…`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 14px 9px 36px",
                  borderRadius: "8px",
                  border: "1px solid var(--d-border)",
                  background: "var(--d-surface)",
                  color: "var(--d-text)",
                  fontSize: "13px",
                  fontFamily: "inherit",
                  outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--d-accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--d-border)")}
              />
            </div>

            {/* Product Dropdown Selector */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--d-text-2)", whiteSpace: "nowrap" }}>
                Product:
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                disabled={loadingProducts || products.length === 0}
                style={{
                  padding: "9px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--d-border)",
                  background: "var(--d-surface)",
                  color: "var(--d-text)",
                  fontSize: "13px",
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: products.length > 0 ? "pointer" : "default",
                  outline: "none",
                  minWidth: "220px",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--d-accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--d-border)")}
              >
                {products.length === 0 ? (
                  <option value="all">No products tracked yet (0)</option>
                ) : (
                  <>
                    <option value="all">All Tracked Products ({products.length})</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>

          {/* ── Alerts feed card ────────────────────────────── */}
          <div className="animate-in" style={{ ...card, animationDelay: "0.12s" }}>
            {/* Filter tabs */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "22px", flexWrap: "wrap" }}>
              {FILTER_TABS.map((tab) => {
                const count =
                  tab.key === "all"
                    ? filtered.length
                    : filtered.filter((a) => a.type === tab.key).length;
                const isActive = activeFilter === tab.key;

                return (
                  <button
                    key={tab.key}
                    id={`btn-alert-filter-${tab.key}`}
                    onClick={() => setActiveFilter(tab.key)}
                    style={{
                      padding: "8px 16px",
                      border: "1px solid",
                      borderColor: isActive ? "var(--d-accent)" : "var(--d-border)",
                      borderRadius: "8px",
                      background: isActive ? "var(--d-accent)" : "var(--d-surface)",
                      color: isActive ? "#ffffff" : "var(--d-text)",
                      fontSize: "13px",
                      fontWeight: 700,
                      fontFamily: "inherit",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: isActive ? "0 2px 6px rgba(37,99,235,0.2)" : "0 1px 2px rgba(0,0,0,0.03)",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = "var(--d-bg)";
                        e.currentTarget.style.borderColor = "var(--d-accent)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = "var(--d-surface)";
                        e.currentTarget.style.borderColor = "var(--d-border)";
                      }
                    }}
                  >
                    <span>{tab.label}</span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: "10px",
                        background: isActive ? "rgba(255,255,255,0.25)" : "var(--d-bg)",
                        color: isActive ? "#ffffff" : "var(--d-text-3)",
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Alert feed list */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 14px", color: "var(--d-text-3)" }}>
                  <p style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: 600, color: "var(--d-text)" }}>
                    No alerts found
                  </p>
                  <p style={{ margin: 0, fontSize: "12.5px" }}>
                    {products.length === 0
                      ? `No tracked products found for ${selectedStore.store_name}. Add products in the Products page to start tracking.`
                      : "Try changing your search query, product filter, or alert category."}
                  </p>
                  {products.length === 0 && (
                    <button
                      onClick={() => navigate("/products")}
                      style={{
                        marginTop: "14px",
                        padding: "8px 16px",
                        background: "var(--d-accent)",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "12.5px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      + Add Products to {selectedStore.store_name}
                    </button>
                  )}
                </div>
              ) : (
                filtered.map((alert, i) => {
                  const isHighPriority = alert.priority === "high";
                  const isOpportunity = alert.priority === "opportunity";
                  const isPositive = alert.priority === "positive";

                  return (
                    <div
                      key={alert.id}
                      className="animate-in"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "16px",
                        padding: "14px 18px",
                        borderRadius: "10px",
                        border: "1px solid var(--d-border)",
                        background: alert.isRead ? "var(--d-surface)" : "var(--d-accent-bg)",
                        animationDelay: `${i * 0.03}s`,
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--d-accent)";
                        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.03)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--d-border)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      {/* Left: Icon + Content */}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", flex: 1, minWidth: 0 }}>
                        <div style={{ position: "relative" }}>
                          <AlertIcon type={alert.type} />
                          {!alert.isRead && (
                            <span
                              title="Unread alert"
                              style={{
                                position: "absolute",
                                top: "-2px",
                                right: "-2px",
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                background: "var(--d-accent)",
                                border: "2px solid var(--d-surface)",
                              }}
                            />
                          )}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                            <p style={{ margin: 0, fontSize: "13.5px", fontWeight: 700, color: "var(--d-text)" }}>
                              {alert.title}
                            </p>

                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                color: "var(--d-text-2)",
                                background: "var(--d-bg)",
                                border: "1px solid var(--d-border)",
                                padding: "1px 8px",
                                borderRadius: "6px",
                              }}
                            >
                              {alert.product}
                            </span>

                            {/* Urgency Badge */}
                            {isHighPriority && (
                              <span style={{ fontSize: "11px", fontWeight: 700, color: "#dc2626", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#dc2626" }} />
                                Urgent
                              </span>
                            )}
                            {isOpportunity && (
                              <span style={{ fontSize: "11px", fontWeight: 700, color: "#0284c7", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#0284c7" }} />
                                Opportunity
                              </span>
                            )}
                            {isPositive && (
                              <span style={{ fontSize: "11px", fontWeight: 700, color: "#16a34a", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#16a34a" }} />
                                Winning
                              </span>
                            )}
                          </div>

                          <p style={{ margin: 0, fontSize: "12.5px", color: "var(--d-text-2)", lineHeight: 1.45 }}>
                            {alert.message}
                          </p>
                        </div>
                      </div>

                      {/* Right: Timestamp & Action Buttons */}
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
                        <span style={{ fontSize: "11.5px", color: "var(--d-text-3)", whiteSpace: "nowrap" }}>
                          {alert.time}
                        </span>

                        <button
                          onClick={() => navigate("/products")}
                          style={{
                            padding: "6px 12px",
                            background: "var(--d-surface)",
                            border: "1px solid var(--d-border)",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: 600,
                            color: "var(--d-accent)",
                            cursor: "pointer",
                            fontFamily: "inherit",
                            transition: "all 0.12s ease",
                            whiteSpace: "nowrap",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = "var(--d-accent)";
                            e.currentTarget.style.background = "var(--d-bg)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = "var(--d-border)";
                            e.currentTarget.style.background = "var(--d-surface)";
                          }}
                        >
                          Reprice ↗
                        </button>

                        <button
                          onClick={() => handleDismiss(alert.id)}
                          title="Dismiss alert"
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "6px",
                            border: "1px solid transparent",
                            background: "transparent",
                            color: "var(--d-text-3)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.12s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#fee2e2";
                            e.currentTarget.style.color = "#dc2626";
                            e.currentTarget.style.borderColor = "#fecaca";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.color = "var(--d-text-3)";
                            e.currentTarget.style.borderColor = "transparent";
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}

export default Alerts;
