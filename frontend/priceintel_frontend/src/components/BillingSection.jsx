// src/components/BillingSection.jsx
import React, { useState } from "react";
import { BILLING_MOCK } from "../mock/billingData";

const cardStyle = {
  background: "var(--d-surface)",
  border: "1px solid var(--d-border)",
  borderRadius: "12px",
  padding: "24px",
  marginBottom: "24px",
};

export default function BillingSection() {
  const [toastMessage, setToastMessage] = useState(null);

  function showNotice(msg) {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  }

  const { currentPlan, usage, paymentMethod, billingHistory } = BILLING_MOCK;

  return (
    <div className="animate-in">
      {/* Toast Notice Banner */}
      {toastMessage && (
        <div
          className="animate-in"
          style={{
            position: "sticky",
            top: "70px",
            zIndex: 100,
            marginBottom: "20px",
            padding: "12px 16px",
            borderRadius: "8px",
            background: "var(--d-accent-bg)",
            border: "1px solid var(--d-accent)",
            color: "var(--d-accent)",
            fontSize: "13.5px",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            style={{
              background: "none",
              border: "none",
              color: "var(--d-accent)",
              cursor: "pointer",
              padding: "2px",
              display: "flex",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* ── SECTION 1: CURRENT PLAN ─────────────────────────────── */}
      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "16px",
            marginBottom: "20px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.6px",
                  color: "var(--d-text-3)",
                }}
              >
                Current Plan
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--d-success)",
                  background: "var(--d-success-bg)",
                  border: "1px solid rgba(34, 197, 94, 0.25)",
                }}
              >
                <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--d-success)" }} />
                {currentPlan.badge}
              </span>
            </div>
            <h2 style={{ margin: "4px 0", fontSize: "22px", fontWeight: 700, color: "var(--d-text)" }}>
              {currentPlan.name}
            </h2>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--d-text-2)" }}>
              {currentPlan.description}
            </p>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--d-text)", letterSpacing: "-0.5px" }}>
              {currentPlan.price}
              <span style={{ fontSize: "13px", fontWeight: 400, color: "var(--d-text-3)", marginLeft: "4px" }}>
                / {currentPlan.interval}
              </span>
            </div>
            <div style={{ fontSize: "12px", color: "var(--d-text-2)", marginTop: "2px" }}>
              Billed monthly
            </div>
          </div>
        </div>

        {/* Plan stats summary grid */}
        <div
          className="res-grid-3"
          style={{
            background: "var(--d-surface-2)",
            border: "1px solid var(--d-border)",
            borderRadius: "10px",
            padding: "16px 20px",
            marginBottom: "20px",
          }}
        >
          <div>
            <div style={{ fontSize: "11.5px", color: "var(--d-text-3)", fontWeight: 500, marginBottom: "4px" }}>
              Tracked Products
            </div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--d-text)" }}>
              {currentPlan.trackedProductsCount.toLocaleString()} <span style={{ fontSize: "13px", color: "var(--d-text-3)", fontWeight: 400 }}>/ {currentPlan.trackedProductsLimit.toLocaleString()}</span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: "11.5px", color: "var(--d-text-3)", fontWeight: 500, marginBottom: "4px" }}>
              Price Checks
            </div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--d-text)" }}>
              {currentPlan.priceChecksCount.toLocaleString()} <span style={{ fontSize: "13px", color: "var(--d-text-3)", fontWeight: 400 }}>/ {currentPlan.priceChecksLimit.toLocaleString()}</span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: "11.5px", color: "var(--d-text-3)", fontWeight: 500, marginBottom: "4px" }}>
              Next Billing Date
            </div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--d-text)" }}>
              {currentPlan.nextBillingDate}
            </div>
          </div>
        </div>

        <button
          id="btn-manage-subscription"
          onClick={() => showNotice("Subscription management will be available soon.")}
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
            cursor: "pointer",
            transition: "all 0.15s ease",
            boxShadow: "0 2px 6px rgba(59, 130, 246, 0.25)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          Manage Subscription
        </button>
      </div>

      {/* ── SECTION 2: USAGE ────────────────────────────────────── */}
      <div style={cardStyle}>
        <div style={{ marginBottom: "20px" }}>
          <h2 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 600, color: "var(--d-text)" }}>
            Usage
          </h2>
          <p style={{ margin: 0, fontSize: "12.5px", color: "var(--d-text-3)" }}>
            Your current monthly consumption against plan allowances.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          {/* Progress Bar 1: Tracked Products */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--d-accent)" }}>
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
                <span style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--d-text)" }}>
                  Tracked Products
                </span>
              </div>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--d-text)" }}>
                {usage.trackedProducts.used.toLocaleString()} / {usage.trackedProducts.total.toLocaleString()}
                <span style={{ fontSize: "12px", color: "var(--d-text-3)", fontWeight: 400, marginLeft: "6px" }}>
                  ({usage.trackedProducts.percent}%)
                </span>
              </span>
            </div>

            {/* Progress Track */}
            <div
              style={{
                width: "100%",
                height: "8px",
                background: "var(--d-surface-2)",
                borderRadius: "4px",
                border: "1px solid var(--d-border)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${usage.trackedProducts.percent}%`,
                  height: "100%",
                  background: "var(--d-accent)",
                  borderRadius: "4px",
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>

          {/* Progress Bar 2: Price Checks */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#8b5cf6" }}>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--d-text)" }}>
                  Price Checks
                </span>
              </div>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--d-text)" }}>
                {usage.priceChecks.used.toLocaleString()} / {usage.priceChecks.total.toLocaleString()}
                <span style={{ fontSize: "12px", color: "var(--d-text-3)", fontWeight: 400, marginLeft: "6px" }}>
                  ({usage.priceChecks.percent}%)
                </span>
              </span>
            </div>

            {/* Progress Track */}
            <div
              style={{
                width: "100%",
                height: "8px",
                background: "var(--d-surface-2)",
                borderRadius: "4px",
                border: "1px solid var(--d-border)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${usage.priceChecks.percent}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #3B82F6 0%, #8b5cf6 100%)",
                  borderRadius: "4px",
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: PAYMENT METHOD ───────────────────────────── */}
      <div style={cardStyle}>
        <div style={{ marginBottom: "18px" }}>
          <h2 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 600, color: "var(--d-text)" }}>
            Payment Method
          </h2>
          <p style={{ margin: 0, fontSize: "12.5px", color: "var(--d-text-3)" }}>
            Card used for automatic subscription renewals and billing invoices.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
            padding: "16px 20px",
            borderRadius: "10px",
            background: "var(--d-surface-2)",
            border: "1px solid var(--d-border)",
            marginBottom: "18px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            {/* Card Logo Icon */}
            <div
              style={{
                width: "44px",
                height: "30px",
                borderRadius: "5px",
                background: "#1e293b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontWeight: 800,
                fontSize: "11px",
                letterSpacing: "0.5px",
                fontStyle: "italic",
                boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
              }}
            >
              VISA
            </div>

            <div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--d-text)", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>{paymentMethod.brand} •••• {paymentMethod.last4}</span>
                {paymentMethod.isDefault && (
                  <span
                    style={{
                      fontSize: "10.5px",
                      fontWeight: 600,
                      padding: "1px 6px",
                      borderRadius: "4px",
                      background: "var(--d-accent-bg)",
                      color: "var(--d-accent)",
                      border: "1px solid rgba(59, 130, 246, 0.2)",
                    }}
                  >
                    Default
                  </span>
                )}
              </div>
              <div style={{ fontSize: "12px", color: "var(--d-text-2)", marginTop: "2px" }}>
                Expires {paymentMethod.expiry}
              </div>
            </div>
          </div>

          <button
            id="btn-update-payment-method"
            onClick={() => showNotice("Payment method management will be available soon.")}
            style={{
              padding: "8px 16px",
              background: "var(--d-surface)",
              color: "var(--d-text)",
              border: "1px solid var(--d-border)",
              borderRadius: "8px",
              fontSize: "12.5px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--d-accent)";
              e.currentTarget.style.color = "var(--d-accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--d-border)";
              e.currentTarget.style.color = "var(--d-text)";
            }}
          >
            Update Payment Method
          </button>
        </div>
      </div>

      {/* ── SECTION 4: BILLING HISTORY ──────────────────────────── */}
      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "18px",
          }}
        >
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 600, color: "var(--d-text)" }}>
              Billing History
            </h2>
            <p style={{ margin: 0, fontSize: "12.5px", color: "var(--d-text-3)" }}>
              View and download past invoices and subscription receipts.
            </p>
          </div>

          <button
            id="btn-view-all-invoices"
            onClick={() => showNotice("All recent invoices are displayed below.")}
            style={{
              padding: "7px 14px",
              background: "transparent",
              color: "var(--d-accent)",
              border: "1px solid var(--d-border)",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--d-accent-bg)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            View All
          </button>
        </div>

        {/* Table Scroll Container */}
        <div className="table-scroll" style={{ border: "1px solid var(--d-border)", borderRadius: "8px", overflow: "hidden" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: "13px",
            }}
          >
            <thead>
              <tr style={{ background: "var(--d-surface-2)", borderBottom: "1px solid var(--d-border)" }}>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--d-text-3)", fontSize: "12px" }}>
                  Date
                </th>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--d-text-3)", fontSize: "12px" }}>
                  Description
                </th>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--d-text-3)", fontSize: "12px" }}>
                  Amount
                </th>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--d-text-3)", fontSize: "12px" }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {billingHistory.map((item, idx) => (
                <tr
                  key={item.id}
                  style={{
                    borderBottom: idx < billingHistory.length - 1 ? "1px solid var(--d-border)" : "none",
                    background: "var(--d-surface)",
                  }}
                >
                  <td style={{ padding: "14px 16px", color: "var(--d-text)", fontWeight: 500 }}>
                    {item.date}
                  </td>
                  <td style={{ padding: "14px 16px", color: "var(--d-text)" }}>
                    {item.description}
                  </td>
                  <td style={{ padding: "14px 16px", color: "var(--d-text)", fontWeight: 600 }}>
                    {item.amount}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        fontSize: "11.5px",
                        fontWeight: 600,
                        color: "var(--d-success)",
                        background: "var(--d-success-bg)",
                        border: "1px solid rgba(34, 197, 94, 0.25)",
                      }}
                    >
                      ✓ {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
