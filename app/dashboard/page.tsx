"use client";

import type { Group } from "@/types";
import { useStore } from "@/lib/store";
import { Users, UsersRound, UserCheck, Shield, ChevronLeft } from "lucide-react";

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  bg: string;
}) {
  return (
    <div
      className="card"
      style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 16 }}
    >
      <div
        style={{
          width: 50,
          height: 50,
          borderRadius: 12,
          background: bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={22} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 700, color: "var(--dark-navy)", lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: 13, color: "var(--gray-text)", marginTop: 4 }}>{label}</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { state } = useStore();
  const { voters, groups, groupLeaders, divisionHeads } = state;

  const orphanGroups = groups.filter((g: Group) => !g.groupLeaderId);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <span className="page-accent" />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--dark-navy)", margin: 0 }}>
            לוח בקרה
          </h1>
        </div>
        <p style={{ color: "var(--gray-text)", fontSize: 14, marginRight: 22 }}>
          סקירה כללית של מערכת ניהול הבחירות
        </p>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 36,
        }}
      >
        <StatCard
          label="בוחרים"
          value={voters.length}
          icon={Users}
          color="#209dd7"
          bg="rgba(32,157,215,0.1)"
        />
        <StatCard
          label="קבוצות"
          value={groups.length}
          icon={UsersRound}
          color="#ecad0a"
          bg="rgba(236,173,10,0.12)"
        />
        <StatCard
          label="ראשי קבוצה"
          value={groupLeaders.length}
          icon={UserCheck}
          color="#753991"
          bg="rgba(117,57,145,0.1)"
        />
        <StatCard
          label="ראשי אגף"
          value={divisionHeads.length}
          icon={Shield}
          color="#032147"
          bg="rgba(3,33,71,0.08)"
        />
      </div>

      {/* Hierarchy */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Hierarchy tree */}
        <div className="card" style={{ padding: 24, gridColumn: "1 / -1" }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 15,
              color: "var(--dark-navy)",
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Shield size={16} color="var(--blue-primary)" />
            היררכיית ניהול
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {divisionHeads.map((dh) => (
              <div key={dh.id}>
                {/* Division Head */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    background: "rgba(3,33,71,0.05)",
                    borderRadius: 10,
                    borderRight: "4px solid var(--dark-navy)",
                  }}
                >
                  <Shield size={15} color="var(--dark-navy)" />
                  <span style={{ fontWeight: 700, color: "var(--dark-navy)", fontSize: 14 }}>
                    ראש אגף: {dh.firstName} {dh.lastName}
                  </span>
                  <span className="badge badge-navy" style={{ marginRight: "auto" }}>
                    {dh.groupLeaderIds.length} ראשי קבוצה
                  </span>
                </div>

                {/* Group Leaders */}
                <div style={{ marginRight: 24, marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                  {dh.groupLeaderIds.map((glId) => {
                    const gl = groupLeaders.find((g) => g.id === glId);
                    if (!gl) return null;
                    const glGroups = groups.filter((g) => gl.groupIds.includes(g.id));
                    const voterCount = glGroups.reduce((sum, g) => sum + g.voterIds.length, 0);

                    return (
                      <div key={gl.id}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 12px",
                            background: "rgba(117,57,145,0.05)",
                            borderRadius: 8,
                            borderRight: "3px solid var(--purple-secondary)",
                          }}
                        >
                          <UserCheck size={13} color="var(--purple-secondary)" />
                          <span style={{ fontWeight: 600, color: "#4a2060", fontSize: 13 }}>
                            ראש קבוצה: {gl.firstName} {gl.lastName}
                          </span>
                          <span className="badge badge-purple" style={{ marginRight: "auto" }}>
                            {glGroups.length} קבוצות · {voterCount} בוחרים
                          </span>
                        </div>

                        {/* Groups */}
                        <div style={{ marginRight: 22, marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {glGroups.map((g) => (
                            <div
                              key={g.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "5px 12px",
                                background: "rgba(32,157,215,0.06)",
                                borderRadius: 20,
                                border: "1px solid rgba(32,157,215,0.2)",
                                fontSize: 12,
                              }}
                            >
                              <UsersRound size={11} color="var(--blue-primary)" />
                              <span style={{ color: "var(--blue-primary)", fontWeight: 600 }}>
                                {g.name}
                              </span>
                              <span style={{ color: "var(--gray-text)" }}>
                                ({g.voterIds.length})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent voters */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--dark-navy)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <Users size={15} color="var(--blue-primary)" />
            בוחרים אחרונים
          </div>
          {voters.slice(0, 6).map((v) => (
            <div
              key={v.id}
              className="table-row"
              style={{ padding: "10px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: "var(--dark-navy)" }}>
                  {v.firstName} {v.lastName}
                </div>
                <div style={{ fontSize: 12, color: "var(--gray-text)" }}>
                  {v.address.street} {v.address.streetNumber}, {v.address.city}
                </div>
              </div>
              <span className="badge badge-blue">{v.groupIds.length} קבוצות</span>
            </div>
          ))}
        </div>

        {/* Orphan groups warning */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--dark-navy)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <UsersRound size={15} color="var(--accent-yellow)" />
            קבוצות ללא ראש קבוצה
          </div>
          {orphanGroups.length === 0 ? (
            <div style={{ color: "#16a34a", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              <ChevronLeft size={14} />
              כל הקבוצות מנוהלות
            </div>
          ) : (
            orphanGroups.map((g) => (
              <div
                key={g.id}
                className="table-row"
                style={{ padding: "10px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--dark-navy)" }}>{g.name}</span>
                <span className="badge badge-red">ללא ראש קבוצה</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
