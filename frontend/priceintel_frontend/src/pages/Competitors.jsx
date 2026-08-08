import Layout from "../components/Layout";

const card = {
  background: "var(--d-surface)",
  border: "1px solid var(--d-border)",
  borderRadius: "12px",
  padding: "24px",
};

/* ── Placeholder competitor rows ────────────────────────── */
const placeholderCompetitors = [
  { name: "TechHub Store", marketplace: "noon", products: 12, lastSeen: "2 min ago", priceAvg: "AED 220" },
  { name: "GadgetWorld UAE", marketplace: "noon", products: 8, lastSeen: "15 min ago", priceAvg: "AED 195" },
  { name: "MegaSeller PK", marketplace: "daraz", products: 5, lastSeen: "1 hr ago", priceAvg: "PKR 8,500" },
  { name: "ElectroMart", marketplace: "noon", products: 3, lastSeen: "3 hrs ago", priceAvg: "AED 210" },
];

function MarketplaceBadge({ marketplace }) {
  const colors = {
    noon: { bg: "#FFF7ED", color: "#C2410C" },
    daraz: { bg: "#FFF0F0", color: "#E11D48" },
  };
  const c = colors[marketplace] || { bg: "var(--d-accent-bg)", color: "var(--d-accent)" };
  return (
    <span style={{ padding: "2px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 600, background: c.bg, color: c.color, textTransform: "capitalize" }}>
      {marketplace}
    </span>
  );
}

function Competitors() {
  return (
    <Layout>
      {/* ── Page header ────────────────────────────────── */}
      <div className="animate-in" style={{ marginBottom: "28px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--d-text)", letterSpacing: "-0.3px" }}>
            Competitors
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--d-text-2)" }}>
            Sellers competing against your products across marketplaces.
          </p>
        </div>

      </div>

      {/* ── Stats row ──────────────────────────────────── */}
      <div className="animate-in" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "20px", animationDelay: "0.05s" }}>
        {[
          { label: "Tracked Competitors", value: "—", icon: "👥", color: "var(--d-accent)", bg: "var(--d-accent-bg)" },
          { label: "Price Drops Detected", value: "—", icon: "↓", color: "var(--d-danger)", bg: "var(--d-danger-bg)" },
          { label: "Stock-out Events", value: "—", icon: "⚠", color: "var(--d-warning)", bg: "var(--d-warning-bg)" },
        ].map((s, i) => (
          <div key={s.label} className="animate-in" style={{ ...card, padding: "16px", animationDelay: `${i * 0.05}s` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ margin: 0, fontSize: "11px", fontWeight: 500, color: "var(--d-text-3)", textTransform: "uppercase", letterSpacing: "0.4px" }}>{s.label}</p>
              <span style={{ width: "28px", height: "28px", borderRadius: "7px", background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>{s.icon}</span>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: "26px", fontWeight: 700, color: "var(--d-text-3)", letterSpacing: "-1px" }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Competitors table (placeholder) ────────────── */}
      <div className="animate-in" style={{ ...card, animationDelay: "0.12s" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--d-text)" }}>Detected Sellers</h2>
            <p style={{ margin: "3px 0 0", fontSize: "12px", color: "var(--d-text-3)" }}>Sellers found competing on your tracked products</p>
          </div>
        </div>


        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Seller", "Marketplace", "Products vs You", "Avg. Price", "Last Seen"].map((col) => (
                  <th key={col} style={{ textAlign: "left", padding: "0 14px 12px", fontSize: "11px", fontWeight: 600, color: "var(--d-text-3)", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid var(--d-border)" }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {placeholderCompetitors.map((c, i) => (
                <tr
                  key={c.name}
                  style={{ borderBottom: i < placeholderCompetitors.length - 1 ? "1px solid var(--d-border)" : "none", opacity: 0.6, transition: "background 0.1s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--d-bg)"; e.currentTarget.style.opacity = "1"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.opacity = "0.6"; }}
                >
                  <td style={{ padding: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "var(--d-accent-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>👤</div>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--d-text)" }}>{c.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "14px" }}><MarketplaceBadge marketplace={c.marketplace} /></td>
                  <td style={{ padding: "14px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--d-text)" }}>{c.products}</span>
                    <span style={{ fontSize: "12px", color: "var(--d-text-3)" }}> products</span>
                  </td>
                  <td style={{ padding: "14px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--d-text)" }}>{c.priceAvg}</span>
                  </td>
                  <td style={{ padding: "14px" }}>
                    <span style={{ fontSize: "12px", color: "var(--d-text-3)" }}>{c.lastSeen}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}

export default Competitors;
