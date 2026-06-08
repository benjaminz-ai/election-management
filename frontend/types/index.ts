export type Voter = {
  id: string;
  firstName: string;
  lastName: string;
  uniqueId: string;
  phone?: string;
  address: {
    street: string;
    streetNumber: string;
    building: string;
    apartment: string;
    city: string;
  };
  groupIds: string[];
  subGroupIds?: string[];
  statusId?: string;
  lastCallStatusId?: string;
  hasVoted?: boolean;
  importedAt?: string;   // ISO timestamp stamped at import time (same for a whole import batch); empty for manually-added voters
  listId?: string;       // which list (מנהל רשימות) brought this voter; independent of groupIds; empty = no list
};

export type SubGroup = {
  id: string;
  name: string;
  parentGroupId: string;
  voterIds: string[];
};

export type Group = {
  id: string;
  name: string;
  groupLeaderId: string | null;
  voterIds: string[];
  subGroupIds?: string[];
};

export type GroupLeader = {
  id: string;
  firstName: string;
  lastName: string;
  uniqueId: string;
  phone: string;
  email: string;
  divisionHeadId: string;
  groupIds: string[];
};

export type DivisionHead = {
  id: string;
  firstName: string;
  lastName: string;
  uniqueId: string;
  phone: string;
  email: string;
  groupLeaderIds: string[];
};

// A "list manager" (מנהל רשימות) sits under group leaders and brings lists of
// voters. They log in (role "list_manager", linked by email) and see only the
// voters from their own lists — across whatever groups those voters belong to.
export type ListManager = {
  id: string;
  firstName: string;
  lastName: string;
  uniqueId: string;
  phone: string;
  email: string;
  tenantId?: string;
};

// A named list a manager brought (e.g. a large family). One manager may own
// several lists. A voter points to a single list via Voter.listId.
export type List = {
  id: string;
  name: string;
  listManagerId: string;       // owning manager (sub-lists inherit the parent's manager)
  parentListId?: string;       // set on a sub-list → points to its parent list; empty = top-level list
  importedAt?: string;
  tenantId?: string;
};

export type StatusCategory = "supporter" | "opponent" | "undecided" | "neutral";

export type Status = {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
  category?: StatusCategory;
};

export type CallStatus = {
  id: string;
  name: string;
  color: string;
};

export type Reminder = {
  id: string;
  voterId: string;
  userId: string;        // owner — reminders are personal, shown only to their creator
  text: string;
  dueAt?: string;        // ISO datetime (date + time)
  done: boolean;
  createdAt: string;
  completedAt?: string;
};

export type ConversationLog = {
  id: string;
  voterId: string;
  userId: string;
  timestamp: string;
  callStatus: string;
  statusId: string;
  notes: string;
  tenantId?: string;
};

// A shareable, identity-gated link to a single call summary (conversationLog).
// Only the chosen recipient (or the sharer / an admin) may open it.
export type CallShare = {
  id: string;              // = shareId, used in the URL (random, unguessable)
  tenantId: string;
  logId: string;           // the shared conversationLog
  voterId: string;
  sharedWithUserId: string;
  sharedById: string;
  note?: string;
  createdAt: string;
};

export type UserRole = "admin" | "field" | "telemarketing" | "group_leader" | "division_head" | "list_manager";

export type AppUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
  isFrozen: boolean;
  createdAt: string;
  password: string;
  tenantId?: string;
  isSuperAdmin?: boolean;
  photoURL?: string;     // self-uploaded avatar (small resized data URL)
};

// A company / workspace (multi-tenancy).
export type Tenant = {
  id: string;
  name: string;
  isFrozen: boolean;
  createdAt: string;
};

export type AppState = {
  voters: Voter[];
  groups: Group[];
  subGroups: SubGroup[];
  groupLeaders: GroupLeader[];
  divisionHeads: DivisionHead[];
  statuses: Status[];
  callStatuses: CallStatus[];
  users: AppUser[];
  reminders: Reminder[];
  listManagers: ListManager[];
  lists: List[];
};
