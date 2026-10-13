import { useState, useEffect, useMemo, useRef } from "react";
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
  discoverCompetitors,   
} from "../api/products";
import { validateProductUrl } from "../api/marketplaceUrl";
import ConfirmModal from "../components/ConfirmModal";

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

function StockBadge({ status }) {
  if (!status || status === "unknown") {
    return <span style={{ fontSize: "12.5px", color: "var(--d-text-3)" }}>—</span>;
  }

  const normalized = String(status).toLowerCase().trim().replace(/[\s-]/g, "_");

  const config = {
    in_stock: {
      label: "In Stock",
      color: "#16a34a",
      bg: "rgba(22, 163, 74, 0.08)",
      border: "rgba(22, 163, 74, 0.2)",
      dot: "#16a34a",
    },
    out_of_stock: {
      label: "Out of Stock",
      color: "#dc2626",
      bg: "rgba(220, 38, 38, 0.08)",
      border: "rgba(220, 38, 38, 0.2)",
      dot: "#dc2626",
    },
    limited: {
      label: "Limited",
      color: "#d97706",
      bg: "rgba(217, 119, 6, 0.08)",
      border: "rgba(217, 119, 6, 0.2)",
      dot: "#d97706",
    },
    pre_order: {
      label: "Pre-order",
      color: "#6366f1",
      dot: "#6366f1",
    },
  };

  const current = config[normalized] || {
    label: status.replace(/_/g, " "),
    color: "var(--d-text-2)",
    dot: "var(--d-text-3)",
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "12px",
        fontWeight: 600,
        color: current.color,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          backgroundColor: current.dot,
          flexShrink: 0,
        }}
      />
      {current.label}
    </span>
  );
}

function BehaviorBadge({ behavior }) {
  if (!behavior) return <span style={{ color: "var(--d-text-3)", fontSize: "12.5px" }}>—</span>;

  let color = "var(--d-text-2)";

  if (behavior.includes("Aggressive") || behavior.includes("Undercutter")) {
    color = "#ef4444";
  } else if (behavior === "Price Matcher") {
    color = "#3b82f6";
  } else if (behavior === "Premium Seller") {
    color = "#8b5cf6";
  } else if (behavior === "Discount Seller") {
    color = "#d97706";
  } else if (behavior === "Above Market") {
    color = "#10b981";
  }

  return (
    <span
      style={{
        display: "inline-block",
        fontSize: "12px",
        fontWeight: 600,
        color: color,
        whiteSpace: "nowrap",
      }}
    >
      {behavior}
    </span>
  );
}

