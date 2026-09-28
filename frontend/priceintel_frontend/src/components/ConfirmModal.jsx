import React, { useEffect } from "react";

/**
 * Reusable Confirmation Dialog Modal for Price Intel
 * 
 * Works seamlessly in both Light and Dark mode using the app's CSS variables (--d-*).
 */
export default function ConfirmModal({
  isOpen,
  title = "Delete Product?",
  productName,
  message,
  confirmText = "Delete",
  cancelText = "Cancel",
  loading = false,
  error = "",
  onConfirm,
  onCancel,
  isDestructive = true,
}) {
  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e) {
      if (e.key === "Escape" && !loading) {
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, loading, onCancel]);

  if (!isOpen) return null;

  const defaultMessage = productName ? (
    <>
      Are you sure you want to delete <strong style={{ color: "var(--d-text)", fontWeight: 700 }}>"{productName}"</strong>? This will remove the tracked product and its competitor listings.
    </>
  ) : (
    "Are you sure you want to proceed with this action?"
  );

  return (
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
        if (e.target === e.currentTarget && !loading) {
          onCancel();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <style>{`
        @keyframes confirmModalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes confirmModalZoomIn {
          from { opacity: 0; transform: scale(0.96) translateY(6px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes confirmModalSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div
        style={{
          background: "var(--d-surface)",
          border: "1px solid var(--d-border)",
          borderRadius: "14px",
          width: "100%",
          maxWidth: "430px",
          padding: "24px",
          boxShadow: "0 20px 45px rgba(0, 0, 0, 0.35)",
          boxSizing: "border-box",
          animation: "confirmModalZoomIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Warning / Destructive Icon Bubble */}
        <div
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            background: isDestructive ? "var(--d-danger-bg)" : "var(--d-accent-bg)",
            color: isDestructive ? "var(--d-danger)" : "var(--d-accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "16px",
          }}
        >
          {isDestructive ? (
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          ) : (
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
        </div>

        {/* Modal Title */}
        <h2
          id="confirm-modal-title"
          style={{
            margin: "0 0 8px",
            fontSize: "17px",
            fontWeight: 700,
            color: "var(--d-text)",
            letterSpacing: "-0.3px",
          }}
        >
          {title}
        </h2>

        {/* Message */}
        <p
          style={{
            margin: "0 0 20px",
            fontSize: "13.5px",
            color: "var(--d-text-2)",
            lineHeight: 1.55,
          }}
        >
          {message || defaultMessage}
        </p>

        {/* Error notification if deletion failed */}
        {error && (
          <div
            style={{
              padding: "9px 12px",
              background: "var(--d-danger-bg)",
              color: "var(--d-danger)",
              border: "1px solid var(--d-danger)",
              borderRadius: "7px",
              fontSize: "12px",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
            marginTop: "8px",
          }}
        >
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            style={{
              padding: "9px 18px",
              background: "var(--d-surface-2)",
              color: "var(--d-text)",
              border: "1px solid var(--d-border)",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              opacity: loading ? 0.6 : 1,
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.borderColor = "var(--d-text-3)";
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.borderColor = "var(--d-border)";
              }
            }}
          >
            {cancelText}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            style={{
              padding: "9px 20px",
              background: isDestructive ? "var(--d-danger)" : "var(--d-accent)",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              opacity: loading ? 0.7 : 1,
              boxShadow: isDestructive
                ? "0 2px 8px rgba(239, 68, 68, 0.25)"
                : "0 2px 8px rgba(59, 130, 246, 0.25)",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.opacity = "0.9";
                e.currentTarget.style.transform = "translateY(-1px)";
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.opacity = "1";
                e.currentTarget.style.transform = "translateY(0)";
              }
            }}
          >
            {loading ? (
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
                <span>Deleting…</span>
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
