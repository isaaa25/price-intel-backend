// src/pages/Account.jsx
import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import { getStores } from "../api/products";
import apiRequest from "../api/client";
import { useStore } from "../context/StoreContext";
import { parseMarketplaceUrl } from "../api/marketplaceUrl";

const cardStyle = {
  background: "var(--d-surface)",
  border: "1px solid var(--d-border)",
  borderRadius: "12px",
  padding: "24px",
};

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  border: "1px solid var(--d-border)",
  borderRadius: "8px",
  background: "var(--d-surface-2)",
  color: "var(--d-text)",
  fontSize: "14px",
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s ease",
};

const labelStyle = {
  display: "block",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--d-text-2)",
  marginBottom: "6px",
};

const MARKETPLACE_OPTIONS = ["noon", "daraz"];
const COUNTRY_OPTIONS = [
  "UAE",
  "Saudi Arabia",
  "Egypt",
  "Kuwait",
  "Qatar",
  "Bahrain",
  "Pakistan",
  "Bangladesh",
  "Nepal",
  "Myanmar",
];

function MarketplaceBadge({ marketplace }) {
  const normalized = (marketplace || "other").toLowerCase();
  const styles = {
    noon: {
      color: "#ea580c",
      background: "rgba(234, 88, 12, 0.10)",
      border: "1px solid rgba(234, 88, 12, 0.20)",
    },
    daraz: {
      color: "#e11d48",
      background: "rgba(225, 29, 72, 0.10)",
      border: "1px solid rgba(225, 29, 72, 0.20)",
    },
    amazon: {
      color: "#d97706",
      background: "rgba(217, 119, 6, 0.10)",
      border: "1px solid rgba(217, 119, 6, 0.20)",
    },
    other: {
      color: "var(--d-accent)",
      background: "var(--d-accent-bg)",
      border: "1px solid rgba(59, 130, 246, 0.20)",
    },
  };

  const current = styles[normalized] || styles.other;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "3px 9px",
        borderRadius: "6px",
        fontSize: "11px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        color: current.color,
        background: current.background,
        border: current.border,
      }}
    >
      {marketplace || "OTHER"}
    </span>
  );
}

function StatusBadge({ active }) {
  const isActive = active !== false;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "3px 9px",
        borderRadius: "6px",
        fontSize: "11.5px",
        fontWeight: 600,
        color: isActive ? "var(--d-success)" : "var(--d-text-3)",
        background: isActive ? "var(--d-success-bg)" : "var(--d-surface-2)",
        border: `1px solid ${isActive ? "rgba(34, 197, 94, 0.25)" : "var(--d-border)"}`,
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: isActive ? "var(--d-success)" : "var(--d-text-3)",
        }}
      />
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

