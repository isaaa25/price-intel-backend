import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../api/auth";
import AuthBackground from "../components/AuthBackground";

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    setLoading(true);
    try {
      const data = await loginUser(email, password);
      localStorage.setItem("token", data.access_token);
      if (data.user?.email) localStorage.setItem("user_email", data.user.email);
      if (data.user?.full_name) localStorage.setItem("user_name", data.user.full_name);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <AuthBackground />

      {/* Card */}
      <div className="auth-card">
        {/* Back */}
        <button
          id="btn-back-login"
          className="btn-ghost"
          onClick={() => navigate("/")}
          style={{
            alignSelf: "flex-start",
            background: "none",
            border: "none",
            color: "#64748b",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
            padding: 0,
            marginBottom: "4px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          ← Back
        </button>

        {/* Header */}
        <div className="auth-card-header">
          <h1>Welcome back</h1>
          <p>Sign in to your Price Intel account</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Email field */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label htmlFor="login-email" style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>
              Email address
            </label>
            <div className="auth-input-wrapper">
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#94a3b8"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ position: "absolute", right: "14px", pointerEvents: "none" }}
              >
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </div>
          </div>

          {/* Password field */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label htmlFor="login-password" style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>
              Password
            </label>
            <div className="auth-input-wrapper">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "10px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                  color: "#94a3b8",
                }}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Remember me & Forgot Password */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", color: "#64748b", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ borderRadius: "4px", accentColor: "#2563EB", cursor: "pointer" }}
              />
              Remember me
            </label>
            <span
              onClick={() => alert("Password reset link will be sent to your email.")}
              style={{ color: "#2563EB", fontWeight: 600, cursor: "pointer" }}
            >
              Forgot password?
            </span>
          </div>

          {error && (
            <p style={{ color: "#ef4444", fontSize: "12px", margin: 0 }}>
              {error}
            </p>
          )}

          {/* Submit Button */}
          <button
            id="btn-login-submit"
            type="submit"
            disabled={loading}
            style={{
              padding: "12px",
              background: "#2563EB",
              color: "#ffffff",
              border: "none",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(37, 99, 235, 0.35)",
              transition: "all 0.15s ease",
              marginTop: "4px",
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "4px 0" }}>
          <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
          <span style={{ fontSize: "11px", color: "#94a3b8" }}>or</span>
          <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
        </div>

        {/* Footer */}
        <p style={{ textAlign: "center", fontSize: "12px", color: "#64748b", margin: 0 }}>
          No account?{" "}
          <span
            role="button"
            onClick={() => navigate("/signup")}
            style={{ color: "#2563EB", fontWeight: 600, cursor: "pointer" }}
          >
            Create one free
          </span>
        </p>
      </div>
    </div>
  );
}

export default Login;