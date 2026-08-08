// src/components/Layout.jsx
import { useNavigate, useLocation } from "react-router-dom";

// Top Menu Items
const NAV_ITEMS = [
  { label: "Dashboard", path: "/dashboard", icon: "⊞" },
  { label: "Products", path: "/products/add", icon: "📦" },
  { label: "Competitors", path: "/competitors", icon: "👥" },
  { label: "Alerts", path: "/alerts", icon: "🔔" },
  { label: "Reports", path: "/reports", icon: "📊" },
];

// Bottom Nav Items (above Logout)
const BOTTOM_NAV = [
  { label: "Account", path: "/account", icon: "👤" },
  { label: "Settings", path: "/settings", icon: "⚙️" },
  { label: "Help", path: "/help", icon: "❓" },
];

function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() {
    localStorage.removeItem("token");
    navigate("/");
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "var(--d-bg)", fontFamily: "'Inter', sans-serif" }}>
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside style={{ width: "220px", flexShrink: 0, background: "var(--d-sidebar)", borderRight: "1px solid var(--d-border)", display: "flex", flexDirection: "column", padding: "20px 12px", position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>

        {/* Brand Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "4px 10px 24px" }}>
          <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "var(--d-accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "12px" }}>
            PI
          </div>
          <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--d-text)" }}>Price Intel</span>
        </div>

        <div style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.8px", color: "var(--d-text-3)", padding: "0 10px 8px", textTransform: "uppercase" }}>
          Menu
        </div>

        {/* Top Nav Items */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.path;
            return (
              <div
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "9px 10px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  color: active ? "var(--d-accent)" : "var(--d-text-2)",
                  background: active ? "var(--d-accent-bg)" : "transparent",
                  fontSize: "13px",
                  fontWeight: active ? 600 : 400,
                  transition: "background 0.12s ease, color 0.12s ease",
                }}
              >
                <span style={{ fontSize: "14px", width: "18px", textAlign: "center" }}>{item.icon}</span>
                {item.label}
              </div>
            );
          })}
        </nav>

        {/* Bottom Section (Account, Settings, Help, Logout) */}
        <div style={{ marginTop: "auto", paddingTop: "12px", borderTop: "1px solid var(--d-border)", display: "flex", flexDirection: "column", gap: "2px" }}>
          {BOTTOM_NAV.map((item) => {
            const active = location.pathname === item.path;
            return (
              <div
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  color: active ? "var(--d-accent)" : "var(--d-text-2)",
                  background: active ? "var(--d-accent-bg)" : "transparent",
                  fontSize: "13px",
                  fontWeight: active ? 600 : 400,
                }}
              >
                <span style={{ fontSize: "14px", width: "18px", textAlign: "center" }}>{item.icon}</span>
                {item.label}
              </div>
            );
          })}

          {/* Logout Button */}
          <div
            onClick={handleLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "8px 10px",
              borderRadius: "8px",
              cursor: "pointer",
              color: "var(--d-danger)",
              background: "var(--d-danger-bg)",
              fontSize: "13px",
              fontWeight: 500,
              marginTop: "4px",
            }}
          >
            <span style={{ fontSize: "14px", width: "18px", textAlign: "center" }}>↩</span> Logout
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: "32px 36px", overflowY: "auto", minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}

export default Layout;
