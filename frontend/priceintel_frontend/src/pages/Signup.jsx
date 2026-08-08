import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerUser } from "../api/auth";

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
      {/* Brand mark */}
      <div className="brand-mark">
        <div className="brand-mark-dot">PI</div>
        <span className="brand-mark-text">Price Intel</span>
      </div>

      {/* Card */}
      <div className="auth-card">
        {/* Back */}
        <button
          id="btn-back-signup"
          className="btn-ghost"
          onClick={() => navigate("/")}
          style={{ alignSelf: "flex-start" }}
        >
          ← Back
        </button>

        {/* Header */}
        <div className="auth-card-header">
          <h1>Create your account</h1>
          <p>Start monitoring prices across all your marketplaces</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="field-form">
          <div className="field">
            <label htmlFor="signup-name">Full name</label>
            <input
              id="signup-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
            />
          </div>

          <div className="field">
            <label htmlFor="signup-email">Email address</label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div className="field">
            <label htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              autoComplete="new-password"
            />
          </div>

          {error && <p className="error-msg">{error}</p>}

          <button
            id="btn-signup-submit"
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ marginTop: "4px" }}
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account?{" "}
          <span role="button" onClick={() => navigate("/login")}>
            Sign in
          </span>
        </p>
      </div>
    </div>
  );
}

export default Signup;