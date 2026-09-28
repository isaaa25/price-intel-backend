import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { useStore } from "../context/StoreContext";
import { getProduct, getProductKpis, getProductCompetitors, updateProduct } from "../api/products";

/* ── card style ─────────────────────────────────────────────── */
const card = {
  background: "var(--d-surface)",
  border: "1px solid var(--d-border)",
  borderRadius: "12px",
  padding: "20px",
};

/* ── platform icon map ───────────────────────────────────────── */
const PLATFORM_ICONS = {
  daraz: "🛒",
  amazon: "📦",
  aliexpress: "🔴",
  jumia: "🟠",
  carrefour: "🔵",
  lulu: "🟢",
};

function platformIcon(platform = "") {
  const key = platform.toLowerCase();
  if (key.includes("noon")) return null;
  for (const [name, icon] of Object.entries(PLATFORM_ICONS)) {
    if (key.includes(name)) return icon;
  }
  return null;
}

/* ── price delta badge ───────────────────────────────────────── */
function PriceDelta({ ownPrice, competitorPrice }) {
  if (ownPrice == null || competitorPrice == null) return null;
  const diff = competitorPrice - ownPrice;
  const pct = ((diff / ownPrice) * 100).toFixed(1);
  const cheaper = diff < 0; // competitor is cheaper than us
  return (
    <span
      style={{
        fontSize: "11px",
        fontWeight: 700,
        padding: "2px 7px",
        borderRadius: "20px",
        background: cheaper ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)",
        color: cheaper ? "var(--d-danger)" : "var(--d-success)",
        whiteSpace: "nowrap",
      }}
    >
      {cheaper ? `▼ ${Math.abs(pct)}% cheaper` : `▲ ${pct}% higher`}
    </span>
  );
}

