import { useNavigate, useLocation } from "react-router-dom";
import hero from "../assets/hero.png";

const NAV_ITEMS = [
    { label: "Dashboard", path: "/dashboard", icon: "▦" },
    { label: "Products", path: "/products", icon: "📦" },
    { label: "Competitors", path: "/competitors", icon: "👥" },
    { label: "Alerts", path: "/alerts", icon: "🔔" },
    { label: "Settings", path: "/settings", icon: "⚙️" },
];

function Layout({ children }) {
    const navigate = useNavigate();
    const location = useLocation();

    function handleLogout() {
        localStorage.removeItem("token");
        navigate("/");
    }

    return (
        <div style={{ minHeight: "100vh", display: "flex", background: "var(--dash-bg-gradient)" }}>
            {/* Sidebar */}
            <aside
                style={{
                    width: "220px",
                    backgroundColor: "var(--dash-sidebar)",
                    borderRight: "1px solid var(--dash-border)",
                    display: "flex",
                    flexDirection: "column",
                    padding: "20px 14px",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0 8px 24px" }}>
                    <img src={hero} alt="Price Intel" style={{ width: "26px", height: "26px" }} />
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: "15px" }}>Price Intel</span>
                </div>

                <div style={{ color: "var(--dash-text-muted)", fontSize: "10px", letterSpacing: "1px", padding: "0 8px 8px" }}>
                    MAIN MENU
                </div>

                <nav style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    {NAV_ITEMS.map((item) => {
                        const active = location.pathname === item.path ||
                       (item.path === "/products" && location.pathname.startsWith("/products"));
                        return (
                            <div
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "10px",
                                    padding: "10px 12px",
                                    borderRadius: "10px",
                                    cursor: "pointer",
                                    color: active ? "#fff" : "var(--dash-text-muted)",
                                    backgroundColor: active ? "var(--dash-accent)" : "transparent",
                                    fontSize: "13px",
                                    fontWeight: active ? 600 : 500,
                                    transition: "background-color 0.15s ease",
                                }}
                            >
                                <span>{item.icon}</span>
                                {item.label}
                            </div>
                        );
                    })}
                </nav>

                <div style={{ marginTop: "auto" }}>
                    <div
                        onClick={handleLogout}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            padding: "10px 12px",
                            borderRadius: "10px",
                            cursor: "pointer",
                            color: "var(--dash-text-muted)",
                            fontSize: "13px",
                        }}
                    >
                        <span>↩</span> Logout
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <main style={{ flex: 1, padding: "28px 32px", overflowY: "auto" }}>{children}</main>
        </div>
    );
}

export default Layout;