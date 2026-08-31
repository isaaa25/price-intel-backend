// src/pages/Account.jsx
import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import { getStores } from "../api/products";
import apiRequest from "../api/client";
import { useStore } from "../context/StoreContext";

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
    background: "var(--d-surface)",
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

const MARKETPLACE_OPTIONS = ["noon", "daraz", "other"];
const COUNTRY_OPTIONS = ["UAE", "Saudi Arabia", "Pakistan"];

function MarketplaceBadge({ marketplace }) {
    const colors = {
        noon: { color: "#C2410C" },
        daraz: { color: "#E11D48" },
        amazon: { color: "#D97706" },
        other: { color: "var(--d-accent)" },
    };
    const c = colors[marketplace?.toLowerCase()] || colors.other;
    return (
        <span style={{
            fontSize: "12px",
            fontWeight: 600,
            color: c.color,
            textTransform: "capitalize",
            minWidth: "55px",
            display: "inline-block",
        }}>
            {marketplace}
        </span>
    );
}

function Account() {
    const { refreshStores } = useStore();
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

    function loadStores() {
        setStoresLoading(true);
        setStoresError("");
        getStores()
            .then((data) => setStores(Array.isArray(data) ? data : []))
            .catch((err) => setStoresError(err.message || "Failed to load stores."))
            .finally(() => setStoresLoading(false));
    }

    useEffect(() => { loadStores(); }, []);

    const isFormValid = Boolean(marketplace && country && storeName.trim() && storeUrl.trim());

    async function handleAddStore(e) {
        e.preventDefault();
        setSubmitError("");
        setSuccessMsg("");

        if (!marketplace || !country || !storeName.trim() || !storeUrl.trim()) {
            setSubmitError("Please fill in all required fields (Marketplace, Country, Store Name, and Store URL).");
            return;
        }

        setSubmitting(true);
        try {
            await apiRequest("/stores/", {
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
            setSuccessMsg("Store added successfully!");
            setStoreName(""); setStoreSlug(""); setExternalId(""); setStoreUrl("");
            setShowForm(false);
            loadStores();
            refreshStores();
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
            refreshStores();
        } catch (err) {
            setSubmitError(err.message || "Failed to delete store.");
        }
    }

    return (
        <Layout>
            {/* ── Page Header ────────────────────────────────────────── */}
            <div className="animate-in" style={{ marginBottom: "28px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--d-text)", letterSpacing: "-0.3px" }}>
                        Account & Stores
                    </h1>
                    <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--d-text-2)" }}>
                        Manage your connected marketplace seller accounts and store details.
                    </p>
                </div>
            </div>

            {/* ── Your Stores Section ────────────────────────────────── */}
            <div className="animate-in" style={{ ...cardStyle, marginBottom: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--d-text)", display: "flex", alignItems: "center", gap: "8px" }}>
                            Your Stores
                        </h2>
                        <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--d-text-3)" }}>
                            Connect your marketplace seller accounts to start tracking.
                        </p>
                    </div>

                    <button
                        onClick={() => { setShowForm(!showForm); setSubmitError(""); setSuccessMsg(""); }}
                        style={{
                            padding: "8px 16px",
                            background: showForm ? "var(--d-bg)" : "var(--d-accent)",
                            color: showForm ? "var(--d-text)" : "#fff",
                            border: showForm ? "1px solid var(--d-border)" : "none",
                            borderRadius: "8px",
                            fontSize: "13px",
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        {showForm ? "Cancel" : "+ Add Store"}
                    </button>
                </div>

                {/* Success Alert */}
                {successMsg && (
                    <div style={{ padding: "10px 14px", borderRadius: "8px", background: "var(--d-success-bg)", color: "var(--d-success)", fontSize: "13px", marginBottom: "16px" }}>
                        ✓ {successMsg}
                    </div>
                )}

                {/* Add Store Form Drawer */}
                {showForm && (
                    <form onSubmit={handleAddStore} style={{ background: "var(--d-bg)", borderRadius: "10px", padding: "20px", border: "1px solid var(--d-border)", marginBottom: "20px" }}>
                        <h3 style={{ margin: "0 0 16px", fontSize: "14px", fontWeight: 600, color: "var(--d-text)" }}>Connect a New Store</h3>

                        {submitError && (
                            <div style={{ padding: "10px 14px", borderRadius: "8px", background: "var(--d-danger-bg)", color: "var(--d-danger)", fontSize: "13px", marginBottom: "16px" }}>
                                ⚠ {submitError}
                            </div>
                        )}

                        {/* Row 1: Marketplace* | Country* */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                            <div>
                                <label style={labelStyle}>Marketplace *</label>
                                <select value={marketplace} onChange={(e) => setMarketplace(e.target.value)} style={inputStyle}>
                                    {MARKETPLACE_OPTIONS.map((m) => (
                                        <option key={m} value={m}>{m.toUpperCase()}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Country *</label>
                                <select value={country} onChange={(e) => setCountry(e.target.value)} style={inputStyle}>
                                    {COUNTRY_OPTIONS.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Row 2: Store Name* | Store URL* */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                            <div>
                                <label style={labelStyle}>Store Name *</label>
                                <input type="text" placeholder="e.g. TechHub Store" value={storeName} onChange={(e) => setStoreName(e.target.value)} style={inputStyle} />
                            </div>
                            <div>
                                <label style={labelStyle}>Store URL *</label>
                                <input type="url" placeholder="https://noon.com/store/techhub" value={storeUrl} onChange={(e) => setStoreUrl(e.target.value)} style={inputStyle} />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={submitting || !isFormValid}
                            style={{
                                padding: "9px 20px",
                                background: (!isFormValid || submitting) ? "var(--d-text-3)" : "var(--d-accent)",
                                color: "#fff",
                                border: "none",
                                borderRadius: "8px",
                                fontSize: "13px",
                                fontWeight: 600,
                                cursor: (!isFormValid || submitting) ? "not-allowed" : "pointer",
                                opacity: (!isFormValid || submitting) ? 0.7 : 1,
                            }}
                        >
                            {submitting ? "Saving..." : "Save Store"}
                        </button>
                    </form>
                )}

                {/* Stores List */}
                {storesLoading && <p style={{ fontSize: "13px", color: "var(--d-text-3)" }}>Loading stores...</p>}
                {storesError && <p style={{ fontSize: "13px", color: "var(--d-danger)" }}>{storesError}</p>}

                {!storesLoading && !storesError && stores.length === 0 && (
                    <p style={{ fontSize: "13px", color: "var(--d-text-3)", margin: 0 }}>No stores added yet.</p>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {stores.map((s) => (
                        <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: "8px", background: "var(--d-bg)", border: "1px solid var(--d-border)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
                                <MarketplaceBadge marketplace={s.marketplace} />
                                <div>
                                    <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--d-text)" }}>{s.store_name}</div>
                                    <div style={{ fontSize: "12px", color: "var(--d-text-3)" }}>{s.country}</div>
                                </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                                {s.store_url && (
                                    <a href={s.store_url} target="_blank" rel="noreferrer" style={{ fontSize: "12px", color: "var(--d-accent)", textDecoration: "none", fontWeight: 500 }}>
                                        View Store ↗
                                    </a>
                                )}
                                <button
                                    onClick={() => handleDeleteStore(s)}
                                    title="Delete Store"
                                    style={{
                                        background: "none",
                                        border: "1px solid #fee2e2",
                                        color: "#ef4444",
                                        padding: "5px 10px",
                                        borderRadius: "6px",
                                        fontSize: "11.5px",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "4px",
                                        transition: "all 0.15s ease",
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = "#fee2e2";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = "none";
                                    }}
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    </svg>
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Layout>
    );
}

export default Account;
