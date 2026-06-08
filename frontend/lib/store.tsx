"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import { AppState, Voter, Group, SubGroup, GroupLeader, DivisionHead, Status, CallStatus, AppUser, Reminder, ListManager, List } from "@/types";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  collection,
  getDocs,
  getDoc,
  query,
  where,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";

// ── Active tenant (company) scoping ───────────────────────────────────────────
// Every read is filtered by this, every write is stamped with it.
let ACTIVE_TENANT: string | null = null;
export function getActiveTenant() { return ACTIVE_TENANT; }

// Resolve which tenant the signed-in user is working in:
//  - normal user: their tenantId claim
//  - super admin: a company they selected (localStorage), else their own
async function resolveActiveTenant(user: import("firebase/auth").User): Promise<string | null> {
  try {
    // Force-refresh so newly-set tenant/super-admin claims are picked up even
    // for sessions that signed in before the claims were assigned.
    const res = await user.getIdTokenResult(true);
    const claimTid = (res.claims.tenantId as string) || null;
    const isSuper = res.claims.isSuperAdmin === true;
    if (isSuper && typeof window !== "undefined") {
      const sel = localStorage.getItem("active_tenant");
      if (sel) return sel;
    }
    return claimTid;
  } catch {
    return null;
  }
}

type StoreContextType = {
  state: AppState;
  loading: boolean;
  // true when Firebase Auth has a signed-in user (the real "logged in" signal,
  // independent of whether tenant data finished loading).
  signedIn: boolean;
  // true when the tenant data failed to load after retries while still signed
  // in — lets the UI offer a retry instead of bouncing to /login.
  loadError: boolean;
  retryLoad: () => void;
  tenantName: string | null;
  tenantFrozen: boolean;
  isSuperAdmin: boolean;
  addVoter: (voter: Voter) => void;
  updateVoter: (voter: Voter) => void;
  bulkUpdateVoters: (
    ids: string[],
    changes: { statusId?: string; hasVoted?: boolean; addToGroupId?: string; listId?: string }
  ) => void;
  deleteVoter: (id: string) => void;
  importVoters: (voters: Voter[]) => void;
  addGroup: (group: Group) => void;
  updateGroup: (group: Group) => void;
  deleteGroup: (id: string) => void;
  addSubGroup: (sg: SubGroup) => void;
  updateSubGroup: (sg: SubGroup) => void;
  deleteSubGroup: (id: string) => void;
  addGroupLeader: (gl: GroupLeader) => void;
  updateGroupLeader: (gl: GroupLeader) => void;
  deleteGroupLeader: (id: string) => void;
  addDivisionHead: (dh: DivisionHead) => void;
  updateDivisionHead: (dh: DivisionHead) => void;
  deleteDivisionHead: (id: string) => void;
  addListManager: (lm: ListManager) => void;
  updateListManager: (lm: ListManager) => void;
  deleteListManager: (id: string) => void;
  addList: (list: List) => void;
  updateList: (list: List) => void;
  deleteList: (id: string) => void;
  addStatus: (status: Status) => void;
  updateStatus: (status: Status) => void;
  deleteStatus: (id: string) => void;
  setDefaultStatus: (id: string) => void;
  addCallStatus: (cs: CallStatus) => void;
  updateCallStatus: (cs: CallStatus) => void;
  deleteCallStatus: (id: string) => void;
  addUser: (user: AppUser) => void;
  updateUser: (user: AppUser) => void;
  freezeUser: (id: string, frozen: boolean) => Promise<void>;
  updateMyPhoto: (id: string, photoURL: string) => Promise<void>;
  refreshUsers: () => Promise<void>;
  addReminder: (r: Reminder) => void;
  updateReminder: (r: Reminder) => void;
  deleteReminder: (id: string) => void;
  refreshReminders: () => Promise<void>;
};

const StoreContext = createContext<StoreContextType | null>(null);

const EMPTY_STATE: AppState = {
  voters: [],
  groups: [],
  subGroups: [],
  groupLeaders: [],
  divisionHeads: [],
  statuses: [],
  callStatuses: [],
  users: [],
  reminders: [],
  listManagers: [],
  lists: [],
};

