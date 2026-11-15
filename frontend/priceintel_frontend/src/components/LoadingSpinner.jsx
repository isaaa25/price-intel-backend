import { useId } from "react";
import { useLocale } from "../context/LocaleContext";

export default function LoadingSpinner({
  size = 32,
  color = "var(--d-accent, #4f7ef7)",
  className = "",
  style = {},
  ...props
}) {
  const reactId = useId();
  const { t } = useLocale();
  const gradId = "pi-spin-" + reactId.replace(/[^a-zA-Z0-9_-]/g, "");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 50 50"
      className={`priceintel-spinner ${className}`}
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        animation: "pi-spin 0.85s linear infinite",
        flexShrink: 0,
        ...style,
      }}
      aria-label={t("Loading")}
      role="status"
      {...props}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="55%" stopColor={color} stopOpacity="0.65" />
          <stop offset="85%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle
        cx="25"
        cy="25"
        r="19"
        fill="none"
        stroke={color}
        strokeOpacity="0.12"
        strokeWidth="4.5"
      />
      <circle
        cx="25"
        cy="25"
        r="19"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeDasharray="92 30"
        transform="rotate(-90 25 25)"
      />
    </svg>
  );
}
