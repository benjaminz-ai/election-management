import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

// Updates an existing user. Profile fields go to Firestore; password + role
// are applied to the REAL Firebase Auth account so they take effect for login
// and security rules (old password stops working immediately).
//
// Only an authenticated admin may call this.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { idToken, uid, firstName, lastName, phone, role, password } = body ?? {};

    if (!idToken) return NextResponse.json({ error: "missing token" }, { status: 401 });
    if (!uid) return NextResponse.json({ error: "missing uid" }, { status: 400 });

    // Verify the caller is an admin
    const decoded = await adminAuth().verifyIdToken(idToken);
    if (decoded.role !== "admin") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // 1) Update the Firebase Auth account (password + display name) if needed.
    const authUpdate: { password?: string; displayName?: string } = {};
    if (typeof password === "string" && password.length > 0) authUpdate.password = password;
    if (firstName || lastName) authUpdate.displayName = `${firstName ?? ""} ${lastName ?? ""}`.trim();
    if (Object.keys(authUpdate).length > 0) {
      await adminAuth().updateUser(uid, authUpdate);
    }

    // 2) Update the role custom claim — preserving the existing tenantId
    //    (setCustomUserClaims replaces ALL claims, so we must keep tenantId).
    if (role) {
      const target = await adminAuth().getUser(uid);
      const existing = target.customClaims || {};
      await adminAuth().setCustomUserClaims(uid, { ...existing, role });
    }

    // 3) Update the Firestore profile (no password ever stored here).
    const profile: Record<string, unknown> = {};
    if (firstName !== undefined) profile.firstName = firstName;
    if (lastName !== undefined) profile.lastName = lastName;
    if (phone !== undefined) profile.phone = phone;
    if (role !== undefined) profile.role = role;
    if (Object.keys(profile).length > 0) {
      await adminDb().collection("users").doc(uid).set(profile, { merge: true });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
