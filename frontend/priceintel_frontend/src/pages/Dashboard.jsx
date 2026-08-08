import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import Layout from "../components/Layout";

// ── TEMPORARY placeholder data — Task 2 will replace with real API calls ──

const kpis = [
  {
    label: "Tracked Products",
    value: "84",
    sub: "Products monitored",
    color: "var(--d-accent)",
    bg: "var(--d-accent-bg)",
  },
  {
    label: "Unread Alerts",
    value: "12",
    sub: "Require attention",
    color: "var(--d-danger)",
    bg: "var(--d-danger-bg)",
  },
  {
    label: "Lowest Price Wins",
    value: "31",
    sub: "You're the cheapest",
    color: "var(--d-success)",
    bg: "var(--d-success-bg)",
  },
  {
    label: "Active Competitors",
    value: "47",
    sub: "Competitor listings",
    color: "#7C3AED",
    bg: "#F5F3FF",
  },
];

const activity = [
  {
    text: "Tech Store reduced the price of Samsung Galaxy Buds by 5.3%",
    time: "2 min ago",
    type: "drop",
  },
  {
    text: "Noon Store went out of stock on iPhone 15 Pro Max",
    time: "1 hr ago",
    type: "stock",
  },
  {
    text: "You are now the cheapest seller on AirPods Pro 2",
    time: "3 hrs ago",
    type: "win",
  },
];

const typeStyles = {
  drop: { icon: "↓", color: "var(--d-danger)", bg: "var(--d-danger-bg)" },
  stock: { icon: "!", color: "var(--d-warning)", bg: "var(--d-warning-bg)" },
  win: { icon: "✓", color: "var(--d-success)", bg: "var(--d-success-bg)" },
};

// ── SAMPLE data — Price trend last 7 days
// Replace with real API data in Task 3 (analytics endpoint)
const priceTrendData = [
  { day: "Mon", yourPrice: 245, competitorPrice: 260 },
  { day: "Tue", yourPrice: 245, competitorPrice: 258 },
  { day: "Wed", yourPrice: 240, competitorPrice: 255 },
  { day: "Thu", yourPrice: 240, competitorPrice: 250 },
  { day: "Fri", yourPrice: 238, competitorPrice: 248 },
  { day: "Sat", yourPrice: 235, competitorPrice: 245 },
  { day: "Sun", yourPrice: 235, competitorPrice: 240 },
];

// ── SAMPLE data — Market health score (0–100)
// Replace with real API data in Task 3
const HEALTH_SCORE = 72;

function getHealthMeta(score) {
  if (score >= 70) return { color: "#16A34A", label: "Good", bg: "#F0FDF4" };
  if (score >= 40) return { color: "#D97706", label: "Fair", bg: "#FFFBEB" };
  return { color: "#DC2626", label: "At Risk", bg: "#FEF2F2" };
}

// ── Custom tooltip for the line chart ──────────────────────
function PriceTrendTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E4E4E7",
        borderRadius: "8px",
        padding: "10px 14px",
        fontSize: "12px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
      }}
    >
      <p style={{ margin: "0 0 6px", fontWeight: 600, color: "#18181B" }}>{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ margin: "2px 0", color: entry.color }}>
          {entry.name}: <strong>AED {entry.value}</strong>
        </p>
      ))}
    </div>
  );
}

// ── Shared card style ──────────────────────────────────────
const card = {
  background: "var(--d-surface)",
  border: "1px solid var(--d-border)",
  borderRadius: "12px",
  padding: "20px",
};

