// src/pages/Settings.jsx
import Layout from "../components/Layout";

const cardStyle = {
  background: "var(--d-surface)",
  border: "1px solid var(--d-border)",
  borderRadius: "12px",
  padding: "24px",
  marginBottom: "24px",
};

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  border: "1px solid var(--d-border)",
  borderRadius: "8px",
  background: "var(--d-surface)",
  color: "var(--d-text)",
  fontSize: "14px",
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle = {
  display: "block",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--d-text-2)",
  marginBottom: "6px",
};

function Settings() {
  return (
    <Layout>
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="animate-in" style={{ marginBottom: "28px" }}>
        <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--d-text)", letterSpacing: "-0.3px" }}>
          Settings
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--d-text-2)" }}>
          Manage your account profile, email notifications, and password.
        </p>
      </div>

      {/* ── Profile & Security ─────────────────────────────────── */}
      <div className="animate-in" style={cardStyle}>
        <h2 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 600, color: "var(--d-text)" }}>
          Account Credentials
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
          <div>
            <label style={labelStyle}>Email Address</label>
            <input type="email" placeholder="user@example.com" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>New Password</label>
            <input type="password" placeholder="••••••••" style={inputStyle} />
          </div>
        </div>
        <button style={{ padding: "9px 20px", background: "var(--d-accent)", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
          Update Settings
        </button>
      </div>
    </Layout>
  );
}

export default Settings;
