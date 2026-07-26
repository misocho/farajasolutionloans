"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2, Plus, MapPin, Phone, Mail, Users, Banknote,
  TrendingUp, CheckCircle2, XCircle, Edit3, X, Loader2,
  Save, AlertTriangle, BarChart3, Receipt,
} from "lucide-react";
import { toast } from "sonner";

import { fetchMeApi } from "@/features/auth/api";
import {
  fetchBranchesApi, createBranchApi, updateBranchApi, deactivateBranchApi,
  type Branch,
} from "@/features/clients/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// ── Branch Form ───────────────────────────────────────────────────────────────

function BranchForm({
  initial,
  onSubmit,
  onClose,
  loading,
}: {
  initial?: Partial<Branch>;
  onSubmit: (data: any) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    location: initial?.location ?? "",
    manager_name: initial?.manager_name ?? "",
    manager_phone: initial?.manager_phone ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    is_active: initial?.is_active ?? true,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-zinc-950/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-t-[28px] sm:rounded-[28px] p-6 w-full sm:max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-5">
          <h3 className="font-black text-zinc-900 dark:text-zinc-50 text-base">
            {initial?.id ? "Edit Branch" : "Open New Branch"}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full cursor-pointer">
            <X className="size-4 text-zinc-500" />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Branch Name <span className="text-rose-500">*</span></Label>
            <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Nairobi Branch" required className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Location / Address <span className="text-rose-500">*</span></Label>
            <Input value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="e.g. Tom Mboya Street, Nairobi CBD" required className="rounded-xl" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Branch Manager</Label>
              <Input value={form.manager_name} onChange={e => setForm({...form, manager_name: e.target.value})} placeholder="Full name" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Manager Phone</Label>
              <Input value={form.manager_phone} onChange={e => setForm({...form, manager_phone: e.target.value})} placeholder="+254 7XX XXX XXX" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Branch Phone</Label>
              <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+254 41 XXX XXXX" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Branch Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="branch@farajasolutions.co.ke" className="rounded-xl" />
            </div>
          </div>
          {initial?.id && (
            <label className="flex items-center gap-3 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 cursor-pointer hover:border-zinc-200">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} className="size-4 rounded" />
              <div>
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Branch is Active</p>
                <p className="text-[10px] text-zinc-400">Uncheck to deactivate this branch</p>
              </div>
            </label>
          )}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl h-10 text-xs font-bold">Cancel</Button>
            <Button type="submit" disabled={loading} className="flex-1 bg-[#0D44A2] hover:bg-[#0A3682] text-white rounded-xl h-10 text-xs font-bold">
              {loading ? <Loader2 className="animate-spin size-4" /> : <Save className="size-4 mr-1" />}
              {initial?.id ? "Save Changes" : "Open Branch"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Branch Card ───────────────────────────────────────────────────────────────

function BranchCard({ branch, canEdit, onEdit, onDeactivate }: {
  branch: Branch;
  canEdit: boolean;
  onEdit: () => void;
  onDeactivate: () => void;
}) {
  const { stats } = branch;
  return (
    <div className={`bg-white dark:bg-zinc-900 border rounded-[20px] sm:rounded-[24px] shadow-sm overflow-hidden ${
      branch.is_active
        ? "border-zinc-150 dark:border-zinc-800"
        : "border-zinc-200 dark:border-zinc-800 opacity-60"
    }`}>
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`p-2.5 rounded-2xl shrink-0 ${branch.is_active ? "bg-[#0D44A2]/10" : "bg-zinc-100 dark:bg-zinc-800"}`}>
              <Building2 className={`size-5 ${branch.is_active ? "text-[#0D44A2]" : "text-zinc-400"}`} />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-zinc-900 dark:text-zinc-100 text-sm sm:text-base truncate">{branch.name}</h3>
              <div className="flex items-center gap-1 mt-0.5">
                <MapPin className="size-3 text-zinc-400 shrink-0" />
                <p className="text-[10px] text-zinc-400 truncate">{branch.location}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
              branch.is_active
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800"
                : "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700"
            }`}>
              {branch.is_active ? "Active" : "Inactive"}
            </span>
            {canEdit && (
              <button onClick={onEdit} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer text-zinc-500 hover:text-zinc-700 transition-colors">
                <Edit3 className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Manager + contact */}
        <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-zinc-500">
          {branch.manager_name && branch.manager_name !== "—" && (
            <span className="flex items-center gap-1"><Users className="size-3" />{branch.manager_name}</span>
          )}
          {branch.phone && branch.phone !== "—" && (
            <span className="flex items-center gap-1"><Phone className="size-3" />{branch.phone}</span>
          )}
          {branch.email && branch.email !== "—" && (
            <span className="flex items-center gap-1"><Mail className="size-3" />{branch.email}</span>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-zinc-100 dark:divide-zinc-800">
        {[
          { label: "Clients", value: stats.total_clients, icon: Users, color: "text-[#0D44A2]" },
          { label: "Active Loans", value: stats.active_loans, icon: Banknote, color: "text-emerald-600" },
          { label: "Disbursed", value: `KES ${(stats.disbursed_amount / 1000).toFixed(0)}K`, icon: BarChart3, color: "text-[#F57424]" },
          { label: "Overdue", value: stats.overdue_loans, icon: TrendingUp, color: stats.overdue_loans > 0 ? "text-rose-600" : "text-zinc-400" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="p-3 sm:p-4 flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <Icon className={`size-3.5 ${s.color}`} />
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">{s.label}</span>
              </div>
              <p className={`text-sm sm:text-base font-black ${s.color}`}>{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Deactivate button (admin only) */}
      {canEdit && branch.is_active && (
        <div className="px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 flex justify-end">
          <button onClick={onDeactivate}
            className="text-[10px] text-rose-500 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer transition-colors">
            <XCircle className="size-3" />Deactivate Branch
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BranchesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  const { data: user } = useQuery({ queryKey: ["me"], queryFn: fetchMeApi });
  const { data: branches = [], isLoading } = useQuery({ queryKey: ["branches"], queryFn: fetchBranchesApi });

  // Role check
  const role = user?.role ?? "";
  const canEdit = ["Director", "System Admin"].includes(role) ||
    (user?.employee_number?.includes("DIR") || user?.employee_number?.includes("SYS")) === true;

  const createMut = useMutation({
    mutationFn: createBranchApi,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["branches"] }); toast.success("Branch opened!"); setShowForm(false); },
    onError: (e: any) => toast.error(e.response?.data?.detail || "Failed to create branch"),
  });

  const updateMut = useMutation({
    mutationFn: (data: any) => updateBranchApi(editingBranch!.id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["branches"] }); toast.success("Branch updated!"); setEditingBranch(null); },
    onError: (e: any) => toast.error(e.response?.data?.detail || "Update failed"),
  });

  const deactivateMut = useMutation({
    mutationFn: deactivateBranchApi,
    onSuccess: (_, id) => { queryClient.invalidateQueries({ queryKey: ["branches"] }); toast.success("Branch deactivated"); },
    onError: (e: any) => toast.error(e.response?.data?.detail || "Deactivation failed"),
  });

  // Summary stats
  const activeBranches = branches.filter(b => b.is_active);
  const totalClients = branches.reduce((s, b) => s + b.stats.total_clients, 0);
  const totalDisbursed = branches.reduce((s, b) => s + b.stats.disbursed_amount, 0);
  const totalOverdue = branches.reduce((s, b) => s + b.stats.overdue_loans, 0);

  return (
    <div className="space-y-4 sm:space-y-5 max-w-5xl mx-auto pb-16 select-none">

      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">Branch Network</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Manage all Faraja Solution Loans branch offices</p>
        </div>
        {canEdit && (
          <Button onClick={() => setShowForm(true)} className="bg-[#0D44A2] hover:bg-[#0A3682] text-white rounded-xl h-10 px-5 font-bold text-xs shrink-0">
            <Plus className="size-4 mr-1.5" />Open New Branch
          </Button>
        )}
      </div>

      {/* Network summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: "Active Branches", value: activeBranches.length, color: "text-[#0D44A2] bg-[#0D44A2]/5 border-[#0D44A2]/15" },
          { label: "Total Clients", value: totalClients, color: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30" },
          { label: "Total Disbursed", value: `KES ${(totalDisbursed/1000000).toFixed(1)}M`, color: "text-[#F57424] bg-[#F57424]/5 border-[#F57424]/15" },
          { label: "Overdue Loans", value: totalOverdue, color: totalOverdue > 0 ? "text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30" : "text-zinc-500 bg-zinc-50 border-zinc-200" },
        ].map(s => (
          <div key={s.label} className={`flex flex-col items-center justify-center p-3 rounded-2xl border ${s.color}`}>
            <span className="text-lg sm:text-2xl font-black">{s.value}</span>
            <span className="text-[9px] sm:text-[10px] font-semibold mt-0.5 opacity-80 text-center">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Branch cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-[#0D44A2] size-8" /></div>
      ) : branches.length === 0 ? (
        <div className="text-center py-16 text-zinc-400 text-sm">No branches found. Open your first branch office.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {branches.map(branch => (
            <BranchCard
              key={branch.id}
              branch={branch}
              canEdit={canEdit}
              onEdit={() => setEditingBranch(branch)}
              onDeactivate={() => {
                if (confirm(`Deactivate "${branch.name}"? This can be reversed.`)) {
                  deactivateMut.mutate(branch.id);
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <BranchForm
          onSubmit={data => createMut.mutate(data)}
          onClose={() => setShowForm(false)}
          loading={createMut.isPending}
        />
      )}

      {/* Edit form */}
      {editingBranch && (
        <BranchForm
          initial={editingBranch}
          onSubmit={data => updateMut.mutate(data)}
          onClose={() => setEditingBranch(null)}
          loading={updateMut.isPending}
        />
      )}
    </div>
  );
}
