import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

// Creates a new company (tenant): the tenant record, its first admin user
// (Auth account + claims + profile), and default statuses / call-statuses.
// Only the super admin may call this.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { idToken, companyName, adminFirstName, adminLastName, adminEmail, adminPhone, adminPassword } = body ?? {};

    if (!idToken) return NextResponse.json({ error: "missing token" }, { status: 401 });
    if (!companyName || !adminFirstName || !adminLastName || !adminEmail || !adminPassword) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }

    const decoded = await adminAuth().verifyIdToken(idToken);
    if (decoded.isSuperAdmin !== true) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const db = adminDb();

    // 1) Tenant record (auto id).
    const tenantRef = db.collection("tenants").doc();
    const tenantId = tenantRef.id;
    await tenantRef.set({
      id: tenantId,
      name: String(companyName).trim(),
      isFrozen: false,
      createdAt: new Date().toISOString(),
    });

    // 2) First admin user for the company.
    const email = String(adminEmail).trim().toLowerCase();
    const userRecord = await adminAuth().createUser({
      email,
      password: String(adminPassword),
      displayName: `${adminFirstName} ${adminLastName}`.trim(),
      emailVerified: true,
    });
    await adminAuth().setCustomUserClaims(userRecord.uid, { role: "admin", tenantId });
    await db.collection("users").doc(userRecord.uid).set({
      id: userRecord.uid,
      firstName: adminFirstName,
      lastName: adminLastName,
      email,
      phone: adminPhone ?? "",
      role: "admin",
      isFrozen: false,
      createdAt: new Date().toISOString(),
      tenantId,
    });

    // 3) Seed default statuses + call-statuses (scoped to the new tenant).
    const gid = (p: string) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const statuses = [
      { name: "תומך", category: "supporter", color: "#16a34a", isDefault: false },
      { name: "מתנגד", category: "opponent", color: "#dc2626", isDefault: false },
      { name: "מתלבט", category: "undecided", color: "#f59e0b", isDefault: false },
      { name: "ללא החלטה", category: "neutral", color: "#94a3b8", isDefault: true },
    ];
    const callStatuses = [
      { name: "ענה", color: "#16a34a" },
      { name: "לא ענה", color: "#dc2626" },
      { name: "לא זמין", color: "#f59e0b" },
      { name: "מספר שגוי", color: "#94a3b8" },
    ];
    const batch = db.batch();
    for (const s of statuses) {
      const id = gid("st");
      batch.set(db.collection("statuses").doc(id), { id, ...s, tenantId });
    }
    for (const c of callStatuses) {
      const id = gid("cs");
      batch.set(db.collection("callStatuses").doc(id), { id, ...c, tenantId });
    }
    await batch.commit();

    return NextResponse.json({ tenantId, adminUid: userRecord.uid });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
