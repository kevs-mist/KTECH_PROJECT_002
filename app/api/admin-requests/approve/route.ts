import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/client';

export async function POST(request: Request) {
  const supabase = createClient();
  
  try {
    const { requestId, action, secretCode } = await request.json();

    if (action === 'approve') {
      // Update the request status to approved
      const { error: updateError } = await supabase
        .from('admin_requests')
        .update({ status: 'approved' })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Get the firebase_uid from the request
      const { data: requestData, error: fetchError } = await supabase
        .from('admin_requests')
        .select('firebase_uid')
        .eq('id', requestId)
        .single();

      if (fetchError) throw fetchError;

      // Insert into admins table with secret code
      const { error: insertError } = await supabase
        .from('admins')
        .insert([
          {
            firebase_uid: requestData.firebase_uid,
            secret_code: secretCode,
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
