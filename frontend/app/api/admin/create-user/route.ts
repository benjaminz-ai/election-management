import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

// Creates a new user in Firebase Authentication + a profile doc in Firestore.
// Only an authenticated admin may call this (verified via their Firebase ID token).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { idToken, firstName, lastName, email, phone, role, password, tenantId } = body ?? {};

    if (!idToken) return NextResponse.json({ error: "missing token" }, { status: 401 });
    if (!email || !password || !firstName || !lastName || !role) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }

    // Verify the caller is an admin
    const decoded = await adminAuth().verifyIdToken(idToken);
    if (decoded.role !== "admin") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // The new user belongs to the caller's company. A super admin may create
    // users in another company by passing tenantId explicitly.
    const newTenantId = (decoded.isSuperAdmin && tenantId) ? tenantId : decoded.tenantId;
    if (!newTenantId) return NextResponse.json({ error: "missing tenant" }, { status: 400 });

    // Create the auth identity (password held by Firebase, never by us).
    // emailVerified is set so the user can enroll two-factor (MFA) — admins
    // create accounts with known, trusted emails.
    const userRecord = await adminAuth().createUser({
      email: String(email).trim().toLowerCase(),
      password: String(password),
      displayName: `${firstName} ${lastName}`,
      emailVerified: true,
    });

    // Role + tenant live as custom claims — this is what security rules check
    await adminAuth().setCustomUserClaims(userRecord.uid, { role, tenantId: newTenantId });

    // Profile doc keyed by uid (no password field), scoped to the company
    await adminDb().collection("users").doc(userRecord.uid).set({
      id: userRecord.uid,
      firstName,
      lastName,
      email: String(email).trim().toLowerCase(),
      phone: phone ?? "",
      role,
      isFrozen: false,
      createdAt: new Date().toISOString(),
      tenantId: newTenantId,
    });

    return NextResponse.json({ uid: userRecord.uid });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
