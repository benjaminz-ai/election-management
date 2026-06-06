import { UserRole } from "@/types";

// Roles that get the focused, read-only "my people" field experience.
// They are restricted to a small set of screens (see FIELD_ALLOWED).
const FIELD_ROLES: UserRole[] = ["field", "group_leader", "division_head"];

// Screens a field-type user may reach. They get ONLY the read-only
// "my people" screen — no telemarketing (editing) and no global search.
// ("/enroll-mfa" is always reachable so anyone can set up two-factor.)
const FIELD_ALLOWED = ["/field", "/enroll-mfa", "/profile", "/shared", "/shares"];

// Screens only an admin (or super admin, whose role is also "admin") may reach.
// Enforced both here (route guard) and by hiding the link in the sidebar.
const ADMIN_ONLY = ["/activity"];

// ── Two-factor (SMS MFA) rollout ──────────────────────────────────────────────
// Set to true ONLY after the flow is verified end-to-end (so we never lock
// users out). When true, users whose role requires MFA and who have not yet
// enrolled a second factor are redirected to /enroll-mfa.
export const MFA_ENFORCED = true;

// Which roles must use two-factor. Currently: everyone with an account.
export function mfaRequiredForRole(_role?: UserRole | null): boolean {
  return true;
}

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
  // Admin-only screens: only the admin role (super admin is also "admin").
  if (ADMIN_ONLY.some((p) => path === p || path.startsWith(p + "/"))) {
    return role === "admin";
  }
  const allowed = allowedPaths(role);
  if (!allowed) return true;
  return allowed.some((p) => path === p || path.startsWith(p + "/"));
}

// Where a role should land after login / when hitting a disallowed page.
export function homePath(role?: UserRole | null): string {
  if (isFieldRole(role)) return "/field";
  return "/dashboard";
}
