"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { useToast } from "@/components/shared/Toast";

export default function SettingsPage() {
  const { toast } = useToast();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <Section title="Store Info" onSave={() => toast({ type: "success", title: "Store info saved" })}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field id="store-name" label="Store name"><input id="store-name" defaultValue="Ate Ai's Kitchen" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[16px]" /></Field>
          <Field id="store-phone" label="Contact number"><input id="store-phone" defaultValue="0917-888-1122" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[16px]" /></Field>
          <Field id="store-address" label="Address" wide><input id="store-address" defaultValue="Poblacion, San Pedro, Laguna" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[16px]" /></Field>
          <Field id="fee" label="Delivery fee (PHP)"><input id="fee" type="number" defaultValue={60} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[16px]" /></Field>
          <Field id="notice" label="Advance notice days"><input id="notice" type="number" defaultValue={1} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[16px]" /></Field>
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

      <Section title="Notifications" onSave={() => toast({ type: "success", title: "Notification settings saved" })}>
        <Toggle label="Email on new order" defaultChecked />
        <Toggle label="Email on new message" defaultChecked />
        <Toggle label="Browser notifications" />
      </Section>

      <section className="rounded-xl bg-white p-4 shadow-sm md:p-6">
        <h2 className="mb-4 text-base font-semibold text-slate-900">Danger Zone</h2>
        <button disabled title="Coming soon" className="h-10 cursor-not-allowed rounded-lg bg-slate-200 px-4 text-sm text-slate-500">Reset All Orders</button>
      </section>
    </div>
  );
}

function Section({ title, children, onSave }: { title: string; children: React.ReactNode; onSave: () => void }) {
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm md:p-6">
      <h2 className="mb-4 text-base font-semibold text-slate-900">{title}</h2>
      <div className="space-y-3">{children}</div>
      <button onClick={onSave} className="mt-4 min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800">Save Changes</button>
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

function Toggle({ label, defaultChecked = false }: { label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex min-h-11 items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
      <span className="text-sm text-slate-700">{label}</span>
      <input type="checkbox" defaultChecked={defaultChecked} className="h-4 w-4" />
    </label>
  );
}
