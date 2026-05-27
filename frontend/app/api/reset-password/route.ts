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

    // Find the reset token
    const resetsRef = collection(db, "passwordResets");
    const q = query(resetsRef, where("token", "==", token));
    const snap = await getDocs(q);

    if (snap.empty) {
      return NextResponse.json({ error: "הקישור אינו תקף" }, { status: 400 });
    }

    const resetDoc = snap.docs[0];
    const resetData = resetDoc.data();

    // Check if already used
    if (resetData.used) {
      return NextResponse.json({ error: "הקישור כבר שומש. אנא בקש קישור חדש." }, { status: 400 });
    }

    // Check expiry
    const expiresAt = new Date(resetData.expiresAt as string);
    if (new Date() > expiresAt) {
      return NextResponse.json({ error: "הקישור פג תוקף. אנא בקש קישור חדש." }, { status: 400 });
    }

    // The userId stored in passwordResets is the Firestore document ID of the user
    const userId = resetData.userId as string;

    // Update password directly using the document ID (no secondary query needed)
    const userDocRef = doc(db, "users", userId);
    await updateDoc(userDocRef, { password: newPassword });

    // Mark token as used
    await updateDoc(doc(db, "passwordResets", resetDoc.id), { used: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "אירעה שגיאה. נסה שנית." }, { status: 500 });
  }
}
