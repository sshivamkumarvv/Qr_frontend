import React from "react";

export function SkeletonList() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          style={{ height: "112px", borderRadius: "16px", overflow: "hidden" }}
          className="skeleton"
        />
      ))}
    </div>
  );
}
