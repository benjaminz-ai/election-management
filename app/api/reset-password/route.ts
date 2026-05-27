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
      return NextResponse.json({ error: "הקישור כבר שומש" }, { status: 400 });
    }

    // Check expiry
    const expiresAt = new Date(resetData.expiresAt as string);
    if (new Date() > expiresAt) {
      return NextResponse.json({ error: "הקישור פג תוקף. אנא בקש קישור חדש." }, { status: 400 });
    }

    // Find user and update password
    const userId = resetData.userId as string;
    const usersRef = collection(db, "users");
    const userQuery = query(usersRef, where("id", "==", userId));
    const userSnap = await getDocs(userQuery);

    if (userSnap.empty) {
      return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
    }

    const userDocRef = doc(db, "users", userSnap.docs[0].id);
    await updateDoc(userDocRef, { password: newPassword });

    // Mark token as used
    const resetDocRef = doc(db, "passwordResets", resetDoc.id);
    await updateDoc(resetDocRef, { used: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "אירעה שגיאה. נסה שנית." }, { status: 500 });
  }
}