function VelocityBadge({ velocity }) {
  if (!velocity) return <span style={{ color: "var(--d-text-3)", fontSize: "12.5px" }}>—</span>;

  let color = "var(--d-text-2)";
  let dotColor = "#94a3b8";

  if (velocity === "High") {
    color = "#ef4444";
    dotColor = "#ef4444";
  } else if (velocity === "Moderate") {
    color = "#f59e0b";
    dotColor = "#f59e0b";
  } else if (velocity === "Low") {
    color = "#10B981";
    dotColor = "#10B981";
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, color, whiteSpace: "nowrap" }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
      {velocity}
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
  const [tableFilter, setTableFilter] = useState("default");

  // Discovery state — controlled entirely by user clicking the button
  const [discoverySearched, setDiscoverySearched] = useState(false);
  const [loadingDiscovery, setLoadingDiscovery] = useState(false);
  const [emptyDiscoveryNotice, setEmptyDiscoveryNotice] = useState(false);
  const emptyNoticeTimerRef = useRef(null);

  // Manual-add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalProductId, setAddModalProductId] = useState("");
  const [addForm, setAddForm] = useState({ url: "", platform: "noon", name: "" });
  const [addingManual, setAddingManual] = useState(false);
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");

  function handleOpenAddModal() {
    setAddError("");
    setAddSuccess("");
    const targetId =
      selectedProductId !== "all"
        ? String(selectedProductId)
        : products.length > 0
        ? String(products[0].id)
        : "";
    setAddModalProductId(targetId);
    setShowAddModal(true);
  }

  function handleCloseAddModal() {
    if (addingManual) return;
    setShowAddModal(false);
    setAddError("");
    setAddSuccess("");
  }

  // Pending-review action state (per-id loading)
  const [actionLoading, setActionLoading] = useState({});

  // Controls whether the discovered candidate list is expanded or collapsed
  const [candidatesVisible, setCandidatesVisible] = useState(true);

  // Search confirmation modal state (Price Intel styled dialog)
  const [searchConfirmOpen, setSearchConfirmOpen] = useState(false);
  const [clearingCandidates, setClearingCandidates] = useState(false);

  // Close Add Modal on Escape key
  useEffect(() => {
    if (!showAddModal) return;
    function handleKeyDown(e) {
      if (e.key === "Escape" && !addingManual) {
        handleCloseAddModal();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showAddModal, addingManual]);

  /* ── Load products strictly for the selected store ──────── */
  useEffect(() => {
    setSelectedProductId("all");
    setSearch("");
    // Reset discovery state whenever the store changes
    setCandidates([]);
    setDiscoverySearched(false);
    if (emptyNoticeTimerRef.current) {
      clearTimeout(emptyNoticeTimerRef.current);
    }
    setEmptyDiscoveryNotice(false);

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

  /* ── "Search My Competitors" — target computation & handlers ─ */
  const targetProductsForSearch = useMemo(() => {
    return selectedProductId === "all"
      ? products
      : products.filter((p) => String(p.id) === String(selectedProductId));
  }, [products, selectedProductId]);

  const searchTargetLabel = useMemo(() => {
    if (selectedProductId === "all") {
      return `all ${targetProductsForSearch.length} tracked product(s)`;
    }
    return targetProductsForSearch.length > 0
      ? displayName(targetProductsForSearch[0])
      : "selected product";
  }, [selectedProductId, targetProductsForSearch]);

  function handleSearchCompetitors() {
    if (products.length === 0 || loadingDiscovery) return;
    if (targetProductsForSearch.length === 0) return;
    setSearchConfirmOpen(true);
  }

  async function executeSearchCompetitors() {
    setSearchConfirmOpen(false);

    if (products.length === 0 || loadingDiscovery) return;
    if (targetProductsForSearch.length === 0) return;

    if (emptyNoticeTimerRef.current) {
      clearTimeout(emptyNoticeTimerRef.current);
      emptyNoticeTimerRef.current = null;
    }
    setEmptyDiscoveryNotice(false);

    setLoadingDiscovery(true);
    setCandidates([]);
    setDiscoverySearched(false);
    setCandidatesVisible(true);

    const flattened = [];

    try {
      // Sequential — one product at a time (safer for Daraz rate limits)
      for (const p of targetProductsForSearch) {
        try {
          const list = await discoverCompetitors(p.id);
          (Array.isArray(list) ? list : []).forEach((c) => {
            flattened.push({
              ...c,
              productId: p.id,
              productName: displayName(p),
            });
          });
        } catch (err) {
          console.error(`Discovery failed for product ${p.id}:`, err);
          // Continue other products; surface a simple alert for the failed one
          alert(
            err?.message ||
              `Discovery failed for "${displayName(p)}". Please try again.`
          );
        }
      }
      setCandidates(flattened);
      if (flattened.length === 0) {
        setEmptyDiscoveryNotice(true);
        emptyNoticeTimerRef.current = setTimeout(() => {
          setEmptyDiscoveryNotice(false);
        }, 6000);
      } else {
        setEmptyDiscoveryNotice(false);
      }
    } finally {
      setDiscoverySearched(true);
      setLoadingDiscovery(false);
    }
  }

  /* ── Filtered confirmed competitors ─────────────────────── */
  const filteredCompetitors = useMemo(() => {
    const list = competitors.filter((c) => {
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

    if (tableFilter === "stock") {
      // Out of stock on top, then limited, then in stock
      const rank = {
        out_of_stock: 1,
        limited: 2,
        in_stock: 3,
        pre_order: 4,
      };
      return [...list].sort((a, b) => {
        const normA = (a.stock_status || "").toLowerCase().replace(/[\s-]/g, "_");
        const normB = (b.stock_status || "").toLowerCase().replace(/[\s-]/g, "_");
        const rA = rank[normA] || 99;
        const rB = rank[normB] || 99;
        return rA - rB;
      });
    }

    if (tableFilter === "velocity") {
      // High, moderate, and then low
      const rank = {
        High: 1,
        Moderate: 2,
        Low: 3,
        Static: 4,
      };
      return [...list].sort((a, b) => {
        const rA = rank[a.repricing_velocity] || 99;
        const rB = rank[b.repricing_velocity] || 99;
        return rA - rB;
      });
    }

    if (tableFilter === "behavior") {
      // Undercutter to price matcher, then premium
      const rank = {
        "Aggressive Undercutter": 1,
        Undercutter: 2,
        "Discount Seller": 3,
        "Price Matcher": 4,
        "Above Market": 5,
        "Premium Seller": 6,
        "Passive Seller": 7,
        "Standard Seller": 8,
      };
      return [...list].sort((a, b) => {
        const rA = rank[a.behavior_type] || 99;
        const rB = rank[b.behavior_type] || 99;
        return rA - rB;
      });
    }

    return list;
  }, [search, selectedProductId, competitors, tableFilter]);

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

  /* ── Clear / Reject all pending candidates directly ─────── */
  async function handleClearCandidates() {
    if (filteredCandidates.length === 0 || clearingCandidates) return;
    setClearingCandidates(true);
    try {
      const idsToReject = filteredCandidates.map((c) => c.id);
      await Promise.allSettled(idsToReject.map((id) => rejectCompetitor(id)));
      const rejectedSet = new Set(idsToReject);
      setCandidates((prev) => prev.filter((c) => !rejectedSet.has(c.id)));
      setDiscoverySearched(false);
      setEmptyDiscoveryNotice(false);
      if (emptyNoticeTimerRef.current) {
        clearTimeout(emptyNoticeTimerRef.current);
      }
    } catch (err) {
      console.error("Failed to clear candidates:", err);
      alert(err?.message || "Failed to clear candidate list.");
    } finally {
      setClearingCandidates(false);
    }
  }

  /* ── Add manual competitor ───────────────────────────────── */
  async function handleAddManual(e) {
    e.preventDefault();
    setAddError("");
    setAddSuccess("");

    const targetProductId =
      addModalProductId ||
      (selectedProductId !== "all"
        ? selectedProductId
        : products.length > 0
        ? products[0].id
        : null);

    if (!targetProductId) {
      setAddError("Please select a tracked product to attach this competitor to.");
      return;
    }
    if (!addForm.url.trim()) {
      setAddError("URL is required.");
      return;
    }
    if (!selectedStore?.marketplace || !selectedStore?.country) {
      setAddError("Select a store first so we can validate the competitor URL.");
      return;
    }

    // Validate URL matches this store's marketplace + country
    let info;
    try {
      info = validateProductUrl(
        addForm.url.trim(),
        selectedStore.marketplace,
        selectedStore.country
      );
    } catch (err) {
      setAddError(err.message || "Invalid competitor URL.");
      return;
    }

    setAddingManual(true);
    try {
      await addCompetitorManual(targetProductId, {
        url: addForm.url.trim(),
        platform: info.marketplace, // from URL, not the dropdown
        name: addForm.name.trim() || null,
      });
      setAddSuccess("Competitor added and confirmed!");
      setAddForm({ url: "", platform: "noon", name: "" });

      const updated = await getProductCompetitors(targetProductId);
      const product = products.find((p) => String(p.id) === String(targetProductId));
      setCompetitors((prev) => {
        const others = prev.filter((c) => String(c.productId) !== String(targetProductId));
        const newOnes = (Array.isArray(updated) ? updated : []).map((c) => ({
          ...c,
          productId: targetProductId,
          productName: product ? displayName(product) : "—",
          ownPrice: product?.own_cost,
        }));
        return [...others, ...newOnes];
      });

      setTimeout(() => {
        setShowAddModal(false);
        setAddSuccess("");
      }, 700);
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
      <div
        className="res-page-header animate-in"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--d-text)", letterSpacing: "-0.3px" }}>
            Competitors
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--d-text-2)" }}>
            Sellers competing against your products across marketplaces.
          </p>
        </div>

        {selectedStore && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={handleSearchCompetitors}
              disabled={loadingDiscovery || products.length === 0}
              style={{
                padding: "8px 16px",
                background: "var(--d-surface)",
                color: "var(--d-text)",
                border: "1px solid var(--d-border)",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: loadingDiscovery || products.length === 0 ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (!loadingDiscovery && products.length > 0) {
                  e.currentTarget.style.borderColor = "var(--d-text-3)";
                }
              }}
              onMouseLeave={(e) => {
                if (!loadingDiscovery && products.length > 0) {
                  e.currentTarget.style.borderColor = "var(--d-border)";
                }
              }}
            >
              {loadingDiscovery && (
                <span
                  style={{
                    width: "13px",
                    height: "13px",
                    border: "2px solid var(--d-accent)",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 0.7s linear infinite",
                  }}
                />
              )}
              <span>Auto Discovery</span>
            </button>

            <button
              onClick={handleOpenAddModal}
              disabled={products.length === 0}
              style={{
                padding: "8px 18px",
                background: "var(--d-accent)",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: products.length === 0 ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)",
                transition: "all 0.15s ease",
                opacity: products.length === 0 ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (products.length > 0) {
                  e.currentTarget.style.opacity = "0.9";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                if (products.length > 0) {
                  e.currentTarget.style.opacity = "1";
                  e.currentTarget.style.transform = "translateY(0)";
                }
              }}
            >
              <span style={{ fontSize: "15px", lineHeight: 1 }}>+</span>
              <span>Add Competitor</span>
            </button>
          </div>
        )}
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
          <div
            className="animate-in"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "12px",
              marginBottom: "16px",
              animationDelay: "0.05s",
            }}
          >
            {[
              {
                label: "Confirmed Competitors",
                value: loadingCompetitors ? "…" : filteredCompetitors.length,
                badge: "+3 this week",
              },
              {
                label: "Pending Review",
                value: !discoverySearched ? "—" : (filteredCandidates.length > 0 ? filteredCandidates.length : "—"),
                subtext: discoverySearched && filteredCandidates.length > 0
                  ? `${filteredCandidates.length} awaiting review`
                  : "No pending reviews",
              },
              {
                label: "Price Drops Detected",
                value: "—",
                subtext: "No changes in 24h",
              },
            ].map((s, i) => (
              <div
                key={s.label}
                className="animate-in hover-lift"
                style={{ ...card, padding: "16px 20px", animationDelay: `${i * 0.05}s` }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--d-text-3)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {s.label}
                  </p>
                  {s.label === "Pending Review" && filteredCandidates.length > 0 && (
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: "#f59e0b",
                        display: "inline-block",
                      }}
                    />
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px" }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "26px",
                      fontWeight: 700,
                      color: "var(--d-text)",
                      letterSpacing: "-1px",
                      lineHeight: 1,
                    }}
                  >
                    {s.value}
                  </p>
                  {s.badge && (
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "#16a34a",
                        background: "rgba(22, 163, 74, 0.12)",
                        padding: "2px 8px",
                        borderRadius: "6px",
                      }}
                    >
                      {s.badge}
                    </span>
                  )}
                </div>
                {s.subtext && (
                  <p style={{ margin: "6px 0 0", fontSize: "12px", color: "var(--d-text-3)" }}>
                    {s.subtext}
                  </p>
                )}
              </div>
            ))}
          </div>





          {/* Spinner keyframe — inject once */}
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

          {/* ══ SECTION 3: Pending Review — shown when candidates exist OR temporary 6s empty notice ══ */}
          {filteredCandidates.length > 0 ? (
            <div className="animate-in" style={{ marginBottom: "16px", animationDelay: "0s" }}>
              {/* Candidates list */}
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
                      onClick={handleClearCandidates}
                      disabled={clearingCandidates || filteredCandidates.length === 0}
                      style={{
                        padding: "4px 10px",
                        border: "1px solid var(--d-border)",
                        borderRadius: "6px",
                        background: "var(--d-surface)",
                        color: "#dc2626",
                        fontSize: "12px",
                        fontWeight: 600,
                        fontFamily: "inherit",
                        cursor: clearingCandidates || filteredCandidates.length === 0 ? "not-allowed" : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        transition: "all 0.15s ease",
                        opacity: clearingCandidates ? 0.6 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!clearingCandidates && filteredCandidates.length > 0) {
                          e.currentTarget.style.borderColor = "#dc2626";
                          e.currentTarget.style.background = "rgba(220, 38, 38, 0.06)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!clearingCandidates && filteredCandidates.length > 0) {
                          e.currentTarget.style.borderColor = "var(--d-border)";
                          e.currentTarget.style.background = "var(--d-surface)";
                        }
                      }}
                    >
                      {clearingCandidates ? (
                        <>
                          <span
                            style={{
                              width: "10px",
                              height: "10px",
                              border: "2px solid #dc2626",
                              borderTopColor: "transparent",
                              borderRadius: "50%",
                              display: "inline-block",
                              animation: "spin 0.7s linear infinite",
                            }}
                          />
                          <span>Clearing…</span>
                        </>
                      ) : (
                        "Clear list"
                      )}
                    </button>
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
                              {c.stock_status && c.stock_status !== "unknown" && (
                                <StockBadge status={c.stock_status} />
                              )}
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
              </div>
          ) : emptyDiscoveryNotice ? (
            /* Empty state after search when 0 candidates were found — visible for 6s only */
            <div className="animate-in" style={{ marginBottom: "16px", animationDelay: "0s" }}>
              <div style={{ ...card, textAlign: "center", padding: "32px 24px", borderColor: "var(--d-border)" }}>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--d-text)" }}>No new competitors found</p>
                <p style={{ margin: "6px 0 0", fontSize: "12.5px", color: "var(--d-text-3)" }}>
                  No unconfirmed competitor candidates were found for your{" "}
                  {selectedProductId === "all" ? "products" : "selected product"}.
                  Try adding competitors manually above.
                </p>
              </div>
            </div>
          ) : null}

          {/* ══ SECTION 4: Confirmed competitors table (Joined with Search & Filter) ══ */}
          <div className="animate-in" style={{ ...card, padding: 0, overflow: "hidden", animationDelay: "0.12s" }}>
            {/* Top: Joined Search & Filter Controls */}
            <div
              style={{
                padding: "12px 20px",
                display: "flex",
                gap: "12px",
                alignItems: "center",
                borderBottom: "1px solid var(--d-border)",
                flexWrap: "nowrap",
                overflowX: "auto",
              }}
            >
              {/* Search */}
              <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
                <span
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--d-text-3)",
                    display: "flex",
                    alignItems: "center",
                    pointerEvents: "none",
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Search competitors, products, or URLs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px 8px 34px",
                    borderRadius: "7px",
                    border: "1px solid var(--d-border)",
                    background: "var(--d-surface)",
                    color: "var(--d-text)",
                    fontSize: "13px",
                    fontFamily: "inherit",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--d-accent)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--d-border)")}
                />
              </div>

              {/* Product filter */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                <label
                  style={{
                    fontSize: "12.5px",
                    fontWeight: 600,
                    color: "var(--d-text-2)",
                    whiteSpace: "nowrap",
                  }}
                >
                  Product:
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  disabled={loadingProducts || products.length === 0}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "7px",
                    border: "1px solid var(--d-border)",
                    background: "var(--d-surface)",
                    color: "var(--d-text)",
                    fontSize: "13px",
                    fontWeight: 600,
                    fontFamily: "inherit",
                    cursor: products.length > 0 ? "pointer" : "default",
                    outline: "none",
                    minWidth: "190px",
                    maxWidth: "280px",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--d-accent)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--d-border)")}
                >
                  {products.length === 0 ? (
                    <option value="all">No products tracked yet (0)</option>
                  ) : (
                    <>
                      <option value="all">
                        All Tracked Products ({products.length})
                      </option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {displayName(p)}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              {/* Table sort filter */}
              <select
                id="competitor-table-filter"
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                style={{
                  padding: "8px 30px 8px 12px",
                  borderRadius: "7px",
                  border: "1px solid var(--d-border)",
                  background: "var(--d-surface-2)",
                  color: "var(--d-text)",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  outline: "none",
                  appearance: "none",
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 10px center",
                  minWidth: "135px",
                  flexShrink: 0,
                }}
              >
                <option value="default">Filter: Default</option>
                <option value="stock">Stock (Out of Stock → In Stock)</option>
                <option value="velocity">Velocity (High → Low)</option>
                <option value="behavior">Behavior (Undercutter → Matcher)</option>
              </select>

              {/* Sellers found count */}
              <span
                style={{
                  fontSize: "12.5px",
                  fontWeight: 600,
                  color: "var(--d-text-3)",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {loadingCompetitors
                  ? "Loading…"
                  : `${filteredCompetitors.length} sellers found`}
              </span>
            </div>

            {/* Header: Detected Sellers */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 20px 14px" }}>
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
              <div>
                <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--d-text-3)", whiteSpace: "nowrap" }}>
                  {loadingCompetitors ? "Loading…" : `${filteredCompetitors.length} sellers found`}
                </span>
              </div>
            </div>

            <div style={{ overflowX: "auto", padding: "0 20px 20px" }}>
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

                          {/* 4. Behavior Type */}
                          <td style={{ padding: "14px", whiteSpace: "nowrap" }}>
                            <BehaviorBadge behavior={c.behavior_type} />
                          </td>

                          {/* 5. Repricing Velocity */}
                          <td style={{ padding: "14px", whiteSpace: "nowrap" }}>
                            <VelocityBadge velocity={c.repricing_velocity} />
                          </td>

                          {/* 6. Stock Status */}
                          <td style={{ padding: "14px", whiteSpace: "nowrap" }}>
                            <StockBadge status={c.stock_status} />
                          </td>

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
      {/* ── Search Confirmation Modal (Price Intel Theme) ────── */}
      <ConfirmModal
        isOpen={searchConfirmOpen}
        title="Discover Competitors?"
        message={
          <span>
            Discover competitors for{" "}
            <strong style={{ color: "var(--d-text)", fontWeight: 700 }}>
              "{searchTargetLabel}"
            </strong>
            ?
            <br />
            <br />
            This will search the marketplace, filter results, and show you
            candidates to Accept or Reject. Previous pending candidates for these
            products will be cleared.
          </span>
        }
        confirmText="Search Competitors"
        cancelText="Cancel"
        isDestructive={false}
        icon={
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        }
        onConfirm={executeSearchCompetitors}
        onCancel={() => setSearchConfirmOpen(false)}
      />

      {/* ── Add Competitor Popup Modal (Price Intel Theme) ────── */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px",
            animation: "confirmModalFadeIn 0.15s ease-out",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !addingManual) {
              handleCloseAddModal();
            }
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              background: "var(--d-surface)",
              border: "1px solid var(--d-border)",
              borderRadius: "14px",
              width: "100%",
              maxWidth: "480px",
              padding: "24px",
              boxShadow: "0 20px 45px rgba(0, 0, 0, 0.35)",
              boxSizing: "border-box",
              animation: "confirmModalZoomIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
              position: "relative",
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  background: "var(--d-accent-bg)",
                  color: "var(--d-accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <button
                type="button"
                onClick={handleCloseAddModal}
                disabled={addingManual}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--d-text-3)",
                  fontSize: "18px",
                  cursor: addingManual ? "not-allowed" : "pointer",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  lineHeight: 1,
                  transition: "color 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--d-text)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--d-text-3)"; }}
                title="Close"
              >
                ✕
              </button>
            </div>

            <h2 style={{ margin: "0 0 6px", fontSize: "17px", fontWeight: 700, color: "var(--d-text)", letterSpacing: "-0.3px" }}>
              Add Competitor Manually
            </h2>
            <p style={{ margin: "0 0 20px", fontSize: "13px", color: "var(--d-text-2)", lineHeight: 1.5 }}>
              Paste a competitor product URL — it will be immediately confirmed and tracked for price changes.
            </p>

            <form onSubmit={handleAddManual} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Product selection dropdown */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--d-text-3)", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  Tracking Against Product
                </label>
                <select
                  value={addModalProductId}
                  onChange={(e) => setAddModalProductId(e.target.value)}
                  required
                  style={{
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--d-border)",
                    background: "var(--d-surface-2)",
                    color: "var(--d-text)",
                    fontSize: "13px",
                    fontWeight: 600,
                    fontFamily: "inherit",
                    outline: "none",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--d-accent)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--d-border)")}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {displayName(p)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Competitor URL */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--d-text-3)", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  Competitor URL <span style={{ color: "var(--d-danger)" }}>*</span>
                </label>
                <input
                  type="url"
                  placeholder="https://www.noon.com/product/... or Daraz URL"
                  value={addForm.url}
                  onChange={(e) => setAddForm((f) => ({ ...f, url: e.target.value }))}
                  required
                  style={{
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--d-border)",
                    background: "var(--d-surface)",
                    color: "var(--d-text)",
                    fontSize: "13px",
                    fontFamily: "inherit",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--d-accent)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--d-border)")}
                />
              </div>

              {/* Platform & Name */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "10px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--d-text-3)", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                    Platform
                  </label>
                  <select
                    value={addForm.platform}
                    onChange={(e) => setAddForm((f) => ({ ...f, platform: e.target.value }))}
                    style={{
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--d-border)",
                      background: "var(--d-surface)",
                      color: "var(--d-text)",
                      fontSize: "13px",
                      fontFamily: "inherit",
                      outline: "none",
                    }}
                  >
                    <option value="noon">Noon</option>
                    <option value="daraz">Daraz</option>
                  </select>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--d-text-3)", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                    Seller Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Official Store"
                    value={addForm.name}
                    onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                    style={{
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--d-border)",
                      background: "var(--d-surface)",
                      color: "var(--d-text)",
                      fontSize: "13px",
                      fontFamily: "inherit",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--d-accent)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--d-border)")}
                  />
                </div>
              </div>

              {/* Error & Success Alerts */}
              {addError && (
                <div
                  style={{
                    padding: "9px 12px",
                    background: "var(--d-danger-bg)",
                    color: "var(--d-danger)",
                    border: "1px solid var(--d-danger)",
                    borderRadius: "7px",
                    fontSize: "12.5px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>⚠️</span>
                  <span>{addError}</span>
                </div>
              )}
              {addSuccess && (
                <div
                  style={{
                    padding: "9px 12px",
                    background: "rgba(22, 163, 74, 0.12)",
                    color: "#16a34a",
                    border: "1px solid #16a34a",
                    borderRadius: "7px",
                    fontSize: "12.5px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>✓</span>
                  <span>{addSuccess}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  disabled={addingManual}
                  onClick={handleCloseAddModal}
                  style={{
                    padding: "9px 16px",
                    background: "var(--d-surface-2)",
                    color: "var(--d-text)",
                    border: "1px solid var(--d-border)",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: addingManual ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingManual}
                  style={{
                    padding: "9px 20px",
                    background: "var(--d-accent)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: addingManual ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    boxShadow: "0 2px 8px rgba(59, 130, 246, 0.25)",
                    opacity: addingManual ? 0.7 : 1,
                  }}
                >
                  {addingManual ? (
                    <>
                      <span
                        style={{
                          display: "inline-block",
                          width: "12px",
                          height: "12px",
                          border: "2px solid #ffffff",
                          borderTopColor: "transparent",
                          borderRadius: "50%",
                          animation: "confirmModalSpin 0.6s linear infinite",
                        }}
                      />
                      <span>Adding…</span>
                    </>
                  ) : (
                    "+ Add Competitor"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default Competitors;