import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';

const SESSION_COOKIE = 'admin_session';
const SESSION_DURATION_HOURS = 8;

export async function getAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('admin_sessions')
    .select('*, admin_users(*)')
    .eq('session_token', token)
    .gt('expires_at', new Date().toISOString())
    .single();

  return data ?? null;
}

export async function createAdminSession(adminId: string, ip?: string) {
  const supabase = createServiceClient();
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

  await supabase.from('admin_sessions').insert({
    admin_id: adminId,
    session_token: token,
    expires_at: expiresAt.toISOString(),
    ip_address: ip,
  });

  await supabase
    .from('admin_users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', adminId);

  return { token, expiresAt };
}

export async function destroyAdminSession(token: string) {
  const supabase = createServiceClient();
  await supabase.from('admin_sessions').delete().eq('session_token', token);
}
