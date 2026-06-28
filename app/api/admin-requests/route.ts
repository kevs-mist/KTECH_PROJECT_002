import { NextResponse } from 'next/server';
import { createAdminClient } from '../../../utils/supabase/admin';

function getBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization');
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
}

export async function GET(request: Request) {
  try {
    if (request.method !== "GET") {
      return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { verifyUserRoleAction } = await import('../../src/lib/actions/authActions');
    const { role } = await verifyUserRoleAction(token);
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('admin_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    console.error('[/api/admin-requests] Failed to fetch admin requests:', error);
    return NextResponse.json({ error: 'Failed to fetch admin requests' }, { status: 500 });
  }
}
