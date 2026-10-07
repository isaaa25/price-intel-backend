// src/pages/AI.jsx
import React, { useState, useRef, useEffect } from "react";

/* ─── Static suggestion cards ─────────────────────────────────── */
const SUGGESTIONS = [
  {
    id: "pricing",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    title: "Find Optimal Pricing",
    description: "Analyze competitor prices and find a competitive price for your product.",
    message: "Can you help me find the optimal price for my products based on competitor pricing?",
    color: "#3B82F6",
    bg: "rgba(59,130,246,0.08)",
  },
  {
    id: "competitors",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m16 3 4 4-4 4" />
        <path d="M20 7H4" />
        <path d="m8 21-4-4 4-4" />
        <path d="M4 17h16" />
      </svg>
    ),
    title: "Analyze Competitors",
    description: "Understand competitor pricing and market positioning.",
    message: "Analyze my competitors and their pricing strategies.",
    color: "#10B981",
    bg: "rgba(16,185,129,0.08)",
  },
  {
    id: "marketing",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    title: "Marketing Strategy",
    description: "Get ideas to improve product visibility and sales.",
    message: "What marketing strategies would you recommend to increase my product sales?",
    color: "#8B5CF6",
    bg: "rgba(139,92,246,0.08)",
  },
  {
    id: "insights",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    title: "Store Insights",
    description: "Explore opportunities and important trends in your store.",
    message: "What are the most important trends and opportunities in my store right now?",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.08)",
  },
];

/* ─── Placeholder AI responses ────────────────────────────────── */
const PLACEHOLDER_RESPONSES = {
  pricing:
    "Once connected to your live pricing data, I'll compare your product prices against all tracked competitors, factor in your cost margins, and recommend an optimal price range that keeps you competitive while protecting your profit. I'll also flag if you should raise or lower prices based on market movement.",
  competitors:
    "When linked to your store data, I'll analyze each competitor's pricing behavior — who prices lowest, who prices highest, where the price gaps are, and which competitors are repricing aggressively. I'll surface strategic insights you can act on immediately.",
  marketing:
    "With your sales and product data connected, I can suggest targeted marketing strategies: which products to promote, what price points attract buyers, seasonal timing, and how to position against competitors. I'll tailor recommendations to your specific market.",
  insights:
    "Once I'm connected to your store, I'll surface your most important opportunities — products that are underpriced, competitors going out of stock, price wars forming, and market gaps you can exploit to grow revenue.",
  default:
    "I'm currently a UI prototype. Once connected to your live store data, I'll be able to analyze your pricing, competitors, costs, and market position to give you personalized recommendations.",
};

function getAIResponse(message) {
  const lower = message.toLowerCase();
  if (lower.includes("price") || lower.includes("pricing") || lower.includes("optimal"))
    return PLACEHOLDER_RESPONSES.pricing;
  if (lower.includes("competitor") || lower.includes("market") || lower.includes("position"))
    return PLACEHOLDER_RESPONSES.competitors;
  if (lower.includes("marketing") || lower.includes("sales") || lower.includes("visibility"))
    return PLACEHOLDER_RESPONSES.marketing;
  if (lower.includes("insight") || lower.includes("trend") || lower.includes("opportunit"))
    return PLACEHOLDER_RESPONSES.insights;
  return PLACEHOLDER_RESPONSES.default;
}

