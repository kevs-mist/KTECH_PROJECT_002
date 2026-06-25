import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      upsert: () => ({
        select: () => Promise.resolve({ data: [{ atm_id: 'ATM-123' }], error: null }),
      }),
    }),
  }),
}));

vi.mock('../../app/src/lib/server/apiSecurity', () => ({
  assertSameOrigin: vi.fn(),
  checkRateLimit: () => ({ success: true, remaining: 9, resetAt: Date.now() + 60000 }),
  getClientIp: () => '127.0.0.1',
  jsonError: (error: unknown, fallback = 'Request failed') => {
    const message = error instanceof Error ? error.message : fallback;
    return { json: async () => ({ error: message }), status: 400 };
  },
  rateLimitResponse: () => ({ json: async () => ({ error: 'Too many requests.' }), status: 429 }),
  requireAdmin: async () => ({ uid: 'admin-uid', email: 'admin@test.com', role: 'admin' }),
}));

import { POST } from '../../app/api/atm/import/route';

describe('ATM import API route', () => {
  it('returns 400 when no rows are provided', async () => {
    const request = new Request('http://localhost/api/atm/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' },
      body: JSON.stringify({ rows: [] }),
    });

    const response: any = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('No data rows provided.');
  });

  it('returns 400 when rows are invalid and includes skippedRows', async () => {
    const request = new Request('http://localhost/api/atm/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' },
      body: JSON.stringify({ rows: [{ 'SR NO': '' }, { atm_id: 'ab' }] }),
    });

    const response: any = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("No valid rows found");
    expect(json.skippedRows).toEqual([1, 2]);
  });

  it('imports rows with SR NO alias and returns success payload', async () => {
    const request = new Request('http://localhost/api/atm/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' },
      body: JSON.stringify({ rows: [{ 'SR NO': 'ATM-123', 'Bank Name': 'Acme', 'Location': 'Main St' }] }),
    });

    const response: any = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.imported).toBe(1);
    expect(json.skipped).toBe(0);
    expect(json.total).toBe(1);
  });

  it('returns 400 for import requests that exceed the row limit', async () => {
    const rows = Array.from({ length: 5001 }, (_, i) => ({ atm_id: `ATM-${i + 1}` }));
    const request = new Request('http://localhost/api/atm/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' },
      body: JSON.stringify({ rows }),
    });

    const response: any = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Import limited to 5000 rows per request.');
  });
});
