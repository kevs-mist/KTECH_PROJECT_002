import { NextResponse } from "next/server";
import { uploadMediaAction } from "../../../src/lib/actions/storageActions";
import {
    assertSameOrigin,
    checkRateLimit,
    getBearerToken,
    getClientIp,
    jsonError,
    rateLimitResponse,
} from "../../../src/lib/server/apiSecurity";

export async function POST(request: Request) {
    try {
        assertSameOrigin(request);

        const limit = checkRateLimit({
            key: `upload:${getClientIp(request)}`,
            limit: 30,
            windowMs: 60 * 1000,
        });
        if (!limit.success) return rateLimitResponse(limit.resetAt);

        const token = getBearerToken(request);
        if (!token) {
            return NextResponse.json({ error: "Unauthorized to upload media." }, { status: 401 });
        }

        const formData = await request.formData();
        const publicUrl = await uploadMediaAction(token, formData);
        return NextResponse.json({ publicUrl });
    } catch (error: unknown) {
        return jsonError(error, "Upload failed");
    }
}