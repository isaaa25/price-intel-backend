import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { getProducts } from "../api/products";

/* ── shared card style ────────────────────────────────────── */
const card = {
  background: "var(--d-surface)",
  border: "1px solid var(--d-border)",
  borderRadius: "12px",
  padding: "20px",
};

/* ── badge helper ─────────────────────────────────────────── */
function Badge({ active }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "3px 10px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 600,
        background: active ? "var(--d-success-bg)" : "var(--d-danger-bg)",
        color: active ? "var(--d-success)" : "var(--d-danger)",
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: active ? "var(--d-success)" : "var(--d-danger)",
          display: "inline-block",
        }}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

/* ── keyword chip ─────────────────────────────────────────── */
function KeywordChip({ keyword }) {
  if (!keyword) {
    return (
      <span
        style={{
          fontSize: "11px",
          color: "var(--d-text-3)",
          fontStyle: "italic",
        }}
      >
        Pending…
      </span>
    );
  }
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "6px",
        fontSize: "11px",
        fontWeight: 500,
        background: "var(--d-accent-bg)",
        color: "var(--d-accent)",
        maxWidth: "160px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
      title={keyword}
    >
      {keyword}
    </span>
  );
}

function Products() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all"); // all | active | inactive

  /* ── fetch products ───────────────────────────────────────── */
  useEffect(() => {
    getProducts()
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message || "Failed to load products."))
      .finally(() => setLoading(false));
  }, []);

  /* ── derived stats ────────────────────────────────────────── */
  const stats = useMemo(() => {
    const total = products.length;
    const active = products.filter((p) => p.is_active).length;
    const withKeyword = products.filter((p) => p.search_keyword).length;
    return { total, active, inactive: total - active, withKeyword };
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

  /* ── input style ──────────────────────────────────────────── */
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
            All products you're tracking across marketplaces.
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

      {/* ── Stats bar ───────────────────────────────────────── */}
      {!loading && !error && (
        <div
          className="animate-in"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "12px",
            marginBottom: "20px",
            animationDelay: "0.05s",
          }}
        >
          {[
            { label: "Total Products", value: stats.total, icon: "📦", color: "var(--d-accent)", bg: "var(--d-accent-bg)" },
            { label: "Active", value: stats.active, icon: "✅", color: "var(--d-success)", bg: "var(--d-success-bg)" },
            { label: "Inactive", value: stats.inactive, icon: "⏸", color: "var(--d-danger)", bg: "var(--d-danger-bg)" },
            { label: "AI Keywords Ready", value: stats.withKeyword, icon: "🤖", color: "#7C3AED", bg: "#F5F3FF" },
          ].map((s, i) => (
            <div
              key={s.label}
              className="animate-in hover-lift"
              style={{ ...card, padding: "16px", animationDelay: `${i * 0.05}s` }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ margin: 0, fontSize: "11px", fontWeight: 500, color: "var(--d-text-3)", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  {s.label}
                </p>
                <span style={{ width: "28px", height: "28px", borderRadius: "7px", background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px" }}>
                  {s.icon}
                </span>
              </div>
              <p style={{ margin: "10px 0 0", fontSize: "26px", fontWeight: 700, color: "var(--d-text)", letterSpacing: "-1px" }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── Main card: filters + table ──────────────────────── */}
      <div className="animate-in" style={{ ...card, animationDelay: "0.12s" }}>
        {/* ── Search & filter bar ──────────────────────────── */}
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
                  fontSize: "13px",
                  pointerEvents: "none",
                }}
              >
                🔍
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

        {/* ── Empty state ───────────────────────────────────── */}
        {!loading && !error && products.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>📦</div>
            <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: 600, color: "var(--d-text)" }}>
              No products yet
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
            <div style={{ fontSize: "28px", marginBottom: "10px" }}>🔍</div>
            No products match your search.
          </div>
        )}

        {/* ── Products table ────────────────────────────────── */}
        {!loading && !error && filtered.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Product", "Your Price", "Category", "AI Keyword", "Status"].map((col) => (
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
                {filtered.map((p, i) => (
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
                    <td style={{ padding: "14px", maxWidth: "240px" }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "13px",
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

                    {/* Price */}
                    <td style={{ padding: "14px", whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--d-text)" }}>
                        {p.own_cost != null
                          ? `AED ${parseFloat(p.own_cost).toFixed(2)}`
                          : <span style={{ color: "var(--d-text-3)", fontStyle: "italic", fontWeight: 400, fontSize: "12px" }}>—</span>
                        }
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

                    {/* AI Keyword */}
                    <td style={{ padding: "14px" }}>
                      <KeywordChip keyword={p.search_keyword} />
                    </td>

                    {/* Status */}
                    <td style={{ padding: "14px" }}>
                      <Badge active={p.is_active} />
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "14px", textAlign: "right", whiteSpace: "nowrap" }}>
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
                    </td>
                  </tr>
                ))}
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
