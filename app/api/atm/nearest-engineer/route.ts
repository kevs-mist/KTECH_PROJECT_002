import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../utils/supabase/admin";
import {
  assertSameOrigin,
  checkRateLimit,
  getClientIp,
  jsonError,
  rateLimitResponse,
  getBearerToken,
  verifyRequestUser,
} from "../../../src/lib/server/apiSecurity";

export const dynamic = 'force-dynamic';

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function POST(request: Request) {
  try {
    if (request.method !== "POST") {
      return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
    }

    assertSameOrigin(request);

    const limit = checkRateLimit({
      key: `atm:nearest:${getClientIp(request)}`,
      limit: 60,
      windowMs: 60 * 1000,
    });
    if (!limit.success) return rateLimitResponse(limit.resetAt);

    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await verifyRequestUser(token);
    if (user.role !== "employee" && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Employee or Admin access required" }, { status: 403 });
    }

    const supabase = createAdminClient();
    const { atmId } = await request.json();

    if (!atmId || typeof atmId !== "string") {
      return NextResponse.json({ error: "ATM ID required" }, { status: 400 });
    }

    const { data: atm, error: atmError } = await supabase
      .from("atm_locations")
      .select("*")
      .eq("atm_id", atmId)
      .single();

    if (atmError || !atm) {
      return NextResponse.json({ error: "ATM not found" }, { status: 404 });
    }

    if (!atm.latitude || !atm.longitude) {
      let engineerId: string | undefined;
      if (atm.engineer_email) {
        const { data: engineerUser } = await supabase
          .from("users")
          .select("firebase_uid")
          .eq("email", atm.engineer_email)
          .eq("role", "employee")
          .single();
        engineerId = engineerUser?.firebase_uid;
      }

      return NextResponse.json({
        success: true,
        data: {
          engineer_name: atm.engineer_name,
          engineer_contact: atm.engineer_contact,
          engineer_email: atm.engineer_email,
          engineer_id: engineerId,
          method: "master_data",
        },
      });
    }

    const { data: users } = await supabase
      .from("users")
      .select("firebase_uid, full_name, email")
      .eq("role", "employee");

    if (!users || users.length === 0) {
      let engineerId: string | undefined;
      if (atm.engineer_email) {
        const { data: engineerUser } = await supabase
          .from("users")
          .select("firebase_uid")
          .eq("email", atm.engineer_email)
          .eq("role", "employee")
          .single();
        engineerId = engineerUser?.firebase_uid;
      }

      return NextResponse.json({
        success: true,
        data: {
          engineer_name: atm.engineer_name,
          engineer_contact: atm.engineer_contact,
          engineer_email: atm.engineer_email,
          engineer_id: engineerId,
          method: "master_data",
        },
      });
    }

    const { data: checkIns } = await supabase
      .from("check_ins")
      .select("employee_id, latitude, longitude")
      .order("checked_in_at", { ascending: false });

    const latestLocations = new Map<string, { lat: number; lon: number }>();
    if (checkIns) {
      for (const ci of checkIns) {
        if (!latestLocations.has(ci.employee_id)) {
          latestLocations.set(ci.employee_id, { lat: ci.latitude, lon: ci.longitude });
        }
      }
    }

    let nearestEngineer: { firebase_uid: string; full_name: string; email: string } | null = null;
    let minDistance = Infinity;

    for (const user of users) {
      const loc = latestLocations.get(user.firebase_uid);
      if (loc) {
        const distance = calculateDistance(atm.latitude, atm.longitude, loc.lat, loc.lon);
        if (distance < minDistance) {
          minDistance = distance;
          nearestEngineer = user;
        }
      }
    }

    if (nearestEngineer) {
      return NextResponse.json({
        success: true,
        data: {
          engineer_name: nearestEngineer.full_name,
          engineer_id: nearestEngineer.firebase_uid,
          engineer_email: nearestEngineer.email,
          distance_km: minDistance.toFixed(2),
          method: "distance_based",
        },
      });
    }

    let engineerId: string | undefined;
    if (atm.engineer_email) {
      const { data: engineerUser } = await supabase
        .from("users")
        .select("firebase_uid")
        .eq("email", atm.engineer_email)
        .eq("role", "employee")
        .single();
      engineerId = engineerUser?.firebase_uid;
    }

    return NextResponse.json({
      success: true,
      data: {
        engineer_name: atm.engineer_name,
        engineer_contact: atm.engineer_contact,
        engineer_email: atm.engineer_email,
        engineer_id: engineerId,
        method: "master_data",
      },
    });
  } catch (error: unknown) {
    return jsonError(error, "Failed to find nearest engineer");
  }
}