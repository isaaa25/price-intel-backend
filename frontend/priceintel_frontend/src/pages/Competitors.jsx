import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { useStore } from "../context/StoreContext";
import { getProductsByStore, getProductCompetitors } from "../api/products";
// CHANGED: added getProductCompetitors, removed nothing else from imports

const card = {
  background: "var(--d-surface)",
  border: "1px solid var(--d-border)",
  borderRadius: "12px",
  padding: "24px",
};

// CHANGED: placeholderCompetitors array deleted entirely 

function MarketplaceBadge({ marketplace }) {
  const colors = {
    noon: { color: "#C2410C" },
    daraz: { color: "#E11D48" },
  };
  const c = colors[(marketplace || "").toLowerCase()] || { color: "var(--d-text-2)" };
  return (
    <span
      style={{
        fontSize: "12.5px",
        fontWeight: 600,
        color: c.color,
        textTransform: "capitalize",
      }}
    >
      {marketplace || "—"}
    </span>
  );
}

function Competitors() {
  const navigate = useNavigate();
  const { selectedStore, currency } = useStore();
  // CHANGED: added currency from useStore, needed for price display

  const [products, setProducts] = useState([]);
  const [competitors, setCompetitors] = useState([]);
  // CHANGED: new state — real flattened competitor list, one row per
  // competitor listing, each tagged with which product it belongs to
  const [selectedProductId, setSelectedProductId] = useState("all");
  const [search, setSearch] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingCompetitors, setLoadingCompetitors] = useState(false);
  // CHANGED: separate loading state for the competitors fetch step

  /* ── Load products strictly for the selected store ──────── */
  useEffect(() => {
    setSelectedProductId("all");
    setSearch("");

    if (!selectedStore?.id) {
      setProducts([]);
      setCompetitors([]);
      // CHANGED: also clear competitors when there's no store
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

  /* ── CHANGED: entirely new effect — fetch real competitors for
     every product, once the product list is loaded ────────── */
  useEffect(() => {
    if (products.length === 0) {
      setCompetitors([]);
      return;
    }
    setLoadingCompetitors(true);
    Promise.allSettled(products.map((p) => getProductCompetitors(p.id)))
      .then((results) => {
        const flattened = [];
        products.forEach((p, i) => {
          const list = results[i].status === "fulfilled" ? results[i].value : [];
          (Array.isArray(list) ? list : []).forEach((c) => {
            flattened.push({
              ...c,
              productId: p.id,
              productTitle: p.title,
              ownPrice: p.own_cost,
            });
          });
        });
        setCompetitors(flattened);
      })
      .finally(() => setLoadingCompetitors(false));
  }, [products]);

  /* ── Filtered competitors — CHANGED: now filters real data,
     no more fuzzy title-matching against placeholder data ──── */
  const filteredCompetitors = useMemo(() => {
    return competitors.filter((c) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        (c.name || "").toLowerCase().includes(q) ||
        (c.productTitle || "").toLowerCase().includes(q) ||
        (c.platform || "").toLowerCase().includes(q);

      const matchesProduct =
        selectedProductId === "all" || String(c.productId) === String(selectedProductId);

      return matchesSearch && matchesProduct;
    });
  }, [search, selectedProductId, competitors]);

  /* ── CHANGED: price position now computed from real prices,
     not a fake canned string ────────────────────────────────── */
  function pricePositionLabel(c) {
    if (c.latest_price == null || c.ownPrice == null) return null;
    const diff = c.latest_price - c.ownPrice;
    const pct = Math.abs((diff / c.ownPrice) * 100).toFixed(1);
    if (diff < 0) return { text: `${pct}% below you`, color: "#dc2626" };
    if (diff > 0) return { text: `${pct}% above you`, color: "#16a34a" };
    return { text: "Same price", color: "var(--d-text-2)" };
  }

  return (
    <Layout>
      {/* ── Page header ────────────────────────────────── */}
      <div className="res-page-header animate-in">
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
          {/* ── Stats row — CHANGED: Tracked Competitors is now real;
              Price Drops Detected and Stock-out Events left empty
              since no backend endpoint computes them yet ────────── */}
          <div className="animate-in" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "20px", animationDelay: "0.05s" }}>
            {[
              { label: "Tracked Competitors", value: loadingCompetitors ? "…" : filteredCompetitors.length },
              { label: "Price Drops Detected", value: "—" },
              { label: "Stock-out Events", value: "—" },
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
                {loadingCompetitors ? "Loading…" : `${filteredCompetitors.length} seller${filteredCompetitors.length !== 1 ? "s" : ""} found`}
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
                  {loadingCompetitors ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "48px 14px", color: "var(--d-text-3)", fontSize: "13px" }}>
                        Loading competitors…
                      </td>
                    </tr>
                  ) : filteredCompetitors.length === 0 ? (
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
                    filteredCompetitors.map((c, i) => {
                      // CHANGED: real price position, computed per row
                      const pos = pricePositionLabel(c);
                      // CHANGED: real last-seen date, or "—" if never scraped
                      const lastSeen = c.last_scraped_at
                        ? new Date(c.last_scraped_at).toLocaleDateString()
                        : "—";

                      return (
                        <tr
                          key={c.id}
                          style={{
                            borderBottom: i < filteredCompetitors.length - 1 ? "1px solid var(--d-border)" : "none",
                            transition: "background 0.1s",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--d-bg)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                        >
                          {/* 1. Seller — CHANGED: uses real c.name (falls back to "—" if scraper hasn't captured a name yet) */}
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
                                  {c.name || "—"}
                                </span>
                                {selectedProductId === "all" && (
                                  <span style={{ fontSize: "11px", color: "var(--d-text-3)" }}>
                                    on {c.productTitle}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* 2. Marketplace — CHANGED: uses real c.platform */}
                          <td style={{ padding: "14px", whiteSpace: "nowrap" }}>
                            <MarketplaceBadge marketplace={c.platform} />
                          </td>

                          {/* 3. Price Position vs You — CHANGED: real computed value */}
                          <td style={{ padding: "14px", whiteSpace: "nowrap" }}>
                            {pos ? (
                              <span style={{ fontSize: "12.5px", fontWeight: 600, color: pos.color }}>
                                {pos.text}
                              </span>
                            ) : (
                              <span style={{ fontSize: "12.5px", color: "var(--d-text-3)" }}>—</span>
                            )}
                          </td>

                          {/* 4. Behavior Type — CHANGED: no backend data exists for this yet, left empty */}
                          <td style={{ padding: "14px", whiteSpace: "nowrap" }}>
                            <span style={{ fontSize: "12.5px", color: "var(--d-text-3)" }}>—</span>
                          </td>

                          {/* 5. Repricing Velocity — CHANGED: no backend data exists for this yet, left empty */}
                          <td style={{ padding: "14px", whiteSpace: "nowrap" }}>
                            <span style={{ fontSize: "12.5px", color: "var(--d-text-3)" }}>—</span>
                          </td>

                          {/* 6. Stock Status — CHANGED: no backend data exists for this yet, left empty */}
                          <td style={{ padding: "14px", whiteSpace: "nowrap" }}>
                            <span style={{ fontSize: "12.5px", color: "var(--d-text-3)" }}>—</span>
                          </td>

                          {/* 7. Last Seen — CHANGED: real c.last_scraped_at */}
                          <td style={{ padding: "14px", whiteSpace: "nowrap" }}>
                            <span style={{ fontSize: "12px", color: "var(--d-text-3)" }}>{lastSeen}</span>
                          </td>
                        </tr>
                      );
                    })
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