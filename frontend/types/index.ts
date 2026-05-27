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
  statusId?: string;
  lastCallStatusId?: string;
  hasVoted?: boolean;
};

export type Group = {
  id: string;
  name: string;
  groupLeaderId: string | null;
  voterIds: string[];
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

export type ConversationLog = {
  id: string;
  voterId: string;
  userId: string;
  timestamp: string;
  callStatus: string;
  statusId: string;
  notes: string;
};

export type UserRole = "admin" | "field" | "telemarketing" | "group_leader" | "division_head";

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
};

export type AppState = {
  voters: Voter[];
  groups: Group[];
  groupLeaders: GroupLeader[];
  divisionHeads: DivisionHead[];
  statuses: Status[];
  callStatuses: CallStatus[];
  users: AppUser[];
};
