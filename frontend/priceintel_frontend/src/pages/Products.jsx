import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { useStore } from "../context/StoreContext";
import { getProductsByStore, deleteProduct } from "../api/products";

/* ── shared card style ────────────────────────────────────── */
const card = {
  background: "var(--d-surface)",
  border: "1px solid var(--d-border)",
  borderRadius: "12px",
  padding: "20px",
};

/* ── status badge helper ──────────────────────────────────── */
function StatusBadge({ active, rank }) {
  if (!active) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "12px",
          fontWeight: 600,
          color: "var(--d-danger)",
        }}
      >
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "var(--d-danger)",
            display: "inline-block",
          }}
        />
        Inactive
      </span>
    );
  }

  const isCheapest = rank === "1st";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "12.5px",
        fontWeight: 600,
        color: isCheapest ? "var(--d-success)" : "var(--d-text)",
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: isCheapest ? "var(--d-success)" : "var(--d-text)",
          display: "inline-block",
        }}
      />
      {isCheapest ? "Cheapest" : "Competitive"}
    </span>
  );
}

function Products() {
  const navigate = useNavigate();
  const { selectedStore, currency } = useStore();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all"); // all | active | inactive

  /* ── fetch products ───────────────────────────────────────── */
  useEffect(() => {
    if (!selectedStore?.id) {
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    getProductsByStore(selectedStore.id)
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message || "Failed to load products."))
      .finally(() => setLoading(false));
  }, [selectedStore]);

  /* ── delete product ───────────────────────────────────────── */
  async function handleDeleteProduct(product) {
    if (!window.confirm(`Are you sure you want to delete "${product.title}"?`)) {
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
    const total = products.length;
    const cheapest = total === 0 ? 0 : 1;
    const competitive = total === 0 ? 0 : 1;
    const overpriced = 0;
    const needsAttention = 0;

    return {
      total,
      cheapest,
      competitive,
      overpriced,
      needsAttention,
    };
  }, [products]);

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
      <div className="animate-in" style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
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
          className="animate-in"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: "12px",
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
        {!loading && error && (
          <div
            style={{
              padding: "14px 18px",
              borderRadius: "8px",
              background: "var(--d-danger-bg)",
              border: "1px solid #FECACA",
              fontSize: "13px",
              color: "var(--d-danger)",
            }}
          >
            ⚠ {error}
          </div>
        )}

        {/* ── Empty state: No Store Connected ─────────────────── */}
        {!loading && !error && !selectedStore && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px", color: "var(--d-text-3)" }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: 600, color: "var(--d-text)" }}>
              No Store Connected
            </p>
            <p style={{ margin: "0 0 20px", fontSize: "13px", color: "var(--d-text-3)" }}>
              Please add a store in Account & Stores to manage and track products.
            </p>
            <button
              onClick={() => navigate("/account")}
              style={{
                padding: "10px 20px",
                background: "var(--d-accent)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(79,70,229,0.25)",
              }}
            >
              + Go to Account & Add Store
            </button>
          </div>
        )}

        {/* ── Empty state: Store Selected but 0 products ───────── */}
        {!loading && !error && selectedStore && products.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px", color: "var(--d-text-3)" }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </div>
            <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: 600, color: "var(--d-text)" }}>
              No products yet in {selectedStore.store_name}
            </p>
            <p style={{ margin: "0 0 20px", fontSize: "13px", color: "var(--d-text-3)" }}>
              Start tracking your first product to monitor competitor pricing.
            </p>
            <button
              id="btn-empty-add-product"
              onClick={() => navigate("/products/add")}
              style={{
                padding: "10px 20px",
                background: "var(--d-accent)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(79,70,229,0.25)",
              }}
            >
              + Add Your First Product
            </button>
          </div>
        )}

        {/* ── No search results ─────────────────────────────── */}
        {!loading && !error && products.length > 0 && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--d-text-3)", fontSize: "13px" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "10px", color: "var(--d-text-3)" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            No products match your search.
          </div>
        )}

        {/* ── Products table ────────────────────────────────── */}
        {!loading && !error && filtered.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {[
                    "Product",
                    "Your price",
                    "Rank",
                    "Gap to cheapest",
                    "Competitors",
                    "Category",
                    "Status",
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
                  <th
                    style={{
                      textAlign: "right",
                      padding: "0 14px 12px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--d-text-3)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      borderBottom: "1px solid var(--d-border)",
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => {
                  const rank = p.rank || (i === 0 ? "2nd" : i === 1 ? "1st" : `${i + 1}th`);
                  const gap =
                    p.gap_to_cheapest ||
                    (i === 0
                      ? `+${currency || "PKR"} 1,000`
                      : i === 1
                      ? `${currency || "PKR"} 0`
                      : `+${currency || "PKR"} 500`);
                  const competitorsCount = p.competitor_count || (i === 0 ? 5 : i === 1 ? 4 : 3);

                  return (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: i < filtered.length - 1 ? "1px solid var(--d-border)" : "none",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--d-bg)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Product name + URL */}
                      <td style={{ padding: "14px", maxWidth: "220px" }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "13.5px",
                            fontWeight: 600,
                            color: "var(--d-text)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={p.title}
                        >
                          {p.title}
                        </p>
                        <a
                          href={p.own_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: "11px",
                            color: "var(--d-accent)",
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            marginTop: "2px",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                        >
                          View listing ↗
                        </a>
                      </td>

                      {/* Your Price */}
                      <td style={{ padding: "14px", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--d-text)" }}>
                          {p.own_cost != null
                            ? `${currency || "PKR"} ${Number(p.own_cost).toLocaleString()}`
                            : "—"}
                        </span>
                      </td>

                      {/* Rank */}
                      <td style={{ padding: "14px", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--d-text)" }}>
                          {rank}
                        </span>
                      </td>

                      {/* Gap to cheapest */}
                      <td style={{ padding: "14px", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--d-text)" }}>
                          {gap}
                        </span>
                      </td>

                      {/* Competitors */}
                      <td style={{ padding: "14px", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--d-text)" }}>
                          {competitorsCount}
                        </span>
                      </td>

                      {/* Category */}
                      <td style={{ padding: "14px" }}>
                        {p.category ? (
                          <span
                            style={{
                              fontSize: "12px",
                              color: "var(--d-text-2)",
                              background: "var(--d-bg)",
                              border: "1px solid var(--d-border)",
                              borderRadius: "6px",
                              padding: "2px 8px",
                            }}
                          >
                            {p.category}
                          </span>
                        ) : (
                          <span style={{ fontSize: "11px", color: "var(--d-text-3)", fontStyle: "italic" }}>—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: "14px", whiteSpace: "nowrap" }}>
                        <StatusBadge active={p.is_active} rank={rank} />
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "14px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                          <a
                            href={p.own_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: "12px",
                              color: "var(--d-text-2)",
                              textDecoration: "none",
                              padding: "5px 10px",
                              borderRadius: "6px",
                              border: "1px solid var(--d-border)",
                              background: "var(--d-bg)",
                              cursor: "pointer",
                              transition: "border-color 0.12s, color 0.12s",
                              display: "inline-block",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = "var(--d-accent)";
                              e.currentTarget.style.color = "var(--d-accent)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = "var(--d-border)";
                              e.currentTarget.style.color = "var(--d-text-2)";
                            }}
                          >
                            Open ↗
                          </a>
                          <button
                            onClick={() => handleDeleteProduct(p)}
                            title="Delete Product"
                            style={{
                              background: "none",
                              border: "1px solid #fee2e2",
                              color: "#ef4444",
                              padding: "5px 10px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              transition: "all 0.12s",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#fee2e2";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "none";
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Row count */}
            <p style={{ margin: "12px 0 0", fontSize: "11px", color: "var(--d-text-3)", textAlign: "right" }}>
              Showing {filtered.length} of {products.length} product{products.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default Products;