function StoreCard({ store, onDelete, isSelected, onSelect }) {
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <div
      className="animate-in hover-lift"
      style={{
        background: "var(--d-surface)",
        border: isSelected ? "2px solid var(--d-accent)" : "1px solid var(--d-border)",
        borderRadius: "12px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: "16px",
        position: "relative",
        boxShadow: isSelected ? "0 0 0 1px var(--d-accent)" : "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
        <MarketplaceBadge marketplace={store.marketplace} />
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {isSelected ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "3px 9px",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: 700,
                color: "#2563eb",
                background: "rgba(37, 99, 235, 0.12)",
                border: "1px solid rgba(37, 99, 235, 0.3)",
              }}
            >
              ✓ Active Store
            </span>
          ) : (
            <button
              onClick={() => onSelect && onSelect(store)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "3px 9px",
                borderRadius: "6px",
                fontSize: "11.5px",
                fontWeight: 600,
                color: "var(--d-accent)",
                background: "var(--d-accent-bg)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Select Store
            </button>
          )}
          <StatusBadge active={store.is_active} />
        </div>
      </div>

      <div>
        <h3
          style={{
            margin: "0 0 6px",
            fontSize: "16px",
            fontWeight: 700,
            color: "var(--d-text)",
            letterSpacing: "-0.2px",
            wordBreak: "break-word",
          }}
        >
          {store.store_name}
        </h3>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12.5px",
            color: "var(--d-text-2)",
            marginBottom: "8px",
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span>{store.country || "Global"}</span>
        </div>

        {store.store_url && (
          <div
            style={{
              fontSize: "12px",
              color: "var(--d-text-3)",
              background: "var(--d-surface-2)",
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid var(--d-border)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={store.store_url}
          >
            {store.store_url}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: "14px",
          borderTop: "1px solid var(--d-border)",
          gap: "10px",
        }}
      >
        {store.store_url ? (
          <a
            href={store.store_url}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "12.5px",
              fontWeight: 600,
              color: "var(--d-accent)",
              textDecoration: "none",
              transition: "opacity 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.75")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            <span>Visit Store</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        ) : (
          <span style={{ fontSize: "12px", color: "var(--d-text-3)" }}>No URL</span>
        )}

        <button
          onClick={async () => {
            setIsDeleting(true);
            await onDelete(store);
            setIsDeleting(false);
          }}
          disabled={isDeleting}
          title="Delete Store"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            background: "transparent",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            color: "var(--d-danger)",
            padding: "5px 10px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: isDeleting ? "not-allowed" : "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            if (!isDeleting) {
              e.currentTarget.style.background = "var(--d-danger-bg)";
              e.currentTarget.style.borderColor = "var(--d-danger)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.25)";
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          <span>{isDeleting ? "Deleting..." : "Delete"}</span>
        </button>
      </div>
    </div>
  );
}

function Account() {
  const { refreshStores, stores: contextStores, selectedStore, setSelectedStore } = useStore();
  const [stores, setStores] = useState([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [storesError, setStoresError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [marketplace, setMarketplace] = useState("noon");
  const [country, setCountry] = useState("UAE");
  const [storeName, setStoreName] = useState("");
  const [storeSlug, setStoreSlug] = useState("");
  const [externalId, setExternalId] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // URL auto-detect state (must live inside Account)
  const [urlMeta, setUrlMeta] = useState(null);
  const [urlError, setUrlError] = useState("");

  function handleStoreUrlChange(value) {
    setStoreUrl(value);
    setUrlError("");
    setUrlMeta(null);
    if (!value.trim()) return;
    try {
      const info = parseMarketplaceUrl(value);
      setUrlMeta(info);
      setMarketplace(info.marketplace);
      setCountry(info.country);
    } catch (err) {
      setUrlError(err.message || "Invalid store URL.");
    }
  }

  function resetForm() {
    setStoreName("");
    setStoreSlug("");
    setExternalId("");
    setStoreUrl("");
    setUrlMeta(null);
    setUrlError("");
    setMarketplace("noon");
    setCountry("UAE");
  }

  function loadStores() {
    setStoresLoading(true);
    setStoresError("");
    getStores()
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setStores(list);
        refreshStores();
      })
      .catch((err) => setStoresError(err.message || "Failed to load stores."))
      .finally(() => setStoresLoading(false));
  }

  useEffect(() => {
    loadStores();
  }, []);

  const isFormValid = Boolean(
    marketplace &&
      country &&
      storeName.trim() &&
      storeUrl.trim() &&
      !urlError &&
      urlMeta
  );

  async function handleAddStore(e) {
    e.preventDefault();
    setSubmitError("");
    setSuccessMsg("");

    if (!storeName.trim() || !storeUrl.trim()) {
      setSubmitError("Please fill in Store Name and Store URL.");
      return;
    }

    if (urlError || !urlMeta) {
      setSubmitError(
        urlError ||
          "Enter a valid Noon or Daraz store URL so we can detect marketplace and country."
      );
      return;
    }

    setSubmitting(true);
    try {
      const created = await apiRequest("/stores/", {
        method: "POST",
        body: JSON.stringify({
          marketplace: urlMeta.marketplace,
          country: urlMeta.country,
          store_name: storeName.trim(),
          store_slug: storeSlug.trim() || null,
          external_store_id: externalId.trim() || null,
          store_url: storeUrl.trim(),
        }),
      });
      setSuccessMsg("Store added successfully!");
      resetForm();
      setShowForm(false);
      loadStores();
      const updated = await refreshStores();
      if (created && created.id) {
        setSelectedStore(created);
      } else if (Array.isArray(updated) && updated.length > 0) {
        setSelectedStore(updated[0]);
      }
    } catch (err) {
      setSubmitError(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteStore(store) {
    if (!window.confirm(`Are you sure you want to delete "${store.store_name}"? This action cannot be undone.`)) {
      return;
    }
    setSubmitError("");
    setSuccessMsg("");
    try {
      await apiRequest(`/stores/${store.id}`, {
        method: "DELETE",
      });
      setSuccessMsg(`Store "${store.store_name}" deleted successfully.`);
      loadStores();
      const updated = await refreshStores();
      if (selectedStore?.id === store.id) {
        if (Array.isArray(updated) && updated.length > 0) {
          setSelectedStore(updated[0]);
        } else {
          setSelectedStore(null);
        }
      }
    } catch (err) {
      setSubmitError(err.message || "Failed to delete store.");
    }
  }

  return (
    <Layout>
      <div className="animate-in" style={{ marginBottom: "20px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            color: "var(--d-text-3)",
            marginBottom: "4px",
          }}
        >
          <span style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Account
          </span>
          <span>/</span>
          <span style={{ color: "var(--d-accent)", fontWeight: 600 }}>Stores</span>
        </div>

        <h1
          style={{
            margin: "4px 0 0",
            fontSize: "22px",
            fontWeight: 700,
            color: "var(--d-text)",
            letterSpacing: "-0.4px",
          }}
        >
          Stores
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--d-text-2)" }}>
          Manage your connected marketplace seller accounts and active store tracking.
        </p>
      </div>

      <div
        className="animate-in"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          borderBottom: "1px solid var(--d-border)",
          paddingBottom: "12px",
          marginBottom: "24px",
        }}
      >
        <button
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            padding: "8px 16px",
            borderRadius: "8px",
            border: "1px solid var(--d-accent)",
            background: "var(--d-accent-bg)",
            color: "var(--d-accent)",
            fontWeight: 600,
            fontSize: "13px",
            cursor: "default",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          Stores ({(stores.length > 0 ? stores : contextStores).length})
        </button>
      </div>

      <div className="animate-in" style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "22px",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "var(--d-text)" }}>
              Your Stores
            </h2>
            <p style={{ margin: "3px 0 0", fontSize: "12.5px", color: "var(--d-text-2)" }}>
              Seller accounts connected to your Price Intel workspace.
            </p>
          </div>

          <button
            id="btn-add-store-toggle"
            onClick={() => {
              setShowForm(!showForm);
              setSubmitError("");
              setSuccessMsg("");
              if (showForm) resetForm();
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "9px 18px",
              background: showForm ? "var(--d-surface-2)" : "var(--d-accent)",
              color: showForm ? "var(--d-text)" : "#ffffff",
              border: showForm ? "1px solid var(--d-border)" : "none",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
              boxShadow: showForm ? "none" : "0 2px 6px rgba(59, 130, 246, 0.25)",
            }}
          >
            {showForm ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Cancel
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Store
              </>
            )}
          </button>
        </div>

        {successMsg && (
          <div
            style={{
              padding: "11px 14px",
              borderRadius: "8px",
              background: "var(--d-success-bg)",
              color: "var(--d-success)",
              border: "1px solid rgba(34, 197, 94, 0.3)",
              fontSize: "13px",
              fontWeight: 500,
              marginBottom: "18px",
            }}
          >
            ✓ {successMsg}
          </div>
        )}

        {showForm && (
          <form
            onSubmit={handleAddStore}
            className="animate-in"
            style={{
              background: "var(--d-surface-2)",
              borderRadius: "10px",
              padding: "22px",
              border: "1px solid var(--d-border)",
              marginBottom: "24px",
            }}
          >
            <div style={{ marginBottom: "16px" }}>
              <h3 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 600, color: "var(--d-text)" }}>
                Connect a New Store
              </h3>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--d-text-3)" }}>
                Paste your Noon or Daraz store URL — marketplace and country are detected automatically.
              </p>
            </div>

            {submitError && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: "var(--d-danger-bg)",
                  color: "var(--d-danger)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  fontSize: "13px",
                  marginBottom: "16px",
                }}
              >
                ⚠ {submitError}
              </div>
            )}

            {/* Store URL first — drives marketplace + country */}
            <div style={{ marginBottom: "14px" }}>
              <label style={labelStyle}>Store URL *</label>
              <input
                type="url"
                placeholder="https://www.noon.com/uae-en/... or https://www.daraz.pk/..."
                value={storeUrl}
                onChange={(e) => handleStoreUrlChange(e.target.value)}
                style={{
                  ...inputStyle,
                  borderColor: urlError ? "var(--d-danger)" : undefined,
                }}
                onFocus={(e) => {
                  if (!urlError) e.target.style.borderColor = "var(--d-accent)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = urlError ? "var(--d-danger)" : "var(--d-border)";
                }}
              />
              {urlError && (
                <p style={{ margin: "6px 0 0", fontSize: "12px", color: "var(--d-danger)" }}>
                  {urlError}
                </p>
              )}
              {urlMeta && !urlError && (
                <p style={{ margin: "6px 0 0", fontSize: "12px", color: "var(--d-success)" }}>
                  Detected: {urlMeta.marketplace.toUpperCase()} · {urlMeta.country} ·{" "}
                  {urlMeta.currency}
                </p>
              )}
            </div>

            {/* Marketplace + Country (auto-filled, locked when URL is valid) */}
            <div className="form-grid-2">
              <div>
                <label style={labelStyle}>Marketplace *</label>
                <select
                  value={marketplace}
                  onChange={(e) => setMarketplace(e.target.value)}
                  disabled={Boolean(urlMeta)}
                  style={{
                    ...inputStyle,
                    opacity: urlMeta ? 0.85 : 1,
                    cursor: urlMeta ? "not-allowed" : "pointer",
                  }}
                >
                  {MARKETPLACE_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Country *</label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  disabled={Boolean(urlMeta)}
                  style={{
                    ...inputStyle,
                    opacity: urlMeta ? 0.85 : 1,
                    cursor: urlMeta ? "not-allowed" : "pointer",
                  }}
                >
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-grid-2">
              <div>
                <label style={labelStyle}>Store Name *</label>
                <input
                  type="text"
                  placeholder="e.g. TechHub Store"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "var(--d-accent)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--d-border)")}
                />
              </div>
              <div>
                <label style={labelStyle}>Store Slug (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. techhub-store"
                  value={storeSlug}
                  onChange={(e) => setStoreSlug(e.target.value)}
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "var(--d-accent)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--d-border)")}
                />
              </div>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={labelStyle}>External Store ID (Optional)</label>
              <input
                type="text"
                placeholder="e.g. p-10492"
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--d-accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--d-border)")}
              />
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
              <button
                type="submit"
                disabled={submitting || !isFormValid}
                style={{
                  padding: "9px 22px",
                  background: !isFormValid || submitting ? "var(--d-text-3)" : "var(--d-accent)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: !isFormValid || submitting ? "not-allowed" : "pointer",
                  opacity: !isFormValid || submitting ? 0.6 : 1,
                  transition: "background 0.15s ease",
                }}
              >
                {submitting ? "Saving Store..." : "Save Store"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                style={{
                  padding: "9px 16px",
                  background: "transparent",
                  color: "var(--d-text-2)",
                  border: "1px solid var(--d-border)",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {storesLoading && (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--d-text-2)", fontSize: "13.5px" }}>
            Loading your stores...
          </div>
        )}

        {storesError && (
          <div
            style={{
              padding: "16px",
              borderRadius: "8px",
              background: "var(--d-danger-bg)",
              color: "var(--d-danger)",
              fontSize: "13px",
              border: "1px solid rgba(239,68,68,0.25)",
            }}
          >
            {storesError}
          </div>
        )}

        {!storesLoading && !storesError && stores.length === 0 && (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              border: "1.5px dashed var(--d-border)",
              borderRadius: "12px",
              background: "var(--d-surface-2)",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "var(--d-accent-bg)",
                color: "var(--d-accent)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "14px",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <h3 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 600, color: "var(--d-text)" }}>
              No stores connected yet
            </h3>
            <p style={{ margin: "0 auto 20px", maxWidth: "380px", fontSize: "13px", color: "var(--d-text-2)" }}>
              Connect your marketplace seller account on Noon or Daraz to start tracking products and competitors automatically.
            </p>
            <button
              onClick={() => setShowForm(true)}
              style={{
                padding: "9px 20px",
                background: "var(--d-accent)",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              + Add Your First Store
            </button>
          </div>
        )}

        {!storesLoading && !storesError && (stores.length > 0 || contextStores.length > 0) && (
          <div className="res-grid-2">
            {(stores.length > 0 ? stores : contextStores).map((s) => (
              <StoreCard
                key={s.id}
                store={s}
                onDelete={handleDeleteStore}
                isSelected={selectedStore?.id === s.id}
                onSelect={(storeToSelect) => setSelectedStore(storeToSelect)}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default Account;