import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/adminAuth';

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({
    admin: {
      id: session.admin_users.id,
      username: session.admin_users.username,
      displayName: session.admin_users.display_name,
    },
  });
}
