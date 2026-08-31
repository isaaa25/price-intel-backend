// src/pages/Settings.jsx
import { useTheme } from "../context/ThemeContext";
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
  background: "var(--d-surface-2)",
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


function ThemeCard() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  return (
    <div className="animate-in" style={cardStyle}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <div>
          <h2 style={{ margin: "0 0 2px", fontSize: "15px", fontWeight: 600, color: "var(--d-text)" }}>
            Appearance
          </h2>
          <p style={{ margin: 0, fontSize: "12px", color: "var(--d-text-3)" }}>
            Choose how Price Intel looks for you. Saved automatically.
          </p>
        </div>

      </div>

      {/* Compact horizontal selector */}
      <div style={{ display: "inline-flex", gap: "0", background: "var(--d-surface-2)", border: "1px solid var(--d-border)", borderRadius: "8px", padding: "3px" }}>
        {[
          {
            value: "light", label: "Light",
            icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
          },
          {
            value: "dark", label: "Dark",
            icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
          },
          {
            value: "system", label: "System",
            icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
          },
        ].map((opt) => {
          const isActive = theme === opt.value;
          return (
            <button
              key={opt.value}
              id={`theme-option-${opt.value}`}
              onClick={() => setTheme(opt.value)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                borderRadius: "6px",
                border: "none",
                background: isActive ? "var(--d-surface)" : "transparent",
                color: isActive ? "var(--d-text)" : "var(--d-text-3)",
                fontSize: "13px",
                fontWeight: isActive ? 600 : 400,
                cursor: "pointer",
                fontFamily: "inherit",
                boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              {opt.icon}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}


function Settings() {
  return (
    <Layout>
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="animate-in" style={{ marginBottom: "28px" }}>
        <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--d-text)", letterSpacing: "-0.3px" }}>
          Settings
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--d-text-2)" }}>
          Manage your account profile, appearance, and preferences.
        </p>
      </div>

      {/* ── Appearance / Theme ──────────────────────────────────── */}
      <ThemeCard />

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
