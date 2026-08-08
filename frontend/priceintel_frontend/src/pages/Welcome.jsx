import { useNavigate } from "react-router-dom";
import { useState } from "react";

/* ─── Data ────────────────────────────────────────────────── */
const NAV_LINKS = ["How It Works", "Features", "Platforms", "Pricing", "Contact"];

const FEATURES = [
  {
    title: "Product Tracking",
    desc: "Add any product URL and we'll monitor its price around the clock across every marketplace you sell on.",
  },
  {
    title: "Competitor Intelligence",
    desc: "See exactly who's undercutting you, by how much, and on which platform — updated every scrape cycle.",
  },
  {
    title: "AI Search Keywords",
    desc: "Gemini AI automatically generates optimized search keywords for each product so discovery never misses a rival listing.",
  },
  {
    title: "Real-time Alerts",
    desc: "Get instant notifications when a competitor drops their price below yours or goes out of stock.",
  },
  {
    title: "Pricing Analytics",
    desc: "7-day trend charts and market health scores show whether your catalog is winning or losing ground.",
  },
  {
    title: "Win Rate Tracking",
    desc: "Know at a glance what percentage of your products are the cheapest option on the market right now.",
  },
];

const PLATFORMS = [
  { name: "Noon", emoji: "🛒", desc: "UAE, Saudi Arabia & Egypt", color: "#FFEE00", bg: "#1C1C1C" },
  { name: "Daraz", emoji: "🛍️", desc: "Pakistan, Bangladesh & Sri Lanka", color: "#F85606", bg: "#FFF4F0" },
  { name: "Amazon", emoji: "📦", desc: "Global marketplace coverage", color: "#FF9900", bg: "#FFFBF0" },
];

const PRICING_PLANS = [
  {
    name: "Starter",
    price: "Free",
    period: "",
    highlight: false,
    features: ["Up to 10 products", "1 marketplace", "Daily price checks", "Email alerts"],
    cta: "Get Started Free",
  },
  {
    name: "Pro",
    price: "$29",
    period: "/mo",
    highlight: true,
    features: ["Up to 200 products", "All marketplaces", "Real-time checks", "Instant alerts", "AI keywords", "Analytics dashboard"],
    cta: "Start Free Trial",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    highlight: false,
    features: ["Unlimited products", "Custom integrations", "Dedicated support", "SLA guarantee", "White-label option"],
    cta: "Contact Sales",
  },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Connect your store", desc: "Add your marketplace seller account in Settings — takes 30 seconds." },
  { step: "02", title: "Add your products", desc: "Paste any product URL and we scrape competitor listings automatically." },
  { step: "03", title: "AI generates keywords", desc: "Gemini maps each product to optimized search queries for accurate discovery." },
  { step: "04", title: "Watch the alerts flow", desc: "Get notified the moment a competitor moves — and act before you lose the sale." },
];

/* ─── Helpers ─────────────────────────────────────────────── */
function scrollTo(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth" });
}

function SectionLabel({ children }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "4px 14px",
      borderRadius: "999px",
      background: "#EEF2FF",
      color: "#4F46E5",
      fontSize: "12px",
      fontWeight: 600,
      letterSpacing: "0.3px",
      marginBottom: "14px",
    }}>
      {children}
    </span>
  );
}

