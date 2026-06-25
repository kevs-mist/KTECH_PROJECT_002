import { describe, it, expect, vi } from 'vitest';

// Mock Firebase admin and Supabase admin client before importing routes
vi.mock('../../utils/firebase/admin', () => ({
  adminAuth: {
    verifyIdToken: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../../utils/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ order: () => ({ data: [], error: null }) }),
    }),
  }),
}));

import { GET as listGET } from '../../app/api/atm/list/route';
import { GET as detailGET } from '../../app/api/atm/[atmId]/route';

describe('ATM API (unauthenticated)', () => {
  it('GET /api/atm/list returns 401 without auth', async () => {
    const req = new Request('http://localhost/api/atm/list');
    const res: any = await listGET(req as any);
    const json = await res.json();
    expect(res.status).toBe(401);
    expect(json).toHaveProperty('error');
  });

  it('GET /api/atm/[atmId] returns 401 without auth', async () => {
    const req = new Request('http://localhost/api/atm/ATM-0001');
    // pass empty context
    const res: any = await detailGET(req as any, {} as any);
    const json = await res.json();
    expect(res.status).toBe(401);
    expect(json).toHaveProperty('error');
  });
});
