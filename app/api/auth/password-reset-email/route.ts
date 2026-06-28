import { NextResponse } from "next/server";
import { resend } from "../../../../utils/email/resend";
import { adminAuth } from "../../../../utils/firebase/admin";
import {
  checkRateLimit,
  getClientIp,
} from "../../../src/lib/server/apiSecurity";

export async function POST(request: Request) {
  try {
    if (request.method !== "POST") {
      return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
    }

    // Rate limiting: 5 requests per hour per IP
    const limit = checkRateLimit({
      key: `password-reset-email:${getClientIp(request)}`,
      limit: 5,
      windowMs: 60 * 60 * 1000, // 1 hour
    });
    if (!limit.success) {
      return new Response(null, { status: 429 });
    }

    const { email, resetLink } = await request.json();

    if (!email || !resetLink) {
      return NextResponse.json(
        { success: false, error: "Email and reset link are required" },
        { status: 400 }
      );
    }

    // Validate email format (basic)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate resetLink: it must be a URL containing oobCode
    let oobCode: string | null = null;
    try {
      const url = new URL(resetLink);
      oobCode = url.searchParams.get("oobCode");
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid reset link" },
        { status: 400 }
      );
    }

    if (!oobCode) {
      return NextResponse.json(
        { success: false, error: "Reset link missing confirmation code" },
        { status: 400 }
      );
    }

    // Verify the OOB code with Firebase Admin
    try {
      await (adminAuth as any).verifyPasswordResetCode(oobCode);
    } catch (error: unknown) {
      console.error("[/api/auth/password-reset-email] Invalid or expired reset code:", error);
      return NextResponse.json(
        { success: false, error: "Invalid or expired reset link" },
        { status: 400 }
      );
    }

    // If we reach here, the reset link is valid (not expired and correctly signed)
    // Now send the email via Resend
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "noreply@yourdomain.com",
      to: email,
      subject: "Reset Your Password",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Your Password</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f5f5f5; padding: 30px; border-radius: 10px;">
              <h2 style="color: #2563eb; margin-top: 0;">Password Reset Request</h2>
              <p>You requested to reset your password. Click the button below to proceed:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" style="background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Reset Password</a>
              </div>
              <p style="font-size: 14px; color: #666;">If you didn't request this, please ignore this email.</p>
              <p style="font-size: 14px; color: #666;">This link will expire in 1 hour.</p>
            </div>
          </body>
        </html>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[/api/auth/password-reset-email] Email send error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send email" },
      { status: 500 }
    );
  }
}