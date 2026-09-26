import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { useStore } from "../context/StoreContext";
import { getProductsByStore, deleteProduct, getProductKpis } from "../api/products";
// CHANGED: added getProductKpis to the import above

/* ── shared card style ────────────────────────────────────── */
const card = {
  background: "var(--d-surface)",
  border: "1px solid var(--d-border)",
  borderRadius: "12px",
  padding: "20px",
};

/* ── status badge helper ──────────────────────────────────── */
function StatusBadge({ active, kpi }) {
  if (!active) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, color: "var(--d-danger)" }}>
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--d-danger)", display: "inline-block" }} />
        Inactive
      </span>
    );
  }

  // No KPI data yet, or no competitor to compare against
  if (!kpi || kpi.cheapest_competitor == null || kpi.own_price == null) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12.5px", fontWeight: 600, color: "var(--d-text-3)" }}>
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--d-text-3)", display: "inline-block" }} />
        No data
      </span>
    );
  }

  const isCheapest = kpi.is_cheapest === true;
  const isOverpriced = kpi.own_price > kpi.cheapest_competitor;

  const label = isCheapest ? "Cheapest" : isOverpriced ? "Overpriced" : "Competitive";
  const color = isCheapest ? "var(--d-success)" : isOverpriced ? "var(--d-danger)" : "var(--d-text)";

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12.5px", fontWeight: 600, color }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}