/* ─── Component ───────────────────────────────────────────── */
function Welcome() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  function handleSubscribe(e) {
    e.preventDefault();
    if (email.trim()) { setSubscribed(true); setEmail(""); }
  }

  /* nav label → section id map */
  const NAV_IDS = {
    "How It Works": "how-it-works",
    "Features": "features",
    "Platforms": "platforms",
    "Pricing": "pricing",
    "Contact": "contact",
  };

  return (
    <div style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif", color: "#18181B", overflowX: "hidden" }}>

      {/* ══════════════════════════════════════════════════════
          NAVBAR
      ══════════════════════════════════════════════════════ */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid #E4E4E7",
        padding: "0 40px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: "60px",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }} onClick={() => scrollTo("hero")}>
          <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "12px" }}>
            PI
          </div>
          <span style={{ fontWeight: 700, fontSize: "15px", color: "#18181B" }}>Price Intel</span>
        </div>

        {/* Desktop nav links */}
        <div style={{ display: "flex", gap: "32px" }}>
          {NAV_LINKS.map((l) => (
            <button key={l} onClick={() => scrollTo(NAV_IDS[l])} style={{ background: "none", border: "none", fontFamily: "inherit", fontSize: "13px", fontWeight: 500, color: "#52525B", cursor: "pointer", padding: 0, transition: "color 0.15s" }}
              onMouseEnter={e => e.target.style.color = "#18181B"}
              onMouseLeave={e => e.target.style.color = "#52525B"}
            >{l}</button>
          ))}
        </div>

        {/* Auth buttons */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button id="nav-btn-login" onClick={() => navigate("/login")} style={{ background: "none", border: "none", fontFamily: "inherit", fontSize: "13px", fontWeight: 600, color: "#52525B", cursor: "pointer", padding: "8px 14px", borderRadius: "8px", transition: "background 0.12s" }}
            onMouseEnter={e => e.currentTarget.style.background = "#F4F4F5"}
            onMouseLeave={e => e.currentTarget.style.background = "none"}
          >Log In</button>
          <button id="nav-btn-signup" onClick={() => navigate("/signup")} style={{ background: "#4F46E5", color: "#fff", border: "none", fontFamily: "inherit", fontSize: "13px", fontWeight: 600, cursor: "pointer", padding: "8px 18px", borderRadius: "8px", transition: "background 0.15s, transform 0.1s", boxShadow: "0 2px 8px rgba(79,70,229,0.3)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#4338CA"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#4F46E5"; e.currentTarget.style.transform = "translateY(0)"; }}
          >Get Started Free</button>
        </div>
      </nav>


      {/* ══════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════ */}
      <section id="hero" style={{
        minHeight: "90vh",
        background: "linear-gradient(135deg, #F8F9FF 0%, #EEF2FF 40%, #F0FDF4 100%)",
        display: "flex", alignItems: "center",
        padding: "80px 80px",
        gap: "60px",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Subtle blobs */}
        <div style={{ position: "absolute", top: "-100px", right: "-100px", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle, rgba(79,70,229,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-80px", left: "20%", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle, rgba(16,163,74,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

        {/* Left: Text */}
        <div style={{ flex: 1, maxWidth: "560px", zIndex: 1 }}>

          <h1 style={{ margin: "0 0 20px", fontSize: "clamp(36px, 5vw, 58px)", fontWeight: 800, color: "#0F0F11", lineHeight: 1.1, letterSpacing: "-2px" }}>
            Know the market<br />
            <span style={{ color: "#4F46E5" }}>before it moves.</span>
          </h1>

          <p style={{ margin: "0 0 36px", fontSize: "17px", color: "#52525B", lineHeight: 1.7, maxWidth: "480px" }}>
            Price Intel tracks your competitors across Noon, Daraz and Amazon — giving you real-time alerts, AI-powered insights, and a clear edge over every rival seller.
          </p>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button id="hero-btn-signup" onClick={() => navigate("/signup")} style={{ padding: "14px 28px", background: "#4F46E5", color: "#fff", border: "none", borderRadius: "10px", fontSize: "15px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 4px 20px rgba(79,70,229,0.35)", transition: "all 0.15s", display: "flex", alignItems: "center", gap: "8px" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#4338CA"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#4F46E5"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              Start for Free →
            </button>
            <button id="hero-btn-login" onClick={() => navigate("/login")} style={{ padding: "14px 28px", background: "#fff", color: "#18181B", border: "1px solid #E4E4E7", borderRadius: "10px", fontSize: "15px", fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#4F46E5"; e.currentTarget.style.color = "#4F46E5"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#E4E4E7"; e.currentTarget.style.color = "#18181B"; }}
            >
              Sign In
            </button>
          </div>

          {/* Trust bar */}
          <div style={{ display: "flex", gap: "28px", marginTop: "44px", paddingTop: "28px", borderTop: "1px solid #E4E4E7" }}>
            {[["10k+", "Products tracked"], ["Real-time", "Price alerts"], ["Noon · Daraz", "Platforms supported"]].map(([n, l]) => (
              <div key={l}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "16px", color: "#18181B", letterSpacing: "-0.3px" }}>{n}</p>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#A1A1AA" }}>{l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Dashboard mockup */}
        <div style={{ flex: 1, maxWidth: "580px", zIndex: 1 }}>
          <div style={{
            background: "#fff",
            borderRadius: "16px",
            border: "1px solid #E4E4E7",
            boxShadow: "0 24px 80px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)",
            overflow: "hidden",
          }}>
            {/* Mock titlebar */}
            <div style={{ padding: "12px 16px", background: "#F7F7F8", borderBottom: "1px solid #E4E4E7", display: "flex", alignItems: "center", gap: "6px" }}>
              {["#FF5F57", "#FEBC2E", "#28C840"].map(c => (
                <div key={c} style={{ width: "10px", height: "10px", borderRadius: "50%", background: c }} />
              ))}
              <div style={{ marginLeft: "12px", flex: 1, height: "10px", borderRadius: "999px", background: "#E4E4E7", maxWidth: "200px" }} />
            </div>

            {/* Mock dashboard content */}
            <div style={{ padding: "20px", background: "#F7F7F8" }}>
              {/* KPI row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "8px", marginBottom: "12px" }}>
                {[["84", "Products"], ["12", "Alerts"], ["31", "Wins"], ["47", "Rivals"]].map(([ic, n, l]) => (
                  <div key={l} style={{ background: "#fff", borderRadius: "8px", padding: "10px", border: "1px solid #E4E4E7" }}>
                    <div style={{ fontSize: "12px" }}>{ic}</div>
                    <div style={{ fontSize: "18px", fontWeight: 700, color: "#18181B", marginTop: "4px" }}>{n}</div>
                    <div style={{ fontSize: "10px", color: "#A1A1AA" }}>{l}</div>
                  </div>
                ))}
              </div>

              {/* Chart mockup */}
              <div style={{ background: "#fff", borderRadius: "8px", border: "1px solid #E4E4E7", padding: "14px", marginBottom: "10px" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "#18181B", marginBottom: "10px" }}>Pricing Trend (Last 7 Days)</div>
                <svg width="100%" height="60" viewBox="0 0 400 60" preserveAspectRatio="none">
                  <polyline points="0,40 60,38 120,32 180,32 240,28 300,22 360,22" fill="none" stroke="#4F46E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="0,20 60,18 120,15 180,18 240,15 300,10 360,8" fill="none" stroke="#A1A1AA" strokeWidth="2" strokeDasharray="5,3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div style={{ display: "flex", gap: "14px", marginTop: "6px" }}>
                  <span style={{ fontSize: "10px", color: "#4F46E5" }}>● Your Price</span>
                  <span style={{ fontSize: "10px", color: "#A1A1AA" }}>● Competitor</span>
                </div>
              </div>

              {/* Alert rows */}
              {[["↓", "TechHub dropped Samsung Buds price by 5.3%", "2m ago", "#FEF2F2", "#DC2626"],
              ["✓", "You are cheapest on AirPods Pro 2", "1h ago", "#F0FDF4", "#16A34A"]].map(([ic, txt, t, bg, col]) => (
                <div key={txt} style={{ background: "#fff", borderRadius: "8px", border: "1px solid #E4E4E7", padding: "10px 12px", display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                  <span style={{ width: "20px", height: "20px", borderRadius: "5px", background: bg, color: col, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, flexShrink: 0 }}>{ic}</span>
                  <span style={{ fontSize: "10px", color: "#52525B", flex: 1 }}>{txt}</span>
                  <span style={{ fontSize: "10px", color: "#A1A1AA", flexShrink: 0 }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════════════════ */}
      <section id="how-it-works" style={{ padding: "100px 80px", background: "#fff" }}>
        <div style={{ textAlign: "center", marginBottom: "60px" }}>
          <SectionLabel>How It Works</SectionLabel>
          <h2 style={{ margin: 0, fontSize: "36px", fontWeight: 800, color: "#0F0F11", letterSpacing: "-1px" }}>
            Up and running in minutes
          </h2>
          <p style={{ margin: "12px auto 0", maxWidth: "480px", fontSize: "15px", color: "#52525B", lineHeight: 1.7 }}>
            No integrations to configure, no APIs to wrestle with. Just paste URLs and we handle everything.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0" }}>
          {HOW_IT_WORKS.map((s, i) => (
            <div key={s.step} style={{ position: "relative", padding: "32px 28px" }}>
              {/* Connector line */}
              {i < HOW_IT_WORKS.length - 1 && (
                <div style={{ position: "absolute", top: "42px", right: 0, width: "50%", height: "1px", background: "linear-gradient(to right, #4F46E5, #E4E4E7)", zIndex: 0 }} />
              )}
              <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px", position: "relative", zIndex: 1 }}>
                <span style={{ fontSize: "13px", fontWeight: 800, color: "#4F46E5" }}>{s.step}</span>
              </div>
              <h3 style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: 700, color: "#18181B" }}>{s.title}</h3>
              <p style={{ margin: 0, fontSize: "13px", color: "#71717A", lineHeight: 1.6 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════
          FEATURES
      ══════════════════════════════════════════════════════ */}
      <section id="features" style={{ padding: "100px 80px", background: "#F7F7F8" }}>
        <div style={{ textAlign: "center", marginBottom: "60px" }}>
          <SectionLabel>Features</SectionLabel>
          <h2 style={{ margin: 0, fontSize: "36px", fontWeight: 800, color: "#0F0F11", letterSpacing: "-1px" }}>
            Everything you need to win on price
          </h2>
          <p style={{ margin: "12px auto 0", maxWidth: "480px", fontSize: "15px", color: "#52525B", lineHeight: 1.7 }}>
            Built specifically for e-commerce sellers competing on Noon, Daraz, and beyond.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{ background: "#fff", borderRadius: "14px", border: "1px solid #E4E4E7", padding: "28px", transition: "transform 0.15s, box-shadow 0.15s, border-color 0.15s", cursor: "default" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.08)"; e.currentTarget.style.borderColor = "#C7D2FE"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "#E4E4E7"; }}
            >

              <h3 style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: 700, color: "#18181B" }}>{f.title}</h3>
              <p style={{ margin: 0, fontSize: "13px", color: "#71717A", lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════
          PLATFORMS
      ══════════════════════════════════════════════════════ */}
      <section id="platforms" style={{ padding: "100px 80px", background: "#fff" }}>
        <div style={{ textAlign: "center", marginBottom: "56px" }}>
          <SectionLabel>Supported Platforms</SectionLabel>
          <h2 style={{ margin: 0, fontSize: "36px", fontWeight: 800, color: "#0F0F11", letterSpacing: "-1px" }}>
            Where we track for you
          </h2>
          <p style={{ margin: "12px auto 0", maxWidth: "440px", fontSize: "15px", color: "#52525B", lineHeight: 1.7 }}>
            We scrape the platforms your customers actually shop on — no obscure corner-case sites.
          </p>
        </div>

        <div style={{ display: "flex", gap: "20px", justifyContent: "center", flexWrap: "wrap" }}>
          {PLATFORMS.map((p) => (
            <div key={p.name} style={{ background: "#F7F7F8", borderRadius: "16px", border: "1px solid #E4E4E7", padding: "36px 40px", textAlign: "center", minWidth: "200px", flex: "1", maxWidth: "260px", transition: "transform 0.15s, box-shadow 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.10)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              <div style={{ fontSize: "44px", marginBottom: "14px" }}>{p.emoji}</div>
              <h3 style={{ margin: "0 0 6px", fontSize: "20px", fontWeight: 800, color: "#18181B" }}>{p.name}</h3>
              <p style={{ margin: 0, fontSize: "12px", color: "#71717A" }}>{p.desc}</p>
              <div style={{ marginTop: "16px", display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 12px", borderRadius: "999px", background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16A34A", display: "inline-block" }} />
                <span style={{ fontSize: "11px", fontWeight: 600, color: "#16A34A" }}>Live</span>
              </div>
            </div>
          ))}
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════
          PRICING
      ══════════════════════════════════════════════════════ */}
      <section id="pricing" style={{ padding: "100px 80px", background: "#F7F7F8" }}>
        <div style={{ textAlign: "center", marginBottom: "56px" }}>
          <SectionLabel>Pricing</SectionLabel>
          <h2 style={{ margin: 0, fontSize: "36px", fontWeight: 800, color: "#0F0F11", letterSpacing: "-1px" }}>
            Simple, transparent pricing
          </h2>
          <p style={{ margin: "12px auto 0", maxWidth: "420px", fontSize: "15px", color: "#52525B", lineHeight: 1.7 }}>
            Start free, scale as you grow. No hidden fees, no surprise charges.
          </p>
        </div>

        <div style={{ display: "flex", gap: "20px", justifyContent: "center", flexWrap: "wrap", alignItems: "stretch" }}>
          {PRICING_PLANS.map((plan) => (
            <div key={plan.name} style={{
              background: plan.highlight ? "#4F46E5" : "#fff",
              borderRadius: "16px",
              border: plan.highlight ? "none" : "1px solid #E4E4E7",
              padding: "36px 32px",
              flex: "1", minWidth: "240px", maxWidth: "300px",
              boxShadow: plan.highlight ? "0 16px 60px rgba(79,70,229,0.35)" : "none",
              position: "relative",
              transition: "transform 0.15s",
            }}
              onMouseEnter={e => e.currentTarget.style.transform = "translateY(-4px)"}
              onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
            >
              {plan.highlight && (
                <div style={{ position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)", padding: "4px 16px", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "999px", fontSize: "11px", fontWeight: 700, color: "#16A34A", whiteSpace: "nowrap" }}>
                  Most Popular
                </div>
              )}
              <h3 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 700, color: plan.highlight ? "#fff" : "#18181B" }}>{plan.name}</h3>
              <div style={{ display: "flex", alignItems: "baseline", gap: "2px", marginBottom: "24px" }}>
                <span style={{ fontSize: "38px", fontWeight: 800, color: plan.highlight ? "#fff" : "#18181B", letterSpacing: "-1px" }}>{plan.price}</span>
                {plan.period && <span style={{ fontSize: "14px", color: plan.highlight ? "rgba(255,255,255,0.7)" : "#A1A1AA" }}>{plan.period}</span>}
              </div>
              <ul style={{ margin: "0 0 28px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "10px" }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ display: "flex", gap: "8px", fontSize: "13px", color: plan.highlight ? "rgba(255,255,255,0.85)" : "#52525B", alignItems: "center" }}>
                    <span style={{ color: plan.highlight ? "#A5B4FC" : "#16A34A", fontWeight: 700, fontSize: "14px" }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                id={`pricing-btn-${plan.name.toLowerCase()}`}
                onClick={() => navigate("/signup")}
                style={{
                  width: "100%", padding: "12px",
                  background: plan.highlight ? "#fff" : "#4F46E5",
                  color: plan.highlight ? "#4F46E5" : "#fff",
                  border: "none", borderRadius: "10px",
                  fontSize: "14px", fontWeight: 700, fontFamily: "inherit",
                  cursor: "pointer",
                  transition: "opacity 0.15s, transform 0.1s",
                  boxShadow: plan.highlight ? "none" : "0 2px 8px rgba(79,70,229,0.25)",
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = "0.88"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════
          CONTACT / CTA BANNER
      ══════════════════════════════════════════════════════ */}
      <section id="contact" style={{ padding: "100px 80px", background: "linear-gradient(135deg, #4F46E5 0%, #6D28D9 100%)", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.05) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(255,255,255,0.04) 0%, transparent 50%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <h2 style={{ margin: "0 0 14px", fontSize: "40px", fontWeight: 800, color: "#fff", letterSpacing: "-1px" }}>
            Ready to outsmart your competition?
          </h2>
          <p style={{ margin: "0 auto 40px", maxWidth: "480px", fontSize: "16px", color: "rgba(255,255,255,0.75)", lineHeight: 1.7 }}>
            Join sellers already using Price Intel to protect margins and react to market changes before they lose the sale.
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <button id="cta-btn-signup" onClick={() => navigate("/signup")} style={{ padding: "14px 32px", background: "#fff", color: "#4F46E5", border: "none", borderRadius: "10px", fontSize: "15px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.2)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.15)"; }}
            >
              Get Started Free →
            </button>
            <button id="cta-btn-login" onClick={() => navigate("/login")} style={{ padding: "14px 32px", background: "transparent", color: "#fff", border: "2px solid rgba(255,255,255,0.4)", borderRadius: "10px", fontSize: "15px", fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "border-color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.8)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)"}
            >
              Sign In
            </button>
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════ */}
      <footer style={{ background: "#0F0F11", color: "#A1A1AA", padding: "64px 80px 32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.5fr", gap: "40px", marginBottom: "48px" }}>

          {/* Brand column */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "11px" }}>PI</div>
              <span style={{ fontWeight: 700, fontSize: "15px", color: "#fff" }}>Price Intel</span>
            </div>
            <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#71717A", lineHeight: 1.7, maxWidth: "240px" }}>
              AI-powered price intelligence for e-commerce sellers competing on Noon, Daraz, and Amazon.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              {["𝕏", "in", "gh"].map((icon) => (
                <div key={icon} style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#1C1C1C", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: "#71717A", cursor: "pointer", transition: "background 0.12s, color 0.12s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#4F46E5"; e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#1C1C1C"; e.currentTarget.style.color = "#71717A"; }}
                >{icon}</div>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 style={{ margin: "0 0 16px", fontSize: "13px", fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: "0.5px" }}>Quick Links</h4>
            {["Home", "How It Works", "Features", "Platforms", "Pricing"].map((l) => (
              <button key={l} onClick={() => scrollTo(NAV_IDS[l] || "hero")} style={{ display: "block", background: "none", border: "none", padding: "5px 0", fontFamily: "inherit", fontSize: "13px", color: "#71717A", cursor: "pointer", transition: "color 0.12s", textAlign: "left" }}
                onMouseEnter={e => e.currentTarget.style.color = "#fff"}
                onMouseLeave={e => e.currentTarget.style.color = "#71717A"}
              >{l}</button>
            ))}
          </div>

          {/* Resources */}
          <div>
            <h4 style={{ margin: "0 0 16px", fontSize: "13px", fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: "0.5px" }}>Resources</h4>
            {["Documentation", "API Reference", "Changelog", "FAQ", "Status"].map((l) => (
              <p key={l} style={{ margin: "5px 0", fontSize: "13px", color: "#71717A", cursor: "pointer", transition: "color 0.12s" }}
                onMouseEnter={e => e.currentTarget.style.color = "#fff"}
                onMouseLeave={e => e.currentTarget.style.color = "#71717A"}
              >{l}</p>
            ))}
          </div>

          {/* Newsletter */}
          <div>
            <h4 style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: "0.5px" }}>Stay Updated</h4>
            <p style={{ margin: "0 0 14px", fontSize: "13px", color: "#71717A", lineHeight: 1.6 }}>Get pricing insights and product updates in your inbox.</p>
            {subscribed ? (
              <p style={{ fontSize: "13px", color: "#16A34A", fontWeight: 600 }}>✓ You're subscribed!</p>
            ) : (
              <form onSubmit={handleSubscribe} style={{ display: "flex", gap: "8px" }}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  style={{ flex: 1, padding: "9px 12px", background: "#1C1C1C", border: "1px solid #2C2C2C", borderRadius: "8px", color: "#fff", fontSize: "13px", fontFamily: "inherit", outline: "none" }}
                  onFocus={e => e.target.style.borderColor = "#4F46E5"}
                  onBlur={e => e.target.style.borderColor = "#2C2C2C"}
                />
                <button type="submit" style={{ padding: "9px 14px", background: "#4F46E5", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>→</button>
              </form>
            )}
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: "1px solid #1C1C1C", paddingTop: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <p style={{ margin: 0, fontSize: "12px", color: "#52525B" }}>© 2026 Price Intel. All rights reserved.</p>
          <div style={{ display: "flex", gap: "20px" }}>
            {["Privacy Policy", "Terms of Service", "Cookie Policy"].map((l) => (
              <span key={l} style={{ fontSize: "12px", color: "#52525B", cursor: "pointer", transition: "color 0.12s" }}
                onMouseEnter={e => e.currentTarget.style.color = "#A1A1AA"}
                onMouseLeave={e => e.currentTarget.style.color = "#52525B"}
              >{l}</span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Welcome;