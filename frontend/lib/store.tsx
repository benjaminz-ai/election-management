"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { AppState, Voter, Group, SubGroup, GroupLeader, DivisionHead, Status, CallStatus, AppUser } from "@/types";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";

type StoreContextType = {
  state: AppState;
  loading: boolean;
  addVoter: (voter: Voter) => void;
  updateVoter: (voter: Voter) => void;
  bulkUpdateVoters: (
    ids: string[],
    changes: { statusId?: string; hasVoted?: boolean; addToGroupId?: string }
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
  addStatus: (status: Status) => void;
  updateStatus: (status: Status) => void;
  deleteStatus: (id: string) => void;
  setDefaultStatus: (id: string) => void;
  addCallStatus: (cs: CallStatus) => void;
  updateCallStatus: (cs: CallStatus) => void;
  deleteCallStatus: (id: string) => void;
  addUser: (user: AppUser) => void;
  updateUser: (user: AppUser) => void;
  freezeUser: (id: string, frozen: boolean) => void;
  refreshUsers: () => Promise<void>;
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
};

async function loadFromFirestore(): Promise<AppState> {
  const [votersSnap, groupsSnap, subGroupsSnap, glSnap, dhSnap, statusesSnap, callStatusesSnap, usersSnap] =
    await Promise.all([
      getDocs(collection(db, "voters")),
      getDocs(collection(db, "groups")),
      getDocs(collection(db, "subGroups")),
      getDocs(collection(db, "groupLeaders")),
      getDocs(collection(db, "divisionHeads")),
      getDocs(collection(db, "statuses")),
      getDocs(collection(db, "callStatuses")),
      getDocs(collection(db, "users")),
    ]);

  const voters = votersSnap.docs.map((d: { data(): unknown }) => d.data() as Voter);
  const groups = groupsSnap.docs.map((d: { data(): unknown }) => d.data() as Group);
  const subGroups = subGroupsSnap.docs.map((d: { data(): unknown }) => d.data() as SubGroup);
  const groupLeaders = glSnap.docs.map((d: { data(): unknown }) => d.data() as GroupLeader);
  const divisionHeads = dhSnap.docs.map((d: { data(): unknown }) => d.data() as DivisionHead);
  const statuses = statusesSnap.docs.map((d: { data(): unknown }) => d.data() as Status);
  const callStatuses = callStatusesSnap.docs.map((d: { data(): unknown }) => d.data() as CallStatus);
  const users = usersSnap.docs.map((d: { data(): unknown }) => d.data() as AppUser);

  return {
    voters,
    groups,
    subGroups,
    groupLeaders,
    divisionHeads,
    statuses,
    callStatuses,
    users,
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const stateRef = useRef<AppState>(EMPTY_STATE);
  stateRef.current = state;

  useEffect(() => {
    (async () => {
      try {
        // Load whatever exists in Firestore. No demo data is ever seeded.
        const loaded = await loadFromFirestore();
        setState(loaded);
      } catch (e) {
        console.error("Firestore load failed", e);
        setState(EMPTY_STATE);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
    setDoc(doc(db, "voters", voter.id), voter).catch(console.error);
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
    setDoc(doc(db, "voters", voter.id), voter).catch(console.error);
    addedSubs.forEach(sgid => updateDoc(doc(db, "subGroups", sgid), { voterIds: arrayUnion(voter.id) }).catch(console.error));
    removedSubs.forEach(sgid => updateDoc(doc(db, "subGroups", sgid), { voterIds: arrayRemove(voter.id) }).catch(console.error));
  };

  const bulkUpdateVoters = (
    ids: string[],
    changes: { statusId?: string; hasVoted?: boolean; addToGroupId?: string }
  ) => {
    if (!ids.length) return;
    const idSet = new Set(ids);
    const { statusId, hasVoted, addToGroupId } = changes;
    const hasStatus = statusId !== undefined;
    const hasVotedChange = hasVoted !== undefined;

    setState((s) => {
      const voters = s.voters.map((v) => {
        if (!idSet.has(v.id)) return v;
        const next: Voter = { ...v };
        if (hasStatus) next.statusId = statusId;
        if (hasVotedChange) next.hasVoted = hasVoted;
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


  const importVoters = (newVoters: Voter[]) => {
    if (!newVoters.length) return;

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
    newVoters.forEach((v) => batch.set(doc(db, "voters", v.id), v));
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
    setDoc(doc(db, "groups", group.id), group).catch(console.error);
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
    setDoc(doc(db, "groups", group.id), group).catch(console.error);
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
    setDoc(doc(db, "subGroups", sg.id), sg).catch(console.error);
    updateDoc(doc(db, "groups", sg.parentGroupId), { subGroupIds: arrayUnion(sg.id) }).catch(console.error);
  };

  const updateSubGroup = (sg: SubGroup) => {
    setState((s) => ({
      ...s,
      subGroups: s.subGroups.map((x) => (x.id === sg.id ? sg : x)),
    }));
    setDoc(doc(db, "subGroups", sg.id), sg).catch(console.error);
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
    setDoc(doc(db, "groupLeaders", gl.id), gl).catch(console.error);
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
    setDoc(doc(db, "groupLeaders", gl.id), gl).catch(console.error);
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
    setDoc(doc(db, "divisionHeads", dh.id), dh).catch(console.error);
  };

  const updateDivisionHead = (dh: DivisionHead) => {
    setState((s) => ({
      ...s,
      divisionHeads: s.divisionHeads.map((d) => (d.id === dh.id ? dh : d)),
    }));
    setDoc(doc(db, "divisionHeads", dh.id), dh).catch(console.error);
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

  // ── Statuses ──────────────────────────────────────────────────────────────────

  const addStatus = (status: Status) => {
    setState((s) => ({ ...s, statuses: [...s.statuses, status] }));
    setDoc(doc(db, "statuses", status.id), status).catch(console.error);
  };

  const updateStatus = (status: Status) => {
    setState((s) => ({
      ...s,
      statuses: s.statuses.map((st) => (st.id === status.id ? status : st)),
    }));
    setDoc(doc(db, "statuses", status.id), status).catch(console.error);
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
    updated.forEach((s) => batch.set(doc(db, "statuses", s.id), s));
    batch.commit().catch(console.error);
  };

  // ── Call Statuses ─────────────────────────────────────────────────────────────

  const addCallStatus = (cs: CallStatus) => {
    setState((s) => ({ ...s, callStatuses: [...s.callStatuses, cs] }));
    setDoc(doc(db, "callStatuses", cs.id), cs).catch(console.error);
  };

  const updateCallStatus = (cs: CallStatus) => {
    setState((s) => ({
      ...s,
      callStatuses: s.callStatuses.map((c) => (c.id === cs.id ? cs : c)),
    }));
    setDoc(doc(db, "callStatuses", cs.id), cs).catch(console.error);
  };

  const deleteCallStatus = (id: string) => {
    setState((s) => ({ ...s, callStatuses: s.callStatuses.filter((c) => c.id !== id) }));
    deleteDoc(doc(db, "callStatuses", id)).catch(console.error);
  };

  // ── Users ─────────────────────────────────────────────────────────────────────

  const addUser = (user: AppUser) => {
    setState((s) => ({ ...s, users: [...s.users, user] }));
    setDoc(doc(db, "users", user.id), user).catch(console.error);
  };

  const updateUser = (user: AppUser) => {
    setState((s) => ({
      ...s,
      users: s.users.map((u) => (u.id === user.id ? user : u)),
    }));
    setDoc(doc(db, "users", user.id), user).catch(console.error);
  };

  const freezeUser = (id: string, frozen: boolean) => {
    const user = stateRef.current.users.find((u) => u.id === id);
    if (!user) return;
    const updated = { ...user, isFrozen: frozen };
    setState((s) => ({
      ...s,
      users: s.users.map((u) => (u.id === id ? updated : u)),
    }));
    updateDoc(doc(db, "users", id), { isFrozen: frozen }).catch(console.error);
  };


  // ── Refresh Users ─────────────────────────────────────────────────────────────

  const refreshUsers = async (): Promise<void> => {
    try {
      const snap = await getDocs(collection(db, "users"));
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
        refreshUsers,
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
