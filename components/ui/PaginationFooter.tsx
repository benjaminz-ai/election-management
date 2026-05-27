import React from "react";

interface Props {
  showing: number;
  total: number;
  hasMore: boolean;
  entityLabel?: string; // e.g. "בוחרים"
}

export default function PaginationFooter({ showing, total, hasMore, entityLabel = "רשומות" }: Props) {
  if (total === 0) return null;
  return (
    <div
      style={{
        padding: "12px 20px",
        borderTop: "1px solid #f1f5f9",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#fafbfc",
      }}
    >
      <span style={{ color: "#888", fontSize: 13 }}>
        מציג <strong style={{ color: "#032147" }}>{showing}</strong> מתוך{" "}
        <strong style={{ color: "#032147" }}>{total}</strong> {entityLabel}
      </span>
      {hasMore && (
        <span style={{ fontSize: 12, color: "#209dd7" }}>
          גלול למטה לטעינת עוד
        </span>
      )}
    </div>
  );
}
