import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

// Fully on the Admin SDK so it works under the locked-down Firestore rules
// (passwordResets is server-only). The new password is applied to the real
// Firebase Auth account, so the old password stops working immediately.
export async function POST(req: NextRequest) {
  try {
    const { token, newPassword } = await req.json();

    if (!token || !newPassword) {
      return NextResponse.json({ error: "נדרש טוקן וסיסמה חדשה" }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "הסיסמה חייבת להכיל לפחות 6 תווים" }, { status: 400 });
    }

    const db = adminDb();

    // Find + validate the reset token
    const snap = await db.collection("passwordResets").where("token", "==", token).get();
    if (snap.empty) {
      return NextResponse.json({ error: "הקישור אינו תקף" }, { status: 400 });
    }
    const resetDoc = snap.docs[0];
    const resetData = resetDoc.data();

    if (resetData.used) {
      return NextResponse.json({ error: "הקישור כבר שומש. אנא בקש קישור חדש." }, { status: 400 });
    }
    if (new Date() > new Date(resetData.expiresAt as string)) {
      return NextResponse.json({ error: "הקישור פג תוקף. אנא בקש קישור חדש." }, { status: 400 });
    }

    const email = String(resetData.email ?? "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "הקישור חסר כתובת אימייל" }, { status: 400 });
    }

    // Update the password in Firebase Authentication (the real login password).
    const userRecord = await adminAuth().getUserByEmail(email);
    await adminAuth().updateUser(userRecord.uid, { password: newPassword });

    // Mark the token used so the link can't be reused.
    await resetDoc.ref.update({ used: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "אירעה שגיאה. נסה שנית." }, { status: 500 });
  }
}
