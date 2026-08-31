// src/pages/Reports.jsx
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { useStore } from "../context/StoreContext";

const cardStyle = {
    background: "var(--d-surface)",
    border: "1px solid var(--d-border)",
    borderRadius: "12px",
    padding: "24px",
};

function Reports() {
    const navigate = useNavigate();
    const { selectedStore } = useStore();

    return (
        <Layout>
            {/* ── Page Header ────────────────────────────────────────── */}
            <div className="animate-in" style={{ marginBottom: "28px" }}>
                <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--d-text)", letterSpacing: "-0.3px" }}>
                    Reports
                </h1>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--d-text-2)" }}>
                    Export pricing history, competitor trends, and market analytics reports.
                </p>
            </div>

            {!selectedStore ? (
                <div
                    className="animate-in"
                    style={{
                        ...cardStyle,
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
                            <line x1="18" y1="20" x2="18" y2="10" />
                            <line x1="12" y1="20" x2="12" y2="4" />
                            <line x1="6" y1="20" x2="6" y2="14" />
                        </svg>
                    </div>
                    <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--d-text)", margin: "0 0 8px" }}>
                        No Store Connected
                    </h2>
                    <p style={{ fontSize: "14px", color: "var(--d-text-2)", maxWidth: "420px", margin: "0 auto 20px", lineHeight: "1.5" }}>
                        Connect your marketplace store in Account & Stores to generate and export pricing reports.
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
                /* ── Minimalist Placeholder Card ────────────────────────── */
                <div className="animate-in" style={cardStyle}>
                    <div style={{ textAlign: "center", padding: "40px 20px" }}>
                        <h3 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 600, color: "var(--d-text)" }}>
                            Custom Exports & Scheduled Reports for {selectedStore.store_name}
                        </h3>
                        <p style={{ margin: 0, fontSize: "13px", color: "var(--d-text-3)", maxWidth: "420px", marginInline: "auto" }}>
                            Generate CSV/Excel reports for your pricing performance and competitor shifts.
                        </p>
                    </div>
                </div>
            )}
        </Layout>
    );
}

export default Reports;
