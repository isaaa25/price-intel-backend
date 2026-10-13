export default function LoadingSpinner({ size = 28, color = "currentColor", className = "", style = {}, ...props }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 100 100"
      className={`priceintel-spinner ${className}`}
      style={{ display: "inline-block", verticalAlign: "middle", ...style }}
      aria-label="Loading" role="status" {...props}
    >
      {Array.from({ length: 12 }, (_, i) => (
        <rect
          key={i} x="46" y="8" width="8" height="24" rx="4" ry="4"
          fill={color} opacity={1 - i * 0.075}
          transform={`rotate(${i * 30} 50 50)`}
        />
      ))}
    </svg>
  );
}