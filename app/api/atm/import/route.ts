import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../utils/supabase/admin";
import {
  assertSameOrigin,
  checkRateLimit,
  getClientIp,
  jsonError,
  rateLimitResponse,
  requireAdmin,
} from "../../../src/lib/server/apiSecurity";

const COLUMN_MAP: Record<string, string> = {
  "bank_name": "bank_name",
  "bank name": "bank_name",
  "location": "location",
  "address": "address",
  "state": "state",
  "engineer_name": "engineer_name",
  "engineer name": "engineer_name",
  "engineer_contact": "engineer_contact",
  "engineer contact": "engineer_contact",
  "engineer_email": "engineer_email",
  "engineer email": "engineer_email",
  "latitude": "latitude",
  "longitude": "longitude",
};

export const normalizeColumnKey = (key: string) =>
  key
    .trim()
    .toLowerCase()
    .replace(/[\/]+/g, " ")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const isAtmIdColumn = (normalizedKey: string) => {
  const tokens = normalizedKey.split(" ");
  return (
    (tokens.includes("atm") && tokens.includes("id")) ||
    normalizedKey === "atm id" ||
    normalizedKey === "atm_id" ||
    normalizedKey === "atm-id" ||
    (tokens.includes("sr") && (tokens.includes("no") || tokens.includes("number")))
  );
};

export function normalizeRow(raw: Record<string, unknown>): Record<string, unknown> | null {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const normalizedKey = normalizeColumnKey(key);
    const dbColumn = COLUMN_MAP[normalizedKey] ?? (isAtmIdColumn(normalizedKey) ? "atm_id" : undefined);
    if (dbColumn && value !== undefined && value !== null && String(value).trim() !== "") {
      row[dbColumn] = String(value).trim();
    }
  }

  if (!row.atm_id || !/^[a-zA-Z0-9_-]{3,40}$/.test(String(row.atm_id))) return null;
  return row;
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const limit = checkRateLimit({
      key: `atm:import:${getClientIp(request)}`,
      limit: 10,
      windowMs: 60 * 1000,
    });

    if (!limit.success) return rateLimitResponse(limit.resetAt);

    await requireAdmin(request);
    const body = await request.json();
    const { rows } = body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No data rows provided." }, { status: 400 });
    }

    if (rows.length > 5000) {
      return NextResponse.json({ error: "Import limited to 5000 rows per request." }, { status: 400 });
    }

    const validRows: Record<string, unknown>[] = [];
    const skippedRows: number[] = [];

    for (let i = 0; i < rows.length; i++) {
      const normalized = normalizeRow(rows[i]);
      if (normalized) {
        validRows.push(normalized);
      } else {
        skippedRows.push(i + 1);
      }
    }

    if (validRows.length === 0) {
      return NextResponse.json(
        {
          error: "No valid rows found. Ensure each row has a valid 'atm_id' column or alias like 'SR NO'.",
          skippedRows,
        },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data: upsertData, error: upsertError } = await supabase
      .from("atm_locations")
      .upsert(validRows, { onConflict: "atm_id" })
      .select("id, atm_id, latitude, longitude, engineer_name, engineer_contact, engineer_email");

    if (upsertError) throw upsertError;

    // Helper function to calculate distance between two coordinates
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371; // Earth's radius in km
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    // Process each upserted record to assign nearest engineer if coordinates are available
    const updatePromises = upsertData?.map(async (atm: any) => {
      // Skip if we don't have valid coordinates
      if (
        atm.latitude === null ||
        atm.longitude === null ||
        isNaN(atm.latitude) ||
        isNaN(atm.longitude)
      ) {
        return null;
      }

      try {
        // Get all employees
        const { data: employees } = await supabase
          .from("users")
          .select("firebase_uid, full_name, email")
          .eq("role", "employee");

        if (!employees || employees.length === 0) {
          // No employees found, skip assignment
          return null;
        }

        // Get latest check-in locations for employees
        const { data: checkIns } = await supabase
          .from("check_ins")
          .select("employee_id, latitude, longitude")
          .order("checked_in_at", { ascending: false });

        // Map to get latest location per employee (most recent check-in)
        const latestLocations = new Map<string, { lat: number; lon: number }>();
        if (checkIns) {
          for (const ci of checkIns) {
            if (!latestLocations.has(ci.employee_id)) {
              latestLocations.set(ci.employee_id, {
                lat: ci.latitude,
                lon: ci.longitude,
              });
            }
          }
        }

        // Find nearest engineer based on check-in locations
        let nearestEmployee: {
          firebase_uid: string;
          full_name: string;
          email: string;
        } | null = null;
        let minDistance = Infinity;

        for (const employee of employees) {
          const loc = latestLocations.get(employee.firebase_uid);
          if (loc) {
            const distance = calculateDistance(
              atm.latitude,
              atm.longitude,
              loc.lat,
              loc.lon
              
            );
            if (distance < minDistance) {
              minDistance = distance;
              nearestEmployee = {
                firebase_uid: employee.firebase_uid,
                full_name: employee.full_name,
                email: employee.email,
              };
            }
          }
        }

        // If we found a nearby engineer, update the ATM record with their info
        if (nearestEmployee) {
          // Get engineer's details to ensure we have the latest info
          const { data: engineerDetails } = await supabase
            .from("users")
            .select("full_name, email")
            .eq("firebase_uid", nearestEmployee.firebase_uid)
            .eq("role", "employee")
            .single();

          if (engineerDetails) {
            const updateData: any = {
              engineer_name: engineerDetails.full_name,
              engineer_email: engineerDetails.email,
              // For engineer_contact, we'll use email as fallback since it's not in users table
              engineer_contact: engineerDetails.email,
            };

            // Update the ATM record with the engineer's information
            await supabase
              .from("atm_locations")
              .update(updateData)
              .eq("id", atm.id);
          }
        }
        return null;
      } catch (error) {
        console.error(`Error processing ATM ${atm.atm_id}:`, error);
        // Don't fail the whole import for one ATM's processing error
        return null;
      }
    }) ?? [];

    // Wait for all update operations to complete
    await Promise.all(updatePromises.filter((p): p is Promise<any> => p !== null));

    return NextResponse.json({
      success: true,
      imported: upsertData?.length || validRows.length,
      skipped: skippedRows.length,
      skippedRows: skippedRows.slice(0, 20),
      total: rows.length,
    });
  } catch (error: unknown) {
    return jsonError(error, "Failed to import ATM data");
  }
}