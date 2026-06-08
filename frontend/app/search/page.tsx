"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useStore } from "@/lib/store"; // advanced search + bulk actions
import { useAuth } from "@/lib/auth";
import { formatAddress } from "@/lib/utils";
import PageHeader from "@/components/ui/PageHeader";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Search, MapPin, UserCheck, X, Vote, Filter, CheckSquare, Square, RotateCcw, Tag, Users2, ChevronDown, ChevronUp, Settings2, Eye, GripVertical, ArrowUp, ArrowDown, ArrowUpDown, Download, FileText, ClipboardList } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import ScrollSentinel from "@/components/ui/ScrollSentinel";
import PaginationFooter from "@/components/ui/PaginationFooter";

type TextMode = "lastName" | "street" | "streetAndNumber";
type VotedFilter = "" | "yes" | "no";

// Sentinel value for the "ללא קבוצה" (no group) option in the group filter.
const NO_GROUP = "__none__";
// Sentinel value for the "ללא רשימה" (no list) option in the list filter.
const NO_LIST = "__nolist__";

const TEXT_MODES: { key: TextMode; label: string; placeholder: string }[] = [
  { key: "lastName",        label: "שם משפחה",   placeholder: "הכנס שם משפחה..." },
  { key: "street",          label: "רחוב",        placeholder: "הכנס שם רחוב..." },
  { key: "streetAndNumber", label: "רחוב + מספר", placeholder: "לדוגמה: הרצל 12" },
];

// ── Column definitions ──────────────────────────────────────
type ColId = "name" | "address" | "status" | "voted" | "leader" | "groups" | "list";
type SortKey = "lastName" | "city" | "status" | "voted" | "leader";
type SortDir = "asc" | "desc";

const COL_LABELS: Record<ColId, string> = {
  name: "שם", address: "כתובת", status: "סטטוס",
  voted: "הצביע", leader: "ראש קבוצה", groups: "קבוצות", list: "רשימה",
};
const COL_SORT: Partial<Record<ColId, SortKey>> = {
  name: "lastName", address: "city", status: "status", voted: "voted", leader: "leader",
};
const DRAGGABLE_COLS: ColId[] = ["name", "address", "status", "voted", "leader", "groups", "list"];

function loadColOrder(): ColId[] {
  try {
    const s = localStorage.getItem("search_col_order");
    if (s) {
      const parsed: ColId[] = JSON.parse(s);
      const valid = DRAGGABLE_COLS.filter(c => parsed.includes(c));
      const missing = DRAGGABLE_COLS.filter(c => !parsed.includes(c));
      return [...valid, ...missing];
    }
  } catch {}
  return [...DRAGGABLE_COLS];
}
function loadColVisible(): Record<ColId, boolean> {
  try {
    const s = localStorage.getItem("search_col_visible");
    if (s) return { ...Object.fromEntries(DRAGGABLE_COLS.map(c => [c, true])), ...JSON.parse(s) } as Record<ColId, boolean>;
  } catch {}
  return Object.fromEntries(DRAGGABLE_COLS.map(c => [c, true])) as Record<ColId, boolean>;
}

