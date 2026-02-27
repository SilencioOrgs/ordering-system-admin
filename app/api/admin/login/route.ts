import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createServiceClient } from '@/lib/supabase/server';
import { createAdminSession } from '@/lib/auth/adminAuth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body;

    // Input validation
    if (
      typeof username !== 'string' ||
      typeof password !== 'string' ||
      username.trim().length === 0 ||
      password.length === 0 ||
      username.length > 50 ||
      password.length > 100
    ) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Fetch admin user (service role bypasses RLS)
    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('id, username, password_hash, display_name, is_active')
      .eq('username', username.trim().toLowerCase())
      .single();

    // Use constant-time comparison to prevent timing attacks
    // Always run bcrypt even if user not found (dummy hash)
    const dummyHash = '$2a$10$7EqJtq98hPqEX7fNZaFWoOHiH6Xx/YcA2uXQ2YSmWvd9FTJMc1iG.';
    const hashToCompare = admin?.password_hash ?? dummyHash;
    const isValid = await bcrypt.compare(password, hashToCompare);

    if (error || !admin || !isValid || !admin.is_active) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Create session
    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined;
    const { token, expiresAt } = await createAdminSession(admin.id, ip ?? undefined);

    const response = NextResponse.json({
      success: true,
      admin: { id: admin.id, username: admin.username, displayName: admin.display_name },
    });

    // Set HttpOnly cookie
    response.cookies.set('admin_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('Admin login error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
