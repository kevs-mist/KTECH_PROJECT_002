import { NextResponse } from "next/server";
import { getEmployeesAction, setEmployeeOnlineStatusAction } from "../../src/lib/actions/employeeActions";

function getBearerToken(request: Request) {
    const authHeader = request.headers.get("authorization");
    return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Employee request failed";
}

function requireToken(request: Request) {
    const token = getBearerToken(request);
    if (!token) throw new Error("Unauthorized: Please log in again.");
    return token;
}

export async function GET(request: Request) {
    try {
        const token = requireToken(request);
        return NextResponse.json(await getEmployeesAction(token));
    } catch (error: unknown) {
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const token = requireToken(request);
        const body = await request.json();

        if (body.operation !== "online-status") {
            return NextResponse.json({ error: "Unknown employee operation" }, { status: 400 });
        }

        await setEmployeeOnlineStatusAction(token, !!body.isOnline);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