/* ─── Typing indicator ─────────────────────────────────────────── */
function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 2px" }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background: "var(--d-accent)",
            opacity: 0.7,
            animation: `aiTypingDot 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Chat message bubble ──────────────────────────────────────── */
function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: isUser ? "row-reverse" : "row",
        alignItems: "flex-start",
        gap: "10px",
        animation: "aiMsgIn 0.25s ease both",
      }}
    >
      {!isUser && (
        <div
          style={{
            width: "30px",
            height: "30px",
            borderRadius: "8px",
            background: "linear-gradient(135deg, #3B82F6 0%, #6366f1 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: "2px",
            color: "#fff",
            fontWeight: 700,
            fontSize: "10px",
            letterSpacing: "-0.3px",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          PI
        </div>
      )}

      <div
        style={{
          maxWidth: "78%",
          padding: "11px 15px",
          borderRadius: isUser ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
          background: isUser
            ? "linear-gradient(135deg, var(--d-accent) 0%, #6366f1 100%)"
            : "var(--d-surface-2)",
          color: isUser ? "#ffffff" : "var(--d-text)",
          fontSize: "13.5px",
          lineHeight: 1.6,
          border: isUser ? "none" : "1px solid var(--d-border)",
          boxShadow: isUser
            ? "0 2px 12px rgba(59,130,246,0.25)"
            : "0 1px 4px rgba(0,0,0,0.05)",
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
        }}
      >
        {msg.content}
      </div>

      {isUser && (
        <div
          style={{
            width: "30px",
            height: "30px",
            borderRadius: "50%",
            background: "var(--d-accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: "2px",
            color: "#fff",
            fontWeight: 700,
            fontSize: "12px",
          }}
        >
          {(localStorage.getItem("user_name") || localStorage.getItem("user_email") || "U")
            .charAt(0)
            .toUpperCase()}
        </div>
      )}
    </div>
  );
}

/* ─── Main AI Agent overlay component ─────────────────────────── */
const INITIAL_MESSAGES = [
  {
    role: "assistant",
    content:
      "Hi! I'm your Price Intel AI Agent — your personal assistant for analyzing your store, competitors, pricing, and growth opportunities.\n\nI'm currently in preview mode. Once connected to your live store data, I'll be able to give you real-time pricing recommendations, competitor analysis, and marketing strategies tailored to your business.",
  },
];

export default function AIAgent({ open, onClose }) {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const sendMessage = (text, responseKey = null) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInputValue("");
    setIsTyping(true);
    setTimeout(() => {
      const response = responseKey
        ? PLACEHOLDER_RESPONSES[responseKey]
        : getAIResponse(trimmed);
      setMessages((prev) => [...prev, { role: "assistant", content: response }]);
      setIsTyping(false);
    }, 900 + Math.random() * 500);
  };

  const handleSuggestion = (s) => sendMessage(s.message, s.id);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim()) sendMessage(inputValue);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleTextareaChange = (e) => {
    setInputValue(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  const handleClearChat = () => {
    setMessages(INITIAL_MESSAGES);
    setIsTyping(false);
  };

  const handleNewChat = () => {
    setMessages(INITIAL_MESSAGES);
    setInputValue("");
    setIsTyping(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  if (!open) return null;

  const hasChatted = messages.length > 1;

  return (
    <>
      <style>{`
        @keyframes aiMsgIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes aiTypingDot {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%            { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes aiOverlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes aiPanelIn {
          from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        .ai-send-btn:not(:disabled):hover {
          background: #1D4ED8 !important;
          transform: scale(1.04);
        }
        .ai-suggestion-card:hover {
          border-color: var(--d-accent) !important;
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.10) !important;
        }
        .ai-close-btn:hover {
          background: var(--d-surface-2) !important;
          color: var(--d-text) !important;
        }
        .ai-action-btn:hover {
          background: var(--d-surface-2) !important;
          border-color: var(--d-border) !important;
          color: var(--d-text) !important;
        }
        .ai-textarea {
          outline: none;
          border-color: var(--d-accent) !important;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.12) !important;
        }
        .ai-textarea:focus {
          outline: none;
          border-color: var(--d-accent) !important;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.18) !important;
        }
        .ai-panel-body::-webkit-scrollbar { width: 5px; }
        .ai-panel-body::-webkit-scrollbar-track { background: transparent; }
        .ai-panel-body::-webkit-scrollbar-thumb { background: var(--d-border); border-radius: 999px; }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.46)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          zIndex: 900,
          animation: "aiOverlayIn 0.22s ease both",
        }}
      />

      {/* Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          width: "min(960px, calc(100vw - 40px))",
          height: "min(740px, calc(100vh - 72px))",
          background: "var(--d-surface)",
          border: "1px solid var(--d-border)",
          borderRadius: "20px",
          boxShadow: "0 32px 80px rgba(0,0,0,0.24), 0 0 0 1px rgba(255,255,255,0.04)",
          zIndex: 901,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "aiPanelIn 0.32s cubic-bezier(0.22,1,0.36,1) both",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 24px",
            borderBottom: "1px solid var(--d-border)",
            background: "var(--d-surface)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "11px",
                background: "linear-gradient(135deg, #3B82F6 0%, #6366f1 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 4px 14px rgba(59,130,246,0.32)",
                color: "#fff",
                fontWeight: 700,
                fontSize: "14px",
                letterSpacing: "-0.4px",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              PI
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                <span style={{ fontWeight: 700, fontSize: "15.5px", color: "var(--d-text)", letterSpacing: "-0.2px" }}>
                  Price Intel AI
                </span>
              </div>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--d-text-2)", fontWeight: 400, lineHeight: 1 }}>
                Your intelligent pricing &amp; business assistant
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {hasChatted && (
              <>
                <button
                  className="ai-action-btn"
                  onClick={handleClearChat}
                  title="Clear chat history"
                  style={{
                    height: "33px",
                    padding: "0 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--d-border)",
                    background: "transparent",
                    color: "var(--d-text-2)",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: 500,
                    transition: "all 0.15s ease",
                    flexShrink: 0,
                    fontFamily: "inherit",
                    whiteSpace: "nowrap",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M9 6V4h6v2" />
                  </svg>
                  Clear
                </button>
                <button
                  className="ai-action-btn"
                  onClick={handleNewChat}
                  title="Start a new chat"
                  style={{
                    height: "33px",
                    padding: "0 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--d-border)",
                    background: "transparent",
                    color: "var(--d-text-2)",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: 500,
                    transition: "all 0.15s ease",
                    flexShrink: 0,
                    fontFamily: "inherit",
                    whiteSpace: "nowrap",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                  New Chat
                </button>
              </>
            )}
            <button
              className="ai-close-btn"
              onClick={onClose}
              aria-label="Close AI Agent"
              style={{
                width: "33px",
                height: "33px",
                borderRadius: "8px",
                border: "1px solid var(--d-border)",
                background: "transparent",
                color: "var(--d-text-2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: "20px",
                lineHeight: 1,
                transition: "all 0.15s ease",
                flexShrink: 0,
                fontFamily: "inherit",
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Chat body */}
        <div
          className="ai-panel-body"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "22px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}

          {isTyping && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <div
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, #3B82F6 0%, #6366f1 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "10px",
                  letterSpacing: "-0.3px",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                PI
              </div>
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: "4px 16px 16px 16px",
                  background: "var(--d-surface-2)",
                  border: "1px solid var(--d-border)",
                }}
              >
                <TypingIndicator />
              </div>
            </div>
          )}

          {/* Suggestion cards — only shown before any chat */}
          {!hasChatted && !isTyping && (
            <div
              style={{
                marginTop: "6px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(195px, 1fr))",
                gap: "10px",
              }}
            >
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.id}
                  className="ai-suggestion-card"
                  onClick={() => handleSuggestion(s)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: "8px",
                    padding: "15px 16px",
                    borderRadius: "12px",
                    border: "1.5px solid var(--d-border)",
                    background: "var(--d-surface-2)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.18s ease",
                    fontFamily: "inherit",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      color: "var(--d-text)",
                    }}
                  >
                    {s.icon}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--d-text)", marginBottom: "3px", letterSpacing: "-0.1px" }}>
                      {s.title}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--d-text-2)", lineHeight: 1.45 }}>
                      {s.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input area */}
        <div
          style={{
            padding: "14px 20px 18px",
            borderTop: "1px solid var(--d-border)",
            background: "var(--d-surface)",
            flexShrink: 0,
          }}
        >
          <form onSubmit={handleSubmit} style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
            <textarea
              ref={inputRef}
              className="ai-textarea"
              value={inputValue}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask your AI Agent anything about your store..."
              rows={1}
              style={{
                flex: 1,
                resize: "none",
                padding: "11px 14px",
                borderRadius: "12px",
                border: "1.5px solid var(--d-accent)",
                background: "var(--d-surface-2)",
                color: "var(--d-text)",
                fontSize: "13.5px",
                fontFamily: "inherit",
                lineHeight: 1.5,
                transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                overflow: "hidden",
                minHeight: "44px",
                maxHeight: "120px",
              }}
            />
            <button
              type="submit"
              className="ai-send-btn"
              disabled={!inputValue.trim() || isTyping}
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                border: "none",
                background: inputValue.trim() && !isTyping ? "var(--d-accent)" : "var(--d-surface-2)",
                color: inputValue.trim() && !isTyping ? "#ffffff" : "var(--d-text-2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: inputValue.trim() && !isTyping ? "pointer" : "default",
                flexShrink: 0,
                transition: "all 0.15s ease",
                boxShadow: inputValue.trim() && !isTyping ? "0 2px 10px rgba(59,130,246,0.28)" : "none",
              }}
              aria-label="Send message"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>

        </div>
      </div>
    </>
  );
}