async function loadFromFirestore(tid: string): Promise<AppState> {
  // Scope every collection to the active tenant (company).
  const q = (name: string) => getDocs(query(collection(db, name), where("tenantId", "==", tid)));
  const [votersSnap, groupsSnap, subGroupsSnap, glSnap, dhSnap, statusesSnap, callStatusesSnap, usersSnap, remindersSnap, listManagersSnap, listsSnap] =
    await Promise.all([
      q("voters"), q("groups"), q("subGroups"), q("groupLeaders"), q("divisionHeads"),
      q("statuses"), q("callStatuses"), q("users"), q("reminders"), q("listManagers"), q("lists"),
    ]);

  const voters = votersSnap.docs.map((d: { data(): unknown }) => d.data() as Voter);
  const groups = groupsSnap.docs.map((d: { data(): unknown }) => d.data() as Group);
  const subGroups = subGroupsSnap.docs.map((d: { data(): unknown }) => d.data() as SubGroup);
  const groupLeaders = glSnap.docs.map((d: { data(): unknown }) => d.data() as GroupLeader);
  const divisionHeads = dhSnap.docs.map((d: { data(): unknown }) => d.data() as DivisionHead);
  const statuses = statusesSnap.docs.map((d: { data(): unknown }) => d.data() as Status);
  const callStatuses = callStatusesSnap.docs.map((d: { data(): unknown }) => d.data() as CallStatus);
  const users = usersSnap.docs.map((d: { data(): unknown }) => d.data() as AppUser);
  const reminders = remindersSnap.docs.map((d: { data(): unknown }) => d.data() as Reminder);
  const listManagers = listManagersSnap.docs.map((d: { data(): unknown }) => d.data() as ListManager);
  const lists = listsSnap.docs.map((d: { data(): unknown }) => d.data() as List);

  return {
    voters,
    groups,
    subGroups,
    groupLeaders,
    divisionHeads,
    statuses,
    callStatuses,
    users,
    reminders,
    listManagers,
    lists,
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const stateRef = useRef<AppState>(EMPTY_STATE);
  stateRef.current = state;

  const [tenantName, setTenantName] = useState<string | null>(null);
  const [tenantFrozen, setTenantFrozen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const fbUserRef = useRef<User | null>(null);
  // The active tenant for writes (kept in a ref so write helpers see it).
  const tenantIdRef = useRef<string | null>(ACTIVE_TENANT);
  // Stamp a new/updated document with the active tenant so it stays scoped.
  const stamp = <T extends object>(obj: T): T & { tenantId: string | null } => ({ ...obj, tenantId: tenantIdRef.current });

  // Load all tenant data for a signed-in Firebase user. Kept as a function so a
  // failed refresh can RETRY without forcing the user to re-login. A transient
  // network hiccup on refresh must never look like "logged out".
  const loadForUser = useCallback(async (user: User) => {
    setLoading(true);
    setLoadError(false);
    try {
      const tid = await resolveActiveTenant(user);
      ACTIVE_TENANT = tid;
      tenantIdRef.current = tid;
      try {
        const res = await user.getIdTokenResult();
        setIsSuperAdmin(res.claims.isSuperAdmin === true);
      } catch {}
      if (!tid) { setState(EMPTY_STATE); setTenantName(null); return; }
      // Load the active company's display name.
      try {
        const tSnap = await getDoc(doc(db, "tenants", tid));
        setTenantName((tSnap.data()?.name as string) ?? null);
        setTenantFrozen(tSnap.data()?.isFrozen === true);
      } catch { setTenantName(null); setTenantFrozen(false); }
      // Load this tenant's data — retry a few times before giving up so a single
      // momentary failure on refresh doesn't wipe state and bounce to /login.
      let loaded: AppState | null = null;
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try { loaded = await loadFromFirestore(tid); break; }
        catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, 600 * (attempt + 1))); }
      }
      if (!loaded) {
        // Persistent failure: the user IS still authenticated. Surface a retry
        // screen (loadError) instead of clearing state — clearing would make
        // currentUser null and the guard would mistake it for a logout.
        console.error("Firestore load failed (after retries)", lastErr);
        setLoadError(true);
        return;
      }
      // A super admin viewing ANOTHER company won't have their own user doc
      // in that company's list — fetch it so their identity (currentUser)
      // still resolves and they aren't bounced to login.
      if (!loaded.users.some((u) => u.id === user.uid)) {
        try {
          const own = await getDoc(doc(db, "users", user.uid));
          if (own.exists()) loaded.users = [...loaded.users, own.data() as AppUser];
        } catch {}
      }
      setState(loaded);
    } catch (e) {
      console.error("Tenant resolve/load failed", e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-run the load for the currently signed-in user (used by the retry button).
  const retryLoad = useCallback(() => {
    const user = fbUserRef.current;
    if (user) loadForUser(user);
  }, [loadForUser]);

  // Load data once Firebase Auth is ready. onAuthStateChanged fires right after
  // login AND on every refresh once the persisted token is restored — so data
  // appears automatically. signedIn tracks the REAL auth state (token present),
  // separate from whether the data finished loading.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      fbUserRef.current = user;
      if (!user) {
        // Genuinely signed out (logout, disabled account, expired token):
        // clear data and stop loading → the guard sends to /login.
        setSignedIn(false);
        setLoadError(false);
        setState(EMPTY_STATE);
        setLoading(false);
        return;
      }
      setSignedIn(true);
      await loadForUser(user);
    });
    return () => unsub();
  }, [loadForUser]);

  // ── Voters ────────────────────────────────────────────────────────────────────

  const addVoter = (voter: Voter) => {
    setState((s) => ({
      ...s,
      voters: [...s.voters, voter],
      groups: s.groups.map((g) =>
        voter.groupIds.includes(g.id)
          ? { ...g, voterIds: [...g.voterIds, voter.id] }
          : g
      ),
    }));
    setDoc(doc(db, "voters", voter.id), stamp(voter)).catch(console.error);
    voter.groupIds.forEach((gid) =>
      updateDoc(doc(db, "groups", gid), { voterIds: arrayUnion(voter.id) }).catch(console.error)
    );
    (voter.subGroupIds ?? []).forEach((sgid) =>
      updateDoc(doc(db, "subGroups", sgid), { voterIds: arrayUnion(voter.id) }).catch(console.error)
    );
  };

  const updateVoter = (voter: Voter) => {
    const old = stateRef.current.voters.find((v) => v.id === voter.id);
    const oldSubGroupIds = old?.subGroupIds ?? [];
    const newSubGroupIds = voter.subGroupIds ?? [];
    // Determine added/removed subgroups
    const addedSubs = newSubGroupIds.filter(id => !oldSubGroupIds.includes(id));
    const removedSubs = oldSubGroupIds.filter(id => !newSubGroupIds.includes(id));
    setState((s) => ({
      ...s,
      voters: s.voters.map((v) => (v.id === voter.id ? voter : v)),
      subGroups: s.subGroups.map((sg) => {
        if (addedSubs.includes(sg.id)) return { ...sg, voterIds: [...sg.voterIds.filter(id => id !== voter.id), voter.id] };
        if (removedSubs.includes(sg.id)) return { ...sg, voterIds: sg.voterIds.filter(id => id !== voter.id) };
        return sg;
      }),
    }));
    setDoc(doc(db, "voters", voter.id), stamp(voter)).catch(console.error);
    addedSubs.forEach(sgid => updateDoc(doc(db, "subGroups", sgid), { voterIds: arrayUnion(voter.id) }).catch(console.error));
    removedSubs.forEach(sgid => updateDoc(doc(db, "subGroups", sgid), { voterIds: arrayRemove(voter.id) }).catch(console.error));
  };

  const bulkUpdateVoters = (
    ids: string[],
    changes: { statusId?: string; hasVoted?: boolean; addToGroupId?: string; listId?: string }
  ) => {
    if (!ids.length) return;
    const idSet = new Set(ids);
    const { statusId, hasVoted, addToGroupId, listId } = changes;
    const hasStatus = statusId !== undefined;
    const hasVotedChange = hasVoted !== undefined;
    const hasList = listId !== undefined;

    setState((s) => {
      const voters = s.voters.map((v) => {
        if (!idSet.has(v.id)) return v;
        const next: Voter = { ...v };
        if (hasStatus) next.statusId = statusId;
        if (hasVotedChange) next.hasVoted = hasVoted;
        if (hasList) next.listId = listId;
        if (addToGroupId && !v.groupIds.includes(addToGroupId)) {
          next.groupIds = [...v.groupIds, addToGroupId];
        }
        return next;
      });
      const groups = addToGroupId
        ? s.groups.map((g) =>
            g.id === addToGroupId
              ? { ...g, voterIds: Array.from(new Set([...g.voterIds, ...ids])) }
              : g
          )
        : s.groups;
      return { ...s, voters, groups };
    });

    // Persist to Firestore in batches (max 500 writes per batch)
    const voterFieldUpdate: Partial<Voter> = {};
    if (hasStatus) voterFieldUpdate.statusId = statusId;
    if (hasVotedChange) voterFieldUpdate.hasVoted = hasVoted;
    if (hasList) voterFieldUpdate.listId = listId;

    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 400) chunks.push(ids.slice(i, i + 400));

    chunks.forEach((group) => {
      const batch = writeBatch(db);
      group.forEach((vid) => {
        const ref = doc(db, "voters", vid);
        if (Object.keys(voterFieldUpdate).length > 0) {
          batch.update(ref, voterFieldUpdate as Record<string, unknown>);
        }
        if (addToGroupId) {
          batch.update(ref, { groupIds: arrayUnion(addToGroupId) });
        }
      });
      batch.commit().catch(console.error);
    });

    if (addToGroupId) {
      updateDoc(doc(db, "groups", addToGroupId), {
        voterIds: arrayUnion(...ids),
      }).catch(console.error);
    }
  };

  const deleteVoter = (id: string) => {
    const voter = stateRef.current.voters.find((v) => v.id === id);
    setState((s) => ({
      ...s,
      voters: s.voters.filter((v) => v.id !== id),
      groups: s.groups.map((g) => ({
        ...g,
        voterIds: g.voterIds.filter((vid) => vid !== id),
      })),
    }));
    deleteDoc(doc(db, "voters", id)).catch(console.error);
    if (voter) {
      voter.groupIds.forEach((gid) =>
        updateDoc(doc(db, "groups", gid), { voterIds: arrayRemove(id) }).catch(console.error)
      );
      (voter.subGroupIds ?? []).forEach((sgid) =>
        updateDoc(doc(db, "subGroups", sgid), { voterIds: arrayRemove(id) }).catch(console.error)
      );
    }
  };

  // ── Groups ────────────────────────────────────────────────────────────────────


  const importVoters = (rawVoters: Voter[]) => {
    if (!rawVoters.length) return;

    // Stamp the whole import batch with one shared timestamp so they can be
    // filtered together later as an "import batch" (מנת ייבוא).
    const importedAt = new Date().toISOString();
    const newVoters = rawVoters.map((v) => ({ ...v, importedAt }));

    // Build map: groupId → new voter IDs to add
    const byGroup = new Map<string, string[]>();
    newVoters.forEach((v) => {
      v.groupIds.forEach((gid) => {
        const arr = byGroup.get(gid) ?? [];
        arr.push(v.id);
        byGroup.set(gid, arr);
      });
    });

    // Update local state
    setState((s) => {
      const updatedGroups = byGroup.size > 0
        ? s.groups.map((g) => {
            const ids = byGroup.get(g.id);
            return ids ? { ...g, voterIds: [...g.voterIds, ...ids] } : g;
          })
        : s.groups;
      return { ...s, voters: [...s.voters, ...newVoters], groups: updatedGroups };
    });

    // Persist to Firestore
    const batch = writeBatch(db);
    newVoters.forEach((v) => batch.set(doc(db, "voters", v.id), stamp(v)));
    byGroup.forEach((voterIds, groupId) => {
      batch.update(doc(db, "groups", groupId), { voterIds: arrayUnion(...voterIds) });
    });
    batch.commit().catch(console.error);
  };

  const addGroup = (group: Group) => {
    setState((s) => {
      const newState = { ...s, groups: [...s.groups, group] };
      if (group.groupLeaderId) {
        newState.groupLeaders = s.groupLeaders.map((gl) =>
          gl.id === group.groupLeaderId
            ? { ...gl, groupIds: [...gl.groupIds, group.id] }
            : gl
        );
      }
      return newState;
    });
    setDoc(doc(db, "groups", group.id), stamp(group)).catch(console.error);
    if (group.groupLeaderId)
      updateDoc(doc(db, "groupLeaders", group.groupLeaderId), {
        groupIds: arrayUnion(group.id),
      }).catch(console.error);
  };

  const updateGroup = (group: Group) => {
    const old = stateRef.current.groups.find((g) => g.id === group.id);
    setState((s) => {
      let groupLeaders = s.groupLeaders;
      if (old && old.groupLeaderId !== group.groupLeaderId) {
        groupLeaders = groupLeaders.map((gl) => {
          if (gl.id === old.groupLeaderId)
            return { ...gl, groupIds: gl.groupIds.filter((gid) => gid !== group.id) };
          if (gl.id === group.groupLeaderId)
            return { ...gl, groupIds: [...gl.groupIds, group.id] };
          return gl;
        });
      }
      return {
        ...s,
        groups: s.groups.map((g) => (g.id === group.id ? group : g)),
        groupLeaders,
      };
    });
    setDoc(doc(db, "groups", group.id), stamp(group)).catch(console.error);
    if (old && old.groupLeaderId !== group.groupLeaderId) {
      if (old.groupLeaderId)
        updateDoc(doc(db, "groupLeaders", old.groupLeaderId), {
          groupIds: arrayRemove(group.id),
        }).catch(console.error);
      if (group.groupLeaderId)
        updateDoc(doc(db, "groupLeaders", group.groupLeaderId), {
          groupIds: arrayUnion(group.id),
        }).catch(console.error);
    }
  };

  const deleteGroup = (id: string) => {
    const group = stateRef.current.groups.find((g) => g.id === id);
    setState((s) => ({
      ...s,
      groups: s.groups.filter((g) => g.id !== id),
      voters: s.voters.map((v) => ({
        ...v,
        groupIds: v.groupIds.filter((gid) => gid !== id),
      })),
      groupLeaders: s.groupLeaders.map((gl) => ({
        ...gl,
        groupIds: gl.groupIds.filter((gid) => gid !== id),
      })),
    }));
    deleteDoc(doc(db, "groups", id)).catch(console.error);
    if (group) {
      if (group.groupLeaderId)
        updateDoc(doc(db, "groupLeaders", group.groupLeaderId), {
          groupIds: arrayRemove(id),
        }).catch(console.error);
      group.voterIds.forEach((vId) =>
        updateDoc(doc(db, "voters", vId), { groupIds: arrayRemove(id) }).catch(console.error)
      );
    }
  };


  // ── Sub Groups ────────────────────────────────────────────────────────────────

  const addSubGroup = (sg: SubGroup) => {
    setState((s) => ({
      ...s,
      subGroups: [...s.subGroups, sg],
      groups: s.groups.map((g) =>
        g.id === sg.parentGroupId
          ? { ...g, subGroupIds: [...(g.subGroupIds ?? []), sg.id] }
          : g
      ),
    }));
    setDoc(doc(db, "subGroups", sg.id), stamp(sg)).catch(console.error);
    updateDoc(doc(db, "groups", sg.parentGroupId), { subGroupIds: arrayUnion(sg.id) }).catch(console.error);
  };

  const updateSubGroup = (sg: SubGroup) => {
    setState((s) => ({
      ...s,
      subGroups: s.subGroups.map((x) => (x.id === sg.id ? sg : x)),
    }));
    setDoc(doc(db, "subGroups", sg.id), stamp(sg)).catch(console.error);
  };

  const deleteSubGroup = (id: string) => {
    const sg = stateRef.current.subGroups.find((x) => x.id === id);
    setState((s) => ({
      ...s,
      subGroups: s.subGroups.filter((x) => x.id !== id),
      groups: s.groups.map((g) =>
        g.id === sg?.parentGroupId
          ? { ...g, subGroupIds: (g.subGroupIds ?? []).filter((sid) => sid !== id) }
          : g
      ),
      voters: s.voters.map((v) => ({
        ...v,
        subGroupIds: (v.subGroupIds ?? []).filter((sid) => sid !== id),
      })),
    }));
    deleteDoc(doc(db, "subGroups", id)).catch(console.error);
    if (sg) {
      updateDoc(doc(db, "groups", sg.parentGroupId), { subGroupIds: arrayRemove(id) }).catch(console.error);
      sg.voterIds.forEach((vId) =>
        updateDoc(doc(db, "voters", vId), { subGroupIds: arrayRemove(id) }).catch(console.error)
      );
    }
  };


  // ── Group Leaders ─────────────────────────────────────────────────────────────

  const addGroupLeader = (gl: GroupLeader) => {
    setState((s) => {
      const newState = { ...s, groupLeaders: [...s.groupLeaders, gl] };
      if (gl.divisionHeadId) {
        newState.divisionHeads = s.divisionHeads.map((dh) =>
          dh.id === gl.divisionHeadId
            ? { ...dh, groupLeaderIds: [...dh.groupLeaderIds, gl.id] }
            : dh
        );
      }
      return newState;
    });
    setDoc(doc(db, "groupLeaders", gl.id), stamp(gl)).catch(console.error);
    if (gl.divisionHeadId)
      updateDoc(doc(db, "divisionHeads", gl.divisionHeadId), {
        groupLeaderIds: arrayUnion(gl.id),
      }).catch(console.error);
  };

  const updateGroupLeader = (gl: GroupLeader) => {
    const old = stateRef.current.groupLeaders.find((g) => g.id === gl.id);
    setState((s) => {
      let divisionHeads = s.divisionHeads;
      if (old && old.divisionHeadId !== gl.divisionHeadId) {
        divisionHeads = divisionHeads.map((dh) => {
          if (dh.id === old.divisionHeadId)
            return { ...dh, groupLeaderIds: dh.groupLeaderIds.filter((lid) => lid !== gl.id) };
          if (dh.id === gl.divisionHeadId)
            return { ...dh, groupLeaderIds: [...dh.groupLeaderIds, gl.id] };
          return dh;
        });
      }
      return {
        ...s,
        groupLeaders: s.groupLeaders.map((g) => (g.id === gl.id ? gl : g)),
        divisionHeads,
      };
    });
    setDoc(doc(db, "groupLeaders", gl.id), stamp(gl)).catch(console.error);
    if (old && old.divisionHeadId !== gl.divisionHeadId) {
      if (old.divisionHeadId)
        updateDoc(doc(db, "divisionHeads", old.divisionHeadId), {
          groupLeaderIds: arrayRemove(gl.id),
        }).catch(console.error);
      if (gl.divisionHeadId)
        updateDoc(doc(db, "divisionHeads", gl.divisionHeadId), {
          groupLeaderIds: arrayUnion(gl.id),
        }).catch(console.error);
    }
  };

  const deleteGroupLeader = (id: string) => {
    const gl = stateRef.current.groupLeaders.find((g) => g.id === id);
    setState((s) => ({
      ...s,
      groupLeaders: s.groupLeaders.filter((g) => g.id !== id),
      groups: s.groups.map((g) =>
        g.groupLeaderId === id ? { ...g, groupLeaderId: null } : g
      ),
      divisionHeads: s.divisionHeads.map((dh) => ({
        ...dh,
        groupLeaderIds: dh.groupLeaderIds.filter((lid) => lid !== id),
      })),
    }));
    deleteDoc(doc(db, "groupLeaders", id)).catch(console.error);
    if (gl) {
      if (gl.divisionHeadId)
        updateDoc(doc(db, "divisionHeads", gl.divisionHeadId), {
          groupLeaderIds: arrayRemove(id),
        }).catch(console.error);
      gl.groupIds.forEach((gId) =>
        updateDoc(doc(db, "groups", gId), { groupLeaderId: null }).catch(console.error)
      );
    }
  };

  // ── Division Heads ────────────────────────────────────────────────────────────

  const addDivisionHead = (dh: DivisionHead) => {
    setState((s) => ({ ...s, divisionHeads: [...s.divisionHeads, dh] }));
    setDoc(doc(db, "divisionHeads", dh.id), stamp(dh)).catch(console.error);
  };

  const updateDivisionHead = (dh: DivisionHead) => {
    setState((s) => ({
      ...s,
      divisionHeads: s.divisionHeads.map((d) => (d.id === dh.id ? dh : d)),
    }));
    setDoc(doc(db, "divisionHeads", dh.id), stamp(dh)).catch(console.error);
  };

  const deleteDivisionHead = (id: string) => {
    setState((s) => ({
      ...s,
      divisionHeads: s.divisionHeads.filter((dh) => dh.id !== id),
      groupLeaders: s.groupLeaders.map((gl) =>
        gl.divisionHeadId === id ? { ...gl, divisionHeadId: "" } : gl
      ),
    }));
    deleteDoc(doc(db, "divisionHeads", id)).catch(console.error);
  };

  // ── List Managers (מנהלי רשימות) ──────────────────────────────────────────────

  const addListManager = (lm: ListManager) => {
    setState((s) => ({ ...s, listManagers: [...s.listManagers, lm] }));
    setDoc(doc(db, "listManagers", lm.id), stamp(lm)).catch(console.error);
  };
  const updateListManager = (lm: ListManager) => {
    setState((s) => ({ ...s, listManagers: s.listManagers.map((m) => (m.id === lm.id ? lm : m)) }));
    setDoc(doc(db, "listManagers", lm.id), stamp(lm)).catch(console.error);
  };
  const deleteListManager = (id: string) => {
    setState((s) => ({ ...s, listManagers: s.listManagers.filter((m) => m.id !== id) }));
    deleteDoc(doc(db, "listManagers", id)).catch(console.error);
  };

  // ── Lists (רשימות) ────────────────────────────────────────────────────────────

  const addList = (list: List) => {
    setState((s) => ({ ...s, lists: [...s.lists, list] }));
    setDoc(doc(db, "lists", list.id), stamp(list)).catch(console.error);
  };
  const updateList = (list: List) => {
    setState((s) => ({ ...s, lists: s.lists.map((l) => (l.id === list.id ? list : l)) }));
    setDoc(doc(db, "lists", list.id), stamp(list)).catch(console.error);
  };
  const deleteList = (id: string) => {
    // Deleting a list also removes its sub-lists, and detaches any voter that
    // pointed to the list OR one of its sub-lists (they become "ללא רשימה").
    const subIds = stateRef.current.lists.filter((l) => l.parentListId === id).map((l) => l.id);
    const removedIds = new Set<string>([id, ...subIds]);
    const affected = stateRef.current.voters.filter((v) => v.listId && removedIds.has(v.listId));
    setState((s) => ({
      ...s,
      lists: s.lists.filter((l) => !removedIds.has(l.id)),
      voters: s.voters.map((v) => (v.listId && removedIds.has(v.listId) ? { ...v, listId: "" } : v)),
    }));
    removedIds.forEach((lid) => deleteDoc(doc(db, "lists", lid)).catch(console.error));
    affected.forEach((v) => updateDoc(doc(db, "voters", v.id), { listId: "" }).catch(console.error));
  };

  // ── Statuses ──────────────────────────────────────────────────────────────────

  const addStatus = (status: Status) => {
    setState((s) => ({ ...s, statuses: [...s.statuses, status] }));
    setDoc(doc(db, "statuses", status.id), stamp(status)).catch(console.error);
  };

  const updateStatus = (status: Status) => {
    setState((s) => ({
      ...s,
      statuses: s.statuses.map((st) => (st.id === status.id ? status : st)),
    }));
    setDoc(doc(db, "statuses", status.id), stamp(status)).catch(console.error);
  };

  const deleteStatus = (id: string) => {
    const toDelete = stateRef.current.statuses.find((s) => s.id === id);
    if (!toDelete || toDelete.isDefault) return;
    setState((s) => ({ ...s, statuses: s.statuses.filter((st) => st.id !== id) }));
    deleteDoc(doc(db, "statuses", id)).catch(console.error);
  };

  const setDefaultStatus = (id: string) => {
    const updated = stateRef.current.statuses.map((s) => ({ ...s, isDefault: s.id === id }));
    setState((s) => ({ ...s, statuses: updated }));
    const batch = writeBatch(db);
    updated.forEach((s) => batch.set(doc(db, "statuses", s.id), stamp(s)));
    batch.commit().catch(console.error);
  };

  // ── Call Statuses ─────────────────────────────────────────────────────────────

  const addCallStatus = (cs: CallStatus) => {
    setState((s) => ({ ...s, callStatuses: [...s.callStatuses, cs] }));
    setDoc(doc(db, "callStatuses", cs.id), stamp(cs)).catch(console.error);
  };

  const updateCallStatus = (cs: CallStatus) => {
    setState((s) => ({
      ...s,
      callStatuses: s.callStatuses.map((c) => (c.id === cs.id ? cs : c)),
    }));
    setDoc(doc(db, "callStatuses", cs.id), stamp(cs)).catch(console.error);
  };

  const deleteCallStatus = (id: string) => {
    setState((s) => ({ ...s, callStatuses: s.callStatuses.filter((c) => c.id !== id) }));
    deleteDoc(doc(db, "callStatuses", id)).catch(console.error);
  };

  // ── Users ─────────────────────────────────────────────────────────────────────

  const addUser = (user: AppUser) => {
    setState((s) => ({ ...s, users: [...s.users, user] }));
    setDoc(doc(db, "users", user.id), stamp(user)).catch(console.error);
  };

  const updateUser = (user: AppUser) => {
    setState((s) => ({
      ...s,
      users: s.users.map((u) => (u.id === user.id ? user : u)),
    }));
    setDoc(doc(db, "users", user.id), stamp(user)).catch(console.error);
  };

  // Freeze = DISABLE the Firebase Auth account (server-side) so the user can't
  // sign in at all, plus flip the profile flag for the UI. We go through the
  // /api/admin/freeze-user route (Admin SDK) — it also enforces the hard guards
  // (never a super admin, never yourself, same-company only). We update local
  // state optimistically and revert if the server rejects it.
  const freezeUser = async (id: string, frozen: boolean) => {
    const user = stateRef.current.users.find((u) => u.id === id);
    if (!user) return;
    setState((s) => ({
      ...s,
      users: s.users.map((u) => (u.id === id ? { ...u, isFrozen: frozen } : u)),
    }));
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("no token");
      const res = await fetch("/api/admin/freeze-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, uid: id, freeze: frozen }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "freeze failed");
    } catch (err) {
      console.error("freezeUser failed:", err);
      // revert optimistic change
      setState((s) => ({
        ...s,
        users: s.users.map((u) => (u.id === id ? { ...u, isFrozen: !frozen } : u)),
      }));
    }
  };

  // A user updates ONLY their own profile photo. Firestore rules allow a signed-in
  // user to change just the photoURL field of their own doc. Optimistic + revert.
  const updateMyPhoto = async (id: string, photoURL: string) => {
    const prev = stateRef.current.users.find((u) => u.id === id)?.photoURL ?? "";
    setState((s) => ({ ...s, users: s.users.map((u) => (u.id === id ? { ...u, photoURL } : u)) }));
    try {
      await updateDoc(doc(db, "users", id), { photoURL });
    } catch (err) {
      console.error("updateMyPhoto failed:", err);
      setState((s) => ({ ...s, users: s.users.map((u) => (u.id === id ? { ...u, photoURL: prev } : u)) }));
      throw err;
    }
  };


  // ── Reminders (personal) ──────────────────────────────────────────────────────

  const addReminder = (r: Reminder) => {
    setState((s) => ({ ...s, reminders: [...s.reminders, r] }));
    setDoc(doc(db, "reminders", r.id), stamp(r)).catch(console.error);
  };

  const updateReminder = (r: Reminder) => {
    setState((s) => ({ ...s, reminders: s.reminders.map((x) => (x.id === r.id ? r : x)) }));
    setDoc(doc(db, "reminders", r.id), stamp(r)).catch(console.error);
  };

  const deleteReminder = (id: string) => {
    setState((s) => ({ ...s, reminders: s.reminders.filter((x) => x.id !== id) }));
    deleteDoc(doc(db, "reminders", id)).catch(console.error);
  };

  const refreshReminders = async (): Promise<void> => {
    try {
      if (!tenantIdRef.current) return;
      const snap = await getDocs(query(collection(db, "reminders"), where("tenantId", "==", tenantIdRef.current)));
      setState((s) => ({ ...s, reminders: snap.docs.map((d) => d.data() as Reminder) }));
    } catch (e) {
      console.error("refreshReminders failed", e);
    }
  };

  // ── Refresh Users ─────────────────────────────────────────────────────────────

  const refreshUsers = async (): Promise<void> => {
    try {
      if (!tenantIdRef.current) return;
      const snap = await getDocs(query(collection(db, "users"), where("tenantId", "==", tenantIdRef.current)));
      const users = snap.docs.map((d) => d.data() as AppUser);
      if (users.length > 0) {
        setState((s) => ({ ...s, users }));
      }
    } catch (e) {
      console.error("refreshUsers failed", e);
    }
  };



  return (
    <StoreContext.Provider
      value={{
        state,
        loading,
        signedIn,
        loadError,
        retryLoad,
        tenantName,
        tenantFrozen,
        isSuperAdmin,
        addVoter,
        updateVoter,
        bulkUpdateVoters,
        deleteVoter,
        importVoters,
        addGroup,
        updateGroup,
        deleteGroup,
        addSubGroup,
        updateSubGroup,
        deleteSubGroup,
        addGroupLeader,
        updateGroupLeader,
        deleteGroupLeader,
        addDivisionHead,
        updateDivisionHead,
        deleteDivisionHead,
        addListManager,
        updateListManager,
        deleteListManager,
        addList,
        updateList,
        deleteList,
        addStatus,
        updateStatus,
        deleteStatus,
        setDefaultStatus,
        addCallStatus,
        updateCallStatus,
        deleteCallStatus,
        addUser,
        updateUser,
        freezeUser,
        updateMyPhoto,
        refreshUsers,
        addReminder,
        updateReminder,
        deleteReminder,
        refreshReminders,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
