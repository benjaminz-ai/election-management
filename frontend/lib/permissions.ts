import { UserRole } from "@/types";

// Roles that get the focused, read-only "my people" field experience.
// They are restricted to a small set of screens (see FIELD_ALLOWED).
const FIELD_ROLES: UserRole[] = ["field", "group_leader", "division_head"];

// Screens a field-type user may reach. "/field" is their home (read-only
// list of the voters assigned to them); telemarketing + search are extras.
const FIELD_ALLOWED = ["/field", "/telemarketing", "/search"];

export function isFieldRole(role?: UserRole | null): boolean {
  return !!role && FIELD_ROLES.includes(role);
}

// The path prefixes a role may access, or null when there is no restriction
// (admin + telemarketing keep full access to the existing screens).
export function allowedPaths(role?: UserRole | null): string[] | null {
  if (isFieldRole(role)) return FIELD_ALLOWED;
  return null;
}

export function canAccess(role: UserRole | null | undefined, path: string): boolean {
  const allowed = allowedPaths(role);
  if (!allowed) return true;
  return allowed.some((p) => path === p || path.startsWith(p + "/"));
}

// Where a role should land after login / when hitting a disallowed page.
export function homePath(role?: UserRole | null): string {
  if (isFieldRole(role)) return "/field";
  return "/dashboard";
}
