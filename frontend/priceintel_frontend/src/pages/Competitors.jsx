import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { useStore } from "../context/StoreContext";
import { getProductsByStore } from "../api/products";

const card = {
  background: "var(--d-surface)",
  border: "1px solid var(--d-border)",
  borderRadius: "12px",
  padding: "24px",
};

/* ── Competitor Dataset with Product mappings ────────────── */
const placeholderCompetitors = [
  {
    id: 1,
    name: "TechHub Store",
    marketplace: "noon",
    productTitle: "Galaxy A17",
    pricePosition: "4% below you",
    pricePositionType: "below",
    behavior: "Aggressive undercutter",
    behaviorColor: "#dc2626",
    velocity: "High",
    velocityDetail: "4.2 / day",
    stockStatus: "In Stock",
    stockColor: "#16a34a",
    lastSeen: "2 min ago",
  },
  {
    id: 2,
    name: "GadgetWorld UAE",
    marketplace: "noon",
    productTitle: "Samsung Galaxy Buds 2 Pro",
    pricePosition: "1% below you",
    pricePositionType: "below",
    behavior: "Dynamic follower",
    behaviorColor: "#2563EB",
    velocity: "Medium",
    velocityDetail: "1.5 / day",
    stockStatus: "In Stock",
    stockColor: "#16a34a",
    lastSeen: "15 min ago",
  },
  {
    id: 3,
    name: "MegaSeller PK",
    marketplace: "daraz",
    productTitle: "Galaxy Z Fold3 Cover",
    pricePosition: "3% above you",
    pricePositionType: "above",
    behavior: "Premium holder",
    behaviorColor: "#d97706",
    velocity: "Low",
    velocityDetail: "0.4 / day",
    stockStatus: "In Stock",
    stockColor: "#16a34a",
    lastSeen: "1 hr ago",
  },
  {
    id: 4,
    name: "ElectroMart",
    marketplace: "noon",
    productTitle: "Galaxy A17",
    pricePosition: "2% below you",
    pricePositionType: "below",
    behavior: "Aggressive undercutter",
    behaviorColor: "#dc2626",
    velocity: "High",
    velocityDetail: "3.8 / day",
    stockStatus: "Low Stock",
    stockColor: "#ea580c",
    lastSeen: "3 hrs ago",
  },
];

function MarketplaceBadge({ marketplace }) {
  const colors = {
    noon: { color: "#C2410C" },
    daraz: { color: "#E11D48" },
  };
  const c = colors[marketplace] || { color: "var(--d-text-2)" };
  return (
    <span
      style={{
        fontSize: "12.5px",
        fontWeight: 600,
        color: c.color,
        textTransform: "capitalize",
      }}
    >
      {marketplace}
    </span>
  );
}

