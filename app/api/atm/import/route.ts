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
    const { data, error } = await supabase
      .from("atm_locations")
      .upsert(validRows, { onConflict: "atm_id" })
      .select("atm_id");

    if (error) throw error;

    return NextResponse.json({
      success: true,
      imported: data?.length || validRows.length,
      skipped: skippedRows.length,
      skippedRows: skippedRows.slice(0, 20),
      total: rows.length,
    });
  } catch (error: unknown) {
    return jsonError(error, "Failed to import ATM data");
  }
}