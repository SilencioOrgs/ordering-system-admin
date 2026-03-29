import { NextRequest, NextResponse } from "next/server";

import { getAdminSession } from "@/lib/auth/adminAuth";
import cloudinary from "@/lib/cloudinary/server";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const provider = formData.get("provider");
    const previousPublicId = formData.get("previousPublicId");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No QR image provided." }, { status: 400 });
    }

    if (provider !== "gcash" && provider !== "maya") {
      return NextResponse.json({ error: "Invalid payment provider." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Only PNG, JPG, and WEBP images are allowed." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "QR image is too large. Max size is 5MB." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadResult = await new Promise<{
      secure_url: string;
      public_id: string;
      width: number;
      height: number;
      bytes: number;
    }>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `ateai-kitchen/payment-qr/${provider}`,
          resource_type: "image",
          format: "png",
          use_filename: false,
          unique_filename: true,
          transformation: [{ width: 1600, height: 1600, crop: "limit" }],
        },
        (error, result) => {
          if (error || !result) {
            reject(error ?? new Error("QR upload failed."));
            return;
          }

          resolve({
            secure_url: result.secure_url,
            public_id: result.public_id,
            width: result.width,
            height: result.height,
            bytes: result.bytes,
          });
        }
      );

      uploadStream.end(buffer);
    });

    if (typeof previousPublicId === "string" && previousPublicId.trim() && previousPublicId !== uploadResult.public_id) {
      void cloudinary.uploader.destroy(previousPublicId, { resource_type: "image" }).catch(() => {
        return null;
      });
    }

    return NextResponse.json({
      success: true,
      provider,
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      width: uploadResult.width,
      height: uploadResult.height,
      bytes: uploadResult.bytes,
    });
  } catch (error) {
    console.error("Payment QR upload error:", error);

    const message =
      error && typeof error === "object" && "error" in error
        ? ((error as { error?: { message?: string } }).error?.message ?? "Failed to upload QR image.")
        : "Failed to upload QR image.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
