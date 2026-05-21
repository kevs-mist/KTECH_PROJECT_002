import { NextResponse } from "next/server";
import { uploadMediaAction } from "../../../src/lib/actions/storageActions";

function getBearerToken(request: Request) {
    const authHeader = request.headers.get("authorization");
    return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Upload failed";
}

export async function POST(request: Request) {
    try {
        const token = getBearerToken(request);
        if (!token) {
            return NextResponse.json({ error: "Unauthorized to upload media." }, { status: 401 });
        }

        const formData = await request.formData();
        const publicUrl = await uploadMediaAction(token, formData);
        return NextResponse.json({ publicUrl });
    } catch (error: unknown) {
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
