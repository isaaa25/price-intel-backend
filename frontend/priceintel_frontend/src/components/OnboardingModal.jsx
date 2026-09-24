// src/components/OnboardingModal.jsx
import React, { useState } from "react";
import apiRequest from "../api/client";
import { useStore } from "../context/StoreContext";

const MARKETPLACE_OPTIONS = [
  { value: "daraz", label: "Daraz", color: "#E11D48", country: "Pakistan" },
  { value: "noon", label: "Noon", color: "#C2410C", country: "UAE" },
  { value: "other", label: "Other Marketplace", color: "#2563EB", country: "Pakistan" },
];

const COUNTRY_OPTIONS = ["Pakistan", "UAE", "Saudi Arabia"];

export default function OnboardingModal({ open, onStoreConnected }) {
  const { refreshStores } = useStore();

  // Steps: 'welcome' | 'store_form'
  const [step, setStep] = useState("welcome");

  // Form states
  const [marketplace, setMarketplace] = useState("daraz");
  const [country, setCountry] = useState("Pakistan");
  const [storeName, setStoreName] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [storeSlug, setStoreSlug] = useState("");
  const [externalId, setExternalId] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleMarketplaceChange = (val) => {
    setMarketplace(val);
    const match = MARKETPLACE_OPTIONS.find((m) => m.value === val);
    if (match) setCountry(match.country);
  };

  const isFormValid = Boolean(marketplace && country && storeName.trim() && storeUrl.trim());

  async function handleStoreSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setError("");

    if (!isFormValid) {
      setError("Please fill in all required fields (Marketplace, Country, Store Name, and Store URL).");
      return;
    }

    try {
      new URL(storeUrl.trim());
    } catch {
      setError("Please enter a valid URL (including https://).");
      return;
    }

    setSubmitting(true);
    try {
      const newStore = await apiRequest("/stores/", {
        method: "POST",
        body: JSON.stringify({
          marketplace,
          country,
          store_name: storeName.trim(),
          store_slug: storeSlug.trim() || null,
          external_store_id: externalId.trim() || null,
          store_url: storeUrl.trim(),
        }),
      });

      await refreshStores();
      if (onStoreConnected) {
        onStoreConnected(newStore);
      }
    } catch (err) {
      setError(err.message || "Failed to create store. Please check details and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      id="onboarding-modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.45)",
        backdropFilter: "blur(2px)",
        zIndex: 9990,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        animation: "fadeIn 0.2s ease",
      }}
    >
      <div
        id="onboarding-modal-card"
        style={{
          width: "100%",
          maxWidth: "480px",
          background: "#FFFFFF",
          borderRadius: "18px",
          border: "1px solid #E2E8F0",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.2), 0 4px 12px rgba(0, 0, 0, 0.05)",
          padding: "32px 28px",
          position: "relative",
          zIndex: 9991,
          boxSizing: "border-box",
          animation: "scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Brand Icon Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(37, 99, 235, 0.35)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "#0F172A", letterSpacing: "-0.2px" }}>
              Price Intel
            </div>
            <div style={{ fontSize: "11px", color: "#64748B", fontWeight: 500 }}>
              Competitive Intelligence
            </div>
          </div>
        </div>

        {/* ── STEP 1: WELCOME SCREEN ─────────────────────────────────── */}
        {step === "welcome" && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", width: "fit-content", padding: "3px 10px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "100px", color: "#2563EB", fontSize: "11px", fontWeight: 600, marginBottom: "14px" }}>
              <span>🚀 Getting Started</span>
            </div>

            <h2
              style={{
                fontSize: "22px",
                fontWeight: 800,
                color: "#0F172A",
                margin: "0 0 8px",
                letterSpacing: "-0.4px",
                lineHeight: 1.3,
              }}
            >
              Welcome to Price Intel
            </h2>

            <p
              style={{
                fontSize: "13.5px",
                color: "#475569",
                margin: "0 0 22px",
                lineHeight: 1.55,
              }}
            >
              Let's get your store set up and start monitoring your competitors in real time.
            </p>

            {/* Feature preview list */}
            <div
              style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: "12px",
                padding: "16px 18px",
                marginBottom: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {[
                { title: "Connect your marketplace", desc: "Link your Daraz or Noon seller account" },
                { title: "Track competing products", desc: "Discover and monitor rival price changes" },
                { title: "Receive price alerts", desc: "Instant notifications when rival prices change" },
              ].map((item, idx) => (
                <div key={idx} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      background: "#DCFCE7",
                      color: "#16A34A",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "11px",
                      fontWeight: 700,
                      flexShrink: 0,
                      marginTop: "1px",
                    }}
                  >
                    ✓
                  </div>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#1E293B" }}>{item.title}</div>
                    <div style={{ fontSize: "11.5px", color: "#64748B" }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <button
              id="btn-modal-add-store"
              type="button"
              onClick={() => setStep("store_form")}
              style={{
                padding: "13px 20px",
                background: "#2563EB",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "10px",
                fontSize: "14px",
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(37, 99, 235, 0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "all 0.15s ease",
              }}
            >
              Add Your Store →
            </button>
          </div>
        )}

        {/* ── STEP 2: STORE SETUP FORM ───────────────────────────────── */}
        {step === "store_form" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <button
                type="button"
                onClick={() => setStep("welcome")}
                style={{
                  background: "none",
                  border: "none",
                  color: "#64748B",
                  fontSize: "12px",
                  fontWeight: 500,
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                ← Back
              </button>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#2563EB", background: "#EFF6FF", padding: "2px 8px", borderRadius: "100px" }}>
                Step 1 of 2
              </span>
            </div>

            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#0F172A", margin: "0 0 6px", letterSpacing: "-0.3px" }}>
              Add Your Store
            </h2>
            <p style={{ fontSize: "13px", color: "#64748B", margin: "0 0 18px" }}>
              Enter your marketplace seller storefront details so Price Intel can monitor your inventory.
            </p>

            {error && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  color: "#B91C1C",
                  fontSize: "12.5px",
                  marginBottom: "14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>⚠️</span> {error}
              </div>
            )}

            <form onSubmit={handleStoreSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Marketplace & Country */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                    Marketplace *
                  </label>
                  <select
                    id="input-modal-marketplace"
                    value={marketplace}
                    onChange={(e) => handleMarketplaceChange(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      background: "#FFFFFF",
                      color: "#0F172A",
                      fontSize: "13px",
                      fontFamily: "inherit",
                      outline: "none",
                    }}
                  >
                    {MARKETPLACE_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                    Country *
                  </label>
                  <select
                    id="input-modal-country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      background: "#FFFFFF",
                      color: "#0F172A",
                      fontSize: "13px",
                      fontFamily: "inherit",
                      outline: "none",
                    }}
                  >
                    {COUNTRY_OPTIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Store Name */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Store Name *
                </label>
                <input
                  id="input-modal-store-name"
                  type="text"
                  placeholder="e.g. TechZone Official"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    background: "#FFFFFF",
                    color: "#0F172A",
                    fontSize: "13px",
                    fontFamily: "inherit",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Store URL */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Store URL *
                </label>
                <input
                  id="input-modal-store-url"
                  type="url"
                  placeholder="https://www.daraz.pk/shop/techzone"
                  value={storeUrl}
                  onChange={(e) => setStoreUrl(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    background: "#FFFFFF",
                    color: "#0F172A",
                    fontSize: "13px",
                    fontFamily: "inherit",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <span style={{ fontSize: "11px", color: "#64748B", marginTop: "4px", display: "block" }}>
                  The public web address of your seller storefront.
                </span>
              </div>

              {/* Optional details toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#2563EB",
                    fontSize: "12px",
                    fontWeight: 500,
                    cursor: "pointer",
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span>{showAdvanced ? "▾ Hide" : "▸ Show"} optional details (slug / ID)</span>
                </button>

                {showAdvanced && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", color: "#64748B", marginBottom: "4px" }}>Store Slug</label>
                      <input
                        type="text"
                        placeholder="techzone-pk"
                        value={storeSlug}
                        onChange={(e) => setStoreSlug(e.target.value)}
                        style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "12px", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", color: "#64748B", marginBottom: "4px" }}>External ID</label>
                      <input
                        type="text"
                        placeholder="p-12345"
                        value={externalId}
                        onChange={(e) => setExternalId(e.target.value)}
                        style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "12px", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Submit CTA */}
              <button
                id="btn-modal-submit-store"
                type="submit"
                disabled={submitting || !isFormValid}
                style={{
                  marginTop: "8px",
                  padding: "12px",
                  background: !isFormValid || submitting ? "#94A3B8" : "#2563EB",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: !isFormValid || submitting ? "not-allowed" : "pointer",
                  boxShadow: isFormValid && !submitting ? "0 4px 14px rgba(37, 99, 235, 0.35)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                {submitting ? "Connecting store…" : "Connect Store →"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