function Dashboard() {
  const healthMeta = getHealthMeta(HEALTH_SCORE);
  // Gauge arcs: filled slice + empty background slice
  const gaugeData = [
    { value: HEALTH_SCORE },
    { value: 100 - HEALTH_SCORE },
  ];

  return (
    <Layout>
      {/* ── Page header ───────────────────────────────────── */}
      <div className="animate-in" style={{ marginBottom: "28px" }}>
        <h1
          style={{
            fontSize: "20px",
            fontWeight: 700,
            color: "var(--d-text)",
            margin: 0,
            letterSpacing: "-0.3px",
          }}
        >
          Dashboard
        </h1>
        <p
          style={{
            fontSize: "13px",
            color: "var(--d-text-2)",
            margin: "4px 0 0",
          }}
        >
          Monitor your pricing position across all marketplaces.
        </p>
      </div>

      {/* ── KPI grid ──────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "14px",
          marginBottom: "20px",
        }}
      >
        {kpis.map((k, i) => (
          <div
            key={k.label}
            className="animate-in hover-lift"
            style={{ ...card, animationDelay: `${i * 0.06}s` }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "var(--d-text-3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.4px",
                }}
              >
                {k.label}
              </p>

            </div>
            <p
              style={{
                margin: "12px 0 2px",
                fontSize: "28px",
                fontWeight: 700,
                color: "var(--d-text)",
                letterSpacing: "-1px",
              }}
            >
              {k.value}
            </p>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--d-text-3)" }}>
              {k.sub}
            </p>
          </div>
        ))}
      </div>

      {/* ── Market Position + Recent Activity ─────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "14px",
          marginBottom: "20px",
        }}
      >
        {/* Market position */}
        <div className="animate-in" style={{ ...card, animationDelay: "0.24s" }}>
          <h2 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--d-text)" }}>
            Market Position
          </h2>
          <p style={{ margin: "4px 0 18px", fontSize: "12px", color: "var(--d-text-3)" }}>
            Pricing competitiveness across tracked products
          </p>

          {/* Progress bar */}
          <div
            style={{
              display: "flex",
              height: "8px",
              borderRadius: "999px",
              overflow: "hidden",
              gap: "2px",
            }}
          >
            <div style={{ width: "45%", background: "var(--d-success)", borderRadius: "999px 0 0 999px" }} />
            <div style={{ width: "28%", background: "var(--d-accent)" }} />
            <div style={{ width: "27%", background: "var(--d-danger)", borderRadius: "0 999px 999px 0" }} />
          </div>

          <div
            style={{
              display: "flex",
              gap: "16px",
              marginTop: "14px",
              fontSize: "12px",
              color: "var(--d-text-3)",
            }}
          >
            <span>
              <span style={{ color: "var(--d-success)", fontWeight: 600 }}>● </span>
              Cheapest <b style={{ color: "var(--d-text-2)" }}>45%</b>
            </span>
            <span>
              <span style={{ color: "var(--d-accent)", fontWeight: 600 }}>● </span>
              Competitive <b style={{ color: "var(--d-text-2)" }}>28%</b>
            </span>
            <span>
              <span style={{ color: "var(--d-danger)", fontWeight: 600 }}>● </span>
              Overpriced <b style={{ color: "var(--d-text-2)" }}>27%</b>
            </span>
          </div>
        </div>

        {/* Recent activity */}
        <div className="animate-in" style={{ ...card, animationDelay: "0.3s" }}>
          <h2 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--d-text)" }}>
            Recent Activity
          </h2>
          <p style={{ margin: "4px 0 16px", fontSize: "12px", color: "var(--d-text-3)" }}>
            Latest competitor changes detected
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {activity.map((a, i) => {
              const s = typeStyles[a.type];
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    padding: "10px",
                    borderRadius: "8px",
                    background: "var(--d-bg)",
                    transition: "background 0.12s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#EFEFF5")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--d-bg)")}
                >
                  <span
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "6px",
                      background: s.bg,
                      color: s.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "11px",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {s.icon}
                  </span>
                  <div>
                    <p style={{ margin: 0, fontSize: "12px", color: "var(--d-text)", lineHeight: 1.5 }}>
                      {a.text}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--d-text-3)" }}>
                      {a.time}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── NEW: Price Trend + Market Health row ──────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: "14px",
        }}
      >
        {/* ── 1. Price Trend Line Chart ─────────────────── */}
        <div className="animate-in" style={{ ...card, animationDelay: "0.36s" }}>
          <h2 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--d-text)" }}>
            Pricing Trend (Last 7 Days)
          </h2>
          <p style={{ margin: "4px 0 20px", fontSize: "12px", color: "var(--d-text-3)" }}>
            Average price movement across your tracked products vs competitors.
          </p>

          <ResponsiveContainer width="100%" height={200}>
            <LineChart
              data={priceTrendData}
              margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#E4E4E7"
                vertical={false}
              />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: "#A1A1AA", fontFamily: "Inter, sans-serif" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 11, fill: "#A1A1AA", fontFamily: "Inter, sans-serif" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}`}
                width={36}
              />
              <Tooltip content={<PriceTrendTooltip />} />
              <Legend
                wrapperStyle={{
                  fontSize: "11px",
                  color: "#52525B",
                  paddingTop: "12px",
                  fontFamily: "Inter, sans-serif",
                }}
                iconType="circle"
                iconSize={8}
              />
              <Line
                type="monotone"
                dataKey="yourPrice"
                name="Your Avg Price (AED)"
                stroke="#4F46E5"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#4F46E5", strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
              <Line
                type="monotone"
                dataKey="competitorPrice"
                name="Competitor Avg (AED)"
                stroke="#A1A1AA"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={{ r: 3, fill: "#A1A1AA", strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ── 2. Market Health Gauge ────────────────────── */}
        <div
          className="animate-in"
          style={{ ...card, animationDelay: "0.42s", display: "flex", flexDirection: "column" }}
        >
          <h2 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--d-text)" }}>
            Market Health Score
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--d-text-3)" }}>
            Overall competitiveness across your catalog.
          </p>

          {/* Gauge chart with centered label */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", minHeight: "180px" }}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={gaugeData}
                  cx="50%"
                  cy="50%"
                  innerRadius="62%"
                  outerRadius="80%"
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  strokeWidth={0}
                  isAnimationActive={true}
                  animationDuration={900}
                >
                  {/* Filled arc */}
                  <Cell fill={healthMeta.color} />
                  {/* Empty arc */}
                  <Cell fill="#E4E4E7" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* Centered score text — absolutely overlaid */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                textAlign: "center",
                pointerEvents: "none",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "36px",
                  fontWeight: 700,
                  color: healthMeta.color,
                  letterSpacing: "-2px",
                  lineHeight: 1,
                }}
              >
                {HEALTH_SCORE}
              </p>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: healthMeta.color,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                {healthMeta.label}
              </p>
            </div>
          </div>

          {/* Score bands legend */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "14px",
              fontSize: "11px",
              color: "var(--d-text-3)",
              marginTop: "8px",
            }}
          >
            <span><span style={{ color: "#DC2626", fontWeight: 600 }}>● </span>At Risk &lt;40</span>
            <span><span style={{ color: "#D97706", fontWeight: 600 }}>● </span>Fair 40–70</span>
            <span><span style={{ color: "#16A34A", fontWeight: 600 }}>● </span>Good &gt;70</span>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default Dashboard;