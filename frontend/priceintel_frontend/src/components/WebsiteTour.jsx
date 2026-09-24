// src/components/WebsiteTour.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { completeOnboarding } from "../api/auth";

const TOUR_STEPS = [
  {
    targetId: "sidebar-nav-dashboard",
    title: "Dashboard",
    description:
      "Your Dashboard gives you a quick overview of your pricing performance, competitor activity, alerts, and market movement.",
    badge: "Step 1 of 5",
  },
  {
    targetId: "sidebar-nav-products",
    title: "Products",
    description:
      "Track your products and see how your prices compare with competing listings.",
    badge: "Step 2 of 5",
  },
  {
    targetId: "sidebar-nav-competitors",
    title: "Competitors",
    description:
      "Monitor competing sellers, pricing changes, and competitor behavior.",
    badge: "Step 3 of 5",
  },
  {
    targetId: "sidebar-nav-alerts",
    title: "Alerts",
    description:
      "Stay informed when important competitor pricing events and opportunities are detected.",
    badge: "Step 4 of 5",
  },
  {
    targetId: "sidebar-nav-reports",
    title: "Reports",
    description:
      "Use Reports to analyze your pricing and competitor intelligence.",
    badge: "Step 5 of 5",
  },
];

export default function WebsiteTour({ active, onDismiss }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [completing, setCompleting] = useState(false);

  // Position calculation
  const updateTargetPosition = useCallback(() => {
    const stepData = TOUR_STEPS[currentStep];
    if (!stepData) return;

    const el = document.getElementById(stepData.targetId);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
        right: rect.right,
      });
      // Scroll into view if needed
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } else {
      setTargetRect(null);
    }
  }, [currentStep]);

  useEffect(() => {
    if (!active) return;
    updateTargetPosition();

    const handleResize = () => updateTargetPosition();
    const handleScroll = () => updateTargetPosition();

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll);

    // Recheck after a small delay in case sidebar animation / fonts settle
    const timer = setTimeout(updateTargetPosition, 100);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(timer);
    };
  }, [active, currentStep, updateTargetPosition]);

  if (!active) return null;

  const step = TOUR_STEPS[currentStep];
  const isLast = currentStep === TOUR_STEPS.length - 1;
  const isFirst = currentStep === 0;

  async function handleFinish() {
    setCompleting(true);
    try {
      await completeOnboarding();
    } catch {
      // Ignore API errors
    }
    localStorage.setItem("onboarding_completed", "true");
    // Clean up query param
    searchParams.delete("tour");
    setSearchParams(searchParams);
    if (onDismiss) onDismiss();
    navigate("/dashboard");
    setCompleting(false);
  }

  async function handleSkip() {
    setCompleting(true);
    try {
      await completeOnboarding();
    } catch {
      // Ignore API errors
    }
    localStorage.setItem("onboarding_completed", "true");
    searchParams.delete("tour");
    setSearchParams(searchParams);
    if (onDismiss) onDismiss();
    navigate("/dashboard");
    setCompleting(false);
  }

  function handleNext() {
    if (isLast) {
      handleFinish();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  }

  function handleBack() {
    if (!isFirst) {
      setCurrentStep((prev) => prev - 1);
    }
  }

  // Calculate popover positioning relative to targetRect
  let popoverStyle = {
    position: "fixed",
    zIndex: 10001,
    width: "320px",
    maxWidth: "calc(100vw - 32px)",
    background: "#FFFFFF",
    borderRadius: "14px",
    border: "1px solid #E2E8F0",
    boxShadow: "0 20px 50px rgba(15, 23, 42, 0.22), 0 2px 8px rgba(0, 0, 0, 0.08)",
    padding: "20px",
    transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
  };

  if (targetRect) {
    const isDesktop = window.innerWidth >= 768;
    if (isDesktop && targetRect.right + 340 < window.innerWidth) {
      // Position to the right of the sidebar item
      popoverStyle.left = `${targetRect.right + 16}px`;
      popoverStyle.top = `${Math.max(16, Math.min(targetRect.top - 20, window.innerHeight - 300))}px`;
    } else {
      // Position below or centered if space is limited
      popoverStyle.left = `${Math.max(16, Math.min(targetRect.left, window.innerWidth - 336))}px`;
      popoverStyle.top = `${Math.min(targetRect.bottom + 12, window.innerHeight - 280)}px`;
    }
  } else {
    // Fallback center of screen
    popoverStyle.left = "50%";
    popoverStyle.top = "50%";
    popoverStyle.transform = "translate(-50%, -50%)";
  }

  return (
    <>
      {/* Dark overlay backdrop */}
      <div
        id="tour-backdrop"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.65)",
          backdropFilter: "blur(2px)",
          zIndex: 9999,
          transition: "opacity 0.25s ease",
        }}
        onClick={handleSkip}
      />

      {/* Spotlight cutout / glow box around the active sidebar item */}
      {targetRect && (
        <div
          id="tour-spotlight"
          style={{
            position: "fixed",
            top: `${targetRect.top - 4}px`,
            left: `${targetRect.left - 4}px`,
            width: `${targetRect.width + 8}px`,
            height: `${targetRect.height + 8}px`,
            borderRadius: "10px",
            border: "2px solid #3B82F6",
            boxShadow: "0 0 0 4px rgba(59, 130, 246, 0.35), 0 0 24px rgba(37, 99, 235, 0.4)",
            zIndex: 10000,
            pointerEvents: "none",
            transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      )}

      {/* Tour Tooltip Card */}
      <div id="tour-popover-card" style={popoverStyle}>
        {/* Top row: Badge, Step indicator, and Skip button */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                fontSize: "10.5px",
                fontWeight: 700,
                color: "#2563EB",
                background: "#EFF6FF",
                padding: "2px 8px",
                borderRadius: "100px",
                border: "1px solid #BFDBFE",
              }}
            >
              {step.badge}
            </span>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748B" }}>
              Step {currentStep + 1} of {TOUR_STEPS.length}
            </span>
          </div>

          <button
            id="tour-btn-skip-top"
            onClick={handleSkip}
            title="Skip Tour"
            style={{
              background: "none",
              border: "none",
              color: "#94A3B8",
              fontSize: "11.5px",
              fontWeight: 500,
              cursor: "pointer",
              padding: "2px 6px",
              borderRadius: "4px",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#475569")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#94A3B8")}
          >
            Skip
          </button>
        </div>

        {/* Title */}
        <h3
          style={{
            margin: "0 0 8px",
            fontSize: "16px",
            fontWeight: 700,
            color: "#0F172A",
            letterSpacing: "-0.2px",
          }}
        >
          {step.title}
        </h3>

        {/* Description */}
        <p
          style={{
            margin: "0 0 18px",
            fontSize: "12.5px",
            color: "#475569",
            lineHeight: 1.55,
          }}
        >
          {step.description}
        </p>

        {/* Footer: Step Dots + Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "12px", borderTop: "1px solid #F1F5F9" }}>
          {/* Step Dots */}
          <div style={{ display: "flex", gap: "5px" }}>
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === currentStep ? "16px" : "6px",
                  height: "6px",
                  borderRadius: "100px",
                  background: i === currentStep ? "#2563EB" : "#CBD5E1",
                  transition: "all 0.2s ease",
                }}
              />
            ))}
          </div>

          {/* Navigation Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              id="tour-btn-skip"
              type="button"
              onClick={handleSkip}
              disabled={completing}
              style={{
                padding: "6px 12px",
                background: "transparent",
                color: "#64748B",
                border: "none",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer",
                transition: "color 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#0F172A")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#64748B")}
            >
              Skip Tour
            </button>

            {!isFirst && (
              <button
                id="tour-btn-back"
                type="button"
                onClick={handleBack}
                style={{
                  padding: "6px 12px",
                  background: "#F1F5F9",
                  color: "#475569",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                }}
              >
                Back
              </button>
            )}

            <button
              id="tour-btn-next"
              type="button"
              onClick={handleNext}
              disabled={completing}
              style={{
                padding: "6px 14px",
                background: "#2563EB",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(37, 99, 235, 0.35)",
                transition: "all 0.15s ease",
              }}
            >
              {isLast ? (completing ? "Finishing…" : "Finish Tour") : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
