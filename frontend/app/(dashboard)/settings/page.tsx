"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Settings,
  User,
  Lock,
  Bell,
  Globe,
  Moon,
  Sun,
  Monitor,
  ChevronRight,
  Shield,
  Building2,
  Smartphone,
  Check,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { fetchMeApi, changePasswordApi } from "@/features/auth/api";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ThemeOption = "light" | "dark" | "system";

type ApiError = {
  response?: { data?: { detail?: string } };
};

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<string>("profile");
  const [theme, setTheme] = useState<ThemeOption>("system");
  const [notifs, setNotifs] = useState({ loansApproved: true, repaymentsReceived: true, systemAlerts: false, dailyDigest: true });
  const [pinForm, setPinForm] = useState({ current: "", next: "", confirm: "" });
  const [saving, setSaving] = useState(false);

  const { data: user } = useQuery({ queryKey: ["me"], queryFn: fetchMeApi });

  const passwordMutation = useMutation({
    mutationFn: (data: { current_password: string; new_password: string }) => changePasswordApi(data),
    onSuccess: () => {
      toast.success("Password updated successfully");
      setPinForm({ current: "", next: "", confirm: "" });
    },
    onError: (err: ApiError) => {
      toast.error("Could not update password", {
        description: err?.response?.data?.detail ?? "Please try again.",
      });
    },
  });

  const handleSave = (section: string) => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success(`${section} settings saved`);
    }, 700);
  };

  const sections = [
    { id: "profile", label: "My Profile", icon: User },
    { id: "security", label: "Security", icon: Lock },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "appearance", label: "Appearance", icon: Moon },
    { id: "system", label: "System Info", icon: Info },
  ];

  return (
    <div className="max-w-3xl mx-auto pb-16 select-none">

      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] shadow-sm mb-4">
        <h2 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">System Settings</h2>
        <p className="text-xs text-zinc-400 mt-0.5">Manage your profile, security and app preferences.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        {/* Sidebar nav (horizontal scroll on mobile, vertical on desktop) */}
        <div className="sm:w-52 shrink-0">
          <div className="flex sm:flex-col gap-1 overflow-x-auto sm:overflow-visible pb-1 sm:pb-0">
            {sections.map(s => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors shrink-0 cursor-pointer ${
                    activeSection === s.id
                      ? "bg-[#0D44A2] text-white shadow-sm"
                      : "bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  <Icon className="size-3.5 shrink-0" />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content panel */}
        <div className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-[20px] sm:rounded-[24px] shadow-sm p-4 sm:p-5 space-y-5">

          {/* Profile */}
          {activeSection === "profile" && (
            <>
              <div className="flex items-center gap-2 text-[#0D44A2] font-bold text-sm">
                <User className="size-4" />
                <span>My Profile</span>
              </div>
              <div className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-850/30 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <div className="size-12 rounded-full bg-[#0D44A2] text-white font-black flex items-center justify-center text-base shrink-0">
                  {user ? `${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}` : "FS"}
                </div>
                <div>
                  <p className="font-bold text-zinc-900 dark:text-zinc-100">{user?.first_name} {user?.last_name}</p>
                  <p className="text-xs text-zinc-500">{user?.employee_number || "—"}</p>
                  <p className="text-xs text-[#0D44A2] font-semibold mt-0.5">{user?.role || "Loan Officer"}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">First Name</Label>
                  <Input defaultValue={user?.first_name || ""} className="rounded-xl" readOnly />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Last Name</Label>
                  <Input defaultValue={user?.last_name || ""} className="rounded-xl" readOnly />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Employee No.</Label>
                  <Input defaultValue={user?.employee_number || ""} className="rounded-xl" readOnly />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Branch</Label>
                  <Input defaultValue={user?.branch || "Mombasa"} className="rounded-xl" readOnly />
                </div>
              </div>
              <p className="text-[10px] text-zinc-400 bg-zinc-50 dark:bg-zinc-850 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <Info className="size-3 inline mr-1" />
                Profile details can only be updated by a System Admin. Contact your administrator for changes.
              </p>
            </>
          )}

          {/* Security */}
          {activeSection === "security" && (
            <>
              <div className="flex items-center gap-2 text-[#0D44A2] font-bold text-sm">
                <Lock className="size-4" />
                <span>Security</span>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Change Password</p>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Current Password</Label>
                    <Input type="password" value={pinForm.current} onChange={e => setPinForm({...pinForm, current: e.target.value})} placeholder="••••••••" className="rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">New Password</Label>
                    <Input type="password" value={pinForm.next} onChange={e => setPinForm({...pinForm, next: e.target.value})} placeholder="••••••••" className="rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Confirm New Password</Label>
                    <Input type="password" value={pinForm.confirm} onChange={e => setPinForm({...pinForm, confirm: e.target.value})} placeholder="••••••••" className="rounded-xl" />
                  </div>
                </div>
                <Button onClick={() => {
                  if (!pinForm.current || !pinForm.next || !pinForm.confirm) { toast.error("Fill in all fields"); return; }
                  if (pinForm.next !== pinForm.confirm) { toast.error("Passwords do not match"); return; }
                  if (pinForm.next.length < 8) { toast.error("New password must be at least 8 characters"); return; }
                  passwordMutation.mutate({ current_password: pinForm.current, new_password: pinForm.next });
                }} disabled={passwordMutation.isPending} className="bg-[#0D44A2] hover:bg-[#0A3682] text-white rounded-xl h-10 text-xs font-bold">
                  Update Password
                </Button>
              </div>
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 space-y-2">
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5"><Shield className="size-3.5 text-emerald-600" />Session Security</p>
                <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50">
                  <div>
                    <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Auto-logout after 30 minutes</p>
                    <p className="text-[10px] text-zinc-400">For security on shared devices</p>
                  </div>
                  <div className="size-5 bg-emerald-500 rounded-full flex items-center justify-center shrink-0">
                    <Check className="size-3 text-white" />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Notifications */}
          {activeSection === "notifications" && (
            <>
              <div className="flex items-center gap-2 text-[#0D44A2] font-bold text-sm">
                <Bell className="size-4" />
                <span>Notification Preferences</span>
              </div>
              <div className="space-y-2">
                {[
                  { key: "loansApproved", label: "Loan Approvals", desc: "Notify when a loan application is approved" },
                  { key: "repaymentsReceived", label: "Repayments", desc: "Notify on each payment receipt" },
                  { key: "systemAlerts", label: "System Alerts", desc: "Critical system warnings and downtime" },
                  { key: "dailyDigest", label: "Daily Digest", desc: "End-of-day portfolio summary" },
                ].map(n => (
                  <label key={n.key} className="flex items-center justify-between p-3.5 rounded-2xl border border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700 cursor-pointer bg-zinc-50/30 transition-colors">
                    <div>
                      <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{n.label}</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">{n.desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={(notifs as any)[n.key]}
                      onChange={e => setNotifs({...notifs, [n.key]: e.target.checked})}
                      className="size-4 rounded border-zinc-300 text-[#0D44A2] shrink-0 ml-3"
                    />
                  </label>
                ))}
              </div>
              <Button onClick={() => handleSave("Notification")} disabled={saving} className="bg-[#0D44A2] hover:bg-[#0A3682] text-white rounded-xl h-10 text-xs font-bold">
                Save Preferences
              </Button>
            </>
          )}

          {/* Appearance */}
          {activeSection === "appearance" && (
            <>
              <div className="flex items-center gap-2 text-[#0D44A2] font-bold text-sm">
                <Moon className="size-4" />
                <span>Appearance</span>
              </div>
              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Theme Mode</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: "light", label: "Light", icon: Sun },
                  { id: "dark", label: "Dark", icon: Moon },
                  { id: "system", label: "System", icon: Monitor },
                ] as { id: ThemeOption; label: string; icon: React.ElementType }[]).map(t => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => { setTheme(t.id); toast.success(`Theme set to ${t.label}`); }}
                      className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                        theme === t.id
                          ? "border-[#0D44A2] bg-[#0D44A2]/5"
                          : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                      }`}
                    >
                      <Icon className={`size-5 ${theme === t.id ? "text-[#0D44A2]" : "text-zinc-500"}`} />
                      <span className={`text-xs font-bold ${theme === t.id ? "text-[#0D44A2]" : "text-zinc-600 dark:text-zinc-400"}`}>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* System Info */}
          {activeSection === "system" && (
            <>
              <div className="flex items-center gap-2 text-[#0D44A2] font-bold text-sm">
                <Info className="size-4" />
                <span>System Information</span>
              </div>
              <div className="space-y-2">
                {[
                  ["Application", "Faraja Solution Loans"],
                  ["Version", "v1.0.0-beta"],
                  ["Environment", "Development"],
                  ["API Status", "🟢 Connected"],
                  ["Storage Mode", "In-Memory (Dev) / S3 (Production)"],
                  ["Auth", "JWT Bearer Token (30 min expiry)"],
                  ["Framework", "Next.js 15 + FastAPI"],
                  ["Database", "PostgreSQL (planned)"],
                  ["Mobile", "PWA-ready, camera + signature support"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-start py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                    <span className="text-xs text-zinc-400 font-semibold shrink-0 mr-3">{label}</span>
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 text-right">{value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
