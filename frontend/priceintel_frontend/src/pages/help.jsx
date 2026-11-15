// src/pages/Help.jsx
import Layout from "../components/Layout";
import { useLocale } from "../context/LocaleContext";

const cardStyle = {
    background: "var(--d-surface)",
    border: "1px solid var(--d-border)",
    borderRadius: "12px",
    padding: "40px 24px",
    textAlign: "center",
};

function Help() {
    const { t } = useLocale();
    return (
        <Layout>
            {/* ── Page Header ────────────────────────────────────────── */}
            <div className="animate-in" style={{ marginBottom: "28px" }}>
                <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--d-text)", letterSpacing: "-0.3px" }}>
                    {t("Help & Support")}
                </h1>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--d-text-2)" }}>
                    {t("Get assistance and learn how to use Price Intel.")}
                </p>
            </div>

            {/* ── Minimalist Blank Placeholder ───────────────────────── */}
            <div className="animate-in" style={cardStyle}>
                <span style={{ fontSize: "32px", display: "block", marginBottom: "12px" }}>❓</span>
                <h3 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 600, color: "var(--d-text)" }}>
                    {t("Help Center")}
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--d-text-3)", maxWidth: "380px", marginInline: "auto" }}>
                    {t("Documentation, guides, and customer support channels will appear here.")}
                </p>
            </div>
        </Layout>
    );
}

export default Help;
