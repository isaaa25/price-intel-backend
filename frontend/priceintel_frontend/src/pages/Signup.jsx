import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerUser } from "../api/auth";
import AuthBackground from "../components/AuthBackground";

function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!name || !email || !password) {
      setError("Please fill in every field.");
      return;
    }
    setLoading(true);
    try {
      const data = await registerUser(name, email, password);
      localStorage.setItem("token", data.access_token);
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
          id="btn-back-signup"
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
          <h1>Create your account</h1>
          <p>Start monitoring prices across all your marketplaces</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Name field */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label htmlFor="signup-name" style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>
              Full name
            </label>
            <div className="auth-input-wrapper">
              <input
                id="signup-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                autoComplete="name"
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
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          </div>

          {/* Email field */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label htmlFor="signup-email" style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>
              Email address
            </label>
            <div className="auth-input-wrapper">
              <input
                id="signup-email"
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
            <label htmlFor="signup-password" style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>
              Password
            </label>
            <div className="auth-input-wrapper">
              <input
                id="signup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                autoComplete="new-password"
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
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
          </div>

          {error && (
            <p style={{ color: "#ef4444", fontSize: "12px", margin: 0 }}>
              {error}
            </p>
          )}

          {/* Submit Button */}
          <button
            id="btn-signup-submit"
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
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        {/* Footer */}
        <p style={{ textAlign: "center", fontSize: "12px", color: "#64748b", margin: 0, marginTop: "6px" }}>
          Already have an account?{" "}
          <span
            role="button"
            onClick={() => navigate("/login")}
            style={{ color: "#2563EB", fontWeight: 600, cursor: "pointer" }}
          >
            Sign in
          </span>
        </p>
      </div>
    </div>
  );
}

export default Signup;