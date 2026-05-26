import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, addDoc } from "firebase/firestore";
import nodemailer from "nodemailer";
import { randomUUID } from "crypto";

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
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "נדרש כתובת אימייל" }, { status: 400 });
    }

    const db = getDb();
    const normalizedEmail = email.trim().toLowerCase();

    // Find user by email
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", normalizedEmail));
    const snap = await getDocs(q);

    // Always return success (don't reveal if email exists)
    if (snap.empty) {
      return NextResponse.json({ success: true });
    }

    const userDoc = snap.docs[0];
    const userData = userDoc.data();
    const userId = userDoc.id;

    // Generate token
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    // Store reset token in Firestore
    const resetsRef = collection(db, "passwordResets");
    await addDoc(resetsRef, {
      token,
      userId,
      email: normalizedEmail,
      expiresAt,
      used: false,
      createdAt: new Date().toISOString(),
    });

    // Send email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const resetLink = `${appUrl}/reset-password?token=${token}`;
    const firstName = (userData.firstName as string) || "";
    const lastName = (userData.lastName as string) || "";

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: `"מערכת ניהול בחירות" <${process.env.GMAIL_USER}>`,
      to: normalizedEmail,
      subject: "איפוס סיסמה - מערכת ניהול בחירות",
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e3a5f;">שלום ${firstName} ${lastName},</h2>
          <p>קיבלנו בקשה לאיפוס הסיסמה שלך במערכת ניהול הבחירות.</p>
          <p>לחץ על הכפתור הבא כדי להגדיר סיסמה חדשה:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}"
               style="background-color: #1e3a5f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-size: 16px; display: inline-block;">
              איפוס סיסמה
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">הקישור יפוג תוך שעה אחת.</p>
          <p style="color: #666; font-size: 14px;">אם לא ביקשת לאפס את הסיסמה, אנא התעלם ממייל זה.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px;">מערכת ניהול בחירות</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "אירעה שגיאה. נסה שנית." }, { status: 500 });
  }
}
