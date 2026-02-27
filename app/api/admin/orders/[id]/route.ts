import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/adminAuth';
import { createServiceClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const payload: Record<string, unknown> = {};

    if (typeof body.status === 'string') payload.status = body.status;
    if (typeof body.adminNote === 'string') payload.admin_note = body.adminNote;

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('orders')
      .update(payload)
      .eq('id', id)
      .select('id, status, admin_note')
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? 'Update failed' }, { status: 500 });
    }

    return NextResponse.json({
      order: {
        id: data.id,
        status: data.status,
        adminNote: data.admin_note,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }
}