function Products() {
  const navigate = useNavigate();
  const { selectedStore, currency } = useStore();

  const [products, setProducts] = useState([]);
  const [kpisById, setKpisById] = useState({});
  // CHANGED: new state — holds real KPI data per product ID, e.g. { "uuid-1": {own_price, cheapest_competitor, num_competitors, is_cheapest}, ... }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all"); // all | active | inactive

  /* ── fetch products ───────────────────────────────────────── */
  useEffect(() => {
    if (!selectedStore?.id) {
      setProducts([]);
      setKpisById({});
      // CHANGED: also clear kpisById when there's no store
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    getProductsByStore(selectedStore.id)
      .then(async (data) => {
        // CHANGED: this whole .then() body is new — was just
        // `.then((data) => setProducts(Array.isArray(data) ? data : []))`
        const list = Array.isArray(data) ? data : [];
        setProducts(list);

        // Fetch KPIs for every product in parallel — each is its own
        // independent request, same pattern as everything else here.
        const results = await Promise.allSettled(
          list.map((p) => getProductKpis(p.id))
        );
        const map = {};
        list.forEach((p, i) => {
          map[p.id] = results[i].status === "fulfilled" ? results[i].value : null;
        });
        setKpisById(map);
      })
      .catch((err) => setError(err.message || "Failed to load products."))
      .finally(() => setLoading(false));
  }, [selectedStore]);

  /* ── delete product ───────────────────────────────────────── */
  async function handleDeleteProduct(product) {
    if (!window.confirm(`Are you sure you want to delete "${product.search_keyword || product.title}"?`)) {
      return;
    }
    try {
      await deleteProduct(product.id);
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
    } catch (err) {
      alert(err.message || "Failed to delete product.");
    }
  }

  /* ── derived stats ────────────────────────────────────────── */
  const stats = useMemo(() => {
    // CHANGED: this whole block replaces the old hardcoded
    // cheapest/competitive/overpriced/needsAttention logic
    const total = products.length;
    let cheapest = 0, competitive = 0, overpriced = 0;
    products.forEach((p) => {
      const kpi = kpisById[p.id];
      if (!kpi || kpi.cheapest_competitor == null) return;
      if (kpi.is_cheapest) cheapest++;
      else if (kpi.own_price != null && kpi.own_price > kpi.cheapest_competitor) overpriced++;
      else competitive++;
    });
    return { total, cheapest, competitive, overpriced, needsAttention: overpriced };
  }, [products, kpisById]);

  /* ── filtered list ────────────────────────────────────────── */
  const filtered = useMemo(() => {
    return products.filter((p) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q) ||
        (p.search_keyword || "").toLowerCase().includes(q);
      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && p.is_active) ||
        (filterStatus === "inactive" && !p.is_active);
      return matchesSearch && matchesStatus;
    });
  }, [products, search, filterStatus]);

  /* ── input style ──────────────────────────────────── */
  const inputStyle = {
    padding: "8px 14px",
    border: "1px solid var(--d-border)",
    borderRadius: "8px",
    background: "var(--d-surface)",
    color: "var(--d-text)",
    fontSize: "13px",
    fontFamily: "inherit",
    outline: "none",
  };

  return (
    <Layout>
      {/* ── Page header ─────────────────────────────────────── */}
      <div className="res-page-header animate-in">
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "20px",
              fontWeight: 700,
              color: "var(--d-text)",
              letterSpacing: "-0.3px",
            }}
          >
            Products
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--d-text-2)" }}>
            {selectedStore
              ? <>Products tracked for <strong>{selectedStore.store_name}</strong>.</>
              : "All products you're tracking across marketplaces."}
          </p>
        </div>

        <button
          id="btn-go-add-product"
          onClick={() => navigate("/products/add")}
          style={{
            padding: "9px 18px",
            background: "var(--d-accent)",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            boxShadow: "0 2px 8px rgba(79,70,229,0.25)",
            transition: "background 0.15s, transform 0.1s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#4338CA";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--d-accent)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span>
          Add Product
        </button>
      </div>

      {/* ── Pricing KPI Stats Bar ─────────────────────────────── */}
      {!loading && !error && (
        <div
          className="animate-in res-grid-5"
          style={{
            marginBottom: "20px",
            animationDelay: "0.05s",
          }}
        >
          {[
            { label: "Total Products", value: stats.total },
            { label: "Cheapest", value: stats.cheapest },
            { label: "Competitive", value: stats.competitive },
            { label: "Overpriced", value: stats.overpriced },
            { label: "Needs Attention", value: stats.needsAttention },
          ].map((s, i) => (
            <div
              key={s.label}
              className="animate-in hover-lift"
              style={{ ...card, padding: "16px", animationDelay: `${i * 0.04}s` }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ margin: 0, fontSize: "11px", fontWeight: 500, color: "var(--d-text-3)", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  {s.label}
                </p>
              </div>
              <p style={{ margin: "10px 0 0", fontSize: "26px", fontWeight: 700, color: "var(--d-text)", letterSpacing: "-1px" }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── Main card: filters + table ──────────────────────── */}
      <div className="animate-in" style={{ ...card, animationDelay: "0.08s" }}>
        {/* ── Search & filter bar ──────────────────── */}
        {!loading && !error && products.length > 0 && (
          <div style={{ display: "flex", gap: "10px", marginBottom: "18px", flexWrap: "wrap" }}>
            {/* Search */}
            <div style={{ position: "relative", flex: "1", minWidth: "200px" }}>
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                id="input-products-search"
                type="text"
                placeholder="Search by title, category or keyword…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ ...inputStyle, paddingLeft: "34px", width: "100%", boxSizing: "border-box" }}
                onFocus={(e) => (e.target.style.borderColor = "var(--d-accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--d-border)")}
              />
            </div>

            {/* Status filter */}
            {["all", "active", "inactive"].map((val) => (
              <button
                key={val}
                id={`btn-filter-${val}`}
                onClick={() => setFilterStatus(val)}
                style={{
                  padding: "8px 14px",
                  border: "1px solid",
                  borderColor: filterStatus === val ? "var(--d-accent)" : "var(--d-border)",
                  borderRadius: "8px",
                  background: filterStatus === val ? "var(--d-accent-bg)" : "var(--d-surface)",
                  color: filterStatus === val ? "var(--d-accent)" : "var(--d-text-2)",
                  fontSize: "12px",
                  fontWeight: filterStatus === val ? 600 : 500,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  transition: "all 0.12s",
                  textTransform: "capitalize",
                }}
              >
                {val === "all" ? "All" : val.charAt(0).toUpperCase() + val.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* ── Loading state ─────────────────────────────────── */}
        {loading && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--d-text-3)", fontSize: "13px" }}>
            <div style={{ fontSize: "28px", marginBottom: "12px", opacity: 0.6 }}>⏳</div>
            Loading your products…
          </div>
        )}

        {/* ── Error state ───────────────────────────────────── */}
        {error && (
          <div
            style={{
              textAlign: "center",
              padding: "48px 0",
              color: "var(--d-danger)",
              fontSize: "13px",
            }}
          >
            <div style={{ fontSize: "28px", marginBottom: "12px" }}>⚠️</div>
            {error}
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────── */}
        {!loading && !error && products.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "64px 0",
              color: "var(--d-text-3)",
            }}
          >
            <div style={{ fontSize: "40px", marginBottom: "16px", opacity: 0.5 }}>
              📦
            </div>
            <p style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--d-text-2)" }}>
              No products yet
            </p>
            <p style={{ margin: "6px 0 0", fontSize: "13px" }}>
              {selectedStore
                ? `No products tracked for ${selectedStore.store_name}.`
                : "Add your first product to start tracking prices."}
            </p>
            <button
              onClick={() => navigate("/products/add")}
              style={{
                marginTop: "18px",
                padding: "9px 20px",
                background: "var(--d-accent)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              + Add Product
            </button>
          </div>
        )}

        {/* ── No search results ─────────────────────────────── */}
        {!loading && !error && products.length > 0 && filtered.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "48px 0",
              color: "var(--d-text-3)",
              fontSize: "13px",
            }}
          >
            <div style={{ fontSize: "28px", marginBottom: "12px", opacity: 0.5 }}>🔍</div>
            No products match your search.
          </div>
        )}

        {/* ── Product table ─────────────────────────────────── */}
        {!loading && !error && filtered.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "13px",
              }}
            >
              <thead>
                <tr>
                  {[
                    "Product",
                    "Category",
                    "Own Price",
                    "Cheapest Competitor",
                    "Competitors",
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        borderBottom: "1px solid var(--d-border)",
                        color: "var(--d-text-3)",
                        fontWeight: 600,
                        fontSize: "11px",
                        textTransform: "uppercase",
                        letterSpacing: "0.4px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => {
                  const kpi = kpisById[product.id];
                  const ownPrice =
                    kpi?.own_price != null
                      ? `${currency} ${Number(kpi.own_price).toFixed(2)}`
                      : product.own_cost != null
                        ? `${currency} ${Number(product.own_cost).toFixed(2)}`
                        : "—";
                  const cheapestComp =
                    kpi?.cheapest_competitor != null
                      ? `${currency} ${Number(kpi.cheapest_competitor).toFixed(2)}`
                      : "—";
                  const numCompetitors =
                    kpi?.num_competitors != null ? kpi.num_competitors : "—";
                  const rank =
                    kpi?.is_cheapest ? "1st" : kpi?.cheapest_competitor != null ? "2nd+" : null;

                  return (
                    <tr
                      key={product.id}
                      style={{
                        borderBottom: "1px solid var(--d-border)",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "var(--d-surface-2, rgba(255,255,255,0.03))")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      {/* Product */}
                      <td style={{ padding: "12px 12px", maxWidth: "260px" }}>
                        <div style={{
                          fontWeight: 600,
                          color: "var(--d-text)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "260px",
                        }}
                          title={product.title}
                        >
                          {product.search_keyword || product.title}
                        </div>
                        {product.search_keyword && product.search_keyword !== product.title && (
                          <div
                            style={{
                              fontSize: "11px",
                              color: "var(--d-text-3)",
                              marginTop: "2px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: "260px",
                            }}
                            title={product.title}
                          >
                            {product.title}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td style={{ padding: "12px 12px", color: "var(--d-text-2)" }}>
                        {product.category || "—"}
                      </td>

                      {/* Own Price */}
                      <td
                        style={{
                          padding: "12px 12px",
                          fontWeight: 600,
                          color: "var(--d-text)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {ownPrice}
                      </td>

                      {/* Cheapest Competitor */}
                      <td
                        style={{
                          padding: "12px 12px",
                          color:
                            kpi?.cheapest_competitor != null &&
                              kpi?.own_price != null &&
                              kpi.own_price > kpi.cheapest_competitor
                              ? "var(--d-danger)"
                              : "var(--d-text-2)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {cheapestComp}
                      </td>

                      {/* # Competitors */}
                      <td
                        style={{
                          padding: "12px 12px",
                          color: "var(--d-text-2)",
                          textAlign: "center",
                        }}
                      >
                        {numCompetitors}
                      </td>

                      {/* Status */}
                      <td style={{ padding: "12px 12px" }}>
                        <StatusBadge active={product.is_active} kpi={kpi} />
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "12px 12px" }}>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            id={`btn-view-${product.id}`}
                            onClick={() => navigate(`/products/${product.id}`)}
                            style={{
                              padding: "5px 12px",
                              background: "var(--d-accent-bg)",
                              color: "var(--d-accent)",
                              border: "1px solid var(--d-accent)",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: 600,
                              fontFamily: "inherit",
                              cursor: "pointer",
                              transition: "opacity 0.12s",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.75")}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                          >
                            View
                          </button>
                          <button
                            id={`btn-delete-${product.id}`}
                            onClick={() => handleDeleteProduct(product)}
                            style={{
                              padding: "5px 10px",
                              background: "transparent",
                              color: "var(--d-danger)",
                              border: "1px solid var(--d-danger)",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: 600,
                              fontFamily: "inherit",
                              cursor: "pointer",
                              transition: "opacity 0.12s",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default Products;