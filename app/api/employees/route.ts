import { NextResponse } from "next/server";
import {
  getBearerToken,
  verifyRequestUser,
} from "../../src/lib/server/apiSecurity";
import { getEmployeesAction, setEmployeeOnlineStatusAction } from "../../src/lib/actions/employeeActions";

export async function GET(request: Request) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await verifyRequestUser(token);

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    return NextResponse.json(await getEmployeesAction(token));
  } catch (error: unknown) {
    // Handle errors from verifyRequestUser or getEmployeesAction
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.toLowerCase().includes("unauthorized")
      ? 401
      : message.toLowerCase().includes("forbidden")
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    if (request.method !== "POST") {
      return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
    }

    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await verifyRequestUser(token);

    if (user.role !== "employee") {
      return NextResponse.json({ error: "Forbidden: Employee access required" }, { status: 403 });
    }

    const body = await request.json();
    if (body.operation !== "online-status") {
      return NextResponse.json({ error: "Unknown employee operation" }, { status: 400 });
    }

    await setEmployeeOnlineStatusAction(token, !!body.isOnline);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.toLowerCase().includes("unauthorized")
      ? 401
      : message.toLowerCase().includes("forbidden")
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}