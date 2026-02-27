"use client";

import Image from "next/image";
import { ImageIcon, MoreVertical, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { ImageUploader, type UploadedImage } from "@/components/shared/ImageUploader";
import { useToast } from "@/components/shared/Toast";
import type { Product } from "@/lib/types";

type DBProduct = {
  id: string;
  name: string;
  category: Product["category"];
  price: number | string;
  description: string | null;
  tags: string[] | null;
  is_best_seller: boolean;
  image_url: string | null;
  image_public_id: string | null;
  sort_order: number;
};

function mapDbToProduct(p: DBProduct): Product {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    price: Number(p.price),
    description: p.description ?? "",
    tags: p.tags ?? [],
    isBestSeller: p.is_best_seller,
    imageUrl: p.image_url ?? undefined,
    imagePublicId: p.image_public_id ?? undefined,
  };
}

export default function ProductsPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"All" | Product["category"]>("All");
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    void fetch("/api/admin/products")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to load products");
        }
        return data.products as DBProduct[];
      })
      .then((items) => {
        setProducts(items.map(mapDbToProduct));
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Failed to load products";
        toast({ type: "error", title: "Load failed", message });
      })
      .finally(() => setLoadingProducts(false));
  }, [toast]);

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        const hit = p.name.toLowerCase().includes(query.toLowerCase());
        const fit = category === "All" ? true : p.category === category;
        return hit && fit;
      }),
    [products, query, category]
  );

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <label className="relative block w-full md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search product"
              className="h-11 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-[16px]"
            />
          </label>
          <button
            onClick={() => {
              setEditing(null);
              setShowModal(true);
            }}
            className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800 active:scale-95"
          >
            Add Product
          </button>
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {(["All", "Kakanin", "Suman", "Party Trays"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={`min-h-11 whitespace-nowrap rounded-full px-4 text-xs font-medium ${
                category === item ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      {loadingProducts ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-slate-100 animate-pulse aspect-[3/4]" />
          ))}
        </div>
      ) : (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onEdit={() => {
                setEditing(product);
                setShowModal(true);
              }}
              onDelete={() => setDeleting(product)}
            />
          ))}
        </section>
      )}

      {showModal ? (
        <ProductFormModal
          product={editing}
          onClose={() => setShowModal(false)}
          onSubmit={(payload) => {
            setProducts((prev) => {
              const existing = prev.some((p) => p.id === payload.id);
              if (existing) return prev.map((p) => (p.id === payload.id ? payload : p));
              return [payload, ...prev];
            });
            setShowModal(false);
            toast({ type: "success", title: "Product saved" });
          }}
        />
      ) : null}

      <ConfirmModal
        isOpen={Boolean(deleting)}
        title="Delete product"
        message={deleting ? `Delete ${deleting.name}?` : "Delete this product?"}
        confirmLabel="Delete"
        isDestructive
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;

          if (deleting.imagePublicId) {
            await fetch("/api/products/delete-image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ publicId: deleting.imagePublicId }),
            });
          }

          const res = await fetch(`/api/admin/products/${deleting.id}`, { method: "DELETE" });
          const payload = await res.json();
          if (!res.ok) {
            toast({ type: "error", title: "Delete failed", message: payload.error ?? "Delete failed" });
          } else {
            setProducts((prev) => prev.filter((p) => p.id !== deleting.id));
            toast({ type: "info", title: "Product removed" });
          }

          setDeleting(null);
        }}
      />
    </div>
  );
}

function ProductCard({ product, onEdit, onDelete }: { product: Product; onEdit: () => void; onDelete: () => void }) {
  const [openMenu, setOpenMenu] = useState(false);
  return (
    <article className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
      <div className="relative aspect-square bg-slate-100">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <ImageIcon className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-slate-300" />
        )}
        <button
          aria-label="Open product actions"
          onClick={() => setOpenMenu((v) => !v)}
          className="absolute right-2 top-2 flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-white/90 md:hidden"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {openMenu ? (
          <div className="absolute right-2 top-14 rounded-lg border border-slate-100 bg-white shadow-lg md:hidden">
            <button onClick={onEdit} className="block min-h-11 w-full px-3 text-left text-sm">
              Edit
            </button>
            <button onClick={onDelete} className="block min-h-11 w-full px-3 text-left text-sm text-red-600">
              Delete
            </button>
          </div>
        ) : null}
      </div>
      <div className="p-2.5 md:p-3">
        <p className="line-clamp-2 text-xs font-semibold text-slate-900 md:text-sm">{product.name}</p>
        <p className="mt-1 text-sm font-bold text-emerald-700 md:text-base">PHP {product.price.toLocaleString()}</p>
        <span className="mt-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700 md:text-xs">{product.category}</span>
        <div className="mt-2 hidden gap-2 md:flex">
          <button onClick={onEdit} className="min-h-11 flex-1 rounded-lg border border-slate-200 px-2 text-xs">
            Edit
          </button>
          <button onClick={onDelete} className="min-h-11 flex-1 rounded-lg bg-red-600 px-2 text-xs text-white">
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

function ProductFormModal({
  product,
  onClose,
  onSubmit,
}: {
  product: Product | null;
  onClose: () => void;
  onSubmit: (p: Product) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState<Product["category"]>(product?.category ?? "Kakanin");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [tags, setTags] = useState(product?.tags.join(", ") ?? "");
  const [isBestSeller, setIsBestSeller] = useState(product?.isBestSeller ?? false);
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(
    product?.imageUrl ? { url: product.imageUrl, publicId: product.imagePublicId ?? "" } : null
  );
  const [imageRemoved, setImageRemoved] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (name.trim().length < 3) {
      toast({ type: "error", title: "Validation", message: "Product name must be at least 3 characters." });
      return;
    }
    if (description.trim().length < 10) {
      toast({ type: "error", title: "Validation", message: "Description must be at least 10 characters." });
      return;
    }
    if (Number(price) < 1) {
      toast({ type: "error", title: "Validation", message: "Price must be greater than 0." });
      return;
    }

    const imageUrl = imageRemoved ? null : uploadedImage?.url ?? product?.imageUrl ?? null;
    const imagePublicId = imageRemoved ? null : uploadedImage?.publicId ?? product?.imagePublicId ?? null;

    const payload = {
      name: name.trim(),
      category,
      price: Number(price),
      description: description.trim(),
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      is_best_seller: isBestSeller,
      image_url: imageUrl,
      image_public_id: imagePublicId,
      is_available: true,
    };

    if (product) {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) {
        toast({ type: "error", title: "Save failed", message: result.error ?? "Update failed" });
        return;
      }

      const updated = mapDbToProduct(result.product as DBProduct);
      onSubmit({
        ...updated,
      });
      return;
    }

    const res = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok || !result.product) {
      toast({ type: "error", title: "Save failed", message: result.error ?? "Unknown error" });
      return;
    }

    const created = mapDbToProduct(result.product as DBProduct);
    onSubmit(created);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await save();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 h-[90vh] rounded-t-2xl bg-white sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <h2 className="text-base font-semibold">{product ? "Edit Product" : "Add Product"}</h2>
          <button aria-label="Close product form" onClick={onClose} className="min-h-11 min-w-11 rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="h-[calc(90vh-130px)] overflow-y-auto p-4 sm:h-auto">
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Product Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[16px]" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value as Product["category"])} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[16px]">
                <option>Kakanin</option>
                <option>Suman</option>
                <option>Party Trays</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Price</span>
              <input type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[16px]" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Description</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-24 w-full rounded-lg border border-slate-200 p-3 text-[16px]" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Tags</span>
              <input value={tags} onChange={(e) => setTags(e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[16px]" />
            </label>
            <label className="flex min-h-11 items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
              <span className="text-sm">Best Seller</span>
              <input checked={isBestSeller} onChange={(e) => setIsBestSeller(e.target.checked)} type="checkbox" className="h-4 w-4" />
            </label>
            <div>
              <span className="mb-1 block text-sm font-medium text-slate-700">Product Image</span>
              <ImageUploader
                currentImage={product?.imageUrl ?? null}
                currentPublicId={product?.imagePublicId ?? null}
                onUploaded={(img) => {
                  setUploadedImage(img);
                  setImageRemoved(false);
                }}
                onRemoved={() => {
                  setUploadedImage(null);
                  setImageRemoved(true);
                }}
              />
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 border-t border-slate-100 bg-white p-4 sm:static">
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="min-h-11 w-full rounded-lg bg-emerald-700 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save Product"}
          </button>
        </div>
      </div>
    </div>
  );
}
