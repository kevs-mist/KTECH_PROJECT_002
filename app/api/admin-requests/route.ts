import { NextResponse } from 'next/server';
import { createClient } from '../../../utils/supabase/client';

export async function GET() {
  const supabase = createClient();
  
  try {
    const { data, error } = await supabase
      .from('admin_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
