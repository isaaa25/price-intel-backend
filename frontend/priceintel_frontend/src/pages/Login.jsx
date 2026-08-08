import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../api/auth";

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      {/* Brand mark */}
      <div className="brand-mark">
        <div className="brand-mark-dot">PI</div>
        <span className="brand-mark-text">Price Intel</span>
      </div>

      {/* Card */}
      <div className="auth-card">
        {/* Back */}
        <button
          id="btn-back-login"
          className="btn-ghost"
          onClick={() => navigate("/")}
          style={{ alignSelf: "flex-start" }}
        >
          ← Back
        </button>

        {/* Header */}
        <div className="auth-card-header">
          <h1>Welcome back</h1>
          <p>Sign in to your Price Intel account</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="field-form">
          <div className="field">
            <label htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div className="field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && <p className="error-msg">{error}</p>}

          <button
            id="btn-login-submit"
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ marginTop: "4px" }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="auth-footer">
          No account?{" "}
          <span role="button" onClick={() => navigate("/signup")}>
            Create one free
          </span>
        </p>
      </div>
    </div>
  );
}

export default Login;