// src/pages/Onboarding.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AuthBackground from "../components/AuthBackground";
import apiRequest from "../api/client";
import { getStores } from "../api/products";
import { completeOnboarding } from "../api/auth";
import { useStore } from "../context/StoreContext";

const MARKETPLACE_OPTIONS = [
  { value: "daraz", label: "Daraz", color: "#E11D48", country: "Pakistan" },
  { value: "noon", label: "Noon", color: "#C2410C", country: "UAE" },
  { value: "other", label: "Other Marketplace", color: "#2563EB", country: "Pakistan" },
];

const COUNTRY_OPTIONS = ["Pakistan", "UAE", "Saudi Arabia"];

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshStores } = useStore();

  // Steps: 'welcome' | 'store_form' | 'store_success'
  const [step, setStep] = useState("welcome");
  const [loadingInitial, setLoadingInitial] = useState(true);

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
  const [createdStore, setCreatedStore] = useState(null);

  // Check auth and existing store state on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    async function checkExistingState() {
      try {
        const stores = await getStores();
        if (Array.isArray(stores) && stores.length > 0) {
          // User already has a store; let them proceed directly to success/tour
          setCreatedStore(stores[0]);
          setStep("store_success");
        } else if (searchParams.get("step") === "store") {
          setStep("store_form");
        }
      } catch {
        // Continue with default welcome
      } finally {
        setLoadingInitial(false);
      }
    }

    checkExistingState();
  }, [navigate, searchParams]);

  // Update country when marketplace changes if using standard defaults
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

    // Basic URL validation
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

      setCreatedStore(newStore);
      await refreshStores();
      setStep("store_success");
    } catch (err) {
      setError(err.message || "Failed to create store. Please check details and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleStartTour() {
    // Navigate to dashboard with tour query param to launch the interactive walkthrough
    navigate("/dashboard?tour=true");
  }

  async function handleSkipTour() {
    try {
      await completeOnboarding();
    } catch {
      // Ignore API errors and navigate anyway
    }
    localStorage.setItem("onboarding_completed", "true");
    navigate("/dashboard");
  }

  if (loadingInitial) {
    return (
      <div className="auth-page">
        <AuthBackground />
        <div style={{ zIndex: 2, color: "#475569", fontSize: "14px", fontWeight: 500 }}>
          Loading your onboarding…
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <AuthBackground />

      <div
        className="auth-card"
        style={{
          width: "100%",
          maxWidth: step === "store_form" ? "480px" : "440px",
          background: "var(--d-surface, #ffffff)",
          border: "1px solid var(--d-border, #E2E8F0)",
          borderRadius: "16px",
          padding: "32px 28px",
          boxShadow: "0 20px 48px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)",
          position: "relative",
          zIndex: 2,
          transition: "all 0.25s ease",
        }}
      >
        {/* Logo / Header Icon */}
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
            {/* Step indicator */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", width: "fit-content", padding: "3px 10px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "100px", color: "#2563EB", fontSize: "11px", fontWeight: 600, marginBottom: "16px" }}>
              <span>🚀 Getting Started</span>
            </div>

            <h1
              style={{
                fontSize: "24px",
                fontWeight: 800,
                color: "var(--d-text, #0F172A)",
                margin: "0 0 10px",
                letterSpacing: "-0.5px",
                lineHeight: 1.25,
              }}
            >
              Welcome to Price Intel
            </h1>

            <p
              style={{
                fontSize: "14px",
                color: "var(--d-text-2, #475569)",
                margin: "0 0 26px",
                lineHeight: 1.55,
              }}
            >
              Let's get your store set up and start monitoring your competitors in real time.
            </p>

            {/* Feature preview list */}
            <div
              style={{
                background: "var(--d-surface-2, #F8FAFC)",
                border: "1px solid var(--d-border, #E2E8F0)",
                borderRadius: "12px",
                padding: "16px 18px",
                marginBottom: "26px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {[
                { title: "Connect Marketplace", desc: "Link your Daraz or Noon seller account" },
                { title: "Automated Tracking", desc: "Discover and monitor competing listings" },
                { title: "Price Alerts", desc: "Instant notifications when rival prices change" },
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
                    <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#1E293B" }}>{item.title}</div>
                    <div style={{ fontSize: "11.5px", color: "#64748B" }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <button
              id="btn-onboarding-add-store"
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

        {/* ── STEP 2: ADD STORE FORM ─────────────────────────────────── */}
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

            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--d-text, #0F172A)", margin: "0 0 6px", letterSpacing: "-0.3px" }}>
              Add Your Store
            </h2>
            <p style={{ fontSize: "13px", color: "var(--d-text-2, #64748B)", margin: "0 0 20px" }}>
              Enter your marketplace seller details so Price Intel can track your inventory.
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
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>⚠️</span> {error}
              </div>
            )}

            <form onSubmit={handleStoreSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Marketplace & Country row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                    Marketplace *
                  </label>
                  <select
                    id="input-onboarding-marketplace"
                    value={marketplace}
                    onChange={(e) => handleMarketplaceChange(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--d-border, #CBD5E1)",
                      background: "var(--d-surface, #FFFFFF)",
                      color: "var(--d-text, #0F172A)",
                      fontSize: "13.5px",
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
                    id="input-onboarding-country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--d-border, #CBD5E1)",
                      background: "var(--d-surface, #FFFFFF)",
                      color: "var(--d-text, #0F172A)",
                      fontSize: "13.5px",
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
                  id="input-onboarding-store-name"
                  type="text"
                  placeholder="e.g. TechZone Official"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--d-border, #CBD5E1)",
                    background: "var(--d-surface, #FFFFFF)",
                    color: "var(--d-text, #0F172A)",
                    fontSize: "13.5px",
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
                  id="input-onboarding-store-url"
                  type="url"
                  placeholder="https://www.daraz.pk/shop/techzone"
                  value={storeUrl}
                  onChange={(e) => setStoreUrl(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--d-border, #CBD5E1)",
                    background: "var(--d-surface, #FFFFFF)",
                    color: "var(--d-text, #0F172A)",
                    fontSize: "13.5px",
                    fontFamily: "inherit",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <span style={{ fontSize: "11px", color: "#64748B", marginTop: "4px", display: "block" }}>
                  The public web address of your seller storefront.
                </span>
              </div>

              {/* Advanced optional fields toggle */}
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
                id="btn-onboarding-submit-store"
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
                {submitting ? "Saving store…" : "Continue →"}
              </button>
            </form>
          </div>
        )}

        {/* ── STEP 3: STORE CREATED SUCCESS ──────────────────────────── */}
        {step === "store_success" && (
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
            {/* Green check icon */}
            <div
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "50%",
                background: "#DCFCE7",
                color: "#16A34A",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
                fontWeight: 700,
                marginBottom: "16px",
                boxShadow: "0 4px 14px rgba(22, 163, 74, 0.2)",
              }}
            >
              ✓
            </div>

            <h2 style={{ fontSize: "22px", fontWeight: 800, color: "var(--d-text, #0F172A)", margin: "0 0 8px", letterSpacing: "-0.4px" }}>
              Store Created Successfully!
            </h2>

            <p style={{ fontSize: "13.5px", color: "var(--d-text-2, #64748B)", margin: "0 0 20px", maxWidth: "340px", lineHeight: 1.5 }}>
              Your store <strong style={{ color: "#0F172A" }}>{createdStore?.store_name || "New Store"}</strong> is now connected. Let's take a quick interactive tour of the platform.
            </p>

            {/* Store card summary */}
            {createdStore && (
              <div
                style={{
                  width: "100%",
                  background: "var(--d-surface-2, #F8FAFC)",
                  border: "1px solid var(--d-border, #E2E8F0)",
                  borderRadius: "10px",
                  padding: "12px 16px",
                  marginBottom: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A" }}>{createdStore.store_name}</div>
                  <div style={{ fontSize: "11px", color: "#64748B" }}>{createdStore.country}</div>
                </div>
                <span
                  style={{
                    padding: "3px 9px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    background: createdStore.marketplace === "daraz" ? "#FFE4E6" : "#FFEDD5",
                    color: createdStore.marketplace === "daraz" ? "#E11D48" : "#C2410C",
                  }}
                >
                  {createdStore.marketplace}
                </span>
              </div>
            )}

            {/* Actions */}
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                id="btn-onboarding-start-tour"
                onClick={handleStartTour}
                style={{
                  width: "100%",
                  padding: "13px",
                  background: "#2563EB",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(37, 99, 235, 0.35)",
                  transition: "all 0.15s ease",
                }}
              >
                Start Website Tour →
              </button>

              <button
                id="btn-onboarding-skip-tour"
                onClick={handleSkipTour}
                style={{
                  width: "100%",
                  padding: "9px",
                  background: "transparent",
                  color: "#64748B",
                  border: "none",
                  fontSize: "12.5px",
                  fontWeight: 500,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                Skip Tour & Go to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
