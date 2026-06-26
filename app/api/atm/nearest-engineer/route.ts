import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../utils/supabase/admin";
import {
  assertSameOrigin,
  checkRateLimit,
  getClientIp,
  jsonError,
  rateLimitResponse,
  requireVerifiedUser,
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
    assertSameOrigin(request);

    const limit = checkRateLimit({
      key: `atm:nearest:${getClientIp(request)}`,
      limit: 60,
      windowMs: 60 * 1000,
    });
    if (!limit.success) return rateLimitResponse(limit.resetAt);

    await requireVerifiedUser(request);
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
      return NextResponse.json({
        success: true,
        data: {
          engineer_name: atm.engineer_name,
          engineer_contact: atm.engineer_contact,
          engineer_email: atm.engineer_email,
          method: "master_data"
        }
      });
    }

    const { data: users } = await supabase
      .from("users")
      .select("firebase_uid, full_name, email")
      .eq("role", "employee");

    if (!users || users.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          engineer_name: atm.engineer_name,
          engineer_contact: atm.engineer_contact,
          engineer_email: atm.engineer_email,
          method: "master_data"
        }
      });
    }

    const { data: checkIns } = await supabase
      .from("check_ins")
      .select("employee_id, latitude, longitude")
      .order("checked_in_at", { ascending: false });

    const latestLocations = new Map<string, { lat: number, lon: number }>();
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
          method: "distance_based"
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        engineer_name: atm.engineer_name,
        engineer_contact: atm.engineer_contact,
        engineer_email: atm.engineer_email,
        method: "master_data"
      }
    });
  } catch (error: unknown) {
    return jsonError(error, "Failed to find nearest engineer");
  }
}