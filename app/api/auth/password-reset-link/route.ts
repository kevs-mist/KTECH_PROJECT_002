import { NextResponse } from "next/server";
import { getAdminAuth } from "../../../../utils/firebase/admin";

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Failed to generate password reset link";
}

export async function POST(request: Request) {
    try {
        if (process.env.NODE_ENV !== "development") {
            return NextResponse.json({ error: "Developer reset links are disabled in production" }, { status: 403 });
        }

        const { email } = await request.json();
        if (!email || typeof email !== "string") {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }

        const adminAuth = getAdminAuth();
        const rawLink = await adminAuth.generatePasswordResetLink(email.trim());
        let link = rawLink;

        try {
            const urlObj = new URL(rawLink);
            const oobCode = urlObj.searchParams.get("oobCode");
            if (oobCode) {
                link = `http://localhost:3000/reset-password?oobCode=${oobCode}`;
            }
        } catch {
            // Keep Firebase's raw link if parsing fails.
        }

        return NextResponse.json({ success: true, link });
    } catch (error: unknown) {
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
