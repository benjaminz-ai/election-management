import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

const firebaseConfig = {
  apiKey: "AIzaSyB6f5AkDkvsDqI99aIyj_sopKAbBlybT78",
  projectId: "election-management-145fc",
};

function getDb() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return getFirestore(app);
}

export async function POST(req: NextRequest) {
  try {
    const { token, newPassword } = await req.json();

    if (!token || !newPassword) {
      return NextResponse.json({ error: "נדרש טוקן וסיסמה חדשה" }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "הסיסמה חייבת להכיל לפחות 6 תווים" }, { status: 400 });
    }

    const db = getDb();

    // Find + validate the reset token
    const resetsRef = collection(db, "passwordResets");
    const snap = await getDocs(query(resetsRef, where("token", "==", token)));
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

    // ── Primary: update the password in Firebase Authentication ──────────────
    const userRecord = await adminAuth().getUserByEmail(email);
    await adminAuth().updateUser(userRecord.uid, { password: newPassword });

    // ── Transition safety: keep the legacy Firestore password in sync too, so
    //    the fallback login path stays consistent until we remove it.
    const usersSnap = await adminDb().collection("users").where("email", "==", email).get();
    await Promise.all(
      usersSnap.docs.map((d) => d.ref.update({ password: newPassword }).catch(() => {}))
    );

    // Mark token used
    await updateDoc(doc(db, "passwordResets", resetDoc.id), { used: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "אירעה שגיאה. נסה שנית." }, { status: 500 });
  }
}
