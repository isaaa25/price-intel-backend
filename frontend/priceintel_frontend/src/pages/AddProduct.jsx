import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { getStores, createProduct } from "../api/products";

/* ── shared card style matching Dashboard ───────────────────── */
const card = {
  background: "var(--d-surface)",
  border: "1px solid var(--d-border)",
  borderRadius: "12px",
  padding: "24px",
};

function AddProduct() {
  const navigate = useNavigate();

  /* ── stores state ─────────────────────────────────────────── */
  const [stores, setStores]           = useState([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [storesError, setStoresError] = useState("");

  /* ── form state ───────────────────────────────────────────── */
  const [storeId,   setStoreId]   = useState("");
  const [title,     setTitle]     = useState("");
  const [ownUrl,    setOwnUrl]    = useState("");
  const [ownCost,   setOwnCost]   = useState("");
  const [category,  setCategory]  = useState("");

  /* ── submit state ─────────────────────────────────────────── */
  const [submitting,    setSubmitting]    = useState(false);
  const [submitError,   setSubmitError]   = useState("");
  const [successMsg,    setSuccessMsg]    = useState("");

  /* ── fetch stores on mount ────────────────────────────────── */
  useEffect(() => {
    getStores()
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setStores(list);
        if (list.length > 0) setStoreId(list[0].id);
      })
      .catch((err) => {
        setStoresError(err.message || "Failed to load stores.");
      })
      .finally(() => setStoresLoading(false));
  }, []);

  /* ── form submit ──────────────────────────────────────────── */
  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError("");
    setSuccessMsg("");

    /* client-side validation */
    if (!storeId || !title.trim() || !ownUrl.trim() || !ownCost) {
      setSubmitError("Please fill in all required fields (Store, Title, URL, and Cost).");
      return;
    }

    const costNum = parseFloat(ownCost);
    if (isNaN(costNum) || costNum < 0) {
      setSubmitError("Cost must be a valid positive number.");
      return;
    }

    const payload = {
      store_id: storeId,
      title:    title.trim(),
      own_url:  ownUrl.trim(),
      own_cost: costNum,
      category: category.trim() || null,
    };

    setSubmitting(true);
    try {
      const result = await createProduct(payload);

      if (!result.search_keyword) {
        setSuccessMsg(
          "Product added! The AI-generated search keyword is still processing — " +
          "it will be filled in automatically on the next discovery run."
        );
      } else {
        setSuccessMsg(`Product added successfully! Search keyword: "${result.search_keyword}"`);
      }

      /* brief pause so the user reads the message, then redirect */
      setTimeout(() => navigate("/dashboard"), 2200);
    } catch (err) {
      setSubmitError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  /* ── shared input style ───────────────────────────────────── */
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
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  };

  const labelStyle = {
    display: "block",
    fontSize: "12px",
    fontWeight: 500,
    color: "var(--d-text-2)",
    marginBottom: "6px",
  };

  const noStores = !storesLoading && !storesError && stores.length === 0;

  return (
    <Layout>
      {/* ── Page header ──────────────────────────────────────── */}
      <div className="animate-in" style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
          <button
            id="btn-back-addproduct"
            onClick={() => navigate("/dashboard")}
            style={{
              background: "none",
              border: "none",
              color: "var(--d-text-3)",
              fontSize: "13px",
              cursor: "pointer",
              padding: 0,
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              transition: "color 0.12s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--d-text)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--d-text-3)")}
          >
            ← Back
          </button>
          <span style={{ color: "var(--d-border)", fontSize: "14px" }}>/</span>
          <h1
            style={{
              margin: 0,
              fontSize: "20px",
              fontWeight: 700,
              color: "var(--d-text)",
              letterSpacing: "-0.3px",
            }}
          >
            Add Product
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: "13px", color: "var(--d-text-2)" }}>
          Track a new product across competitor marketplaces.
        </p>
      </div>

      {/* ── Main form card ───────────────────────────────────── */}
      <div
        className="animate-in"
        style={{ ...card, maxWidth: "560px", animationDelay: "0.06s" }}
      >
        {/* ── Loading stores ─────────────────────────────────── */}
        {storesLoading && (
          <p style={{ margin: 0, fontSize: "13px", color: "var(--d-text-3)" }}>
            Loading your stores…
          </p>
        )}

        {/* ── Error loading stores ────────────────────────────── */}
        {!storesLoading && storesError && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "8px",
              background: "var(--d-danger-bg)",
              border: "1px solid #FECACA",
              fontSize: "13px",
              color: "var(--d-danger)",
            }}
          >
            ⚠ Could not load stores: {storesError}
          </div>
        )}

        {/* ── No stores warning ──────────────────────────────── */}
        {noStores && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "8px",
              background: "var(--d-warning-bg)",
              border: "1px solid #FDE68A",
              fontSize: "13px",
              color: "var(--d-warning)",
            }}
          >
            ⚠ No store found. Add a store in <strong>Settings</strong> before adding products.
          </div>
        )}

        {/* ── Form (only shown when stores are available) ─────── */}
        {!storesLoading && !storesError && stores.length > 0 && (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>

            {/* Store dropdown */}
            <div>
              <label htmlFor="field-store" style={labelStyle}>
                Store <span style={{ color: "var(--d-danger)" }}>*</span>
              </label>
              <select
                id="field-store"
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                style={{
                  ...inputStyle,
                  cursor: "pointer",
                  appearance: "none",
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23A1A1AA' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 14px center",
                  paddingRight: "36px",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--d-accent)";
                  e.target.style.boxShadow = "0 0 0 3px rgba(79,70,229,0.10)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--d-border)";
                  e.target.style.boxShadow = "none";
                }}
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.store_name} — {s.marketplace} ({s.country})
                  </option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div>
              <label htmlFor="field-title" style={labelStyle}>
                Product title <span style={{ color: "var(--d-danger)" }}>*</span>
              </label>
              <input
                id="field-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Samsung Galaxy Buds 2 Pro"
                style={inputStyle}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--d-accent)";
                  e.target.style.boxShadow = "0 0 0 3px rgba(79,70,229,0.10)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--d-border)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            {/* Own URL */}
            <div>
              <label htmlFor="field-own-url" style={labelStyle}>
                Your product URL <span style={{ color: "var(--d-danger)" }}>*</span>
              </label>
              <input
                id="field-own-url"
                type="url"
                value={ownUrl}
                onChange={(e) => setOwnUrl(e.target.value)}
                placeholder="https://www.noon.com/your-product-listing"
                style={inputStyle}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--d-accent)";
                  e.target.style.boxShadow = "0 0 0 3px rgba(79,70,229,0.10)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--d-border)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            {/* Cost + Category row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              {/* Own cost */}
              <div>
                <label htmlFor="field-own-cost" style={labelStyle}>
                  Your price (cost) <span style={{ color: "var(--d-danger)" }}>*</span>
                </label>
                <input
                  id="field-own-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={ownCost}
                  onChange={(e) => setOwnCost(e.target.value)}
                  placeholder="49.99"
                  style={inputStyle}
                  onFocus={(e) => {
                    e.target.style.borderColor = "var(--d-accent)";
                    e.target.style.boxShadow = "0 0 0 3px rgba(79,70,229,0.10)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "var(--d-border)";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>

              {/* Category */}
              <div>
                <label htmlFor="field-category" style={labelStyle}>
                  Category <span style={{ color: "var(--d-text-3)", fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  id="field-category"
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Electronics"
                  style={inputStyle}
                  onFocus={(e) => {
                    e.target.style.borderColor = "var(--d-accent)";
                    e.target.style.boxShadow = "0 0 0 3px rgba(79,70,229,0.10)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "var(--d-border)";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>
            </div>

            {/* AI keyword helper note */}
            <p
              style={{
                margin: 0,
                fontSize: "12px",
                color: "var(--d-text-3)",
                lineHeight: 1.6,
                padding: "10px 14px",
                background: "var(--d-bg)",
                borderRadius: "8px",
                border: "1px solid var(--d-border)",
              }}
            >
              A search keyword for finding competitors will be generated automatically by AI
              after saving. No action needed on your part.
            </p>

            {/* Validation / submit error */}
            {submitError && (
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  color: "var(--d-danger)",
                  background: "var(--d-danger-bg)",
                  border: "1px solid #FECACA",
                  borderRadius: "8px",
                  padding: "10px 14px",
                }}
              >
                {submitError}
              </p>
            )}

            {/* Success message */}
            {successMsg && (
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  color: "var(--d-success)",
                  background: "var(--d-success-bg)",
                  border: "1px solid #BBF7D0",
                  borderRadius: "8px",
                  padding: "10px 14px",
                }}
              >
                ✓ {successMsg}
              </p>
            )}

            {/* Submit button */}
            <button
              id="btn-add-product-submit"
              type="submit"
              disabled={submitting || noStores}
              style={{
                padding: "11px",
                background: submitting ? "var(--d-text-3)" : "var(--d-accent)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: submitting ? "not-allowed" : "pointer",
                transition: "background 0.15s ease, transform 0.1s ease",
                boxShadow: submitting ? "none" : "0 2px 8px rgba(79,70,229,0.25)",
              }}
              onMouseEnter={(e) => {
                if (!submitting) {
                  e.currentTarget.style.background = "var(--accent-hover, #4338CA)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = submitting ? "var(--d-text-3)" : "var(--d-accent)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {submitting ? "Saving product…" : "Save product"}
            </button>
          </form>
        )}
      </div>
    </Layout>
  );
}

export default AddProduct;
