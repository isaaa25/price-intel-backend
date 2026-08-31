// src/components/AuthBackground.jsx
import React from "react";

export default function AuthBackground({ children }) {
  return (
    <>
      {/* Brand Header Top-Left */}
      <div className="auth-brand-header">
        <div className="brand-logo-box">PI</div>
        <div className="brand-logo-text">
          <span className="brand-title">Price Intel</span>
          <span className="brand-subtitle">Enterprise Analytics</span>
        </div>
      </div>

      {/* Background Radar Rings */}
      <svg className="bg-radar-rings" viewBox="0 0 520 520">
        <circle cx="50" cy="50" r="70" fill="none" stroke="#e0e7ff" strokeWidth="1" strokeDasharray="4 4" />
        <circle cx="50" cy="50" r="130" fill="none" stroke="#e0e7ff" strokeWidth="1" />
        <circle cx="50" cy="50" r="190" fill="none" stroke="#e0e7ff" strokeWidth="1" strokeDasharray="6 6" />
        <circle cx="50" cy="50" r="260" fill="none" stroke="#e0e7ff" strokeWidth="1" />
        <circle cx="50" cy="50" r="340" fill="none" stroke="#e0e7ff" strokeWidth="1" strokeDasharray="8 8" />
      </svg>

      {/* Floating UI Decor Cards */}
      {/* 1. Dollar Card */}
      <div className="floating-card float-dollar" style={{ animationDelay: "0s" }}>
        <span className="dollar-symbol">$</span>
      </div>

      {/* 2. Pie Chart */}
      <div className="floating-card float-pie" style={{ animationDelay: "1.2s" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
          <path d="M22 12A10 10 0 0 0 12 2v10z" />
        </svg>
      </div>

      {/* 3. Shopping Cart */}
      <div className="floating-card float-cart" style={{ animationDelay: "0.6s" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
      </div>

      {/* 4. Search Icon */}
      <div className="floating-card float-search" style={{ animationDelay: "1.8s" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>

      {/* 5. Bar Chart Card */}
      <div className="floating-card float-barchart" style={{ animationDelay: "2.4s" }}>
        <div className="bar-column" style={{ height: "35%" }} />
        <div className="bar-column" style={{ height: "65%" }} />
        <div className="bar-column" style={{ height: "45%" }} />
        <div className="bar-column" style={{ height: "85%" }} />
        <div className="bar-column" style={{ height: "55%" }} />
        <div className="bar-column" style={{ height: "100%" }} />
      </div>

      {/* Particles */}
      <div className="wave-particle p1" />
      <div className="wave-particle p2" />
      <div className="wave-particle p3" />
      <div className="wave-particle p4" />
      <div className="wave-particle p5" />
      <div className="wave-particle p6" />
      <div className="wave-particle p7" />

      {/* 3D Wave Bottom Graphic */}
      <div className="auth-waves-wrapper">
        <svg className="auth-waves-svg" viewBox="0 0 1440 360" fill="none" preserveAspectRatio="none">
          <path
            d="M0 160C240 100 480 220 720 180C960 140 1200 60 1440 120V360H0V160Z"
            fill="url(#wave-grad-1)"
            opacity="0.45"
          />
          <path
            d="M0 210C320 150 540 270 820 210C1100 150 1280 190 1440 170V360H0V210Z"
            fill="url(#wave-grad-2)"
            opacity="0.65"
          />
          <path
            d="M0 270C360 210 600 310 900 260C1200 210 1320 250 1440 240V360H0V270Z"
            fill="url(#wave-grad-3)"
            opacity="0.85"
          />
          <defs>
            <linearGradient id="wave-grad-1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#e0e7ff" />
              <stop offset="50%" stopColor="#ede9fe" />
              <stop offset="100%" stopColor="#e0e7ff" />
            </linearGradient>
            <linearGradient id="wave-grad-2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#c7d2fe" />
              <stop offset="50%" stopColor="#ddd6fe" />
              <stop offset="100%" stopColor="#c7d2fe" />
            </linearGradient>
            <linearGradient id="wave-grad-3" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#e0e7fe" />
              <stop offset="50%" stopColor="#ede9fe" />
              <stop offset="100%" stopColor="#e0e7fe" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {children}
    </>
  );
}
