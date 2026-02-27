import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { destroyAdminSession } from '@/lib/auth/adminAuth';

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_session')?.value;

  if (token) {
    await destroyAdminSession(token);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete('admin_session');
  return response;
}
