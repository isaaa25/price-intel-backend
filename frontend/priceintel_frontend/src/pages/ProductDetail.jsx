import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { useStore } from "../context/StoreContext";
import { getProduct, getProductKpis, getProductCompetitors } from "../api/products";

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
            {product.title}
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
                📁 {product.category}
              </span>
            )}
            {product.search_keyword && (
              <span style={{ fontSize: "12px", color: "var(--d-text-3)" }}>
                🔍 {product.search_keyword}
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

        {/* Open your own listing */}
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

      {/* ── KPI cards ────────────────────────────────────────── */}
      <div
        className="animate-in res-grid-4"
        style={{ marginBottom: "20px", animationDelay: "0.04s" }}
      >
        {[
          {
            label: "My Price",
            value: fmt(kpi?.own_price ?? product.own_cost),
            sub: "Your current listed price",
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
              ? "🏆 Cheapest"
              : isOverpriced
              ? "📈 Overpriced"
              : "⚡ Competitive",
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
    </Layout>
  );
}

export default ProductDetail;