function Competitors() {
  const navigate = useNavigate();
  const { selectedStore } = useStore();

  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState("all");
  const [search, setSearch] = useState("");
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

  /* ── Filtered competitors ─────────────────────────────────── */
  const filteredCompetitors = useMemo(() => {
    // If the selected store has 0 products, show 0 competitors for this store
    if (products.length === 0) {
      return [];
    }

    return placeholderCompetitors.filter((c) => {
      // 1. Search filter
      const matchesSearch =
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.productTitle.toLowerCase().includes(search.toLowerCase()) ||
        c.marketplace.toLowerCase().includes(search.toLowerCase()) ||
        c.behavior.toLowerCase().includes(search.toLowerCase());

      // 2. Product filter
      let matchesProduct = false;
      if (selectedProductId === "all") {
        matchesProduct = products.some((p) =>
          c.productTitle.toLowerCase().includes(p.title.toLowerCase().slice(0, 7)) ||
          p.title.toLowerCase().includes(c.productTitle.toLowerCase().slice(0, 7))
        );
      } else {
        const selectedProductObj = products.find((p) => String(p.id) === String(selectedProductId));
        if (selectedProductObj) {
          matchesProduct =
            c.productTitle.toLowerCase().includes(selectedProductObj.title.toLowerCase().slice(0, 7)) ||
            selectedProductObj.title.toLowerCase().includes(c.productTitle.toLowerCase().slice(0, 7));
        }
      }

      return matchesSearch && matchesProduct;
    });
  }, [search, selectedProductId, products]);

  return (
    <Layout>
      {/* ── Page header ────────────────────────────────── */}
      <div className="animate-in" style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--d-text)", letterSpacing: "-0.3px" }}>
            Competitors
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--d-text-2)" }}>
            Sellers competing against your products across marketplaces.
          </p>
        </div>
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
              <path d="m16 3 4 4-4 4" />
              <path d="M20 7H4" />
              <path d="m8 21-4-4 4-4" />
              <path d="M4 17h16" />
            </svg>
          </div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--d-text)", margin: "0 0 8px" }}>
            No Store Connected
          </h2>
          <p style={{ fontSize: "14px", color: "var(--d-text-2)", maxWidth: "420px", margin: "0 auto 20px", lineHeight: "1.5" }}>
            Connect your marketplace store in Account & Stores to start tracking competing sellers and price shifts.
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
          {/* ── Stats row ──────────────────────────────────── */}
          <div className="animate-in" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "20px", animationDelay: "0.05s" }}>
            {[
              { label: "Tracked Competitors", value: filteredCompetitors.length },
              { label: "Price Drops Detected", value: filteredCompetitors.length > 0 ? "14" : "0" },
              { label: "Stock-out Events", value: filteredCompetitors.length > 0 ? "2" : "0" },
            ].map((s, i) => (
              <div key={s.label} className="animate-in hover-lift" style={{ ...card, padding: "16px", animationDelay: `${i * 0.05}s` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ margin: 0, fontSize: "11px", fontWeight: 500, color: "var(--d-text-3)", textTransform: "uppercase", letterSpacing: "0.4px" }}>{s.label}</p>
                </div>
                <p style={{ margin: "10px 0 0", fontSize: "26px", fontWeight: 700, color: "var(--d-text)", letterSpacing: "-1px" }}>{s.value}</p>
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
            {/* Search Bar */}
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
                placeholder={`Search competitors in ${selectedStore.store_name}…`}
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

          {/* ── Competitors table ──────────────────────────── */}
          <div className="animate-in" style={{ ...card, animationDelay: "0.12s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--d-text)" }}>
                  Detected Sellers in {selectedStore.store_name}
                </h2>
                <p style={{ margin: "3px 0 0", fontSize: "12px", color: "var(--d-text-3)" }}>
                  {products.length === 0
                    ? `No tracked products found for ${selectedStore.store_name}`
                    : selectedProductId === "all"
                    ? "Showing all competitor sellers across your store's catalog"
                    : `Filtered competitors for ${products.find((p) => String(p.id) === String(selectedProductId))?.title || "selected product"}`}
                </p>
              </div>

              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--d-text-3)" }}>
                {filteredCompetitors.length} seller{filteredCompetitors.length !== 1 ? "s" : ""} found
              </span>
            </div>

            {/* Table */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {[
                      "Seller",
                      "Marketplace",
                      "Price Position vs You",
                      "Behavior Type",
                      "Repricing Velocity",
                      "Stock Status",
                      "Last Seen",
                    ].map((col) => (
                      <th
                        key={col}
                        style={{
                          textAlign: "left",
                          padding: "0 14px 12px",
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "var(--d-text-3)",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          borderBottom: "1px solid var(--d-border)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCompetitors.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "48px 14px", color: "var(--d-text-3)", fontSize: "13px" }}>
                        <p style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: 600, color: "var(--d-text)" }}>
                          No competitors found
                        </p>
                        <p style={{ margin: 0 }}>
                          {products.length === 0
                            ? `No tracked products in ${selectedStore.store_name}. Add products to begin monitoring competitors.`
                            : "No competitors matching your search or product filter."}
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
                      </td>
                    </tr>
                  ) : (
                    filteredCompetitors.map((c, i) => (
                      <tr
                        key={c.id || c.name}
                        style={{
                          borderBottom: i < filteredCompetitors.length - 1 ? "1px solid var(--d-border)" : "none",
                          transition: "background 0.1s",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--d-bg)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        {/* 1. Seller */}
                        <td style={{ padding: "14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div
                              style={{
                                width: "30px",
                                height: "30px",
                                borderRadius: "50%",
                                background: "var(--d-bg)",
                                border: "1px solid var(--d-border)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "var(--d-text-2)",
                                flexShrink: 0,
                              }}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                              </svg>
                            </div>
                            <div>
                              <span style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--d-text)", display: "block" }}>
                                {c.name}
                              </span>
                              {selectedProductId === "all" && (
                                <span style={{ fontSize: "11px", color: "var(--d-text-3)" }}>
                                  on {c.productTitle}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 2. Marketplace */}
                        <td style={{ padding: "14px", whiteSpace: "nowrap" }}>
                          <MarketplaceBadge marketplace={c.marketplace} />
                        </td>

                        {/* 3. Price Position vs You */}
                        <td style={{ padding: "14px", whiteSpace: "nowrap" }}>
                          <span
                            style={{
                              fontSize: "12.5px",
                              fontWeight: 600,
                              color: c.pricePositionType === "below" ? "#dc2626" : "#16a34a",
                            }}
                          >
                            {c.pricePosition}
                          </span>
                        </td>

                        {/* 4. Behavior Type */}
                        <td style={{ padding: "14px", whiteSpace: "nowrap" }}>
                          <span
                            style={{
                              fontSize: "12.5px",
                              fontWeight: 600,
                              color: c.behaviorColor,
                            }}
                          >
                            {c.behavior}
                          </span>
                        </td>

                        {/* 5. Repricing Velocity */}
                        <td style={{ padding: "14px", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--d-text)" }}>{c.velocity}</span>
                            <span style={{ fontSize: "11.5px", color: "var(--d-text-3)" }}>({c.velocityDetail})</span>
                          </div>
                        </td>

                        {/* 6. Stock Status */}
                        <td style={{ padding: "14px", whiteSpace: "nowrap" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              fontSize: "12px",
                              fontWeight: 600,
                              color: c.stockColor,
                            }}
                          >
                            <span
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                background: c.stockColor,
                                display: "inline-block",
                              }}
                            />
                            {c.stockStatus}
                          </span>
                        </td>

                        {/* 7. Last Seen */}
                        <td style={{ padding: "14px", whiteSpace: "nowrap" }}>
                          <span style={{ fontSize: "12px", color: "var(--d-text-3)" }}>{c.lastSeen}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}

export default Competitors;