/* ─── Floating trigger button (rendered in Layout) ─────────────── */
export function AIFloatingButton({ onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <>
      <style>{`
        @keyframes aiPulseRing {
          0%   { transform: scale(1);   opacity: 0.55; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
      <button
        id="ai-agent-float-btn"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label="Open AI Agent"
        style={{
          position: "fixed",
          bottom: "28px",
          right: "28px",
          zIndex: 800,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          height: "46px",
          padding: "0 18px 0 14px",
          borderRadius: "999px",
          border: "none",
          background: "linear-gradient(135deg, #3B82F6 0%, #6366f1 100%)",
          color: "#ffffff",
          cursor: "pointer",
          boxShadow: hovered
            ? "0 8px 28px rgba(59,130,246,0.52), 0 2px 8px rgba(0,0,0,0.14)"
            : "0 4px 18px rgba(59,130,246,0.38), 0 1px 4px rgba(0,0,0,0.10)",
          transform: hovered ? "translateY(-2px) scale(1.04)" : "translateY(0) scale(1)",
          transition: "all 0.20s ease",
          fontFamily: "'Inter', sans-serif",
          overflow: "visible",
        }}
      >
        {/* Pulse ring */}
        <span
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "999px",
            border: "2px solid rgba(99,102,241,0.55)",
            animation: "aiPulseRing 2.4s ease-out infinite",
            pointerEvents: "none",
          }}
        />
        <span style={{
            width: "20px",
            height: "20px",
            borderRadius: "5px",
            background: "rgba(255,255,255,0.22)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            fontWeight: 700,
            fontSize: "9px",
            letterSpacing: "-0.2px",
            fontFamily: "'Inter', sans-serif",
          }}>PI</span>
        <span style={{ fontWeight: 600, fontSize: "13.5px", letterSpacing: "-0.1px", whiteSpace: "nowrap" }}>
          Ask Agent
        </span>
      </button>
    </>
  );
}
