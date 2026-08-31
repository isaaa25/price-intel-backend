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
  {
    name: "Noon",
    desc: "Monitor regional price movements",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="21" r="1" />
        <circle cx="19" cy="21" r="1" />
        <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
      </svg>
    ),
  },
  {
    name: "Daraz",
    desc: "Track your local competition",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    ),
  },
  {
    name: "Amazon",
    desc: "Analyze international competition",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m7.5 4.27 9 5.15" />
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </svg>
    ),
  },
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

function SectionLabel({ children, style = {} }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "6px 20px",
      borderRadius: "999px",
      background: "#EFF6FF",
      color: "#2563EB",
      fontSize: "14.5px",
      fontWeight: 600,
      letterSpacing: "0.3px",
      marginBottom: "16px",
      ...style,
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
          <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "12px" }}>
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
          <button id="nav-btn-signup" onClick={() => navigate("/signup")} style={{ background: "#2563EB", color: "#fff", border: "none", fontFamily: "inherit", fontSize: "13px", fontWeight: 600, cursor: "pointer", padding: "8px 18px", borderRadius: "8px", transition: "background 0.15s, transform 0.1s", boxShadow: "0 2px 8px rgba(37,99,235,0.3)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#1D4ED8"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#2563EB"; e.currentTarget.style.transform = "translateY(0)"; }}
          >Get Started Free</button>
        </div>
      </nav>


      {/* ══════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════ */}
      <section id="hero" style={{
        minHeight: "90vh",
        background: "linear-gradient(135deg, #F8F9FF 0%, #EFF6FF 40%, #F0FDF4 100%)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "80px 80px",
        gap: "60px",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Subtle blobs */}
        <div style={{ position: "absolute", top: "-100px", right: "-100px", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-80px", left: "20%", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle, rgba(16,163,74,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

        {/* Left: Text */}
        <div style={{ flex: 1, maxWidth: "560px", zIndex: 1 }}>

          <h1 style={{ margin: "0 0 20px", fontSize: "clamp(36px, 5vw, 58px)", fontWeight: 800, color: "#0F0F11", lineHeight: 1.1, letterSpacing: "-2px" }}>
            Ready to outsmart<br />
            <span style={{ color: "#2563EB" }}>your competition?</span>
          </h1>

          <p style={{ margin: "0 0 36px", fontSize: "17px", color: "#52525B", lineHeight: 1.7, maxWidth: "480px" }}>
            Price Intel tracks your competitors across Noon, Daraz and Amazon — giving you real-time alerts, AI-powered insights, and a clear edge over every rival seller.
          </p>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button id="hero-btn-signup" onClick={() => navigate("/signup")} style={{ padding: "14px 28px", background: "#2563EB", color: "#fff", border: "none", borderRadius: "10px", fontSize: "15px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 4px 20px rgba(37,99,235,0.35)", transition: "all 0.15s", display: "flex", alignItems: "center", gap: "8px" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#1D4ED8"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#2563EB"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              Start for Free →
            </button>
            <button id="hero-btn-login" onClick={() => navigate("/login")} style={{ padding: "14px 28px", background: "#fff", color: "#18181B", border: "1px solid #E4E4E7", borderRadius: "10px", fontSize: "15px", fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#2563EB"; e.currentTarget.style.color = "#2563EB"; }}
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
        <div style={{ flex: 1, maxWidth: "680px", zIndex: 1, transform: "translateX(8px)" }}>
          <div style={{
            background: "#E9EEF4",
            borderRadius: "16px",
            border: "1px solid #CBD5E1",
            boxShadow: "0 24px 80px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)",
            overflow: "hidden",
            padding: "22px",
          }}>
            {/* Dashboard Title Row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#2563EB" }} />
                <span style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", letterSpacing: "-0.2px" }}>Dashboard</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "5px", background: "#FFFFFF", border: "1px solid #CBD5E1", padding: "5px 12px", borderRadius: "6px", fontSize: "11.5px", fontWeight: 600, color: "#475569" }}>
                  <span>Last 30 Days</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                </div>
              </div>
            </div>

            {/* 5 KPI Cards (Clean, decent & minimal) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px", marginBottom: "16px" }}>
              {[
                { label: "RANK", val: "#2", color: "#0F172A" },
                { label: "MIN GAP", val: "+PKR 15", color: "#0F172A" },
                { label: "MAX GAP", val: "-PKR 42", color: "#0F172A" },
                { label: "STABILITY", val: "24%", color: "#0F172A" },
                { label: "SCORE", val: "78/100", color: "#2563EB" },
              ].map((k) => (
                <div key={k.label} style={{ background: "#FFFFFF", borderRadius: "8px", padding: "12px 10px", border: "1px solid #DCE3EC", boxShadow: "0 1px 2px rgba(0,0,0,0.03)", textAlign: "center" }}>
                  <div style={{ fontSize: "9px", fontWeight: 700, color: "#64748B", letterSpacing: "0.4px" }}>{k.label}</div>
                  <div style={{ fontSize: "14px", fontWeight: 800, color: k.color, marginTop: "5px" }}>{k.val}</div>
                </div>
              ))}
            </div>

            {/* Price History & Trend Analysis Card */}
            <div style={{ background: "#FFFFFF", borderRadius: "10px", border: "1px solid #DCE3EC", padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A" }}>Price Trend</span>
                  <span style={{ fontSize: "10px", fontWeight: 600, color: "#10B981", background: "#DCFCE7", padding: "2px 7px", borderRadius: "4px" }}>▼ 3.4%</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "#F8FAFC", border: "1px solid #E2E8F0", padding: "4px 9px", borderRadius: "5px", fontSize: "10.5px", fontWeight: 600, color: "#334155" }}>
                    <span>Galaxy Z Fold3</span>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                  </div>

                  <div style={{ display: "flex", background: "#F1F5F9", padding: "2px", borderRadius: "5px", border: "1px solid #E2E8F0" }}>
                    {["24h", "7d", "1m"].map((tf) => (
                      <span key={tf} style={{ padding: "3px 8px", fontSize: "9.5px", fontWeight: tf === "7d" ? 700 : 500, color: tf === "7d" ? "#2563EB" : "#64748B", background: tf === "7d" ? "#FFFFFF" : "transparent", borderRadius: "4px" }}>
                        {tf}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "14px", marginBottom: "10px", fontSize: "10px" }}>
                <span style={{ color: "#94A3B8", display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ display: "inline-block", width: "14px", height: "0px", borderTop: "2px dashed #94A3B8" }} /> Competitor Avg
                </span>
                <span style={{ color: "#2563EB", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ display: "inline-block", width: "14px", height: "2.5px", background: "#2563EB" }} /> Your Price
                </span>
              </div>

              {/* High-Fidelity Trend Chart SVG */}
              <div style={{ width: "100%", height: "155px" }}>
                <svg width="100%" height="100%" viewBox="0 0 460 120" preserveAspectRatio="none">
                  {/* Grid lines & Y-axis labels */}
                  {[
                    { y: 15, label: "PKR 830" },
                    { y: 38, label: "PKR 798" },
                    { y: 62, label: "PKR 763" },
                    { y: 86, label: "PKR 728" },
                    { y: 108, label: "PKR 693" },
                  ].map((g) => (
                    <g key={g.label}>
                      <text x="0" y={g.y + 3} fill="#94A3B8" fontSize="8" fontFamily="Inter, sans-serif">{g.label}</text>
                      <line x1="42" y1={g.y} x2="455" y2={g.y} stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
                    </g>
                  ))}

                  {/* Competitor Avg Line (Dashed grey with dots) */}
                  <path
                    d="M 55 42 C 90 44, 120 54, 155 70 C 190 85, 220 100, 255 102 C 290 102, 320 78, 355 64 C 390 52, 420 50, 450 56"
                    fill="none"
                    stroke="#94A3B8"
                    strokeWidth="1.8"
                    strokeDasharray="4 4"
                  />
                  {[
                    [55, 42], [120, 54], [185, 84], [255, 102], [320, 78], [385, 52], [450, 56]
                  ].map(([cx, cy], i) => (
                    <circle key={i} cx={cx} cy={cy} r="2.5" fill="#94A3B8" />
                  ))}

                  {/* Your Price Line (Solid blue with white-centered dots) */}
                  <path
                    d="M 55 58 C 90 59, 120 62, 155 73 C 190 83, 220 90, 255 92 C 290 92, 320 86, 355 80 C 390 72, 420 74, 450 78"
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth="2.5"
                  />
                  {[
                    [55, 58], [120, 62], [185, 80], [255, 92], [320, 86], [385, 73], [450, 78]
                  ].map(([cx, cy], i) => (
                    <g key={i}>
                      <circle cx={cx} cy={cy} r="3.5" fill="#2563EB" stroke="#FFFFFF" strokeWidth="1.5" />
                    </g>
                  ))}

                  {/* X-axis labels */}
                  {[
                    { x: 55, text: "Mon" },
                    { x: 120, text: "Tue" },
                    { x: 185, text: "Wed" },
                    { x: 255, text: "Thu" },
                    { x: 320, text: "Fri" },
                    { x: 385, text: "Sat" },
                    { x: 450, text: "Sun" },
                  ].map((xl) => (
                    <text key={xl.text} x={xl.x} y="119" textAnchor="middle" fill="#94A3B8" fontSize="8" fontFamily="Inter, sans-serif">{xl.text}</text>
                  ))}
                </svg>
              </div>
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
          <h2 style={{ margin: "6px 0 0", fontSize: "28px", fontWeight: 700, color: "#0F0F11", letterSpacing: "-0.6px" }}>
            Just paste the URL and you are ready to go
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0" }}>
          {HOW_IT_WORKS.map((s, i) => (
            <div key={s.step} style={{ position: "relative", padding: "32px 28px" }}>
              {/* Connector line */}
              {i < HOW_IT_WORKS.length - 1 && (
                <div
                  style={{
                    position: "absolute",
                    top: "54px",
                    left: "84px",
                    right: "-16px",
                    height: "1.5px",
                    background: "linear-gradient(to right, #2563EB, #E4E4E7)",
                    borderRadius: "999px",
                    zIndex: 0,
                  }}
                />
              )}
              <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px", position: "relative", zIndex: 1 }}>
                <span style={{ fontSize: "13px", fontWeight: 800, color: "#2563EB" }}>{s.step}</span>
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
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.08)"; e.currentTarget.style.borderColor = "#93C5FD"; }}
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
              <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}>
                {p.icon}
              </div>
              <h3 style={{ margin: "0 0 6px", fontSize: "20px", fontWeight: 800, color: "#18181B" }}>{p.name}</h3>
              <p style={{ margin: 0, fontSize: "12px", color: "#71717A", fontStyle: "italic" }}>{p.desc}</p>
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
              background: plan.highlight ? "#2563EB" : "#fff",
              borderRadius: "16px",
              border: plan.highlight ? "none" : "1px solid #E4E4E7",
              padding: "36px 32px",
              flex: "1", minWidth: "240px", maxWidth: "300px",
              boxShadow: plan.highlight ? "0 16px 60px rgba(37,99,235,0.35)" : "none",
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
                    <span style={{ color: plan.highlight ? "#93C5FD" : "#16A34A", fontWeight: 700, fontSize: "14px" }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                id={`pricing-btn-${plan.name.toLowerCase()}`}
                onClick={() => navigate("/signup")}
                style={{
                  width: "100%", padding: "12px",
                  background: plan.highlight ? "#fff" : "#2563EB",
                  color: plan.highlight ? "#2563EB" : "#fff",
                  border: "none", borderRadius: "10px",
                  fontSize: "14px", fontWeight: 700, fontFamily: "inherit",
                  cursor: "pointer",
                  transition: "opacity 0.15s, transform 0.1s",
                  boxShadow: plan.highlight ? "none" : "0 2px 8px rgba(37,99,235,0.25)",
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
      <section id="contact" style={{ padding: "100px 80px", background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.05) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(255,255,255,0.04) 0%, transparent 50%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <h2 style={{ margin: "0 0 14px", fontSize: "40px", fontWeight: 800, color: "#fff", letterSpacing: "-1px" }}>
            Ready to outsmart your competition?
          </h2>
          <p style={{ margin: "0 auto 40px", maxWidth: "480px", fontSize: "16px", color: "rgba(255,255,255,0.75)", lineHeight: 1.7 }}>
            Join sellers already using Price Intel to protect margins and react to market changes before they lose the sale.
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <button id="cta-btn-signup" onClick={() => navigate("/signup")} style={{ padding: "14px 32px", background: "#fff", color: "#2563EB", border: "none", borderRadius: "10px", fontSize: "15px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}
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
              <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "11px" }}>PI</div>
              <span style={{ fontWeight: 700, fontSize: "15px", color: "#fff" }}>Price Intel</span>
            </div>
            <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#71717A", lineHeight: 1.7, maxWidth: "240px" }}>
              AI-powered price intelligence for e-commerce sellers competing on Noon, Daraz, and Amazon.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              {["𝕏", "in", "gh"].map((icon) => (
                <div key={icon} style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#1C1C1C", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: "#71717A", cursor: "pointer", transition: "background 0.12s, color 0.12s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#2563EB"; e.currentTarget.style.color = "#fff"; }}
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
                  onFocus={e => e.target.style.borderColor = "#2563EB"}
                  onBlur={e => e.target.style.borderColor = "#2C2C2C"}
                />
                <button type="submit" style={{ padding: "9px 14px", background: "#2563EB", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>→</button>
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