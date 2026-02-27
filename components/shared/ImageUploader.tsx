"use client";

import { AlertCircle, CheckCircle2, ImageIcon, RefreshCw, Upload, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import { convertToWebP, formatBytes } from "@/lib/utils/imageConvert";

export interface UploadedImage {
  url: string;
  publicId: string;
}

type UploadState =
  | { phase: "idle" }
  | { phase: "converting"; progress: number; fileName: string }
  | { phase: "uploading"; progress: number; originalSize: number; convertedSize: number }
  | { phase: "done"; url: string; publicId: string; originalSize: number; convertedSize: number }
  | { phase: "error"; message: string };

interface ImageUploaderProps {
  currentImage?: string | null;
  currentPublicId?: string | null;
  onUploaded: (image: UploadedImage) => void;
  onRemoved?: () => void;
}

export function ImageUploader({ currentImage, currentPublicId, onUploaded, onRemoved }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>(
    currentImage && currentPublicId
      ? { phase: "done", url: currentImage, publicId: currentPublicId, originalSize: 0, convertedSize: 0 }
      : { phase: "idle" }
  );
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImage ?? null);
  const uploadedPublicIdRef = useRef<string | null>(currentPublicId ?? null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setState({ phase: "error", message: "Please select an image file." });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setState({ phase: "error", message: "File is too large (max 20MB before compression)." });
      return;
    }

    setState({ phase: "converting", progress: 0, fileName: file.name });

    let convProgress = 0;
    const convInterval = setInterval(() => {
      convProgress = Math.min(convProgress + 15, 85);
      setState({ phase: "converting", progress: convProgress, fileName: file.name });
    }, 80);

    let converted;
    try {
      converted = await convertToWebP(file, 0.82, 1200);
    } catch (err) {
      clearInterval(convInterval);
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "Image conversion failed.",
      });
      return;
    }

    clearInterval(convInterval);
    setState({ phase: "converting", progress: 100, fileName: file.name });
    setPreview(converted.dataUrl);

    await new Promise((r) => setTimeout(r, 250));

    setState({
      phase: "uploading",
      progress: 0,
      originalSize: converted.originalSize,
      convertedSize: converted.convertedSize,
    });

    try {
      const oldPublicId = uploadedPublicIdRef.current;
      if (oldPublicId) {
        await fetch("/api/products/delete-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicId: oldPublicId }),
        });
      }

      const formData = new FormData();
      formData.append("file", converted.blob, "product.webp");

      const uploadResult = await new Promise<{ url: string; publicId: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setState((prev) =>
              prev.phase === "uploading" ? { ...prev, progress: pct } : prev
            );
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              if (data.success) resolve({ url: data.url, publicId: data.publicId });
              else reject(new Error(data.error ?? "Upload failed"));
            } catch {
              reject(new Error("Invalid server response"));
            }
          } else {
            try {
              const data = JSON.parse(xhr.responseText);
              reject(new Error(data.error ?? `Server error ${xhr.status}`));
            } catch {
              reject(new Error(`Server error ${xhr.status}`));
            }
          }
        });

        xhr.addEventListener("error", () => reject(new Error("Network error")));
        xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

        xhr.open("POST", "/api/products/upload-image");
        xhr.send(formData);
      });

      uploadedPublicIdRef.current = uploadResult.publicId;
      setState({
        phase: "done",
        url: uploadResult.url,
        publicId: uploadResult.publicId,
        originalSize: converted.originalSize,
        convertedSize: converted.convertedSize,
      });

      setPreview(uploadResult.url);
      onUploaded({ url: uploadResult.url, publicId: uploadResult.publicId });
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "Upload failed. Please try again.",
      });
    }
  }, [onUploaded]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const handleRemove = async () => {
    const publicIdToDelete = state.phase === "done" ? state.publicId : uploadedPublicIdRef.current;

    if (publicIdToDelete) {
      await fetch("/api/products/delete-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId: publicIdToDelete }),
      });
    }

    uploadedPublicIdRef.current = null;
    setState({ phase: "idle" });
    setPreview(null);
    onRemoved?.();
  };

  const retry = () => {
    setState({ phase: "idle" });
    inputRef.current?.click();
  };

  const isProcessing = state.phase === "converting" || state.phase === "uploading";

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
        aria-label="Upload product image"
      />

      <div
        onClick={() => !isProcessing && !preview && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!isProcessing) setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative w-full aspect-video rounded-xl overflow-hidden border-2 transition-all duration-200 ${preview ? "border-slate-200 bg-slate-100" : isDragging ? "border-emerald-500 bg-emerald-50 cursor-copy" : "border-dashed border-slate-300 bg-slate-50 hover:border-emerald-400 hover:bg-emerald-50 cursor-pointer"} ${isProcessing ? "cursor-wait" : ""}`}
      >
        {preview && (
          <Image
            src={preview}
            alt="Product preview"
            fill
            className="object-cover"
            unoptimized={preview.startsWith("data:")}
          />
        )}

        {!preview && state.phase === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
              <ImageIcon className="h-7 w-7" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-600">{isDragging ? "Drop image here" : "Upload product image"}</p>
              <p className="mt-0.5 text-xs text-slate-400">JPG, PNG, WEBP, HEIC - Auto-converted to WebP</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">
              <Upload className="h-3.5 w-3.5" />
              Browse files
            </div>
          </div>
        )}

        {state.phase === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-red-50/95 p-4 text-center">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <p className="text-sm font-semibold text-red-700">Upload failed</p>
            <p className="text-xs text-red-500">{state.message}</p>
            <button
              onClick={(e) => { e.stopPropagation(); retry(); }}
              className="flex items-center gap-1.5 rounded-lg bg-white border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        )}

        {isProcessing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60 backdrop-blur-sm p-4">
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${state.phase === "converting" ? "bg-amber-400 text-amber-900" : "bg-emerald-500 text-white"}`}>
                {state.phase === "uploading" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                )}
                Convert to WebP
              </div>

              <div className={`h-px w-4 ${state.phase === "uploading" ? "bg-emerald-500" : "bg-white/30"}`} />

              <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${state.phase === "uploading" ? "bg-emerald-500 text-white" : "bg-white/20 text-white/60"}`}>
                {state.phase === "uploading" && (
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                )}
                Upload to Cloud
              </div>
            </div>

            <div className="w-full max-w-[240px]">
              <div className="h-1.5 w-full rounded-full bg-white/20 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${state.phase === "uploading" ? "bg-emerald-400" : "bg-amber-400"}`}
                  style={{ width: `${state.phase === "converting" || state.phase === "uploading" ? state.progress : 0}%` }}
                />
              </div>
              <p className="mt-1.5 text-center text-xs font-bold text-white">
                {state.phase === "converting" ? `Converting... ${state.progress}%` : `Uploading... ${state.progress}%`}
              </p>
            </div>

            {state.phase === "uploading" && (
              <div className="rounded-lg bg-white/10 px-4 py-2 text-center text-xs text-white/80">
                <span className="line-through text-white/50">{formatBytes(state.originalSize)}</span>
                {" -> "}
                <span className="font-semibold text-emerald-300">{formatBytes(state.convertedSize)} WebP</span>
                {" · "}
                <span className="text-white/70">
                  {Math.max(0, Math.round((1 - state.convertedSize / Math.max(1, state.originalSize)) * 100))}% smaller
                </span>
              </div>
            )}
          </div>
        )}

        {state.phase === "done" && state.originalSize > 0 && (
          <div className="absolute bottom-2 right-2">
            <div className="flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-sm px-2.5 py-1 text-[10px] font-semibold text-white">
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              {formatBytes(state.convertedSize)} WebP
              {" · "}
              {Math.max(0, Math.round((1 - state.convertedSize / Math.max(1, state.originalSize)) * 100))}% saved
            </div>
          </div>
        )}

        {preview && !isProcessing && (
          <button
            aria-label="Remove image"
            onClick={(e) => { e.stopPropagation(); void handleRemove(); }}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-red-600/90 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {preview && !isProcessing && state.phase !== "idle" && (
          <button
            onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
            className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg bg-black/60 backdrop-blur-sm px-2.5 py-1.5 text-xs font-medium text-white hover:bg-black/80 transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            Replace
          </button>
        )}
      </div>

      {state.phase === "done" && state.originalSize > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <p className="text-xs text-emerald-700">
            <span className="font-semibold">Image saved.</span>{" "}
            {formatBytes(state.originalSize)} -&gt; {formatBytes(state.convertedSize)} WebP{" "}
            <span className="font-semibold text-emerald-600">
              ({Math.max(0, Math.round((1 - state.convertedSize / Math.max(1, state.originalSize)) * 100))}% smaller)
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
