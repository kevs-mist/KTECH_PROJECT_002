import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createAdminClient } from '../../../../utils/supabase/admin';
import { verifyUserRoleAction } from '../../../src/lib/actions/authActions';

function getBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization');
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
}

export async function POST(request: Request) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { role } = await verifyUserRoleAction(token);
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabase = createAdminClient();
    const { requestId, action, secretCode } = await request.json();

    if (!requestId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    if (action === 'approve') {
      if (!secretCode || String(secretCode).length < 4) {
        return NextResponse.json({ error: 'Secret code must be at least 4 characters' }, { status: 400 });
      }

      // Get the firebase_uid from the request
      const { data: requestData, error: fetchError } = await supabase
        .from('admin_requests')
        .select('firebase_uid')
        .eq('id', requestId)
        .eq('status', 'pending')
        .single();

      if (fetchError) throw fetchError;

      const hashedSecretCode = await bcrypt.hash(String(secretCode), 10);

      // Insert into admins table with secret code
      const { error: insertError } = await supabase
        .from('admins')
        .insert([
          {
            firebase_uid: requestData.firebase_uid,
            secret_code: hashedSecretCode,
            is_super_admin: false,
            last_access: new Date().toISOString()
          }
        ]);

      if (insertError) throw insertError;

      // Update user role to admin
      const { error: userUpdateError } = await supabase
        .from('users')
        .update({ role: 'admin' })
        .eq('firebase_uid', requestData.firebase_uid);

      if (userUpdateError) throw userUpdateError;

      // Update the request status to approved after all promotion steps succeed
      const { error: updateError } = await supabase
        .from('admin_requests')
        .update({ status: 'approved' })
        .eq('id', requestId);

      if (updateError) throw updateError;

    } else if (action === 'reject') {
      // Update the request status to rejected
      const { error } = await supabase
        .from('admin_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);

      if (error) throw error;
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
