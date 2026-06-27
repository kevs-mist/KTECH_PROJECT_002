import { NextResponse } from "next/server";
import { adminAuth } from "../../../../utils/firebase/admin";
import { createAdminClient } from "../../../../utils/supabase/admin";
import { checkRateLimit as checkRateLimitImpl, rateLimitResponse as rateLimitResponseImpl } from "./rateLimit";

export type RateLimitOptions = {
    key: string;
    limit: number;
    windowMs: number;
};

// Re-export rate limiting functions
export const checkRateLimit = checkRateLimitImpl;
export const rateLimitResponse = rateLimitResponseImpl;

export type VerifiedUser = {
    uid: string;
    email: string | null;
    role: "admin" | "employee" | "user";
    adminId?: string;
    employeeId?: string;
};

export function getBearerToken(request: Request): string | null {
    const authHeader = request.headers.get("authorization");
    return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

export function getClientIp(request: Request): string {
    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    return forwardedFor || request.headers.get("x-real-ip") || "unknown";
}

export function errorMessage(error: unknown, fallback = "Request failed"): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "object" && error !== null && "message" in error && typeof (error as any).message === "string") {
        return (error as any).message;
    }
    return fallback;
}

export function statusFromError(message: string): number {
    const normalized = message.toLowerCase();
    if (normalized.includes("unauthorized") || normalized.includes("authentication")) return 401;
    if (normalized.includes("forbidden") || normalized.includes("access required")) return 403;
    if (normalized.includes("not found")) return 404;
    if (
        normalized.includes("invalid") ||
        normalized.includes("required") ||
        normalized.includes("missing") ||
        normalized.includes("too large") ||
        normalized.includes("too short")
    ) {
        return 400;
    }
    if (normalized.includes("rate limit") || normalized.includes("too many")) return 429;
    if (normalized.includes("modified") || normalized.includes("already been")) return 409;
    return 500;
}

export function jsonError(error: unknown, fallback = "Request failed") {
    const message = errorMessage(error, fallback);
    return NextResponse.json({ error: message }, { status: statusFromError(message) });
}

export function assertSameOrigin(request: Request) {
    const origin = request.headers.get("origin");
    if (!origin) return;

    const requestUrl = new URL(request.url);
    const allowedOrigins = new Set(
        [
            `${requestUrl.protocol}//${requestUrl.host}`,
            process.env.NEXT_PUBLIC_APP_URL,
            process.env.APP_URL,
            process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
        ].filter(Boolean)
    );

    if (!allowedOrigins.has(origin)) {
        throw new Error("Forbidden: cross-origin requests are not allowed.");
    }
}

export async function verifyRequestUser(token: string): Promise<VerifiedUser> {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const supabase = createAdminClient();

    const [adminResult, employeeResult, userResult] = await Promise.all([
        supabase
            .from("admins")
            .select("id")
            .eq("firebase_uid", decodedToken.uid)
            .maybeSingle(),
        supabase
            .from("employees")
            .select("id")
            .eq("firebase_uid", decodedToken.uid)
            .maybeSingle(),
        supabase
            .from("users")
            .select("role")
            .eq("firebase_uid", decodedToken.uid)
            .maybeSingle(),
    ]);

    if (adminResult.error) throw adminResult.error;
    if (employeeResult.error) throw employeeResult.error;
    if (userResult.error) throw userResult.error;

    if (adminResult.data) {
        return {
            uid: decodedToken.uid,
            email: decodedToken.email ?? null,
            role: "admin",
            adminId: adminResult.data.id,
        };
    }

    if (employeeResult.data || userResult.data?.role === "employee") {
        return {
            uid: decodedToken.uid,
            email: decodedToken.email ?? null,
            role: "employee",
            employeeId: employeeResult.data?.id,
        };
    }

    return {
        uid: decodedToken.uid,
        email: decodedToken.email ?? null,
        role: "user",
    };
}

export async function requireVerifiedUser(request: Request): Promise<VerifiedUser> {
    const token = getBearerToken(request);
    if (!token) throw new Error("Unauthorized: Please log in again.");
    return verifyRequestUser(token);
}

export async function requireAdmin(request: Request): Promise<VerifiedUser> {
    const user = await requireVerifiedUser(request);
    if (user.role !== "admin") throw new Error("Forbidden: Admin access required.");
    return user;
}

export async function logAuditEvent(params: {
    actorUid: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
    request?: Request;
}) {
    try {
        const supabase = createAdminClient();
        await supabase.from("audit_logs").insert([
            {
                actor_uid: params.actorUid,
                action: params.action,
                resource_type: params.resourceType,
                resource_id: params.resourceId ?? null,
                metadata: params.metadata ?? {},
                ip_address: params.request ? getClientIp(params.request) : null,
                user_agent: params.request?.headers.get("user-agent") ?? null,
            },
        ]);
    } catch (error) {
        console.error("Audit log write failed:", errorMessage(error));
    }
}
