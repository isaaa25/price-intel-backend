// src/pages/Settings.jsx
import { useState, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import Layout from "../components/Layout";
import apiRequest from "../api/client";

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
  transition: "border-color 0.15s",
};

const labelStyle = {
  display: "block",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--d-text-2)",
  marginBottom: "6px",
};


function ThemeCard() {
  const { theme, setTheme } = useTheme();

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
  const [email, setEmail] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);

  // Fetch current user email on mount
  useEffect(() => {
    apiRequest("/auth/me")
      .then((user) => {
        setEmail(user.email || "");
      })
      .catch(() => {
        setEmail(localStorage.getItem("user_email") || "");
      });
  }, []);

  async function handleChangePassword(e) {
    e.preventDefault();
    setMessage(null);

    if (!oldPassword) {
      setMessage({ type: "error", text: "Please enter your current password." });
      return;
    }
    if (!newPassword) {
      setMessage({ type: "error", text: "Please enter a new password." });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ type: "error", text: "New password must be at least 8 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match." });
      return;
    }
    if (oldPassword === newPassword) {
      setMessage({ type: "error", text: "New password must be different from current password." });
      return;
    }

    setSaving(true);
    try {
      await apiRequest("/auth/change-password", {
        method: "PUT",
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
        }),
      });
      setMessage({ type: "success", text: "Password updated successfully! ✓" });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setShowResetForm(false);
      }, 2000);
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to update password." });
    } finally {
      setSaving(false);
    }
  }

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

      {/* ── Account Credentials ─────────────────────────────────── */}
      <div className="animate-in" style={{ ...cardStyle, animationDelay: "0.04s" }}>
        <div style={{ marginBottom: "18px" }}>
          <h2 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 600, color: "var(--d-text)" }}>
            Account Credentials
          </h2>
          <p style={{ margin: 0, fontSize: "12px", color: "var(--d-text-3)" }}>
            {showResetForm
              ? "To change your password, verify your identity by entering your current password first."
              : "View your registered account email or reset your account password."}
          </p>
        </div>

        {/* Email Address — always visible */}
        <div style={{ marginBottom: showResetForm ? "18px" : "18px" }}>
          <label style={labelStyle}>Email Address</label>
          <input
            type="email"
            value={email}
            readOnly
            style={{
              ...inputStyle,
              opacity: 0.7,
              cursor: "not-allowed",
              background: "var(--d-bg)",
            }}
          />
        </div>

        {/* Option to Reset Password (when form is not open) */}
        {!showResetForm ? (
          <div>
            <button
              type="button"
              id="reset-password-trigger-btn"
              onClick={() => {
                setShowResetForm(true);
                setMessage(null);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "9px 20px",
                background: "var(--d-accent)",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
                transition: "background 0.15s, transform 0.1s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Reset Password
            </button>
          </div>
        ) : (
          /* Password reset form — shown only when Reset Password is clicked */
          <form onSubmit={handleChangePassword}>
            <div style={{ borderTop: "1px solid var(--d-border)", paddingTop: "18px", marginTop: "18px" }}>
              {/* Current password */}
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>
                  Current Password <span style={{ color: "var(--d-danger)" }}>*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showOld ? "text" : "password"}
                    placeholder="Enter your current password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    style={{ ...inputStyle, paddingRight: "42px" }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--d-accent)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--d-border)")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOld(!showOld)}
                    tabIndex={-1}
                    aria-label={showOld ? "Hide password" : "Show password"}
                    style={{
                      position: "absolute",
                      right: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px",
                      display: "flex",
                      alignItems: "center",
                      color: "var(--d-text-3)",
                    }}
                  >
                    {showOld ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* New password + confirm — side by side */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                <div>
                  <label style={labelStyle}>
                    New Password <span style={{ color: "var(--d-danger)" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showNew ? "text" : "password"}
                      placeholder="Min. 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      style={{ ...inputStyle, paddingRight: "42px" }}
                      onFocus={(e) => (e.target.style.borderColor = "var(--d-accent)")}
                      onBlur={(e) => (e.target.style.borderColor = "var(--d-border)")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      tabIndex={-1}
                      aria-label={showNew ? "Hide password" : "Show password"}
                      style={{
                        position: "absolute",
                        right: "10px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "4px",
                        display: "flex",
                        alignItems: "center",
                        color: "var(--d-text-3)",
                      }}
                    >
                      {showNew ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>
                    Confirm New Password <span style={{ color: "var(--d-danger)" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showConfirm ? "text" : "password"}
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      style={{ ...inputStyle, paddingRight: "42px" }}
                      onFocus={(e) => (e.target.style.borderColor = "var(--d-accent)")}
                      onBlur={(e) => (e.target.style.borderColor = "var(--d-border)")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      tabIndex={-1}
                      aria-label={showConfirm ? "Hide password" : "Show password"}
                      style={{
                        position: "absolute",
                        right: "10px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "4px",
                        display: "flex",
                        alignItems: "center",
                        color: "var(--d-text-3)",
                      }}
                    >
                      {showConfirm ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: "9px 24px",
                    background: saving ? "var(--d-text-3)" : "var(--d-accent)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    fontFamily: "inherit",
                    cursor: saving ? "not-allowed" : "pointer",
                    transition: "background 0.15s, transform 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    if (!saving) e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  {saving ? "Updating…" : "Update Password"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowResetForm(false);
                    setOldPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setMessage(null);
                  }}
                  style={{
                    padding: "9px 18px",
                    background: "transparent",
                    color: "var(--d-text-2)",
                    border: "1px solid var(--d-border)",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 500,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--d-text)";
                    e.currentTarget.style.borderColor = "var(--d-text-3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--d-text-2)";
                    e.currentTarget.style.borderColor = "var(--d-border)";
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Feedback message */}
        {message && (
          <div
            style={{
              marginTop: "16px",
              padding: "10px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 500,
              background:
                message.type === "success"
                  ? "var(--d-success-bg, rgba(34,197,94,0.1))"
                  : "var(--d-danger-bg, rgba(239,68,68,0.1))",
              color:
                message.type === "success" ? "var(--d-success)" : "var(--d-danger)",
              border: `1px solid ${
                message.type === "success" ? "var(--d-success)" : "var(--d-danger)"
              }`,
            }}
          >
            {message.text}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default Settings;
