import { NextRequest, NextResponse } from 'next/server';
import cloudinary from '@/lib/cloudinary/server';
import { getAdminSession } from '@/lib/auth/adminAuth';

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { publicId } = await req.json();

    if (typeof publicId !== 'string' || publicId.trim().length === 0) {
      return NextResponse.json({ error: 'Missing publicId' }, { status: 400 });
    }

    if (!publicId.startsWith('ateai-kitchen/products/')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
    });

    return NextResponse.json({ success: true, result: result.result });
  } catch (err) {
    console.error('Cloudinary delete error:', err);
    const message =
      err && typeof err === "object" && "error" in err
        ? ((err as { error?: { message?: string } }).error?.message ?? "Delete failed")
        : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
