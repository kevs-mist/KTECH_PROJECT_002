import { NextResponse } from "next/server";
import { adminAuth } from "../../../../utils/firebase/admin";
import { getAppBaseUrl } from "../../../src/lib/server/apiSecurity";

export async function POST(request: Request) {
    try {
        if (process.env.NODE_ENV !== "development") {
            return NextResponse.json({ error: "Developer reset links are disabled in production" }, { status: 403 });
        }

        const { email } = await request.json();
        if (!email || typeof email !== "string") {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }

        const rawLink = await adminAuth.generatePasswordResetLink(email.trim());
        let link = rawLink;

        try {
            const urlObj = new URL(rawLink);
            const oobCode = urlObj.searchParams.get("oobCode");
            if (oobCode) {
                link = `${getAppBaseUrl()}/reset-password?oobCode=${oobCode}`;
            }
        } catch {
            // Keep Firebase's raw link if parsing fails.
        }

        return NextResponse.json({ success: true, link });
    } catch (error: unknown) {
        console.error("[/api/auth/password-reset-link] Failed to generate reset link:", error);
        return NextResponse.json({ error: "Failed to generate reset link" }, { status: 500 });
    }
}