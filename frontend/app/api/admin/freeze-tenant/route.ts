import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

// Freezes / unfreezes a whole company. Sets the tenant flag AND disables
// (or re-enables) every Auth user of that company — except super admins —
// so that while frozen, nobody from the company (including its admin) can
// sign in. Only the super admin may call this.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { idToken, tenantId, freeze } = body ?? {};

    if (!idToken) return NextResponse.json({ error: "missing token" }, { status: 401 });
    if (!tenantId || typeof freeze !== "boolean") {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }

    const decoded = await adminAuth().verifyIdToken(idToken);
    if (decoded.isSuperAdmin !== true) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // 1) Flag on the tenant record.
    await adminDb().collection("tenants").doc(tenantId).set({ isFrozen: freeze }, { merge: true });

    // 2) Disable / enable every Auth user of this company (skip super admins).
    let token, affected = 0;
    do {
      const res = await adminAuth().listUsers(1000, token);
      for (const u of res.users) {
        const c = u.customClaims || {};
        if (c.tenantId === tenantId && c.isSuperAdmin !== true) {
          if (u.disabled !== freeze) {
            await adminAuth().updateUser(u.uid, { disabled: freeze });
            affected++;
          }
        }
      }
      token = res.pageToken;
    } while (token);

    return NextResponse.json({ ok: true, frozen: freeze, affectedUsers: affected });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
