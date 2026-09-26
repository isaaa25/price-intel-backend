import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { useStore } from "../context/StoreContext";
import {
  getProductsByStore,
  getProductCompetitors,
  getCompetitorCandidates,
  confirmCompetitor,
  rejectCompetitor,
  addCompetitorManual,
} from "../api/products";

const card = {
  background: "var(--d-surface)",
  border: "1px solid var(--d-border)",
  borderRadius: "12px",
  padding: "24px",
};

// Helper: display name prefers search_keyword, falls back to title
function displayName(product) {
  return product?.search_keyword || product?.title || "—";
}

function MarketplaceBadge({ marketplace }) {
  const colors = {
    noon: { color: "#C2410C" },
    daraz: { color: "#E11D48" },
  };
  const c = colors[(marketplace || "").toLowerCase()] || { color: "var(--d-text-2)" };
  return (
    <span
      style={{
        fontSize: "12.5px",
        fontWeight: 600,
        color: c.color,
        textTransform: "capitalize",
      }}
    >
      {marketplace || "—"}
    </span>
  );
}

function Competitors() {
  const navigate = useNavigate();
  const { selectedStore, currency } = useStore();

  const [products, setProducts] = useState([]);
  const [competitors, setCompetitors] = useState([]);
  // Candidates are NOT loaded automatically — only after "Search My Competitors" is clicked
  const [candidates, setCandidates] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState("all");
  const [search, setSearch] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingCompetitors, setLoadingCompetitors] = useState(false);

  // Discovery state — controlled entirely by user clicking the button
  const [discoverySearched, setDiscoverySearched] = useState(false);
  const [loadingDiscovery, setLoadingDiscovery] = useState(false);

  // Manual-add form state
  const [addForm, setAddForm] = useState({ productId: "", url: "", platform: "noon", name: "" });
  const [addingManual, setAddingManual] = useState(false);
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");

  // Pending-review action state (per-id loading)
  const [actionLoading, setActionLoading] = useState({});

  // Controls whether the discovered candidate list is expanded or collapsed
  const [candidatesVisible, setCandidatesVisible] = useState(true);

  /* ── Load products strictly for the selected store ──────── */
  useEffect(() => {
    setSelectedProductId("all");
    setSearch("");
    // Reset discovery state whenever the store changes
    setCandidates([]);
    setDiscoverySearched(false);

    if (!selectedStore?.id) {
      setProducts([]);
      setCompetitors([]);
      return;
    }

    setLoadingProducts(true);
    getProductsByStore(selectedStore.id)
      .then((data) => {
        const productList = Array.isArray(data) ? data : [];
        setProducts(productList);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false));
  }, [selectedStore?.id]); // depend on ID (stable primitive), not the object reference

  /* ── Fetch confirmed competitors for every product ───────── */
  /* This still runs automatically — confirmed competitors always show */
  useEffect(() => {
    if (products.length === 0) {
      setCompetitors([]);
      return;
    }
    setLoadingCompetitors(true);
    Promise.allSettled(products.map((p) => getProductCompetitors(p.id)))
      .then((results) => {
        const flattened = [];
        products.forEach((p, i) => {
          const list = results[i].status === "fulfilled" ? results[i].value : [];
          (Array.isArray(list) ? list : []).forEach((c) => {
            flattened.push({
              ...c,
              productId: p.id,
              productName: displayName(p),
              ownPrice: p.own_cost,
            });
          });
        });
        setCompetitors(flattened);
      })
      .finally(() => setLoadingCompetitors(false));
  }, [products]);

  /* ── "Search My Competitors" — triggered only by user click ─ */
  async function handleSearchCompetitors() {
    if (products.length === 0) return;
    setLoadingDiscovery(true);
    setCandidates([]);
    setDiscoverySearched(false);

    // Determine which products to search candidates for
    const targetProducts =
      selectedProductId === "all"
        ? products
        : products.filter((p) => String(p.id) === String(selectedProductId));

    try {
      const results = await Promise.allSettled(
        targetProducts.map((p) => getCompetitorCandidates(p.id))
      );
      const flattened = [];
      targetProducts.forEach((p, i) => {
        const list = results[i].status === "fulfilled" ? results[i].value : [];
        (Array.isArray(list) ? list : []).forEach((c) => {
          flattened.push({
            ...c,
            productId: p.id,
            productName: displayName(p),
          });
        });
      });
      setCandidates(flattened);
    } catch {
      setCandidates([]);
    } finally {
      setDiscoverySearched(true);
      setLoadingDiscovery(false);
    }
  }

  /* ── Filtered confirmed competitors ─────────────────────── */
  const filteredCompetitors = useMemo(() => {
    return competitors.filter((c) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        (c.name || "").toLowerCase().includes(q) ||
        (c.productName || "").toLowerCase().includes(q) ||
        (c.platform || "").toLowerCase().includes(q);

      const matchesProduct =
        selectedProductId === "all" || String(c.productId) === String(selectedProductId);

      return matchesSearch && matchesProduct;
    });
  }, [search, selectedProductId, competitors]);

  /* ── Filtered candidates (after search, respects product filter) */
  const filteredCandidates = useMemo(() => {
    if (selectedProductId === "all") return candidates;
    return candidates.filter((c) => String(c.productId) === String(selectedProductId));
  }, [candidates, selectedProductId]);

  /* ── Price position ──────────────────────────────────────── */
  function pricePositionLabel(c) {
    if (c.latest_price == null || c.ownPrice == null) return null;
    const diff = c.latest_price - c.ownPrice;
    const pct = Math.abs((diff / c.ownPrice) * 100).toFixed(1);
    if (diff < 0) return { text: `${pct}% below you`, color: "#dc2626" };
    if (diff > 0) return { text: `${pct}% above you`, color: "#16a34a" };
    return { text: "Same price", color: "var(--d-text-2)" };
  }

  /* ── Confirm competitor ──────────────────────────────────── */
  async function handleConfirm(competitorId) {
    setActionLoading((prev) => ({ ...prev, [competitorId]: "confirming" }));
    try {
      await confirmCompetitor(competitorId);
      // Move from candidates to competitors list optimistically
      const confirmed = candidates.find((c) => c.id === competitorId);
      if (confirmed) {
        setCandidates((prev) => prev.filter((c) => c.id !== competitorId));
        setCompetitors((prev) => [
          ...prev,
          { ...confirmed, confirmed_by_user: true, is_active: true },
        ]);
      }
    } catch (err) {
      alert(err?.message || "Failed to confirm competitor.");
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[competitorId];
        return next;
      });
    }
  }

  /* ── Reject competitor ───────────────────────────────────── */
  async function handleReject(competitorId) {
    setActionLoading((prev) => ({ ...prev, [competitorId]: "rejecting" }));
    try {
      await rejectCompetitor(competitorId);
      setCandidates((prev) => prev.filter((c) => c.id !== competitorId));
    } catch (err) {
      alert(err?.message || "Failed to reject competitor.");
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[competitorId];
        return next;
      });
    }
  }

  /* ── Add manual competitor ───────────────────────────────── */
  async function handleAddManual(e) {
    e.preventDefault();
    setAddError("");
    setAddSuccess("");
    if (!addForm.productId) { setAddError("Please select a product."); return; }
    if (!addForm.url.trim()) { setAddError("URL is required."); return; }

    setAddingManual(true);
    try {
      await addCompetitorManual(addForm.productId, {
        url: addForm.url.trim(),
        platform: addForm.platform || "unknown",
        name: addForm.name.trim() || null,
      });
      setAddSuccess("Competitor added and confirmed!");
      setAddForm((prev) => ({ ...prev, url: "", name: "" }));
      // Refresh confirmed competitors for that product
      const updated = await getProductCompetitors(addForm.productId);
      const product = products.find((p) => String(p.id) === String(addForm.productId));
      setCompetitors((prev) => {
        const others = prev.filter((c) => String(c.productId) !== String(addForm.productId));
        const newOnes = (Array.isArray(updated) ? updated : []).map((c) => ({
          ...c,
          productId: addForm.productId,
          productName: product ? displayName(product) : "—",
          ownPrice: product?.own_cost,
        }));
        return [...others, ...newOnes];
      });
    } catch (err) {
      setAddError(err?.message || "Failed to add competitor.");
    } finally {
      setAddingManual(false);
    }
  }

  const btnStyle = (variant = "primary") => ({
    padding: "7px 14px",
    border: "none",
    borderRadius: "7px",
    fontSize: "12.5px",
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
    transition: "opacity 0.12s",
    background:
      variant === "primary"
        ? "var(--d-accent)"
        : variant === "success"
        ? "rgba(22,163,74,0.12)"
        : variant === "danger"
        ? "rgba(220,38,38,0.1)"
        : "var(--d-bg)",
    color:
      variant === "primary"
        ? "#fff"
        : variant === "success"
        ? "#16a34a"
        : variant === "danger"
        ? "#dc2626"
        : "var(--d-text-2)",
  });

  return (
    <Layout>
      {/* ── Page header ────────────────────────────────── */}
      <div className="res-page-header animate-in">
        <div>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--d-text)", letterSpacing: "-0.3px" }}>
            Competitors
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--d-text-2)" }}>
            Sellers competing against your products across marketplaces.
          </p>
        </div>
      </div>

      {!selectedStore ? (
        <div
          className="animate-in"
          style={{ ...card, textAlign: "center", padding: "60px 20px" }}
        >
          <div
            style={{
              width: "60px", height: "60px", borderRadius: "50%",
              background: "rgba(37, 99, 235, 0.08)", display: "flex",
              alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m16 3 4 4-4 4" /><path d="M20 7H4" /><path d="m8 21-4-4 4-4" /><path d="M4 17h16" />
            </svg>
          </div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--d-text)", margin: "0 0 8px" }}>
            No Store Connected
          </h2>
          <p style={{ fontSize: "14px", color: "var(--d-text-2)", maxWidth: "420px", margin: "0 auto 20px", lineHeight: "1.5" }}>
            Connect your marketplace store in Account &amp; Stores to start tracking competing sellers and price shifts.
          </p>
          <button
            onClick={() => navigate("/account")}
            style={{
              padding: "10px 20px", background: "var(--d-accent)", color: "#ffffff",
              border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 600,
              cursor: "pointer", boxShadow: "0 2px 8px rgba(79,70,229,0.25)",
            }}
          >
            + Go to Account &amp; Add Store
          </button>
        </div>
      ) : (
        <>
          {/* ── Stats row ─────────────────────────────── */}
          <div className="animate-in" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "20px", animationDelay: "0.05s" }}>
            {[
              { label: "Confirmed Competitors", value: loadingCompetitors ? "…" : filteredCompetitors.length },
              { label: "Pending Review", value: !discoverySearched ? "—" : filteredCandidates.length },
              { label: "Price Drops Detected", value: "—" },
            ].map((s, i) => (
              <div key={s.label} className="animate-in hover-lift" style={{ ...card, padding: "16px", animationDelay: `${i * 0.05}s` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ margin: 0, fontSize: "11px", fontWeight: 500, color: "var(--d-text-3)", textTransform: "uppercase", letterSpacing: "0.4px" }}>{s.label}</p>
                  {s.label === "Pending Review" && discoverySearched && filteredCandidates.length > 0 && (
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
                  )}
                </div>
                <p style={{ margin: "10px 0 0", fontSize: "26px", fontWeight: 700, color: "var(--d-text)", letterSpacing: "-1px" }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* ── Search & Product Filter Bar ─────────────────── */}
          <div
            className="animate-in"
            style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center", animationDelay: "0.08s" }}
          >
            {/* Search */}
            <div style={{ position: "relative", flex: "1", minWidth: "240px" }}>
              <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--d-text-3)", display: "flex", alignItems: "center", pointerEvents: "none" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="text"
                placeholder={`Search competitors in ${selectedStore.store_name}…`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%", padding: "9px 14px 9px 36px", borderRadius: "8px",
                  border: "1px solid var(--d-border)", background: "var(--d-surface)",
                  color: "var(--d-text)", fontSize: "13px", fontFamily: "inherit",
                  outline: "none", boxSizing: "border-box",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--d-accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--d-border)")}
              />
            </div>

            {/* Product filter */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--d-text-2)", whiteSpace: "nowrap" }}>Product:</label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                disabled={loadingProducts || products.length === 0}
                style={{
                  padding: "9px 14px", borderRadius: "8px", border: "1px solid var(--d-border)",
                  background: "var(--d-surface)", color: "var(--d-text)", fontSize: "13px",
                  fontWeight: 600, fontFamily: "inherit", cursor: products.length > 0 ? "pointer" : "default",
                  outline: "none", minWidth: "220px",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--d-accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--d-border)")}
              >
                {products.length === 0 ? (
                  <option value="all">No products tracked yet (0)</option>
                ) : (
                  <>
                    <option value="all">All Tracked Products ({products.length})</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {displayName(p)}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>

          {/* ══ SECTION 1: Add Competitor Manually ══ */}
          {products.length > 0 && (
            <div className="animate-in" style={{ ...card, marginBottom: "16px", animationDelay: "0.09s" }}>
              <h2 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 700, color: "var(--d-text)" }}>
                Add Competitor Manually
              </h2>
              <p style={{ margin: "0 0 16px", fontSize: "12px", color: "var(--d-text-3)" }}>
                Paste a competitor product URL — it will be immediately confirmed and tracked.
              </p>
              <form onSubmit={handleAddManual} style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end" }}>
                {/* Product selector */}
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--d-text-3)", textTransform: "uppercase", letterSpacing: "0.4px" }}>Product</label>
                  <select
                    value={addForm.productId}
                    onChange={(e) => setAddForm((f) => ({ ...f, productId: e.target.value }))}
                    required
                    style={{
                      padding: "8px 12px", borderRadius: "7px", border: "1px solid var(--d-border)",
                      background: "var(--d-surface)", color: "var(--d-text)", fontSize: "13px",
                      fontFamily: "inherit", outline: "none", minWidth: "180px",
                    }}
                  >
                    <option value="">Select product…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{displayName(p)}</option>
                    ))}
                  </select>
                </div>

                {/* URL */}
                <div style={{ display: "flex", flexDirection: "column", gap: "5px", flex: 1, minWidth: "200px" }}>
                  <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--d-text-3)", textTransform: "uppercase", letterSpacing: "0.4px" }}>Competitor URL</label>
                  <input
                    type="url"
                    placeholder="https://www.noon.com/product/..."
                    value={addForm.url}
                    onChange={(e) => setAddForm((f) => ({ ...f, url: e.target.value }))}
                    required
                    style={{
                      padding: "8px 12px", borderRadius: "7px", border: "1px solid var(--d-border)",
                      background: "var(--d-surface)", color: "var(--d-text)", fontSize: "13px",
                      fontFamily: "inherit", outline: "none",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--d-accent)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--d-border)")}
                  />
                </div>

                {/* Platform */}
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--d-text-3)", textTransform: "uppercase", letterSpacing: "0.4px" }}>Platform</label>
                  <select
                    value={addForm.platform}
                    onChange={(e) => setAddForm((f) => ({ ...f, platform: e.target.value }))}
                    style={{
                      padding: "8px 12px", borderRadius: "7px", border: "1px solid var(--d-border)",
                      background: "var(--d-surface)", color: "var(--d-text)", fontSize: "13px",
                      fontFamily: "inherit", outline: "none",
                    }}
                  >
                    <option value="noon">Noon</option>
                    <option value="daraz">Daraz</option>
                  </select>
                </div>

                {/* Name (optional) */}
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--d-text-3)", textTransform: "uppercase", letterSpacing: "0.4px" }}>Name (optional)</label>
                  <input
                    type="text"
                    placeholder="Seller / product name"
                    value={addForm.name}
                    onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                    style={{
                      padding: "8px 12px", borderRadius: "7px", border: "1px solid var(--d-border)",
                      background: "var(--d-surface)", color: "var(--d-text)", fontSize: "13px",
                      fontFamily: "inherit", outline: "none",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--d-accent)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--d-border)")}
                  />
                </div>

                <button
                  type="submit"
                  disabled={addingManual}
                  style={{
                    ...btnStyle("primary"),
                    padding: "9px 18px",
                    fontSize: "13px",
                    opacity: addingManual ? 0.6 : 1,
                  }}
                >
                  {addingManual ? "Adding…" : "+ Add Competitor"}
                </button>
              </form>

              {addError && (
                <p style={{ margin: "10px 0 0", fontSize: "12.5px", color: "var(--d-danger)" }}>{addError}</p>
              )}
              {addSuccess && (
                <p style={{ margin: "10px 0 0", fontSize: "12.5px", color: "var(--d-success)" }}>✓ {addSuccess}</p>
              )}
            </div>
          )}

          {/* ══ SECTION 2: Let Price Intel discover competitors ══ */}
          {products.length > 0 && (
            <div
              className="animate-in"
              style={{ ...card, marginBottom: "16px", animationDelay: "0.10s", display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: "10px", padding: "12px 20px", width: "fit-content" }}
            >
              <h2 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--d-text)" }}>
                Let Price Intel discover your competitors
              </h2>
              <button
                onClick={handleSearchCompetitors}
                disabled={loadingDiscovery || products.length === 0}
                style={{
                  padding: "8px 18px",
                  background: loadingDiscovery ? "var(--d-border)" : "var(--d-accent)",
                  color: loadingDiscovery ? "var(--d-text-3)" : "#fff",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: loadingDiscovery || products.length === 0 ? "not-allowed" : "pointer",
                  boxShadow: loadingDiscovery ? "none" : "0 2px 10px rgba(79,70,229,0.25)",
                  transition: "all 0.15s",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  flexShrink: 0,
                }}
              >
                {loadingDiscovery ? (
                  <>
                    <span style={{
                      width: "14px", height: "14px", border: "2px solid var(--d-text-3)",
                      borderTopColor: "transparent", borderRadius: "50%",
                      display: "inline-block", animation: "spin 0.7s linear infinite",
                    }} />
                    Searching for competitors…
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    Search My Competitors
                  </>
                )}
              </button>

              {/* Spinner keyframe — inject once */}
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* ══ SECTION 3: Pending Review — shown ONLY after search ══ */}
          {discoverySearched && (
            <div className="animate-in" style={{ marginBottom: "16px", animationDelay: "0s" }}>
              {filteredCandidates.length === 0 ? (
                /* Empty state after search */
                <div style={{ ...card, textAlign: "center", padding: "32px 24px", borderColor: "var(--d-border)" }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--d-text)" }}>No new competitors found</p>
                  <p style={{ margin: "6px 0 0", fontSize: "12.5px", color: "var(--d-text-3)" }}>
                    No unconfirmed competitor candidates were found for your{" "}
                    {selectedProductId === "all" ? "products" : "selected product"}.
                    Try adding competitors manually above.
                  </p>
                </div>
              ) : (
                /* Candidates list */
                <div style={{ ...card, borderColor: "rgba(245,158,11,0.35)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--d-text)", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
                        Pending Review
                      </h2>
                      <p style={{ margin: "3px 0 0", fontSize: "12px", color: "var(--d-text-3)" }}>
                        Price Intel discovered these competitors — review and accept or reject them.
                      </p>
                    </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#f59e0b" }}>
                      {filteredCandidates.length} waiting
                    </span>
                    <button
                      onClick={() => setCandidatesVisible((v) => !v)}
                      style={{
                        padding: "4px 10px",
                        border: "1px solid var(--d-border)",
                        borderRadius: "6px",
                        background: "var(--d-surface)",
                        color: "var(--d-text-2)",
                        fontSize: "12px",
                        fontWeight: 600,
                        fontFamily: "inherit",
                        cursor: "pointer",
                      }}
                    >
                      {candidatesVisible ? "Hide list" : "Show list"}
                    </button>
                  </div>
                  </div>

                  {candidatesVisible && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {filteredCandidates.map((c) => {
                      const busy = actionLoading[c.id];
                      return (
                        <div
                          key={c.id}
                          style={{
                            display: "flex", alignItems: "center", gap: "14px",
                            padding: "12px 14px", borderRadius: "9px",
                            background: "var(--d-bg)", border: "1px solid var(--d-border)",
                            flexWrap: "wrap",
                          }}
                        >
                          {/* Info */}
                          <div style={{ flex: 1, minWidth: "200px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <span style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--d-text)" }}>
                                {c.name || c.url}
                              </span>
                              <MarketplaceBadge marketplace={c.platform} />
                            </div>
                            <div style={{ marginTop: "3px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                              <span style={{ fontSize: "11px", color: "var(--d-text-3)" }}>
                                {c.productName}
                              </span>
                              {c.latest_price != null && (
                                <span style={{ fontSize: "11px", color: "var(--d-text-3)" }}>
                                  {currency} {Number(c.latest_price).toFixed(2)}
                                </span>
                              )}
                              <a
                                href={c.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ fontSize: "11px", color: "var(--d-accent)", textDecoration: "none" }}
                              >
                                View listing ↗
                              </a>
                            </div>
                          </div>

                          {/* Actions */}
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              disabled={!!busy}
                              onClick={() => handleConfirm(c.id)}
                              style={{ ...btnStyle("success"), opacity: busy ? 0.5 : 1 }}
                            >
                              {busy === "confirming" ? "…" : "✓ Accept"}
                            </button>
                            <button
                              disabled={!!busy}
                              onClick={() => handleReject(c.id)}
                              style={{ ...btnStyle("danger"), opacity: busy ? 0.5 : 1 }}
                            >
                              {busy === "rejecting" ? "…" : "✕ Reject"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══ SECTION 4: Confirmed competitors table ══ */}
          <div className="animate-in" style={{ ...card, animationDelay: "0.12s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--d-text)" }}>
                  Detected Sellers in {selectedStore.store_name}
                </h2>
                <p style={{ margin: "3px 0 0", fontSize: "12px", color: "var(--d-text-3)" }}>
                  {products.length === 0
                    ? `No tracked products found for ${selectedStore.store_name}`
                    : selectedProductId === "all"
                      ? "Showing all confirmed competitor sellers across your store's catalog"
                      : `Filtered competitors for ${displayName(products.find((p) => String(p.id) === String(selectedProductId))) || "selected product"}`}
                </p>
              </div>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--d-text-3)" }}>
                {loadingCompetitors ? "Loading…" : `${filteredCompetitors.length} seller${filteredCompetitors.length !== 1 ? "s" : ""} found`}
              </span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Seller", "Marketplace", "Price Position vs You", "Behavior Type", "Repricing Velocity", "Stock Status", "Last Seen"].map((col) => (
                      <th
                        key={col}
                        style={{
                          textAlign: "left", padding: "0 14px 12px", fontSize: "11px",
                          fontWeight: 600, color: "var(--d-text-3)", textTransform: "uppercase",
                          letterSpacing: "0.5px", borderBottom: "1px solid var(--d-border)", whiteSpace: "nowrap",
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingCompetitors ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "48px 14px", color: "var(--d-text-3)", fontSize: "13px" }}>
                        Loading competitors…
                      </td>
                    </tr>
                  ) : filteredCompetitors.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "48px 14px", color: "var(--d-text-3)", fontSize: "13px" }}>
                        <p style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: 600, color: "var(--d-text)" }}>
                          No confirmed competitors yet
                        </p>
                        <p style={{ margin: 0 }}>
                          {products.length === 0
                            ? `No tracked products in ${selectedStore.store_name}. Add products to begin monitoring competitors.`
                            : "Add competitors manually above, or click \"Search My Competitors\" to discover them automatically."}
                        </p>
                        {products.length === 0 && (
                          <button
                            onClick={() => navigate("/products")}
                            style={{
                              marginTop: "14px", padding: "8px 16px", background: "var(--d-accent)",
                              color: "#ffffff", border: "none", borderRadius: "8px",
                              fontSize: "12.5px", fontWeight: 600, cursor: "pointer",
                            }}
                          >
                            + Add Products to {selectedStore.store_name}
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredCompetitors.map((c, i) => {
                      const pos = pricePositionLabel(c);
                      const lastSeen = c.last_scraped_at
                        ? new Date(c.last_scraped_at).toLocaleDateString()
                        : "—";

                      return (
                        <tr
                          key={c.id}
                          style={{
                            borderBottom: i < filteredCompetitors.length - 1 ? "1px solid var(--d-border)" : "none",
                            transition: "background 0.1s",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--d-bg)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                        >
                          {/* 1. Seller */}
                          <td style={{ padding: "14px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <div style={{
                                width: "30px", height: "30px", borderRadius: "50%",
                                background: "var(--d-bg)", border: "1px solid var(--d-border)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: "var(--d-text-2)", flexShrink: 0,
                              }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                                </svg>
                              </div>
                              <div>
                                <span style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--d-text)", display: "block" }}>
                                  {c.name || "—"}
                                </span>
                                {selectedProductId === "all" && (
                                  <span style={{ fontSize: "11px", color: "var(--d-text-3)" }}>
                                    on {c.productName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* 2. Marketplace */}
                          <td style={{ padding: "14px", whiteSpace: "nowrap" }}>
                            <MarketplaceBadge marketplace={c.platform} />
                          </td>

                          {/* 3. Price Position */}
                          <td style={{ padding: "14px", whiteSpace: "nowrap" }}>
                            {pos ? (
                              <span style={{ fontSize: "12.5px", fontWeight: 600, color: pos.color }}>{pos.text}</span>
                            ) : (
                              <span style={{ fontSize: "12.5px", color: "var(--d-text-3)" }}>—</span>
                            )}
                          </td>

                          {/* 4-6. Pending data */}
                          {["—", "—", "—"].map((val, idx) => (
                            <td key={idx} style={{ padding: "14px", whiteSpace: "nowrap" }}>
                              <span style={{ fontSize: "12.5px", color: "var(--d-text-3)" }}>{val}</span>
                            </td>
                          ))}

                          {/* 7. Last Seen */}
                          <td style={{ padding: "14px", whiteSpace: "nowrap" }}>
                            <span style={{ fontSize: "12px", color: "var(--d-text-3)" }}>{lastSeen}</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}

export default Competitors;