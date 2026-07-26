"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Receipt, Plus, Search, Loader2, CheckCircle2, X, Save,
  Clock, Filter, ShieldCheck, AlertTriangle, Eye,
} from "lucide-react";
import { toast } from "sonner";

import { fetchMeApi } from "@/features/auth/api";
import {
  fetchRepaymentsApi, createRepaymentApi, verifyRepaymentApi, fetchLoansApi,
  type Repayment,
} from "@/features/clients/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const PAYMENT_MODES = ["Cash", "M-Pesa", "Bank Transfer", "Cheque", "Other"];

function useRole() {
  const { data: user } = useQuery({ queryKey: ["me"], queryFn: fetchMeApi });
  const role = (() => {
    if (!user) return "";
    if (user.role) return user.role;
    if (user.employee_number?.includes("DIR")) return "Director";
    if (user.employee_number?.includes("SYS")) return "System Admin";
    if (user.employee_number?.includes("MGR")) return "Manager";
    if (user.employee_number?.includes("LO")) return "Loan Officer";
    return "Auditor";
  })();
  const name = user ? `${user.first_name} ${user.last_name}` : "";
  return { role, name };
}

// ── Verify Confirm Modal ──────────────────────────────────────────────────────

function VerifyModal({ rep, verifierName, onVerify, onClose }: {
  rep: Repayment;
  verifierName: string;
  onVerify: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-zinc-950/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-t-[28px] sm:rounded-[28px] p-6 w-full sm:max-w-sm shadow-2xl">
        <div className="flex justify-between items-center pb-3 mb-4 border-b border-zinc-100 dark:border-zinc-800">
          <h3 className="font-black text-zinc-900 dark:text-zinc-50">Confirm Payment</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full cursor-pointer"><X className="size-4 text-zinc-500" /></button>
        </div>

        <div className="space-y-2 mb-5">
          {[
            ["Receipt ID", rep.id],
            ["Client", rep.client],
            ["Loan ID", rep.loan_id],
            ["Amount", `KES ${rep.amount.toLocaleString()}`],
            ["Mode", rep.mode],
            ["Reference", rep.reference],
            ["Date", rep.date],
            ["Recorded By", rep.recorded_by || "—"],
          ].map(([l, v]) => (
            <div key={l} className="flex justify-between text-xs">
              <span className="text-zinc-400 font-semibold">{l}</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100 text-right max-w-[60%] truncate">{v}</span>
            </div>
          ))}
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 text-xs text-emerald-700 dark:text-emerald-400 mb-4">
          <ShieldCheck className="size-3.5 inline mr-1" />
          Verifying as <strong>{verifierName}</strong>. This action confirms the funds have been received and cannot be undone.
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl h-10 text-xs font-bold">Cancel</Button>
          <Button onClick={onVerify} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 text-xs font-bold">
            <CheckCircle2 className="size-3.5 mr-1.5" />Verify Payment
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RepaymentsPage() {
  const queryClient = useQueryClient();
  const { role, name: officerName } = useRole();
  const [activeTab, setActiveTab] = useState<"all" | "pending">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [verifyingRep, setVerifyingRep] = useState<Repayment | null>(null);
  const [form, setForm] = useState({
    loan_id: "", client: "", amount: "", mode: "Cash", reference: "",
  });

  const { data: repayments = [], isLoading } = useQuery({
    queryKey: ["repayments"],
    queryFn: () => fetchRepaymentsApi(),
  });

  const { data: loans = [] } = useQuery({
    queryKey: ["loans"],
    queryFn: fetchLoansApi,
  });

  const disbursedLoans = loans.filter(l => l.status === "Disbursed");

  const createMut = useMutation({
    mutationFn: () => createRepaymentApi({
      loan_id: form.loan_id,
      client: form.client,
      amount: parseFloat(form.amount),
      mode: form.mode,
      reference: form.reference || undefined,
      recorded_by: officerName || "Loan Officer",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repayments"] });
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      toast.success("Payment recorded — pending verification by Manager/Director");
      setShowForm(false);
      setForm({ loan_id: "", client: "", amount: "", mode: "Cash", reference: "" });
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || "Failed to record payment"),
  });

  const verifyMut = useMutation({
    mutationFn: (id: string) => verifyRepaymentApi(id, officerName || role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repayments"] });
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      toast.success("Payment verified and confirmed!");
      setVerifyingRep(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || "Verification failed"),
  });

  const canRecord = ["Loan Officer", "Manager", "Director", "System Admin"].includes(role);
  const canVerify = ["Manager", "Director", "System Admin"].includes(role);

  // Filtered lists
  const filterReps = (list: Repayment[]) => {
    const q = searchQuery.toLowerCase();
    return list.filter(r =>
      r.client.toLowerCase().includes(q) ||
      r.loan_id.toLowerCase().includes(q) ||
      r.reference.toLowerCase().includes(q)
    );
  };

  const allReps = filterReps(repayments);
  const pendingReps = filterReps(repayments.filter(r => !r.verified));

  const displayReps = activeTab === "pending" ? pendingReps : allReps;

  // Summary
  const verifiedTotal = repayments.filter(r => r.verified).reduce((s, r) => s + r.amount, 0);
  const pendingTotal = repayments.filter(r => !r.verified).reduce((s, r) => s + r.amount, 0);
  const todayTotal = repayments.filter(r => r.verified && r.date === new Date().toISOString().slice(0, 10)).reduce((s, r) => s + r.amount, 0);

  // Auto-fill client when loan is selected
  const handleLoanSelect = (loan_id: string) => {
    const loan = disbursedLoans.find(l => l.id === loan_id);
    setForm({ ...form, loan_id, client: loan?.client || "" });
  };

  return (
    <div className="space-y-4 sm:space-y-5 max-w-4xl mx-auto pb-16 select-none">

      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">Repayments & Receipts</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Record payments → Manager/Director verifies</p>
        </div>
        {canRecord && (
          <Button onClick={() => setShowForm(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-5 font-bold text-xs shrink-0">
            <Plus className="size-4 mr-1.5" />Record Payment
          </Button>
        )}
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-3 sm:p-4 rounded-2xl shadow-sm text-center">
          <p className="text-[9px] sm:text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Verified</p>
          <p className="text-base sm:text-xl font-black text-emerald-600 mt-1">KES {(verifiedTotal/1000).toFixed(0)}K</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-3 sm:p-4 rounded-2xl shadow-sm text-center">
          <p className="text-[9px] sm:text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Pending Verify</p>
          <p className={`text-base sm:text-xl font-black mt-1 ${pendingReps.length > 0 ? "text-amber-600" : "text-zinc-500"}`}>
            {pendingReps.length > 0 ? `KES ${(pendingTotal/1000).toFixed(0)}K` : "—"}
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-3 sm:p-4 rounded-2xl shadow-sm text-center">
          <p className="text-[9px] sm:text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Today Verified</p>
          <p className="text-base sm:text-xl font-black text-[#0D44A2] mt-1">KES {(todayTotal/1000).toFixed(0)}K</p>
        </div>
      </div>

      {/* Tabs + List */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] shadow-sm space-y-3">

        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-2xl w-fit">
          {([
            { id: "all", label: "All Payments", count: repayments.length },
            { id: "pending", label: "Pending Verification", count: pendingReps.length },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                activeTab === t.id
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${
                  t.id === "pending" && t.count > 0
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
                }`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Pending banner */}
        {activeTab === "all" && pendingReps.length > 0 && canVerify && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-3.5 shrink-0" />
            <span><strong>{pendingReps.length} payments</strong> awaiting your verification — KES {pendingTotal.toLocaleString()}</span>
            <button onClick={() => setActiveTab("pending")} className="ml-auto font-bold underline shrink-0">Review →</button>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
          <Input placeholder="Search client, loan ID, reference..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-10 rounded-xl bg-zinc-50/50" />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-emerald-600 size-7" /></div>
        ) : displayReps.length === 0 ? (
          <div className="text-center py-10 text-zinc-400 text-sm">
            {activeTab === "pending" ? "No payments pending verification. ✓" : "No payments recorded yet."}
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden flex flex-col gap-2.5">
              {displayReps.map(r => (
                <div key={r.id} className="border border-zinc-100 dark:border-zinc-800 rounded-2xl p-3.5 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{r.client}</p>
                      <p className="text-[10px] text-zinc-400 font-mono">{r.loan_id} · {r.id}</p>
                    </div>
                    <span className="text-sm font-black text-emerald-600">KES {r.amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-zinc-100 dark:border-zinc-800 gap-2">
                    <div>
                      <p className="text-[10px] text-zinc-400">{r.mode} · Ref: {r.reference}</p>
                      <p className="text-[10px] text-zinc-400">{r.date}</p>
                    </div>
                    {r.verified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold shrink-0">
                        <CheckCircle2 className="size-3" />Verified
                      </span>
                    ) : canVerify ? (
                      <Button onClick={() => setVerifyingRep(r)} size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-7 text-[10px] font-bold shrink-0">
                        <ShieldCheck className="size-3 mr-0.5" />Verify
                      </Button>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-[10px] font-bold shrink-0">
                        <Clock className="size-3" />Pending
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-850 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-2">Receipt</th>
                    <th className="py-3 px-2">Client</th>
                    <th className="py-3 px-2">Loan ID</th>
                    <th className="py-3 px-2">Amount</th>
                    <th className="py-3 px-2">Mode · Ref</th>
                    <th className="py-3 px-2">Date</th>
                    <th className="py-3 px-2">Status</th>
                    {canVerify && <th className="py-3 px-2 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100/50 dark:divide-zinc-850/50">
                  {displayReps.map(r => (
                    <tr key={r.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/10 transition-colors">
                      <td className="py-3 px-2 font-mono text-zinc-500 text-[10px]">{r.id}</td>
                      <td className="py-3 px-2 font-bold text-zinc-900 dark:text-zinc-100">{r.client}</td>
                      <td className="py-3 px-2 font-mono text-[#0D44A2] dark:text-blue-400">{r.loan_id}</td>
                      <td className="py-3 px-2 font-black text-emerald-600">KES {r.amount.toLocaleString()}</td>
                      <td className="py-3 px-2 text-zinc-500">{r.mode} · <span className="font-mono">{r.reference}</span></td>
                      <td className="py-3 px-2 text-zinc-400">{r.date}</td>
                      <td className="py-3 px-2">
                        {r.verified ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold">
                            <CheckCircle2 className="size-3" />Verified · {r.verified_by}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-[10px] font-bold">
                            <Clock className="size-3" />Unverified
                          </span>
                        )}
                      </td>
                      {canVerify && (
                        <td className="py-3 px-2 text-right">
                          {!r.verified && (
                            <Button onClick={() => setVerifyingRep(r)} size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-7 text-[10px] font-bold cursor-pointer">
                              <ShieldCheck className="size-3 mr-0.5" />Verify
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Record Payment Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-zinc-950/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-t-[28px] sm:rounded-[28px] p-6 w-full sm:max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-5">
              <h3 className="font-black text-zinc-900 dark:text-zinc-50 text-base">Record Payment</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full cursor-pointer"><X className="size-4 text-zinc-500" /></button>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 mb-4 text-xs text-blue-700 dark:text-blue-400">
              Payment will be recorded as <strong>Unverified</strong> until a Manager or Director confirms it.
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!form.loan_id || !form.amount) { toast.error("Loan and amount required"); return; }
              createMut.mutate();
            }} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Select Loan (Disbursed) <span className="text-rose-500">*</span></Label>
                <select value={form.loan_id} onChange={e => handleLoanSelect(e.target.value)} required
                  className="w-full h-10 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 rounded-xl text-sm px-3 focus:outline-none">
                  <option value="">— Select disbursed loan —</option>
                  {disbursedLoans.map(l => (
                    <option key={l.id} value={l.id}>{l.id} · {l.client} (KES {l.outstanding.toLocaleString()} outstanding)</option>
                  ))}
                </select>
              </div>
              {form.client && (
                <p className="text-xs text-emerald-600 font-semibold -mt-1">✓ Client: {form.client}</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Amount (KES) <span className="text-rose-500">*</span></Label>
                  <Input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} placeholder="e.g. 50000" required className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Payment Mode</Label>
                  <select value={form.mode} onChange={e => setForm({...form, mode: e.target.value})}
                    className="w-full h-10 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 rounded-xl text-sm px-3 focus:outline-none">
                    {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Reference / Transaction Code</Label>
                <Input value={form.reference} onChange={e => setForm({...form, reference: e.target.value})} placeholder="e.g. M-PESA QER7X9KL2 or Bank EFT ref" className="rounded-xl" />
              </div>
              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="flex-1 rounded-xl h-10 text-xs font-bold">Cancel</Button>
                <Button type="submit" disabled={createMut.isPending} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 text-xs font-bold">
                  {createMut.isPending ? <Loader2 className="animate-spin size-4" /> : <Receipt className="size-4 mr-1" />}
                  Record Payment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Verify Confirm Modal */}
      {verifyingRep && (
        <VerifyModal
          rep={verifyingRep}
          verifierName={officerName || role}
          onVerify={() => verifyMut.mutate(verifyingRep.id)}
          onClose={() => setVerifyingRep(null)}
        />
      )}
    </div>
  );
}
