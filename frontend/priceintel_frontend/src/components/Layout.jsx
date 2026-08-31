// src/components/Layout.jsx
import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useStore } from "../context/StoreContext";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    label: "Products",
    path: "/products",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
  {
    label: "Competitors",
    path: "/competitors",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m16 3 4 4-4 4" />
        <path d="M20 7H4" />
        <path d="m8 21-4-4 4-4" />
        <path d="M4 17h16" />
      </svg>
    ),
  },
  {
    label: "Alerts",
    path: "/alerts",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    ),
  },
  {
    label: "Reports",
    path: "/reports",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
];

const BOTTOM_NAV = [
  {
    label: "Account",
    path: "/account",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="5" />
        <path d="M20 21a8 8 0 0 0-16 0" />
      </svg>
    ),
  },
  {
    label: "Settings",
    path: "/settings",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
  {
    label: "Help",
    path: "/help",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
];


function StoreSwitcher() {
  const navigate = useNavigate();
  const { stores, selectedStore, setSelectedStore } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 12px",
          borderRadius: "7px",
          border: "1px solid var(--d-border)",
          background: "var(--d-surface)",
          color: selectedStore ? "var(--d-text)" : "var(--d-text-2)",
          fontSize: "13.5px",
          fontWeight: 600,
          fontFamily: "inherit",
          cursor: "pointer",
          boxShadow: "var(--shadow-xs)",
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={selectedStore ? "var(--d-accent)" : "var(--d-text-3)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <span>{selectedStore?.store_name || "No Stores Added"}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--d-text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            background: "var(--d-surface)",
            border: "1px solid var(--d-border)",
            borderRadius: "8px",
            boxShadow: "var(--shadow-md)",
            minWidth: "190px",
            zIndex: 1000,
            padding: "4px",
          }}
        >
          <div style={{ padding: "5px 8px 3px", fontSize: "10px", fontWeight: 600, color: "var(--d-text-3)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Your Stores
          </div>
          {stores.length > 0 ? (
            stores.map((s) => {
              const isSelected = selectedStore?.id === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => {
                    setSelectedStore(s);
                    setOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "7px 10px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: isSelected ? 600 : 400,
                    color: isSelected ? "var(--d-accent)" : "var(--d-text)",
                    background: isSelected ? "var(--d-accent-bg)" : "transparent",
                    cursor: "pointer",
                  }}
                >
                  <span>{s.store_name}</span>
                  <span style={{ fontSize: "10px", color: "var(--d-text-3)", textTransform: "uppercase" }}>{s.marketplace || "store"}</span>
                </div>
              );
            })
          ) : (
            <div style={{ padding: "8px 10px", textAlign: "center" }}>
              <div style={{ fontSize: "12px", color: "var(--d-text-2)", marginBottom: "8px" }}>
                No stores connected yet.
              </div>
              <button
                onClick={() => {
                  setOpen(false);
                  navigate("/account");
                }}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  color: "var(--d-accent)",
                  background: "var(--d-accent-bg)",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                + Add Store in Account
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UserAvatar() {
  const navigate = useNavigate();
  return (
    <div
      id="user-avatar-btn"
      onClick={() => navigate("/account")}
      style={{
        width: "30px",
        height: "30px",
        borderRadius: "50%",
        background: "var(--d-accent)",
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: "13px",
        cursor: "pointer",
        boxShadow: "0 2px 4px rgba(37,99,235,0.25)",
        transition: "transform 0.15s ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.08)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      title="My Account"
    >
      M
    </div>
  );
}

function SidebarNavItem({ item, active, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 14px",
        borderRadius: "8px",
        cursor: "pointer",
        color: active ? "var(--d-accent)" : hovered ? "var(--d-text)" : "var(--d-text-2)",
        background: active ? "var(--d-accent-bg)" : hovered ? "var(--d-surface-2)" : "transparent",
        fontSize: "14px",
        fontWeight: active ? 600 : 500,
        position: "relative",
        transition: "all 0.15s ease",
      }}
    >
      {active && (
        <div
          style={{
            position: "absolute",
            left: "-4px",
            top: "8px",
            bottom: "8px",
            width: "3.5px",
            background: "var(--d-accent)",
            borderRadius: "0 4px 4px 0",
          }}
        />
      )}
      <span style={{ display: "flex", alignItems: "center", color: active ? "var(--d-accent)" : hovered ? "var(--d-text)" : "var(--d-text-3)" }}>
        {item.icon}
      </span>
      <span>{item.label}</span>
    </div>
  );
}

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() {
    localStorage.removeItem("token");
    navigate("/");
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "var(--d-bg)", fontFamily: "'Inter', sans-serif" }}>
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        style={{
          width: "260px",
          flexShrink: 0,
          background: "var(--d-surface)",
          borderRight: "1px solid var(--d-border)",
          boxShadow: "2px 0 8px -2px rgba(0,0,0,0.05)",
          display: "flex",
          flexDirection: "column",
          padding: "22px 16px",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
          boxSizing: "border-box",
          zIndex: 50,
        }}
      >
        {/* Brand Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "4px 6px 26px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "var(--d-accent)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: "14px",
              boxShadow: "0 2px 8px rgba(37,99,235,0.28)",
            }}
          >
            PI
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: 700, fontSize: "15px", color: "var(--d-text)", lineHeight: 1.2 }}>Price Intel</span>
            <span style={{ fontSize: "11px", color: "var(--d-text-3)", fontWeight: 500 }}>Enterprise Analytics</span>
          </div>
        </div>

        {/* Top Nav Items */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {NAV_ITEMS.map((item) => {
            const active =
              location.pathname === item.path ||
              (item.path === "/products" && location.pathname.startsWith("/products"));
            return (
              <SidebarNavItem
                key={item.path}
                item={item}
                active={active}
                onClick={() => navigate(item.path)}
              />
            );
          })}
        </nav>

        {/* Divider between top nav and bottom nav */}
        <div style={{ height: "1px", background: "var(--d-border)", margin: "18px 4px 14px" }} />

        {/* Bottom Section */}
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
          {BOTTOM_NAV.map((item) => {
            const active = location.pathname === item.path;
            return (
              <SidebarNavItem
                key={item.path}
                item={item}
                active={active}
                onClick={() => navigate(item.path)}
              />
            );
          })}

          {/* Logout Button */}
          <div
            onClick={handleLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "10px 14px",
              marginTop: "4px",
              borderRadius: "8px",
              cursor: "pointer",
              color: "var(--d-danger)",
              background: "transparent",
              border: "none",
              fontSize: "14px",
              fontWeight: 500,
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--d-danger-bg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Logout</span>
          </div>
        </div>
      </aside>

      {/* ── Main Layout (Top bar + Page content) ─────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top Header */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 36px",
            borderBottom: "1px solid var(--d-border)",
            background: "var(--d-surface)",
            position: "sticky",
            top: 0,
            zIndex: 40,
          }}
        >
          <StoreSwitcher />
          {/* Right side: avatar */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <UserAvatar />
          </div>
        </header>

        {/* Page Content */}
        <main style={{ flex: 1, padding: "28px 36px", overflowY: "auto", background: "var(--d-bg)" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