function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currency } = useStore();

  const [product, setProduct] = useState(null);
  const [kpi, setKpi] = useState(null);
  const [competitors, setCompetitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ── edit modal state ─────────────────────────────────────── */
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    own_cost: "",
    category: "",
    own_url: "",
    search_keyword: "",
    is_active: true,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");

  function openEditModal() {
    if (!product) return;
    setEditForm({
      title: product.title || "",
      own_cost: product.own_cost != null ? String(product.own_cost) : "",
      category: product.category || "",
      own_url: product.own_url || "",
      search_keyword: product.search_keyword || "",
      is_active: product.is_active ?? true,
    });
    setEditError("");
    setEditSuccess("");
    setIsEditModalOpen(true);
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    setEditError("");
    setEditSuccess("");

    if (!editForm.title.trim()) {
      setEditError("Product name/title is required.");
      return;
    }
    const numericCost = parseFloat(editForm.own_cost);
    if (isNaN(numericCost) || numericCost < 0) {
      setEditError("Please enter a valid price.");
      return;
    }

    setSavingEdit(true);
    try {
      const updated = await updateProduct(id, {
        title: editForm.title.trim(),
        own_cost: numericCost,
        category: editForm.category.trim() || null,
        own_url: editForm.own_url.trim(),
        search_keyword: editForm.search_keyword.trim() || null,
        is_active: editForm.is_active,
      });
      setProduct(updated);
      const newKpi = await getProductKpis(id).catch(() => null);
      if (newKpi) setKpi(newKpi);
      setEditSuccess("Product updated successfully!");
      setTimeout(() => {
        setIsEditModalOpen(false);
        setEditSuccess("");
      }, 700);
    } catch (err) {
      setEditError(err.message || "Failed to update product.");
    } finally {
      setSavingEdit(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");

    Promise.all([
      getProduct(id),
      getProductKpis(id).catch(() => null),
      getProductCompetitors(id).catch(() => []),
    ])
      .then(([prod, kpiData, comps]) => {
        setProduct(prod);
        setKpi(kpiData);
        setCompetitors(Array.isArray(comps) ? comps : []);
      })
      .catch((err) => setError(err.message || "Failed to load product."))
      .finally(() => setLoading(false));
  }, [id]);

  /* ── loading ──────────────────────────────────────────────── */
  if (loading) {
    return (
      <Layout>
        <div
          style={{
            textAlign: "center",
            padding: "80px 0",
            color: "var(--d-text-3)",
            fontSize: "13px",
          }}
        >
          <div style={{ fontSize: "32px", marginBottom: "12px", opacity: 0.6 }}>⏳</div>
          Loading product…
        </div>
      </Layout>
    );
  }

  /* ── error ────────────────────────────────────────────────── */
  if (error || !product) {
    return (
      <Layout>
        <div
          style={{
            textAlign: "center",
            padding: "80px 0",
            color: "var(--d-danger)",
            fontSize: "13px",
          }}
        >
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>⚠️</div>
          {error || "Product not found."}
          <br />
          <button
            onClick={() => navigate("/products")}
            style={{
              marginTop: "16px",
              padding: "8px 18px",
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
            ← Back to Products
          </button>
        </div>
      </Layout>
    );
  }

  const fmt = (price) =>
    price != null ? `${currency} ${Number(price).toFixed(2)}` : "—";

  const isCheapest = kpi?.is_cheapest;
  const isOverpriced =
    kpi?.own_price != null &&
    kpi?.cheapest_competitor != null &&
    kpi.own_price > kpi.cheapest_competitor;

  return (
    <Layout>
      {/* ── Back button + header ──────────────────────────────── */}
      <div className="res-page-header animate-in" style={{ marginBottom: "20px" }}>
        <div>
          <button
            onClick={() => navigate("/products")}
            style={{
              background: "none",
              border: "none",
              color: "var(--d-text-3)",
              cursor: "pointer",
              fontSize: "13px",
              padding: "0 0 6px 0",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            ← Back to Products
          </button>
          <h1
            style={{
              margin: "4px 0 0",
              fontSize: "18px",
              fontWeight: 700,
              color: "var(--d-text)",
              letterSpacing: "-0.3px",
              maxWidth: "700px",
            }}
          >
            {product.search_keyword || product.title}
          </h1>
          <div
            style={{
              marginTop: "6px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            {product.category && (
              <span style={{ fontSize: "12px", color: "var(--d-text-3)" }}>
                {product.category}
              </span>
            )}
            {product.search_keyword && product.search_keyword !== product.title && (
              <span style={{ fontSize: "12px", color: "var(--d-text-3)" }} title={product.title}>
                {product.title}
              </span>
            )}
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: product.is_active ? "var(--d-success)" : "var(--d-danger)",
              }}
            >
              {product.is_active ? "● Active" : "● Inactive"}
            </span>
          </div>
        </div>

        {/* Action Buttons: Edit Product & View Listing */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={openEditModal}
            style={{
              padding: "9px 16px",
              background: "var(--d-surface)",
              color: "var(--d-text)",
              border: "1px solid var(--d-border)",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              whiteSpace: "nowrap",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--d-accent)";
              e.currentTarget.style.color = "var(--d-accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--d-border)";
              e.currentTarget.style.color = "var(--d-text)";
            }}
          >
            ✏️ Edit Product
          </button>

          {product.own_url && (
            <a
              href={product.own_url}
              target="_blank"
              rel="noopener noreferrer"
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
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 2px 8px rgba(79,70,229,0.25)",
                whiteSpace: "nowrap",
              }}
            >
              🔗 View My Listing
            </a>
          )}
        </div>
      </div>

      {/* ── KPI cards ────────────────────────────────────────── */}
      <div
        className="animate-in res-grid-4"
        style={{ marginBottom: "20px", animationDelay: "0.04s" }}
      >
        {[
          {
            label: "My Price",
            value: fmt(kpi?.own_price ?? product.own_cost),
            sub: "",
            color: "var(--d-text)",
          },
          {
            label: "Cheapest Competitor",
            value: fmt(kpi?.cheapest_competitor),
            sub:
              kpi?.cheapest_competitor != null
                ? isOverpriced
                  ? "⚠️ You're priced higher"
                  : "✅ You're competitive"
                : "No competitor data yet",
            color: isOverpriced ? "var(--d-danger)" : "var(--d-success)",
          },
          {
            label: "Active Competitors",
            value: kpi?.num_competitors ?? competitors.length,
            sub: "Listings tracked",
            color: "var(--d-text)",
          },
          {
            label: "Price Position",
            value: isCheapest
              ? "Cheapest"
              : isOverpriced
                ? "Overpriced"
                : "Competitive",
            sub: isCheapest
              ? "You have the lowest price"
              : isOverpriced
                ? "Competitors are cheaper"
                : "Within competitive range",
            color: isCheapest
              ? "var(--d-success)"
              : isOverpriced
                ? "var(--d-danger)"
                : "var(--d-text)",
          },
        ].map((s, i) => (
          <div
            key={s.label}
            className="animate-in hover-lift"
            style={{ ...card, padding: "16px 20px", animationDelay: `${i * 0.04}s` }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "11px",
                fontWeight: 500,
                color: "var(--d-text-3)",
                textTransform: "uppercase",
                letterSpacing: "0.4px",
              }}
            >
              {s.label}
            </p>
            <p
              style={{
                margin: "10px 0 4px",
                fontSize: "22px",
                fontWeight: 700,
                color: s.color,
                letterSpacing: "-0.5px",
              }}
            >
              {s.value}
            </p>
            <p style={{ margin: 0, fontSize: "11px", color: "var(--d-text-3)" }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Competitor listings table ────────────────────────── */}
      <div className="animate-in" style={{ ...card, animationDelay: "0.12s" }}>
        <h2
          style={{
            margin: "0 0 16px",
            fontSize: "15px",
            fontWeight: 700,
            color: "var(--d-text)",
          }}
        >
          Competitor Listings
          {competitors.length > 0 && (
            <span
              style={{
                marginLeft: "8px",
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--d-text-3)",
                background: "var(--d-border)",
                padding: "2px 8px",
                borderRadius: "20px",
              }}
            >
              {competitors.length}
            </span>
          )}
        </h2>

        {competitors.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "48px 0",
              color: "var(--d-text-3)",
              fontSize: "13px",
            }}
          >
            <div style={{ fontSize: "32px", marginBottom: "12px", opacity: 0.4 }}>🔍</div>
            <p style={{ margin: 0, fontWeight: 600, color: "var(--d-text-2)" }}>
              No competitors found yet
            </p>
            <p style={{ margin: "4px 0 0", fontSize: "12px" }}>
              Competitor listings are discovered automatically when the scraper runs.
            </p>
          </div>
        ) : (
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
                    "Platform",
                    "Product Name",
                    "Their Price",
                    "vs Your Price",
                    "Last Scraped",
                    "Action",
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
                {competitors.map((comp) => (
                  <tr
                    key={comp.id}
                    style={{
                      borderBottom: "1px solid var(--d-border)",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "var(--d-surface-2, rgba(255,255,255,0.03))")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    {/* Platform */}
                    <td style={{ padding: "12px 12px", whiteSpace: "nowrap" }}>
                      {platformIcon(comp.platform) && (
                        <span style={{ fontSize: "16px", marginRight: "6px" }}>
                          {platformIcon(comp.platform)}
                        </span>
                      )}
                      <span
                        style={{
                          fontWeight: 600,
                          color: "var(--d-text)",
                          textTransform: "capitalize",
                        }}
                      >
                        {comp.platform || "Unknown"}
                      </span>
                    </td>

                    {/* Name */}
                    <td
                      style={{
                        padding: "12px 12px",
                        color: "var(--d-text-2)",
                        maxWidth: "260px",
                      }}
                    >
                      <div
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "260px",
                        }}
                        title={comp.name || ""}
                      >
                        {comp.name || (
                          <em style={{ color: "var(--d-text-3)" }}>Not scraped yet</em>
                        )}
                      </div>
                    </td>

                    {/* Their price */}
                    <td
                      style={{
                        padding: "12px 12px",
                        fontWeight: 700,
                        color:
                          comp.latest_price != null &&
                            (kpi?.own_price ?? product.own_cost) != null &&
                            comp.latest_price < (kpi?.own_price ?? product.own_cost)
                            ? "var(--d-danger)"
                            : "var(--d-text)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fmt(comp.latest_price)}
                    </td>

                    {/* vs your price */}
                    <td style={{ padding: "12px 12px", whiteSpace: "nowrap" }}>
                      <PriceDelta
                        ownPrice={kpi?.own_price ?? product.own_cost}
                        competitorPrice={comp.latest_price}
                      />
                    </td>

                    {/* Last scraped */}
                    <td
                      style={{
                        padding: "12px 12px",
                        color: "var(--d-text-3)",
                        fontSize: "12px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {comp.last_scraped_at
                        ? new Date(comp.last_scraped_at).toLocaleDateString()
                        : "Never"}
                    </td>

                    {/* Action — opens the REAL competitor listing on Noon/Daraz/etc */}
                    <td style={{ padding: "12px 12px" }}>
                      <a
                        href={comp.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "5px 12px",
                          background: "var(--d-accent-bg)",
                          color: "var(--d-accent)",
                          border: "1px solid var(--d-accent)",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: 600,
                          fontFamily: "inherit",
                          textDecoration: "none",
                          whiteSpace: "nowrap",
                          transition: "opacity 0.12s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.75")}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                      >
                        🔗 View on {comp.platform || "Site"}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Edit Product Modal ───────────────────────────────── */}
      {isEditModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingEdit) {
              setIsEditModalOpen(false);
            }
          }}
        >
          <div
            style={{
              background: "var(--d-surface)",
              border: "1px solid var(--d-border)",
              borderRadius: "14px",
              width: "100%",
              maxWidth: "520px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid var(--d-border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--d-text)" }}>
                  ✏️ Edit Product
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--d-text-3)" }}>
                  Update name, price, URL, category, or discovery search keyword.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !savingEdit && setIsEditModalOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--d-text-3)",
                  cursor: "pointer",
                  fontSize: "18px",
                  padding: "4px",
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEdit} style={{ padding: "20px 24px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {/* Product Name */}
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--d-text-2)" }}>
                    Product Name / Title <span style={{ color: "var(--d-danger)" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Smart Watch Series 9"
                    required
                    style={{
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--d-border)",
                      background: "var(--d-bg)",
                      color: "var(--d-text)",
                      fontSize: "13px",
                      fontFamily: "inherit",
                      outline: "none",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--d-accent)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--d-border)")}
                  />
                </div>

                {/* My Price + Currency */}
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--d-text-2)" }}>
                    My Price ({currency || "Cost"}) <span style={{ color: "var(--d-danger)" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <span
                      style={{
                        position: "absolute",
                        left: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "var(--d-text-3)",
                        fontSize: "12px",
                        fontWeight: 600,
                        pointerEvents: "none",
                      }}
                    >
                      {currency}
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={editForm.own_cost}
                      onChange={(e) => setEditForm((f) => ({ ...f, own_cost: e.target.value }))}
                      placeholder="2500.00"
                      required
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: `9px 12px 9px ${currency ? currency.length * 9 + 20 : 36}px`,
                        borderRadius: "8px",
                        border: "1px solid var(--d-border)",
                        background: "var(--d-bg)",
                        color: "var(--d-text)",
                        fontSize: "13px",
                        fontFamily: "inherit",
                        outline: "none",
                      }}
                      onFocus={(e) => (e.target.style.borderColor = "var(--d-accent)")}
                      onBlur={(e) => (e.target.style.borderColor = "var(--d-border)")}
                    />
                  </div>
                </div>

                {/* Category & Status Row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: "12px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--d-text-2)" }}>
                      Category (Optional)
                    </label>
                    <input
                      type="text"
                      value={editForm.category}
                      onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                      placeholder="e.g. Electronics"
                      style={{
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--d-border)",
                        background: "var(--d-bg)",
                        color: "var(--d-text)",
                        fontSize: "13px",
                        fontFamily: "inherit",
                        outline: "none",
                      }}
                      onFocus={(e) => (e.target.style.borderColor = "var(--d-accent)")}
                      onBlur={(e) => (e.target.style.borderColor = "var(--d-border)")}
                    />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--d-text-2)" }}>
                      Status
                    </label>
                    <select
                      value={editForm.is_active ? "true" : "false"}
                      onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.value === "true" }))}
                      style={{
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--d-border)",
                        background: "var(--d-bg)",
                        color: "var(--d-text)",
                        fontSize: "13px",
                        fontFamily: "inherit",
                        outline: "none",
                        cursor: "pointer",
                      }}
                    >
                      <option value="true">● Active</option>
                      <option value="false">○ Inactive</option>
                    </select>
                  </div>
                </div>

                {/* Product URL */}
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--d-text-2)" }}>
                    Product Listing URL <span style={{ color: "var(--d-danger)" }}>*</span>
                  </label>
                  <input
                    type="url"
                    value={editForm.own_url}
                    onChange={(e) => setEditForm((f) => ({ ...f, own_url: e.target.value }))}
                    placeholder="https://..."
                    required
                    style={{
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--d-border)",
                      background: "var(--d-bg)",
                      color: "var(--d-text)",
                      fontSize: "13px",
                      fontFamily: "inherit",
                      outline: "none",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--d-accent)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--d-border)")}
                  />
                </div>

                {/* Search Keyword */}
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--d-text-2)" }}>
                      Search Keyword (Optional)
                    </label>
                    <span style={{ fontSize: "11px", color: "var(--d-text-3)" }}>
                      Used for scraper search discovery
                    </span>
                  </div>
                  <input
                    type="text"
                    value={editForm.search_keyword}
                    onChange={(e) => setEditForm((f) => ({ ...f, search_keyword: e.target.value }))}
                    placeholder="Leave blank to auto-generate from title"
                    style={{
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--d-border)",
                      background: "var(--d-bg)",
                      color: "var(--d-text)",
                      fontSize: "13px",
                      fontFamily: "inherit",
                      outline: "none",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--d-accent)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--d-border)")}
                  />
                </div>
              </div>

              {/* Status feedback */}
              {editError && (
                <div style={{ marginTop: "14px", padding: "8px 12px", borderRadius: "6px", background: "rgba(239,68,68,0.1)", color: "var(--d-danger)", fontSize: "12.5px" }}>
                  ⚠️ {editError}
                </div>
              )}
              {editSuccess && (
                <div style={{ marginTop: "14px", padding: "8px 12px", borderRadius: "6px", background: "rgba(34,197,94,0.1)", color: "var(--d-success)", fontSize: "12.5px" }}>
                  ✓ {editSuccess}
                </div>
              )}

              {/* Action Buttons */}
              <div
                style={{
                  marginTop: "20px",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                }}
              >
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={() => setIsEditModalOpen(false)}
                  style={{
                    padding: "9px 16px",
                    background: "var(--d-bg)",
                    color: "var(--d-text-2)",
                    border: "1px solid var(--d-border)",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  style={{
                    padding: "9px 20px",
                    background: "var(--d-accent)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    boxShadow: "0 2px 8px rgba(79,70,229,0.25)",
                    opacity: savingEdit ? 0.7 : 1,
                  }}
                >
                  {savingEdit ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default ProductDetail;
