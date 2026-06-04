import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

// Freezes / unfreezes a SINGLE user. Like company-freeze, this DISABLES (or
// re-enables) the Firebase Auth account so the user cannot sign in at all, and
// also flips the profile isFrozen flag for the UI. Only an admin (of the same
// company) or a super admin may call this.
//
// Hard guards (cannot be bypassed via the API):
//   • a super admin account can NEVER be frozen,
//   • you can never freeze yourself,
//   • a company admin may only act on users inside their own company.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { idToken, uid, freeze } = body ?? {};

    if (!idToken) return NextResponse.json({ error: "missing token" }, { status: 401 });
    if (!uid || typeof freeze !== "boolean") {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }

    // Caller must be an admin or super admin.
    const decoded = await adminAuth().verifyIdToken(idToken);
    const isAdmin = decoded.role === "admin";
    const isSuper = decoded.isSuperAdmin === true;
    if (!isAdmin && !isSuper) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // Cannot freeze yourself.
    if (decoded.uid === uid) {
      return NextResponse.json({ error: "cannot freeze self" }, { status: 400 });
    }

    // Look up the target's claims.
    const target = await adminAuth().getUser(uid);
    const targetClaims = target.customClaims || {};

    // A super admin can NEVER be frozen — by anyone.
    if (targetClaims.isSuperAdmin === true) {
      return NextResponse.json({ error: "cannot freeze super admin" }, { status: 400 });
    }

    // A company admin may only act within their own company.
    if (!isSuper && targetClaims.tenantId !== decoded.tenantId) {
      return NextResponse.json({ error: "forbidden (other company)" }, { status: 403 });
    }

    // Disable / enable the Auth account (this is what blocks login) ...
    await adminAuth().updateUser(uid, { disabled: freeze });
    // ... and mirror the flag on the profile for the UI.
    await adminDb().collection("users").doc(uid).set({ isFrozen: freeze }, { merge: true });

    return NextResponse.json({ ok: true, frozen: freeze });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
