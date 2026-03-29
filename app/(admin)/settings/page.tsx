"use client";

import Image from "next/image";
import { Eye, EyeOff, QrCode, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/shared/Toast";
import {
  getDefaultRewardSettings,
  getDefaultStoreSettings,
  type RewardSettingsForm,
  type StoreSettingsForm,
} from "@/lib/rewards";

type SettingsResponse = {
  storeSettings?: StoreSettingsForm & { id?: string | null };
  rewardSettings?: RewardSettingsForm & { id?: string | null };
  error?: string;
};

type WalletProviderKey = "gcash" | "maya";

export default function SettingsPage() {
  const { toast } = useToast();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [storeSettings, setStoreSettings] = useState<StoreSettingsForm>(getDefaultStoreSettings());
  const [rewardSettings, setRewardSettings] = useState<RewardSettingsForm>(getDefaultRewardSettings());
  const [loading, setLoading] = useState(true);
  const [savingStore, setSavingStore] = useState(false);
  const [savingRewards, setSavingRewards] = useState(false);
  const [uploadingWalletQr, setUploadingWalletQr] = useState<Record<WalletProviderKey, boolean>>({
    gcash: false,
    maya: false,
  });

  useEffect(() => {
    const loadSettings = async () => {
      const response = await fetch("/api/admin/settings", { cache: "no-store" });
      const body = (await response.json()) as SettingsResponse;

      if (!response.ok) {
        toast({
          type: "error",
          title: "Load failed",
          message: body.error ?? "Unable to fetch settings.",
        });
        setLoading(false);
        return;
      }

      if (body.storeSettings) {
        setStoreSettings(body.storeSettings);
      }
      if (body.rewardSettings) {
        setRewardSettings(body.rewardSettings);
      }
      setLoading(false);
    };

    void loadSettings();
  }, [toast]);

  const saveSettings = async (mode: "store" | "rewards") => {
    if (mode === "store") {
      setSavingStore(true);
    } else {
      setSavingRewards(true);
    }

    const response = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeSettings,
        rewardSettings,
      }),
    });

    const body = (await response.json()) as { error?: string };

    if (!response.ok) {
      toast({
        type: "error",
        title: "Save failed",
        message: body.error ?? "Unable to save settings.",
      });
    } else {
      toast({
        type: "success",
        title: mode === "store" ? "Store settings saved" : "Reward settings saved",
      });
    }

    if (mode === "store") {
      setSavingStore(false);
    } else {
      setSavingRewards(false);
    }
  };

  const uploadWalletQr = async (provider: WalletProviderKey, file: File) => {
    setUploadingWalletQr((prev) => ({ ...prev, [provider]: true }));

    const formData = new FormData();
    formData.append("file", file);
    formData.append("provider", provider);

    const previousPublicId = provider === "gcash" ? storeSettings.gcashQrPublicId : storeSettings.mayaQrPublicId;
    if (previousPublicId) {
      formData.append("previousPublicId", previousPublicId);
    }

    try {
      const response = await fetch("/api/admin/settings/upload-payment-qr", {
        method: "POST",
        body: formData,
      });

      const body = (await response.json()) as {
        error?: string;
        url?: string;
        publicId?: string;
      };

      if (!response.ok || !body.url || !body.publicId) {
        throw new Error(body.error ?? "Unable to upload QR image.");
      }

      setStoreSettings((prev) =>
        provider === "gcash"
          ? {
              ...prev,
              gcashQrUrl: body.url ?? "",
              gcashQrPublicId: body.publicId ?? "",
            }
          : {
              ...prev,
              mayaQrUrl: body.url ?? "",
              mayaQrPublicId: body.publicId ?? "",
            }
      );

      toast({
        type: "success",
        title: `${provider === "gcash" ? "GCash" : "Maya"} QR uploaded`,
        message: "Save store settings to publish this QR in the ordering system.",
      });
    } catch (error) {
      toast({
        type: "error",
        title: "Upload failed",
        message: error instanceof Error ? error.message : "Unable to upload QR image.",
      });
    } finally {
      setUploadingWalletQr((prev) => ({ ...prev, [provider]: false }));
    }
  };

  const clearWalletQr = (provider: WalletProviderKey) => {
    setStoreSettings((prev) =>
      provider === "gcash"
        ? { ...prev, gcashQrUrl: "", gcashQrPublicId: "" }
        : { ...prev, mayaQrUrl: "", mayaQrPublicId: "" }
    );
  };

  const activeSeasonalMonths = useMemo(
    () =>
      rewardSettings.seasonalRules
        .map((rule) => `${rule.label}: ${rule.months.join(", ")}`)
        .join(" | "),
    [rewardSettings.seasonalRules]
  );

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <Section title="Store Info" onSave={() => void saveSettings("store")} saving={savingStore}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field id="store-name" label="Store name">
            <input
              id="store-name"
              value={storeSettings.storeName}
              onChange={(event) => setStoreSettings((prev) => ({ ...prev, storeName: event.target.value }))}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[16px]"
            />
          </Field>
          <Field id="store-phone" label="Contact number">
            <input
              id="store-phone"
              value={storeSettings.contactNumber}
              onChange={(event) => setStoreSettings((prev) => ({ ...prev, contactNumber: event.target.value }))}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[16px]"
            />
          </Field>
          <Field id="store-address" label="Address" wide>
            <input
              id="store-address"
              value={storeSettings.storeAddress}
              onChange={(event) => setStoreSettings((prev) => ({ ...prev, storeAddress: event.target.value }))}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[16px]"
            />
          </Field>
          <Field id="fee" label="Delivery fee (PHP)">
            <input
              id="fee"
              type="number"
              value={storeSettings.deliveryFee}
              onChange={(event) => setStoreSettings((prev) => ({ ...prev, deliveryFee: Number(event.target.value) }))}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[16px]"
            />
          </Field>
          <Field id="notice" label="Advance notice days">
            <input
              id="notice"
              type="number"
              value={storeSettings.advanceNoticeDays}
              onChange={(event) =>
                setStoreSettings((prev) => ({ ...prev, advanceNoticeDays: Number(event.target.value) }))
              }
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[16px]"
            />
          </Field>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-slate-900">Wallet Payment Settings</h3>
            <p className="text-sm text-slate-500">
              These account details and QR images appear in the customer&apos;s Scan to Pay modal.
            </p>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <WalletQrCard
              providerLabel="GCash"
              accountName={storeSettings.gcashAccountName}
              accountNumber={storeSettings.gcashAccountNumber}
              qrUrl={storeSettings.gcashQrUrl}
              uploading={uploadingWalletQr.gcash}
              onAccountNameChange={(value) => setStoreSettings((prev) => ({ ...prev, gcashAccountName: value }))}
              onAccountNumberChange={(value) => setStoreSettings((prev) => ({ ...prev, gcashAccountNumber: value }))}
              onUpload={(file) => void uploadWalletQr("gcash", file)}
              onClear={() => clearWalletQr("gcash")}
            />

            <WalletQrCard
              providerLabel="Maya"
              accountName={storeSettings.mayaAccountName}
              accountNumber={storeSettings.mayaAccountNumber}
              qrUrl={storeSettings.mayaQrUrl}
              uploading={uploadingWalletQr.maya}
              onAccountNameChange={(value) => setStoreSettings((prev) => ({ ...prev, mayaAccountName: value }))}
              onAccountNumberChange={(value) => setStoreSettings((prev) => ({ ...prev, mayaAccountNumber: value }))}
              onUpload={(file) => void uploadWalletQr("maya", file)}
              onClear={() => clearWalletQr("maya")}
            />
          </div>
        </div>
      </Section>

      <Section title="Voucher Controls" onSave={() => void saveSettings("rewards")} saving={savingRewards}>
        <Toggle
          label="Enable rewards program"
          checked={rewardSettings.rewardsEnabled}
          onChange={(checked) => setRewardSettings((prev) => ({ ...prev, rewardsEnabled: checked }))}
        />
        <div className="grid gap-3 md:grid-cols-2">
          <Field id="welcome-enabled" label="First order voucher">
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
              <input
                id="welcome-enabled"
                type="checkbox"
                checked={rewardSettings.welcomeVoucherEnabled}
                onChange={(event) =>
                  setRewardSettings((prev) => ({ ...prev, welcomeVoucherEnabled: event.target.checked }))
                }
                className="h-4 w-4"
              />
              <span className="text-sm text-slate-700">Enabled</span>
            </div>
          </Field>
          <Field id="welcome-percent" label="First order percent off">
            <input
              id="welcome-percent"
              type="number"
              value={rewardSettings.welcomeVoucherPercent}
              onChange={(event) =>
                setRewardSettings((prev) => ({ ...prev, welcomeVoucherPercent: Number(event.target.value) }))
              }
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[16px]"
            />
          </Field>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="grid grid-cols-[1.3fr_1fr_1fr_0.8fr] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Order value rule</span>
            <span>Min order</span>
            <span>Percent off</span>
            <span>Free ship</span>
          </div>
          {rewardSettings.orderValueRules.map((rule, index) => (
            <div key={rule.id} className="grid grid-cols-[1.3fr_1fr_1fr_0.8fr] gap-3 border-t border-slate-100 px-4 py-3">
              <div>
                <input
                  value={rule.label}
                  onChange={(event) =>
                    setRewardSettings((prev) => ({
                      ...prev,
                      orderValueRules: prev.orderValueRules.map((entry, ruleIndex) =>
                        ruleIndex === index ? { ...entry, label: event.target.value } : entry
                      ),
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                />
              </div>
              <input
                type="number"
                value={rule.minOrderAmount}
                onChange={(event) =>
                  setRewardSettings((prev) => ({
                    ...prev,
                    orderValueRules: prev.orderValueRules.map((entry, ruleIndex) =>
                      ruleIndex === index ? { ...entry, minOrderAmount: Number(event.target.value) } : entry
                    ),
                  }))
                }
                className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
              />
              <input
                type="number"
                value={rule.percentOff ?? 0}
                onChange={(event) =>
                  setRewardSettings((prev) => ({
                    ...prev,
                    orderValueRules: prev.orderValueRules.map((entry, ruleIndex) =>
                      ruleIndex === index ? { ...entry, percentOff: Number(event.target.value) || null } : entry
                    ),
                  }))
                }
                className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
              />
              <label className="flex items-center justify-center rounded-lg border border-slate-200">
                <input
                  type="checkbox"
                  checked={rule.freeShipping}
                  onChange={(event) =>
                    setRewardSettings((prev) => ({
                      ...prev,
                      orderValueRules: prev.orderValueRules.map((entry, ruleIndex) =>
                        ruleIndex === index ? { ...entry, freeShipping: event.target.checked } : entry
                      ),
                    }))
                  }
                  className="h-4 w-4"
                />
              </label>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Seasonal promos: {activeSeasonalMonths}
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="grid grid-cols-[1.4fr_1fr_1fr_0.8fr] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Seasonal promo</span>
            <span>Months</span>
            <span>Percent off</span>
            <span>Active</span>
          </div>
          {rewardSettings.seasonalRules.map((rule, index) => (
            <div key={rule.id} className="grid grid-cols-[1.4fr_1fr_1fr_0.8fr] gap-3 border-t border-slate-100 px-4 py-3">
              <div className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800">{rule.label}</div>
              <input
                type="text"
                value={rule.months.join(",")}
                onChange={(event) =>
                  setRewardSettings((prev) => ({
                    ...prev,
                    seasonalRules: prev.seasonalRules.map((entry, ruleIndex) =>
                      ruleIndex === index
                        ? {
                            ...entry,
                            months: event.target.value
                              .split(",")
                              .map((value) => Number(value.trim()))
                              .filter((value) => Number.isFinite(value) && value >= 1 && value <= 12),
                          }
                        : entry
                    ),
                  }))
                }
                className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
              />
              <input
                type="number"
                value={rule.percentOff ?? 0}
                onChange={(event) =>
                  setRewardSettings((prev) => ({
                    ...prev,
                    seasonalRules: prev.seasonalRules.map((entry, ruleIndex) =>
                      ruleIndex === index ? { ...entry, percentOff: Number(event.target.value) || null } : entry
                    ),
                  }))
                }
                className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
              />
              <label className="flex items-center justify-center rounded-lg border border-slate-200">
                <input
                  type="checkbox"
                  checked={rule.isActive}
                  onChange={(event) =>
                    setRewardSettings((prev) => ({
                      ...prev,
                      seasonalRules: prev.seasonalRules.map((entry, ruleIndex) =>
                        ruleIndex === index ? { ...entry, isActive: event.target.checked } : entry
                      ),
                    }))
                  }
                  className="h-4 w-4"
                />
              </label>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Loyalty & Bonus Controls" onSave={() => void saveSettings("rewards")} saving={savingRewards}>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Loyalty tier</span>
            <span>Minimum points</span>
            <span>Percent off</span>
            <span>Free shipping</span>
          </div>
          {rewardSettings.loyaltyTiers.map((tier, index) => (
            <div key={tier.id} className="grid grid-cols-[1.3fr_1fr_1fr_1fr] gap-3 border-t border-slate-100 px-4 py-3">
              <div className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800">{tier.name}</div>
              <input
                type="number"
                value={tier.minPoints}
                onChange={(event) =>
                  setRewardSettings((prev) => ({
                    ...prev,
                    loyaltyTiers: prev.loyaltyTiers.map((entry, tierIndex) =>
                      tierIndex === index ? { ...entry, minPoints: Number(event.target.value) } : entry
                    ),
                  }))
                }
                className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
              />
              <input
                type="number"
                value={tier.percentOff}
                onChange={(event) =>
                  setRewardSettings((prev) => ({
                    ...prev,
                    loyaltyTiers: prev.loyaltyTiers.map((entry, tierIndex) =>
                      tierIndex === index ? { ...entry, percentOff: Number(event.target.value) } : entry
                    ),
                  }))
                }
                className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
              />
              <input
                type="text"
                value={tier.freeShippingAlways ? "Always" : tier.monthlyFreeShippingLimit ?? 0}
                onChange={(event) => {
                  const value = event.target.value.trim().toLowerCase();
                  setRewardSettings((prev) => ({
                    ...prev,
                    loyaltyTiers: prev.loyaltyTiers.map((entry, tierIndex) =>
                      tierIndex === index
                        ? {
                            ...entry,
                            freeShippingAlways: value === "always",
                            monthlyFreeShippingLimit: value === "always" ? null : Number(value) || null,
                          }
                        : entry
                    ),
                  }));
                }}
                className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
              />
            </div>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Field id="review-points" label="Review bonus points">
            <input
              id="review-points"
              type="number"
              value={rewardSettings.reviewPoints}
              onChange={(event) =>
                setRewardSettings((prev) => ({ ...prev, reviewPoints: Number(event.target.value) }))
              }
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[16px]"
            />
          </Field>
          <Field id="first-order-points" label="First order of month bonus">
            <input
              id="first-order-points"
              type="number"
              value={rewardSettings.firstOrderOfMonthPoints}
              onChange={(event) =>
                setRewardSettings((prev) => ({ ...prev, firstOrderOfMonthPoints: Number(event.target.value) }))
              }
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[16px]"
            />
          </Field>
          <Field id="rankup-percent" label="Rank-up voucher percent">
            <input
              id="rankup-percent"
              type="number"
              value={rewardSettings.rankUpVoucherPercent}
              onChange={(event) =>
                setRewardSettings((prev) => ({ ...prev, rankUpVoucherPercent: Number(event.target.value) }))
              }
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[16px]"
            />
          </Field>
          <Field id="comeback-percent" label="Comeback voucher percent">
            <input
              id="comeback-percent"
              type="number"
              value={rewardSettings.comebackVoucherPercent}
              onChange={(event) =>
                setRewardSettings((prev) => ({ ...prev, comebackVoucherPercent: Number(event.target.value) }))
              }
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[16px]"
            />
          </Field>
          <Field id="comeback-days" label="Inactive days before comeback">
            <input
              id="comeback-days"
              type="number"
              value={rewardSettings.comebackInactiveDays}
              onChange={(event) =>
                setRewardSettings((prev) => ({ ...prev, comebackInactiveDays: Number(event.target.value) }))
              }
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[16px]"
            />
          </Field>
          <Field id="streak-percent" label="Streak reward percent">
            <input
              id="streak-percent"
              type="number"
              value={rewardSettings.streakRewardPercent}
              onChange={(event) =>
                setRewardSettings((prev) => ({ ...prev, streakRewardPercent: Number(event.target.value) }))
              }
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[16px]"
            />
          </Field>
          <Field id="double-multiplier" label="Double points multiplier">
            <input
              id="double-multiplier"
              type="number"
              value={rewardSettings.doublePointsMultiplier}
              onChange={(event) =>
                setRewardSettings((prev) => ({ ...prev, doublePointsMultiplier: Number(event.target.value) }))
              }
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[16px]"
            />
          </Field>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Field id="double-start" label="Double points starts at">
            <input
              id="double-start"
              type="datetime-local"
              value={rewardSettings.doublePointsStartsAt ? rewardSettings.doublePointsStartsAt.slice(0, 16) : ""}
              onChange={(event) =>
                setRewardSettings((prev) => ({
                  ...prev,
                  doublePointsStartsAt: event.target.value ? new Date(event.target.value).toISOString() : null,
                }))
              }
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[16px]"
            />
          </Field>
          <Field id="double-end" label="Double points ends at">
            <input
              id="double-end"
              type="datetime-local"
              value={rewardSettings.doublePointsEndsAt ? rewardSettings.doublePointsEndsAt.slice(0, 16) : ""}
              onChange={(event) =>
                setRewardSettings((prev) => ({
                  ...prev,
                  doublePointsEndsAt: event.target.value ? new Date(event.target.value).toISOString() : null,
                }))
              }
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[16px]"
            />
          </Field>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Toggle
            label="Enable comeback vouchers"
            checked={rewardSettings.comebackEnabled}
            onChange={(checked) => setRewardSettings((prev) => ({ ...prev, comebackEnabled: checked }))}
          />
          <Toggle
            label="Enable streak vouchers"
            checked={rewardSettings.streakEnabled}
            onChange={(checked) => setRewardSettings((prev) => ({ ...prev, streakEnabled: checked }))}
          />
          <Toggle
            label="Enable double points day"
            checked={rewardSettings.doublePointsEnabled}
            onChange={(checked) => setRewardSettings((prev) => ({ ...prev, doublePointsEnabled: checked }))}
          />
          <Toggle
            label="Enable loot spin flag"
            checked={rewardSettings.lootSpinEnabled}
            onChange={(checked) => setRewardSettings((prev) => ({ ...prev, lootSpinEnabled: checked }))}
          />
        </div>
      </Section>

      <Section title="Admin Account" onSave={() => {
        if (!currentPassword || !newPassword || !confirmPassword) {
          toast({ type: "error", title: "Validation", message: "All password fields are required." });
          return;
        }
        if (newPassword.length < 8) {
          toast({ type: "error", title: "Validation", message: "New password must be at least 8 characters." });
          return;
        }
        if (newPassword !== confirmPassword) {
          toast({ type: "error", title: "Validation", message: "Passwords do not match." });
          return;
        }
        toast({ type: "success", title: "Account updated" });
      }}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field id="admin-name" label="Name"><input id="admin-name" defaultValue="Admin" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[16px]" /></Field>
          <Field id="admin-email" label="Email"><input id="admin-email" defaultValue="admin@ateaikitchen.com" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[16px]" /></Field>
        </div>
        <PasswordField id="current-pass" label="Current password" value={currentPassword} onChange={setCurrentPassword} visible={showCurrent} toggle={() => setShowCurrent((v) => !v)} />
        <PasswordField id="new-pass" label="New password" value={newPassword} onChange={setNewPassword} visible={showNew} toggle={() => setShowNew((v) => !v)} />
        <PasswordField id="confirm-pass" label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} visible={showConfirm} toggle={() => setShowConfirm((v) => !v)} />
      </Section>

      <section className="rounded-xl bg-white p-4 shadow-sm md:p-6">
        <h2 className="mb-4 text-base font-semibold text-slate-900">Danger Zone</h2>
        <button disabled title="Coming soon" className="h-10 cursor-not-allowed rounded-lg bg-slate-200 px-4 text-sm text-slate-500">Reset All Orders</button>
      </section>
    </div>
  );
}

function Section({
  title,
  children,
  onSave,
  saving = false,
}: {
  title: string;
  children: React.ReactNode;
  onSave: () => void;
  saving?: boolean;
}) {
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm md:p-6">
      <h2 className="mb-4 text-base font-semibold text-slate-900">{title}</h2>
      <div className="space-y-3">{children}</div>
      <button
        onClick={onSave}
        disabled={saving}
        className="mt-4 min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </section>
  );
}

function Field({ id, label, children, wide }: { id: string; label: string; children: React.ReactNode; wide?: boolean }) {
  return <label htmlFor={id} className={`block ${wide ? "md:col-span-2" : ""}`}><span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>{children}</label>;
}

function PasswordField({ id, label, value, onChange, visible, toggle }: { id: string; label: string; value: string; onChange: (v: string) => void; visible: boolean; toggle: () => void }) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <div className="relative">
        <input id={id} type={visible ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 px-3 pr-10 text-[16px]" />
        <button type="button" aria-label="Toggle password visibility" onClick={toggle} className="absolute right-1 top-1 min-h-8 min-w-8 rounded-md p-1">{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
      </div>
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
      <span className="text-sm text-slate-700">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4" />
    </label>
  );
}

function WalletQrCard({
  providerLabel,
  accountName,
  accountNumber,
  qrUrl,
  uploading,
  onAccountNameChange,
  onAccountNumberChange,
  onUpload,
  onClear,
}: {
  providerLabel: string;
  accountName: string;
  accountNumber: string;
  qrUrl: string;
  uploading: boolean;
  onAccountNameChange: (value: string) => void;
  onAccountNumberChange: (value: string) => void;
  onUpload: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{providerLabel}</p>
          <p className="text-xs text-slate-500">Shown in checkout for wallet payments.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
          {providerLabel}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Account name</span>
          <input
            value={accountName}
            onChange={(event) => onAccountNameChange(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[16px]"
            placeholder="Ate Ai's Kitchen"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Account number</span>
          <input
            value={accountNumber}
            onChange={(event) => onAccountNumberChange(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[16px]"
            placeholder="09123456789"
          />
        </label>
      </div>

      <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <div className="relative mx-auto aspect-square w-full max-w-[220px] overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {qrUrl ? (
            <Image src={qrUrl} alt={`${providerLabel} QR code`} fill className="object-contain p-3" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-400">
              <QrCode className="h-10 w-10" />
              <p className="text-xs font-medium">No QR uploaded yet</p>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-800">
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading..." : qrUrl ? "Change QR" : "Upload QR"}
            <input
              type="file"
              className="hidden"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) {
                  onUpload(file);
                }
              }}
            />
          </label>

          <button
            type="button"
            onClick={onClear}
            disabled={!qrUrl}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Remove QR
          </button>
        </div>
      </div>
    </div>
  );
}