export default function SearchPage() {
  const { state, bulkUpdateVoters } = useStore();
  const { currentUser } = useAuth();
  const { voters, groups, subGroups, groupLeaders, divisionHeads, statuses, callStatuses, listManagers, lists } = state;
  const listById = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists]);

  // Bulk-action safety cap: limited roles can change at most BULK_LIMIT records per action
  const bulkLimit = currentUser && (currentUser.role === "telemarketing" || currentUser.role === "field") ? 10 : Infinity;
  const capped = bulkLimit !== Infinity;
  const statusMap = useMemo(() => new Map(statuses.map(s => [s.id, s])), [statuses]);
  // Voters who were never set have an empty statusId but DISPLAY as the default
  // status, so any "support status" comparison must fall back to it.
  const defaultStatusId = useMemo(() => statuses.find((s) => s.isDefault)?.id ?? statuses[0]?.id ?? "", [statuses]);
  // The "default" call result (voter never called) is the callStatus named "ברירת מחדל".
  // New voters have an empty lastCallStatusId but should match this when filtering.
  const defaultCallStatusId = useMemo(() => callStatuses.find((c) => c.name.trim() === "ברירת מחדל")?.id ?? "", [callStatuses]);

  // Distinct import batches (by importedAt), newest first — for the "מנת ייבוא" filter.
  const importBatches = useMemo(() => {
    const set = new Map<string, number>();
    voters.forEach((v) => { if (v.importedAt) set.set(v.importedAt, (set.get(v.importedAt) ?? 0) + 1); });
    return [...set.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([iso, count]) => {
      const d = new Date(iso);
      const label = `${d.toLocaleDateString("he-IL")} ${d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })} (${count})`;
      return { value: iso, label };
    });
  }, [voters]);

  // ── Filters ────────────────────────────────────────────────
  const [textMode, setTextMode] = useState<TextMode>("lastName");
  const [query, setQuery] = useState("");
  const [statusId, setStatusId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [leaderId, setLeaderId] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [subGroupId, setSubGroupId] = useState("");
  const [city, setCity] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(""); // kept for reports drill-down (?category=) — no visible dropdown
  const [callStatusFilter, setCallStatusFilter] = useState(""); // "תוצאת שיחה אחרונה" — filters by lastCallStatusId
  const [importBatchFilter, setImportBatchFilter] = useState(""); // "מנת ייבוא" — filters by importedAt
  const [listFilter, setListFilter] = useState("");               // "רשימה" — by listId (or NO_LIST)
  const [listManagerFilter, setListManagerFilter] = useState(""); // "מנהל רשימה" — by list's listManagerId
  const [filterVoted, setFilterVoted] = useState<VotedFilter>("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Exact-address filter (arrives from the reports "families" drill-down)
  const [addrLastName, setAddrLastName] = useState("");
  const [addrStreet, setAddrStreet] = useState("");
  const [addrNumber, setAddrNumber] = useState("");
  const [addrApartment, setAddrApartment] = useState("");

  // Read filters passed from the reports screen on mount
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const cat = p.get("category");
      const voted = p.get("voted");
      const street = p.get("street");
      const number = p.get("streetNumber");
      const apartment = p.get("apartment");
      const cityParam = p.get("city");
      const lastName = p.get("lastName");
      if (cat) { setCategoryFilter(cat); setFiltersOpen(true); }
      if (voted === "yes" || voted === "no") { setFilterVoted(voted); setFiltersOpen(true); }
      if (lastName) setAddrLastName(lastName);
      if (street) setAddrStreet(street);
      if (number) setAddrNumber(number);
      if (apartment) setAddrApartment(apartment);
      if (cityParam) setCity(cityParam);
    } catch {}
  }, []);

  // ── Sorting ────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<SortKey>("lastName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  // ── Columns (drag / show-hide) ─────────────────────────────
  const [colOrder, setColOrder] = useState<ColId[]>(loadColOrder);
  const [colVisible, setColVisible] = useState<Record<ColId, boolean>>(loadColVisible);
  const [showColMenu, setShowColMenu] = useState(false);
  const dragColRef = useRef<ColId | null>(null);
  const dragOverColRef = useRef<ColId | null>(null);

  // ── Selection (bulk) ───────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionsOpen, setActionsOpen] = useState(false);

  const cities = useMemo(
    () => Array.from(new Set(voters.map((v) => v.address.city).filter(Boolean))).sort(),
    [voters]
  );
  const leaderByGroupId = useMemo(() => {
    const m: Record<string, string> = {};
    groups.forEach((g) => { if (g.groupLeaderId) m[g.id] = g.groupLeaderId; });
    return m;
  }, [groups]);
  const divisionByLeaderId = useMemo(() => {
    const m: Record<string, string> = {};
    groupLeaders.forEach((gl) => { m[gl.id] = gl.divisionHeadId; });
    return m;
  }, [groupLeaders]);

  const getVoterLeader = useCallback((voter: typeof voters[0]) => {
    for (const gl of groupLeaders) {
      if (voter.groupIds.some((gid) => gl.groupIds.includes(gid))) return gl;
    }
    return null;
  }, [groupLeaders]);
  const getVoterGroups = (voter: typeof voters[0]) => groups.filter((g) => voter.groupIds.includes(g.id));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hasAnyFilter = q || statusId || groupId || leaderId || divisionId || subGroupId || city || categoryFilter || callStatusFilter || importBatchFilter || listFilter || listManagerFilter || filterVoted || addrLastName || addrStreet || addrNumber || addrApartment;
    if (!hasAnyFilter) return [];
    return voters.filter((v) => {
      if (q) {
        let textMatch = false;
        if (textMode === "lastName") textMatch = v.lastName.toLowerCase().includes(q);
        else if (textMode === "street") textMatch = v.address.street.toLowerCase().includes(q);
        else textMatch = `${v.address.street} ${v.address.streetNumber}`.toLowerCase().includes(q);
        if (!textMatch) return false;
      }
      // Support-status filter — fall back to the default status so that
      // filtering by "ברירת מחדל" matches voters who were never set (empty statusId).
      if (statusId && (v.statusId ?? defaultStatusId) !== statusId) return false;
      if (groupId === NO_GROUP) { if (v.groupIds.length > 0) return false; }
      else if (groupId && !v.groupIds.includes(groupId)) return false;
      if (subGroupId && !(v.subGroupIds ?? []).includes(subGroupId)) return false;
      if (leaderId && !v.groupIds.some((gid) => leaderByGroupId[gid] === leaderId)) return false;
      if (divisionId && !v.groupIds.some((gid) => {
        const lid = leaderByGroupId[gid];
        return lid && divisionByLeaderId[lid] === divisionId;
      })) return false;
      if (city && v.address.city !== city) return false;
      if (addrLastName && v.lastName !== addrLastName) return false;
      if (addrStreet && v.address.street !== addrStreet) return false;
      if (addrNumber && v.address.streetNumber !== addrNumber) return false;
      if (addrApartment && v.address.apartment !== addrApartment) return false;
      if (categoryFilter && (statusMap.get(v.statusId ?? "")?.category ?? "neutral") !== categoryFilter) return false;
      // Last-call-result filter (replaces the old redundant "category" dropdown).
      // Empty lastCallStatusId falls back to the default call status so that
      // filtering by "ברירת מחדל" matches voters who were never called.
      if (callStatusFilter && (v.lastCallStatusId || defaultCallStatusId) !== callStatusFilter) return false;
      // Import-batch filter (מנת ייבוא) — all records of one import share importedAt.
      if (importBatchFilter && v.importedAt !== importBatchFilter) return false;
      // List filter (רשימה) — by listId, or "ללא רשימה".
      if (listFilter === NO_LIST) { if (v.listId) return false; }
      else if (listFilter && v.listId !== listFilter) return false;
      // List-manager filter (מנהל רשימה) — the voter's list must belong to them.
      if (listManagerFilter) {
        const l = v.listId ? listById.get(v.listId) : undefined;
        if (!l || l.listManagerId !== listManagerFilter) return false;
      }
      if (filterVoted === "yes" && !v.hasVoted) return false;
      if (filterVoted === "no" && v.hasVoted) return false;
      return true;
    });
  }, [voters, query, textMode, statusId, defaultStatusId, groupId, leaderId, divisionId, subGroupId, city, categoryFilter, callStatusFilter, defaultCallStatusId, importBatchFilter, listFilter, listManagerFilter, listById, filterVoted, addrLastName, addrStreet, addrNumber, addrApartment, leaderByGroupId, divisionByLeaderId, statusMap]);

  const results = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va = "", vb = "";
      if (sortKey === "lastName") { va = a.lastName; vb = b.lastName; }
      else if (sortKey === "city") { va = a.address.city; vb = b.address.city; }
      else if (sortKey === "status") { va = statusMap.get(a.statusId ?? "")?.name ?? ""; vb = statusMap.get(b.statusId ?? "")?.name ?? ""; }
      else if (sortKey === "voted") { va = a.hasVoted ? "1" : "0"; vb = b.hasVoted ? "1" : "0"; }
      else if (sortKey === "leader") {
        const la = getVoterLeader(a); const lb = getVoterLeader(b);
        va = la ? `${la.lastName} ${la.firstName}` : "";
        vb = lb ? `${lb.lastName} ${lb.firstName}` : "";
      }
      const cmp = va.localeCompare(vb, "he");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir, statusMap, getVoterLeader]);

  // Clear selections that left the result set
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const ids = new Set(results.map((r) => r.id));
      const next = new Set<string>();
      prev.forEach((id) => { if (ids.has(id)) next.add(id); });
      return next.size === prev.size ? prev : next;
    });
  }, [results]);

  const { visible: visibleResults, hasMore, loadMore, showing } = usePagination(results, 20);

  // Infinite-scroll on the app's main scroll container (same as other screens)
  const loadMoreRef = useRef(loadMore);
  useEffect(() => { loadMoreRef.current = loadMore; });
  useEffect(() => {
    const mainEl = document.getElementById("main-scroll");
    if (!mainEl) return;
    const onScroll = () => {
      if (mainEl.scrollHeight - mainEl.scrollTop <= mainEl.clientHeight + 300) {
        loadMoreRef.current();
      }
    };
    mainEl.addEventListener("scroll", onScroll, { passive: true });
    return () => mainEl.removeEventListener("scroll", onScroll);
  }, []);

  const addrActive = Boolean(addrLastName || addrStreet || addrNumber || addrApartment);
  const activeFilterCount =
    (statusId ? 1 : 0) + (groupId ? 1 : 0) + (leaderId ? 1 : 0) +
    (divisionId ? 1 : 0) + (subGroupId ? 1 : 0) + (city ? 1 : 0) + (categoryFilter ? 1 : 0) + (callStatusFilter ? 1 : 0) + (importBatchFilter ? 1 : 0) + (listFilter ? 1 : 0) + (listManagerFilter ? 1 : 0) + (filterVoted ? 1 : 0) + (addrActive ? 1 : 0);

  const clearAddress = () => { setAddrLastName(""); setAddrStreet(""); setAddrNumber(""); setAddrApartment(""); };

  const resetFilters = () => {
    setQuery(""); setStatusId(""); setGroupId(""); setLeaderId("");
    setDivisionId(""); setSubGroupId(""); setCity(""); setCategoryFilter(""); setCallStatusFilter(""); setImportBatchFilter(""); setListFilter(""); setListManagerFilter(""); setFilterVoted("");
    clearAddress();
    setSelected(new Set());
  };

  // Selection helpers (respect the bulk cap for limited roles)
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); return n; }
      if (n.size >= bulkLimit) return prev; // cap reached — ignore
      n.add(id);
      return n;
    });
  const allVisibleSelected = visibleResults.length > 0 && visibleResults.every((v) => selected.has(v.id));
  const toggleAllVisible = () =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (allVisibleSelected) { visibleResults.forEach((v) => n.delete(v.id)); return n; }
      for (const v of visibleResults) { if (n.size >= bulkLimit) break; n.add(v.id); }
      return n;
    });
  const selectAllResults = () =>
    setSelected(new Set(results.slice(0, capped ? bulkLimit : results.length).map((r) => r.id)));

  // Column drag & drop
  const handleDragStart = (col: ColId) => { dragColRef.current = col; };
  const handleDragOver = useCallback((e: React.DragEvent, col: ColId) => {
    e.preventDefault();
    if (!dragColRef.current || dragColRef.current === col) return;
    if (dragOverColRef.current === col) return;
    dragOverColRef.current = col;
    setColOrder((prev) => {
      const newOrder = [...prev];
      const from = newOrder.indexOf(dragColRef.current!);
      const to = newOrder.indexOf(col);
      if (from === -1 || to === -1) return prev;
      newOrder.splice(from, 1);
      newOrder.splice(to, 0, dragColRef.current!);
      return newOrder;
    });
  }, []);
  const handleDrop = () => {
    localStorage.setItem("search_col_order", JSON.stringify(colOrder));
    dragColRef.current = null;
    dragOverColRef.current = null;
  };
  const toggleColVisible = (col: ColId) => {
    const next = { ...colVisible, [col]: !colVisible[col] };
    setColVisible(next);
    localStorage.setItem("search_col_visible", JSON.stringify(next));
  };
  const visibleCols = colOrder.filter(c => colVisible[c]);

  const hasFilters = Boolean(query.trim() || activeFilterCount > 0);

  // Render a single result cell
  const renderCell = (v: typeof voters[0], col: ColId) => {
    const st = statusMap.get(v.statusId ?? "");
    const leader = getVoterLeader(v);
    const voterGroups = getVoterGroups(v);
    switch (col) {
      case "name": return (
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, var(--blue-primary), var(--purple-secondary))", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 11 }}>
            {v.firstName[0]}{v.lastName[0]}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--navy)" }}>{v.firstName} {v.lastName}</div>
            <div style={{ fontSize: 11, color: "var(--gray-text)", fontFamily: "monospace" }}>{v.uniqueId}</div>
          </div>
        </div>
      );
      case "address": return (
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--text-secondary)" }}>
          <MapPin size={11} color="var(--gray-text)" />{formatAddress(v.address)}
        </span>
      );
      case "status": return st
        ? <span style={{ display: "inline-block", fontSize: 12, padding: "3px 9px", borderRadius: 20, fontWeight: 600, background: st.color + "22", color: st.color, border: `1px solid ${st.color}55` }}>{st.name}</span>
        : <span className="badge badge-gray">ללא סטטוס</span>;
      case "voted": return v.hasVoted
        ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "#dcfce7", color: "#16a34a", borderRadius: 20, padding: "3px 9px", fontSize: 12, fontWeight: 700 }}>✓ הצביע</span>
        : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>;
      case "leader": return leader
        ? <span style={{ fontSize: 13, color: "var(--purple-secondary)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><UserCheck size={12} />{leader.firstName} {leader.lastName}</span>
        : <span className="badge badge-gray">לא משויך</span>;
      case "groups": return voterGroups.length === 0
        ? <span className="badge badge-gray">ללא קבוצה</span>
        : <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {voterGroups.map((g) => <span key={g.id} className="badge badge-blue" style={{ fontSize: 11 }}>{g.name}</span>)}
          </div>;
      case "list": {
        const l = v.listId ? listById.get(v.listId) : undefined;
        const mgr = l ? listManagers.find((m) => m.id === l.listManagerId) : undefined;
        return l
          ? <span className="badge badge-orange" style={{ fontSize: 11 }} title={mgr ? `מנהל: ${mgr.firstName} ${mgr.lastName}` : undefined}>{l.name}</span>
          : <span className="badge badge-gray">ללא רשימה</span>;
      }
    }
  };

  // Plain-text value of a cell, for export — mirrors what the table shows.
  const cellText = (v: typeof voters[0], col: ColId): string => {
    switch (col) {
      case "name": return `${v.firstName} ${v.lastName} (${v.uniqueId})`;
      case "address": return formatAddress(v.address);
      case "status": { const st = statusMap.get(v.statusId ?? ""); return st ? st.name : "ללא סטטוס"; }
      case "voted": return v.hasVoted ? "הצביע" : "לא הצביע";
      case "leader": { const l = getVoterLeader(v); return l ? `${l.firstName} ${l.lastName}` : "לא משויך"; }
      case "groups": { const g = getVoterGroups(v); return g.length ? g.map((x) => x.name).join(", ") : "ללא קבוצה"; }
      case "list": { const l = v.listId ? listById.get(v.listId) : undefined; return l ? l.name : "ללא רשימה"; }
      default: return "";
    }
  };

  const exportBaseName = () => `בוחרים_${new Date().toLocaleDateString("he-IL").replace(/\//g, "-")}`;

  // Export the current (filtered) results + displayed columns to a CSV that
  // Excel opens with Hebrew intact (UTF-8 BOM).
  const exportExcel = () => {
    if (results.length === 0) return;
    const esc = (s: string) => /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    const rows = [visibleCols.map((c) => COL_LABELS[c]), ...results.map((v) => visibleCols.map((c) => cellText(v, c)))];
    const csv = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${exportBaseName()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // Export to PDF via a print window — the browser renders Hebrew/RTL natively.
  const exportPDF = () => {
    if (results.length === 0) return;
    const e = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
    const head = visibleCols.map((c) => `<th>${e(COL_LABELS[c])}</th>`).join("");
    const body = results.map((v) => `<tr>${visibleCols.map((c) => `<td>${e(cellText(v, c))}</td>`).join("")}</tr>`).join("");
    const now = new Date();
    const html = `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>${e(exportBaseName())}</title>`
      + `<style>body{font-family:Arial,sans-serif;direction:rtl;margin:24px;color:#0f172a}`
      + `h1{font-size:18px;margin:0 0 4px}.sub{color:#64748b;font-size:12px;margin:0 0 16px}`
      + `table{width:100%;border-collapse:collapse;font-size:12px}`
      + `th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:right}`
      + `thead th{background:#f1f5f9}tr:nth-child(even) td{background:#f8fafc}`
      + `@media print{@page{size:landscape;margin:12mm}}</style></head><body>`
      + `<h1>רשימת בוחרים</h1><p class="sub">${results.length} רשומות · ${now.toLocaleDateString("he-IL")} ${now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</p>`
      + `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
      + `<script>window.onload=function(){window.print()}</script></body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html); w.document.close();
  };

  const SortIcon = ({ col }: { col: ColId }) => {
    const sk = COL_SORT[col];
    if (!sk) return null;
    const active = sortKey === sk;
    return active
      ? (sortDir === "asc" ? <ArrowUp size={11} color="var(--blue-primary)" /> : <ArrowDown size={11} color="var(--blue-primary)" />)
      : <ArrowUpDown size={11} style={{ opacity: 0.35 }} />;
  };

  return (
    <div>
      <PageHeader title="חיפוש מתקדם" subtitle="חיתוכים משולבים ועדכון קבוצתי של בוחרים" />

      {/* ── Filter panel ─────────────────────────────────── */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {TEXT_MODES.map((m) => (
            <button key={m.key} onClick={() => setTextMode(m.key)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1.5px solid", borderColor: textMode === m.key ? "var(--blue-primary)" : "var(--border)", background: textMode === m.key ? "rgba(32,157,215,0.08)" : "#fff", color: textMode === m.key ? "var(--blue-primary)" : "var(--text-secondary)" }}>
              {m.label}
            </button>
          ))}
        </div>
        <div className="search-wrap" style={{ fontSize: 15 }}>
          <Search size={16} color="var(--gray-text)" />
          <input className="input" autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={TEXT_MODES.find((m) => m.key === textMode)!.placeholder}
            style={{ border: "none", boxShadow: "none", padding: 0, background: "transparent", flex: 1, fontSize: 15 }} />
          {query && (
            <button onClick={() => setQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-text)", display: "flex", padding: 0 }}>
              <X size={15} />
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
          <button onClick={() => setFiltersOpen((o) => !o)}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: filtersOpen || activeFilterCount > 0 ? "var(--blue-primary)" : "var(--text-secondary)", fontSize: 13, fontWeight: 700, padding: 0 }}>
            <Filter size={14} /> סינון מתקדם
            {activeFilterCount > 0 && (
              <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 20, background: "rgba(32,157,215,0.12)", color: "var(--blue-primary)", fontWeight: 700 }}>{activeFilterCount}</span>
            )}
            {filtersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {hasFilters && (
            <button onClick={resetFilters} style={{ marginRight: "auto", display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: "var(--gray-text)", fontSize: 12, fontWeight: 600 }}>
              <RotateCcw size={12} /> נקה הכל
            </button>
          )}
        </div>

        {filtersOpen && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
              <FilterSelect label="תוצאת שיחה אחרונה" value={callStatusFilter} onChange={setCallStatusFilter}
                options={callStatuses.map((cs) => ({ value: cs.id, label: cs.name }))} />
              <FilterSelect label="סטטוס" value={statusId} onChange={setStatusId}
                options={statuses.map((s) => ({ value: s.id, label: s.name }))} />
              <FilterSelect label="קבוצה" value={groupId} onChange={setGroupId}
                options={[{ value: NO_GROUP, label: "ללא קבוצה" }, ...groups.map((g) => ({ value: g.id, label: g.name }))]} />
              <FilterSelect label="מנת ייבוא" value={importBatchFilter} onChange={setImportBatchFilter}
                options={importBatches} />
              <FilterSelect label="מנהל רשימה" value={listManagerFilter} onChange={setListManagerFilter}
                options={listManagers.map((m) => ({ value: m.id, label: `${m.firstName} ${m.lastName}` }))} />
              <FilterSelect label="רשימה" value={listFilter} onChange={setListFilter}
                options={[{ value: NO_LIST, label: "ללא רשימה" }, ...lists.map((l) => ({ value: l.id, label: l.name }))]} />
              <FilterSelect label="תת-קבוצה" value={subGroupId} onChange={setSubGroupId}
                options={subGroups.map((sg) => ({ value: sg.id, label: sg.name }))} />
              <FilterSelect label="ראש קבוצה" value={leaderId} onChange={setLeaderId}
                options={groupLeaders.map((gl) => ({ value: gl.id, label: `${gl.firstName} ${gl.lastName}` }))} />
              <FilterSelect label="ראש אזור" value={divisionId} onChange={setDivisionId}
                options={divisionHeads.map((dh) => ({ value: dh.id, label: `${dh.firstName} ${dh.lastName}` }))} />
              <FilterSelect label="עיר" value={city} onChange={setCity}
                options={cities.map((c) => ({ value: c, label: c }))} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
              <Vote size={13} color="var(--gray-text)" />
              <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>הצבעה:</span>
              {(["", "yes", "no"] as VotedFilter[]).map((opt) => (
                <button key={opt} onClick={() => setFilterVoted(opt)}
                  style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${filterVoted === opt ? (opt === "yes" ? "#22c55e" : opt === "no" ? "#ef4444" : "var(--blue-primary)") : "var(--border)"}`, background: filterVoted === opt ? (opt === "yes" ? "#f0fdf4" : opt === "no" ? "#fef2f2" : "rgba(32,157,215,0.08)") : "#fff", color: filterVoted === opt ? (opt === "yes" ? "#16a34a" : opt === "no" ? "#dc2626" : "var(--blue-primary)") : "var(--text-muted)" }}>
                  {opt === "" ? "הכל" : opt === "yes" ? "✓ הצביע" : "✗ לא הצביע"}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Results header ───────────────────────────────── */}
      {hasFilters && (
        <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            נמצאו <strong style={{ color: "var(--navy)" }}>{results.length}</strong> בוחרים
          </span>
          {addrActive && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 20, background: "rgba(117,57,145,0.1)", color: "var(--purple-secondary)" }}>
              <MapPin size={12} />
              {addrLastName ? `משפחת ${addrLastName} · ` : ""}{[addrStreet, addrNumber].filter(Boolean).join(" ")}{addrApartment ? `, דירה ${addrApartment}` : ""}{city ? `, ${city}` : ""}
              <button onClick={clearAddress} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--purple-secondary)", display: "flex", padding: 0 }} aria-label="הסר סינון כתובת">
                <X size={13} />
              </button>
            </span>
          )}
          {results.length > 0 && (
            <>
              <button onClick={toggleAllVisible} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                {allVisibleSelected ? <CheckSquare size={13} /> : <Square size={13} />} בחר את המוצגים
              </button>
              {capped ? (
                <button onClick={selectAllResults} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--blue-primary)" }}>
                  בחר {bulkLimit} ראשונות
                </button>
              ) : results.length > visibleResults.length && (
                <button onClick={selectAllResults} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--blue-primary)" }}>
                  בחר את כל {results.length} התוצאות
                </button>
              )}
              {capped && (
                <span style={{ fontSize: 11, color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  (מוגבל ל-{bulkLimit} רשומות לפעולה)
                </span>
              )}

              {/* Column menu */}
              <div style={{ position: "relative" }}>
                <button onClick={() => setShowColMenu(s => !s)}
                  style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                  <Eye size={13} /> עמודות
                </button>
                {showColMenu && (
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "#fff", border: "1.5px solid var(--border)", borderRadius: 10, padding: 12, zIndex: 100, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", minWidth: 160 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-text)", marginBottom: 8, textTransform: "uppercase" }}>הצג/הסתר עמודות</div>
                    {DRAGGABLE_COLS.map(col => (
                      <label key={col} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", cursor: "pointer", fontSize: 13 }}>
                        <input type="checkbox" checked={colVisible[col]} onChange={() => toggleColVisible(col)} style={{ width: 14, height: 14, cursor: "pointer" }} />
                        {COL_LABELS[col]}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Bulk actions */}
          {selected.size > 0 && (
            <div style={{ marginRight: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--blue-primary)" }}>{selected.size} נבחרו</span>
              <button onClick={() => setSelected(new Set())}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-text)", fontSize: 12, fontWeight: 600 }}>
                נקה בחירה
              </button>
              <button onClick={() => setActionsOpen(true)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--blue-primary)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                <Settings2 size={15} /> פעולות ({selected.size})
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty / no-results */}
      {!hasFilters && (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <div className="empty-state-icon"><Search size={28} color="var(--blue-primary)" /></div>
          <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "var(--navy)" }}>חפש בוחרים</h3>
          <p style={{ margin: 0, color: "var(--gray-text)", fontSize: 14 }}>הכנס טקסט או פתח סינון מתקדם. ניתן לשלב כמה פילטרים יחד.</p>
        </div>
      )}
      {hasFilters && results.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon"><Search size={24} color="var(--gray-text)" /></div>
          <p style={{ margin: 0, color: "var(--gray-text)", fontSize: 14 }}>לא נמצאו בוחרים התואמים לסינון</p>
        </div>
      )}

      {/* Toolbar: drag hint + export */}
      {results.length > 0 && (
        <div style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
            <GripVertical size={12} />
            <span>גרור כותרת עמודה לשינוי סדר · לחץ על כותרת למיון</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={exportExcel} title="ייצוא תוצאות הסינון ל-Excel"
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 13px", borderRadius: 8, border: "1px solid #16a34a55", background: "#16a34a14", color: "#16a34a", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
              <Download size={13} /> ייצוא Excel
            </button>
            <button onClick={exportPDF} title="ייצוא תוצאות הסינון ל-PDF"
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 13px", borderRadius: 8, border: "1px solid #dc262655", background: "#dc262614", color: "#dc2626", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
              <FileText size={13} /> ייצוא PDF
            </button>
          </div>
        </div>
      )}

      {/* ── Results table ────────────────────────────────── */}
      {results.length > 0 && (
        <div className="card" style={{ overflow: "hidden", padding: 0 }}>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg)", borderBottom: "1.5px solid var(--border)" }}>
                  <th style={{ ...thBase, width: 40, cursor: "pointer" }} onClick={toggleAllVisible}>
                    {allVisibleSelected ? <CheckSquare size={15} color="var(--blue-primary)" /> : <Square size={15} color="var(--gray-text)" />}
                  </th>
                  {visibleCols.map(col => {
                    const sk = COL_SORT[col];
                    const active = sk && sortKey === sk;
                    return (
                      <th key={col} draggable
                        onDragStart={() => handleDragStart(col)}
                        onDragOver={(e) => handleDragOver(e, col)}
                        onDrop={handleDrop}
                        onClick={() => sk && handleSort(sk)}
                        style={{ ...thBase, color: active ? "var(--blue-primary)" : "var(--gray-text)", cursor: sk ? "pointer" : "grab", userSelect: "none", background: active ? "rgba(32,157,215,0.06)" : "var(--bg)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <GripVertical size={11} style={{ opacity: 0.4 }} />
                          {COL_LABELS[col]}
                          <SortIcon col={col} />
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleResults.map((v) => {
                  const isSel = selected.has(v.id);
                  return (
                    <tr key={v.id} onClick={() => toggleOne(v.id)}
                      style={{ borderBottom: "1px solid var(--border)", cursor: "pointer", background: isSel ? "rgba(32,157,215,0.06)" : "" }}>
                      <td style={tdStyle} onClick={(e) => { e.stopPropagation(); toggleOne(v.id); }}>
                        {isSel ? <CheckSquare size={16} color="var(--blue-primary)" /> : <Square size={16} color="var(--gray-text)" />}
                      </td>
                      {visibleCols.map(col => (
                        <td key={col} style={tdStyle}>{renderCell(v, col)}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ScrollSentinel onIntersect={loadMore} />
          <PaginationFooter showing={showing} total={results.length} hasMore={hasMore} entityLabel="בוחרים" />
        </div>
      )}

      {/* ── Bulk actions modal ───────────────────────────── */}
      {actionsOpen && (
        <ActionsModal
          count={selected.size}
          statuses={statuses}
          groupLeaders={groupLeaders}
          groups={groups}
          lists={lists}
          onClose={() => setActionsOpen(false)}
          onApply={(changes) => {
            bulkUpdateVoters(Array.from(selected), changes);
            setSelected(new Set());
            setActionsOpen(false);
          }}
        />
      )}

      {/* Close col menu on outside click */}
      {showColMenu && <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setShowColMenu(false)} />}
    </div>
  );
}

// ── Filter dropdown ─────────────────────────────────────────
function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-text)" }}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${value ? "var(--blue-primary)" : "var(--border)"}`, fontSize: 13, fontWeight: 600, color: value ? "var(--navy)" : "var(--text-muted)", background: value ? "rgba(32,157,215,0.06)" : "#fff", cursor: "pointer" }}>
        <option value="">הכל</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ── Bulk actions modal ──────────────────────────────────────
type Status = { id: string; name: string; color: string };
type GL = { id: string; firstName: string; lastName: string };
type Grp = { id: string; name: string; groupLeaderId: string | null };

function ActionsModal({ count, statuses, groupLeaders, groups, lists, onClose, onApply }: {
  count: number;
  statuses: Status[];
  groupLeaders: GL[];
  groups: Grp[];
  lists: { id: string; name: string }[];
  onClose: () => void;
  onApply: (changes: { statusId?: string; hasVoted?: boolean; addToGroupId?: string; listId?: string }) => void;
}) {
  type Action = "status" | "voted" | "move" | "list";
  const [action, setAction] = useState<Action>("status");
  const [statusId, setStatusId] = useState("");
  const [voted, setVoted] = useState<"yes" | "no">("yes");
  const [moveLeaderId, setMoveLeaderId] = useState("");
  const [moveGroupId, setMoveGroupId] = useState("");
  const [assignListId, setAssignListId] = useState("");
  const [confirming, setConfirming] = useState(false);

  const leaderGroups = useMemo(
    () => groups.filter((g) => g.groupLeaderId === moveLeaderId),
    [groups, moveLeaderId]
  );

  const canApply =
    (action === "status" && !!statusId) ||
    (action === "voted") ||
    (action === "move" && !!moveGroupId) ||
    (action === "list" && !!assignListId);

  const confirmMessage = () => {
    if (action === "status") {
      const name = statuses.find((s) => s.id === statusId)?.name ?? "";
      return `הסטטוס של ${count} בוחרים ישונה ל"${name}". האם להמשיך?`;
    }
    if (action === "voted") {
      return `${count} בוחרים יסומנו כ"${voted === "yes" ? "הצביע" : "לא הצביע"}". האם להמשיך?`;
    }
    if (action === "list") {
      const name = lists.find((l) => l.id === assignListId)?.name ?? "";
      return `${count} בוחרים ישויכו לרשימה "${name}". האם להמשיך?`;
    }
    const leader = groupLeaders.find((g) => g.id === moveLeaderId);
    const grp = groups.find((g) => g.id === moveGroupId);
    return `${count} בוחרים יתווספו לקבוצה "${grp?.name ?? ""}" (ראש קבוצה: ${leader ? `${leader.firstName} ${leader.lastName}` : ""}). האם להמשיך?`;
  };

  const doApply = () => {
    if (action === "status") onApply({ statusId });
    else if (action === "voted") onApply({ hasVoted: voted === "yes" });
    else if (action === "move") onApply({ addToGroupId: moveGroupId });
    else if (action === "list") onApply({ listId: assignListId });
  };

  const tab = (key: Action, icon: React.ReactNode, label: string) => (
    <button onClick={() => setAction(key)}
      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 10px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1.5px solid", borderColor: action === key ? "var(--blue-primary)" : "var(--border)", background: action === key ? "rgba(32,157,215,0.1)" : "#fff", color: action === key ? "var(--blue-primary)" : "var(--text-secondary)" }}>
      {icon}{label}
    </button>
  );

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: "var(--dark-navy)" }}>פעולות קבוצתיות</div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-text)", display: "flex" }}><X size={18} /></button>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 0, marginBottom: 18 }}>
            הפעולה תחול על <strong style={{ color: "var(--blue-primary)" }}>{count} בוחרים</strong> שנבחרו.
          </p>

          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            {tab("status", <Tag size={14} />, "שנה סטטוס")}
            {tab("voted", <Vote size={14} />, "סמן הצבעה")}
            {tab("move", <Users2 size={14} />, "העבר לראש קבוצה")}
            {tab("list", <ClipboardList size={14} />, "שייך לרשימה")}
          </div>

          {action === "status" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--gray-text)" }}>בחר סטטוס</label>
              <select value={statusId} onChange={(e) => setStatusId(e.target.value)} style={selStyle}>
                <option value="">בחר סטטוס...</option>
                {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          {action === "voted" && (
            <div style={{ display: "flex", gap: 8 }}>
              {(["yes", "no"] as const).map((opt) => (
                <button key={opt} onClick={() => setVoted(opt)}
                  style={{ flex: 1, padding: "10px 14px", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", border: `1.5px solid ${voted === opt ? (opt === "yes" ? "#22c55e" : "#ef4444") : "var(--border)"}`, background: voted === opt ? (opt === "yes" ? "#f0fdf4" : "#fef2f2") : "#fff", color: voted === opt ? (opt === "yes" ? "#16a34a" : "#dc2626") : "var(--text-muted)" }}>
                  {opt === "yes" ? "✓ הצביע" : "✗ לא הצביע"}
                </button>
              ))}
            </div>
          )}
          {action === "move" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--gray-text)" }}>ראש קבוצה יעד</label>
                <select value={moveLeaderId} onChange={(e) => { setMoveLeaderId(e.target.value); setMoveGroupId(""); }} style={selStyle}>
                  <option value="">בחר ראש קבוצה...</option>
                  {groupLeaders.map((gl) => <option key={gl.id} value={gl.id}>{gl.firstName} {gl.lastName}</option>)}
                </select>
              </div>
              {moveLeaderId && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "var(--gray-text)" }}>קבוצה</label>
                  {leaderGroups.length > 0 ? (
                    <select value={moveGroupId} onChange={(e) => setMoveGroupId(e.target.value)} style={selStyle}>
                      <option value="">בחר קבוצה...</option>
                      {leaderGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  ) : (
                    <span style={{ fontSize: 13, color: "#dc2626" }}>אין קבוצות משויכות לראש קבוצה זה</span>
                  )}
                </div>
              )}
            </div>
          )}
          {action === "list" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--gray-text)" }}>בחר רשימה</label>
              {lists.length > 0 ? (
                <select value={assignListId} onChange={(e) => setAssignListId(e.target.value)} style={selStyle}>
                  <option value="">בחר רשימה...</option>
                  {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              ) : (
                <span style={{ fontSize: 13, color: "#dc2626" }}>אין רשימות במערכת — צור רשימה במסך &quot;מנהלי רשימות&quot;.</span>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
            <button className="btn-secondary" onClick={onClose}>ביטול</button>
            <button className="btn-primary" disabled={!canApply}
              onClick={() => setConfirming(true)}
              style={!canApply ? { opacity: 0.5, cursor: "not-allowed" } : undefined}>
              החל על {count} בוחרים
            </button>
          </div>
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          title="אישור פעולה קבוצתית"
          message={confirmMessage()}
          confirmLabel={`כן, החל על ${count}`}
          danger
          onCancel={() => setConfirming(false)}
          onConfirm={() => { setConfirming(false); doApply(); }}
        />
      )}
    </>
  );
}

const selStyle: React.CSSProperties = { padding: "9px 10px", borderRadius: 8, border: "1.5px solid var(--blue-primary)", fontSize: 14, fontWeight: 600, color: "var(--navy)", background: "#fff", cursor: "pointer" };
const thBase: React.CSSProperties = { padding: "11px 16px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "var(--gray-text)", textTransform: "uppercase", letterSpacing: "0.05em" };
const tdStyle: React.CSSProperties = { padding: "12px 16px", verticalAlign: "middle" };
