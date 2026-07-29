"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Banknote, Plus, Search, Eye, X, Loader2, CheckCircle2, Clock,
  XCircle, ArrowUpRight, Filter, AlertTriangle, ChevronRight,
  ThumbsUp, ThumbsDown, Send, Lock, Info, Receipt, Calendar,
  BadgeCheck, Flame, Save,
} from "lucide-react";
import { toast } from "sonner";

import { fetchMeApi } from "@/features/auth/api";
import {
  fetchLoansApi, fetchLoanApi, createLoanApi, approveLoanApi,
  rejectLoanApi, disburseLoanApi, closeLoanApi, fetchClientsApi,
  type Loan, type LoanStatus, type Client,
} from "@/features/clients/api";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// ── Constants ─────────────────────────────────────────────────────────────────

const SECTOR_OPTIONS = [
  "Retail & Trade", "Agriculture", "Logistics & Transport",
  "Construction", "Healthcare & Services", "Education",
  "Manufacturing", "Technology", "Hospitality & Tourism", "Other",
];

const STATUS_CFG: Record<LoanStatus, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  Pending:  { color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800", icon: Clock, label: "Pending Approval" },
  Approved: { color: "text-blue-700 dark:text-blue-400", bg: "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800", icon: CheckCircle2, label: "Approved" },
  Disbursed:{ color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800", icon: ArrowUpRight, label: "Disbursed" },
  Rejected: { color: "text-rose-700 dark:text-rose-400", bg: "bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-800", icon: XCircle, label: "Rejected" },
  Closed:   { color: "text-zinc-600 dark:text-zinc-400", bg: "bg-zinc-100 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700", icon: BadgeCheck, label: "Closed" },
};

const WORKFLOW_STEPS: LoanStatus[] = ["Pending", "Approved", "Disbursed", "Closed"];

// ── Role Helper ───────────────────────────────────────────────────────────────

function useRole() {
  const { data: user } = useQuery({ queryKey: ["me"], queryFn: fetchMeApi });
  const role = (() => {
    if (!user) return "";
    // UserProfile exposes a flat `role` string
    if (user.role) return user.role;
    if (user.employee_number?.includes("DIR")) return "Director";
    if (user.employee_number?.includes("SYS")) return "System Admin";
    if (user.employee_number?.includes("MGR")) return "Manager";
    if (user.employee_number?.includes("LO")) return "Loan Officer";
    return "Auditor";
  })();
  const name = user ? `${user.first_name} ${user.last_name}` : "";
  return { role, name, user };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: LoanStatus }) {
  const cfg = STATUS_CFG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>
      <Icon className="size-3" />{cfg.label}
    </span>
  );
}

function WorkflowBar({ status }: { status: LoanStatus }) {
  if (status === "Rejected") {
    return (
      <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-2xl">
        <XCircle className="size-4 text-rose-500 shrink-0" />
        <span className="text-xs font-bold text-rose-700 dark:text-rose-400">This loan application was rejected.</span>
      </div>
    );
  }
  const currentIdx = WORKFLOW_STEPS.indexOf(status);
  return (
    <div className="flex items-center gap-0 w-full">
      {WORKFLOW_STEPS.map((s, i) => {
        const done = i <= currentIdx;
        const active = i === currentIdx;
        return (
          <React.Fragment key={s}>
            <div className={`flex flex-col items-center gap-1 flex-1 min-w-0`}>
              <div className={`size-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 transition-colors shrink-0 ${
                done
                  ? active
                    ? "bg-[#0D44A2] border-[#0D44A2] text-white"
                    : "bg-emerald-500 border-emerald-500 text-white"
                  : "bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-400"
              }`}>
                {i < currentIdx ? "✓" : i + 1}
              </div>
              <span className={`text-[9px] font-bold text-center leading-tight ${
                done ? active ? "text-[#0D44A2]" : "text-emerald-600" : "text-zinc-400"
              }`}>{s}</span>
            </div>
            {i < WORKFLOW_STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 mb-3.5 ${i < currentIdx ? "bg-emerald-400" : "bg-zinc-200 dark:bg-zinc-700"}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function MoneyRow({ label, value, color = "text-zinc-900 dark:text-zinc-100", bold = false }: {
  label: string; value: string; color?: string; bold?: boolean;
}) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className={`text-xs font-${bold ? "black" : "bold"} ${color}`}>{value}</span>
    </div>
  );
}

// ── Loan Detail Drawer ────────────────────────────────────────────────────────

function LoanDrawer({
  loanId,
  onClose,
  role,
  officerName,
}: {
  loanId: string;
  onClose: () => void;
  role: string;
  officerName: string;
}) {
  const queryClient = useQueryClient();
  const [actionNote, setActionNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState<null | "approve" | "reject">(null);

  const { data: loan, isLoading } = useQuery({
    queryKey: ["loan", loanId],
    queryFn: () => fetchLoanApi(loanId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["loans"] });
    queryClient.invalidateQueries({ queryKey: ["loan", loanId] });
  };

  const approveMut = useMutation({
    mutationFn: () => approveLoanApi(loanId, actionNote || "Approved by manager", officerName),
    onSuccess: () => { toast.success("Loan approved!"); setShowNoteInput(null); setActionNote(""); invalidate(); },
    onError: (e: any) => toast.error(e.response?.data?.detail || "Approval failed"),
  });

  const rejectMut = useMutation({
    mutationFn: () => rejectLoanApi(loanId, actionNote || "No reason provided", officerName),
    onSuccess: () => { toast.success("Loan rejected"); setShowNoteInput(null); setActionNote(""); invalidate(); },
    onError: (e: any) => toast.error(e.response?.data?.detail || "Rejection failed"),
  });

  const disburseMut = useMutation({
    mutationFn: () => disburseLoanApi(loanId, officerName),
    onSuccess: () => { toast.success("Loan disbursed! Due date set."); invalidate(); },
    onError: (e: any) => toast.error(e.response?.data?.detail || "Disbursement failed"),
  });

  const closeMut = useMutation({
    mutationFn: () => closeLoanApi(loanId, officerName),
    onSuccess: () => { toast.success("Loan marked as Closed ✓"); invalidate(); },
    onError: (e: any) => toast.error(e.response?.data?.detail || "Cannot close: " + e.response?.data?.detail),
  });

  const anyPending = approveMut.isPending || rejectMut.isPending || disburseMut.isPending || closeMut.isPending;

  const canApprove = role === "Manager" || role === "System Admin";
  const canDisburse = role === "Director" || role === "System Admin";
  const canReject = canApprove || canDisburse;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-zinc-950/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 w-full max-w-lg h-full shadow-2xl overflow-y-auto flex flex-col">
        {/* Sticky header */}
        <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 px-5 py-4 flex justify-between items-start z-10 shrink-0">
          <div>
            <h3 className="font-black text-zinc-900 dark:text-zinc-50">{isLoading ? "Loading..." : loan?.client}</h3>
            <p className="text-xs font-mono text-zinc-400 mt-0.5">{loanId}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full cursor-pointer">
            <X className="size-5 text-zinc-500" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-[#0D44A2] size-8" /></div>
        ) : loan ? (
          <div className="flex-1 p-5 space-y-5 text-left">

            {/* Status + Workflow */}
            <div className="space-y-3">
              <StatusBadge status={loan.status} />
              <WorkflowBar status={loan.status} />
            </div>

            {/* Loan Financials */}
            <div className="bg-zinc-50 dark:bg-zinc-850/30 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-4 space-y-0">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider mb-2">Financial Summary</p>
              <MoneyRow label="Principal" value={`KES ${loan.amount.toLocaleString()}`} />
              {loan.status !== "Pending" && loan.status !== "Approved" && (
                <MoneyRow label="Interest (20% flat)" value={`KES ${loan.interest_amount.toLocaleString()}`} color="text-[#F57424]" />
              )}
              {loan.status !== "Pending" && loan.status !== "Approved" && (
                <MoneyRow label="Total Repayable" value={`KES ${loan.total_repayable.toLocaleString()}`} bold />
              )}
              <MoneyRow label="Amount Repaid (verified)" value={`KES ${loan.amount_repaid.toLocaleString()}`} color="text-emerald-600" />
              <MoneyRow label="Outstanding Balance" value={`KES ${loan.outstanding.toLocaleString()}`}
                color={loan.outstanding > 0 ? "text-rose-600" : "text-emerald-600"} bold />
              <MoneyRow label="Application Fee" value={`KES ${loan.application_fee.toLocaleString()}`} color="text-zinc-400" />
            </div>

            {/* Overdue / Penalty */}
            {loan.is_overdue && (
              <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-2xl p-4 space-y-1">
                <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-bold text-xs">
                  <Flame className="size-3.5" /><span>OVERDUE — {loan.days_overdue} days past due</span>
                </div>
                <p className="text-xs text-rose-600 dark:text-rose-400">
                  Penalty: <strong>KES {loan.penalty_amount.toLocaleString()}</strong>
                  {" "}(3% × {Math.floor(loan.days_overdue / 2)} periods of 2 days)
                </p>
              </div>
            )}

            {/* Loan Details */}
            <div className="bg-zinc-50 dark:bg-zinc-850/30 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-4 space-y-0">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider mb-2">Loan Details</p>
              <MoneyRow label="Sector" value={loan.sector} />
              <MoneyRow label="Duration" value={`${loan.duration_days} days`} />
              <MoneyRow label="Date Applied" value={loan.date} />
              {loan.disbursed_date && <MoneyRow label="Date Disbursed" value={loan.disbursed_date} />}
              {loan.due_date && (
                <MoneyRow label="Due Date" value={loan.due_date}
                  color={loan.is_overdue ? "text-rose-600" : "text-zinc-900 dark:text-zinc-100"} />
              )}
              {loan.submitted_by && <MoneyRow label="Submitted By" value={loan.submitted_by} />}
              {loan.approved_by && <MoneyRow label="Approved By" value={loan.approved_by} />}
              {loan.disbursed_by && <MoneyRow label="Disbursed By" value={loan.disbursed_by} />}
              {loan.notes && <MoneyRow label="Notes" value={loan.notes} />}
              {loan.approval_note && <MoneyRow label="Approval Note" value={loan.approval_note} />}
              {loan.rejection_reason && (
                <MoneyRow label="Rejection Reason" value={loan.rejection_reason} color="text-rose-600" />
              )}
            </div>

            {/* Repayment History */}
            {loan.repayments && loan.repayments.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">
                  Repayment History ({loan.repayments.length})
                </p>
                {loan.repayments.map((r) => (
                  <div key={r.id} className="flex justify-between items-center p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/30">
                    <div>
                      <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">KES {r.amount.toLocaleString()}</p>
                      <p className="text-[10px] text-zinc-400">{r.date} · {r.mode} · {r.reference}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                      r.verified
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800"
                        : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800"
                    }`}>
                      {r.verified ? `✓ ${r.verified_by}` : "Unverified"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Action Zone */}
            {loan.status !== "Rejected" && loan.status !== "Closed" && (
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 space-y-3">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Actions</p>

                {/* Note input for approve/reject */}
                {showNoteInput && (
                  <div className="space-y-2 bg-zinc-50 dark:bg-zinc-850/30 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                    <Label className="text-xs font-semibold">
                      {showNoteInput === "approve" ? "Approval Note (optional)" : "Rejection Reason (required)"}
                    </Label>
                    <Input
                      value={actionNote}
                      onChange={(e) => setActionNote(e.target.value)}
                      placeholder={showNoteInput === "approve" ? "e.g. Good repayment history" : "e.g. Incomplete documents"}
                      className="rounded-xl text-sm"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setShowNoteInput(null); setActionNote(""); }}
                        className="text-xs text-zinc-500 hover:text-zinc-700 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700"
                      >
                        Cancel
                      </button>
                      <Button
                        onClick={() => showNoteInput === "approve" ? approveMut.mutate() : rejectMut.mutate()}
                        disabled={anyPending || (showNoteInput === "reject" && !actionNote)}
                        className={`flex-1 rounded-xl h-9 text-xs font-bold ${
                          showNoteInput === "approve"
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : "bg-rose-600 hover:bg-rose-700 text-white"
                        }`}
                      >
                        {anyPending ? <Loader2 className="animate-spin size-3.5" /> : null}
                        {showNoteInput === "approve" ? "Confirm Approve" : "Confirm Reject"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Manager: Approve / Reject */}
                {loan.status === "Pending" && canApprove && !showNoteInput && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setShowNoteInput("approve")}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 text-xs font-bold"
                    >
                      <ThumbsUp className="size-3.5 mr-1.5" />Approve
                    </Button>
                    <Button
                      onClick={() => setShowNoteInput("reject")}
                      variant="outline"
                      className="flex-1 border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 rounded-xl h-10 text-xs font-bold"
                    >
                      <ThumbsDown className="size-3.5 mr-1.5" />Reject
                    </Button>
                  </div>
                )}

                {/* Director: Reject or Disburse */}
                {loan.status === "Approved" && canDisburse && !showNoteInput && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => disburseMut.mutate()}
                      disabled={anyPending}
                      className="flex-1 bg-[#0D44A2] hover:bg-[#0A3682] text-white rounded-xl h-10 text-xs font-bold"
                    >
                      {anyPending ? <Loader2 className="animate-spin size-3.5" /> : <Send className="size-3.5 mr-1.5" />}
                      Disburse Loan
                    </Button>
                    <Button
                      onClick={() => setShowNoteInput("reject")}
                      variant="outline"
                      className="border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 rounded-xl h-10 text-xs font-bold px-4"
                    >
                      <ThumbsDown className="size-3.5" />
                    </Button>
                  </div>
                )}

                {/* Director: Close fully-repaid loan */}
                {loan.status === "Disbursed" && canDisburse && loan.outstanding <= 0 && !showNoteInput && (
                  <Button
                    onClick={() => closeMut.mutate()}
                    disabled={anyPending}
                    className="w-full bg-zinc-800 hover:bg-zinc-900 text-white rounded-xl h-10 text-xs font-bold dark:bg-zinc-700"
                  >
                    {anyPending ? <Loader2 className="animate-spin size-3.5" /> : <BadgeCheck className="size-3.5 mr-1.5" />}
                    Mark Loan as Closed
                  </Button>
                )}

                {/* Role restriction message */}
                {!canApprove && !canDisburse && (
                  <div className="flex items-center gap-2 p-3 bg-zinc-50 dark:bg-zinc-850 rounded-xl border border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500">
                    <Lock className="size-3.5 shrink-0" />
                    <span>Your role ({role || "Auditor"}) is read-only. Actions require Manager or Director access.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm">Loan not found</div>
        )}

        <div className="sticky bottom-0 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 p-4 shrink-0">
          <Button onClick={onClose} className="w-full bg-[#0D44A2] hover:bg-[#0A3682] text-white rounded-xl h-10 text-xs font-bold">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LoansPage() {
  const queryClient = useQueryClient();
  const { role, name: officerName } = useRole();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [form, setForm] = useState({
    client: "", sector: "Retail & Trade", amount: "",
    duration_days: "90", application_fee: "500", notes: "",
  });

  const { data: loans = [], isLoading } = useQuery({ queryKey: ["loans"], queryFn: fetchLoansApi });

  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: fetchClientsApi });

  const getApplicationFee = (clientName: string, amountStr: string): number => {
    const amount = parseFloat(amountStr) || 0;
    const nameClean = clientName.trim().toLowerCase();
    const isExisting = clients.some((c: Client) => c.name.trim().toLowerCase() === nameClean) ||
                       loans.some((l: Loan) => l.client.trim().toLowerCase() === nameClean);

    if (amount >= 4000 && amount <= 10000) {
      return isExisting ? 600 : 800;
    } else if (amount > 10000) {
      return isExisting ? 1000 : 1500;
    }
    return 500;
  };


  const createMut = useMutation({
    mutationFn: () => {
      const calculatedFee = getApplicationFee(form.client, form.amount);
      return createLoanApi({
        client: form.client, sector: form.sector,
        amount: parseFloat(form.amount),
        duration_days: parseInt(form.duration_days) || 90,
        application_fee: calculatedFee,
        notes: form.notes,
        submitted_by: officerName || "Loan Officer",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      toast.success("Loan application submitted!");
      setShowNewForm(false);
      setForm({ client: "", sector: "Retail & Trade", amount: "", duration_days: "90", application_fee: "500", notes: "" });
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || "Submission failed"),
  });


  const canCreate = ["Loan Officer", "Manager", "Director", "System Admin"].includes(role);

  const filtered = loans.filter((l) => {
    const q = searchQuery.toLowerCase();
    const mQ = l.client.toLowerCase().includes(q) || l.id.toLowerCase().includes(q) || l.sector.toLowerCase().includes(q);
    const mS = statusFilter === "All" || (statusFilter === "Overdue" ? l.is_overdue : l.status === statusFilter);
    return mQ && mS;
  });

  // Summary stats
  const pendingCount = loans.filter(l => l.status === "Pending").length;
  const overdueCount = loans.filter(l => l.is_overdue).length;
  const totalPortfolio = loans.filter(l => l.status === "Disbursed").reduce((s, l) => s + l.outstanding, 0);

  return (
    <div className="space-y-4 sm:space-y-5 max-w-5xl mx-auto pb-16 select-none">

      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">Loans & Credit Facilities</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Submit → Manager approves → Director disburses</p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowNewForm(true)} className="bg-[#0D44A2] hover:bg-[#0A3682] text-white rounded-xl h-10 px-5 font-bold text-xs shrink-0">
            <Plus className="size-4 mr-1.5" />New Application
          </Button>
        )}
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: "Outstanding", value: `KES ${(totalPortfolio / 1000).toFixed(0)}K`, color: "text-[#0D44A2] bg-[#0D44A2]/5 border-[#0D44A2]/15" },
          { label: "Pending Approval", value: pendingCount, color: "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30" },
          { label: "Overdue", value: overdueCount, color: overdueCount > 0 ? "text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30" : "text-zinc-500 bg-zinc-50 border-zinc-200" },
        ].map(s => (
          <div key={s.label} className={`flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl border ${s.color}`}>
            <span className="text-base sm:text-xl font-black">{s.value}</span>
            <span className="text-[9px] sm:text-[10px] font-semibold mt-0.5 opacity-80 text-center">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filter + Table/Cards */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
            <Input placeholder="Search client, loan ID, sector..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-10 rounded-xl bg-zinc-50/50" />
          </div>
          <div className="relative shrink-0">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400 pointer-events-none" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="h-10 pl-9 pr-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 focus:outline-none w-full sm:w-auto">
              {["All", "Pending", "Approved", "Disbursed", "Overdue", "Rejected", "Closed"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-14"><Loader2 className="animate-spin text-[#0D44A2] size-7" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-zinc-400 text-sm">No loans match your filter.</div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden flex flex-col gap-2.5">
              {filtered.map(loan => (
                <div key={loan.id} onClick={() => setSelectedLoanId(loan.id)}
                  className="border border-zinc-100 dark:border-zinc-800 rounded-2xl p-3.5 space-y-2 cursor-pointer hover:border-[#0D44A2]/30 active:bg-zinc-50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 mr-2">
                      <p className="font-bold text-zinc-900 dark:text-zinc-100 text-sm truncate">{loan.client}</p>
                      <p className="text-[10px] font-mono text-zinc-400">{loan.id} · {loan.sector}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge status={loan.status} />
                      {loan.is_overdue && (
                        <span className="text-[9px] font-bold text-rose-600 flex items-center gap-0.5"><Flame className="size-2.5" />{loan.days_overdue}d overdue</span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-zinc-100 dark:border-zinc-800">
                    <span className="text-[10px] text-zinc-400">Principal: KES {loan.amount.toLocaleString()}</span>
                    <span className={`text-xs font-black ${loan.outstanding > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      Outstanding: KES {loan.outstanding.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-850 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-2">Loan ID</th>
                    <th className="py-3 px-2">Client</th>
                    <th className="py-3 px-2">Sector</th>
                    <th className="py-3 px-2">Principal</th>
                    <th className="py-3 px-2">Outstanding</th>
                    <th className="py-3 px-2">Due Date</th>
                    <th className="py-3 px-2">Status</th>
                    <th className="py-3 px-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100/50 dark:divide-zinc-850/50">
                  {filtered.map(loan => (
                    <tr key={loan.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/10 transition-colors">
                      <td className="py-3 px-2 font-mono font-bold text-zinc-500 text-[10px]">{loan.id}</td>
                      <td className="py-3 px-2 font-bold text-zinc-900 dark:text-zinc-100">{loan.client}</td>
                      <td className="py-3 px-2 text-zinc-500">{loan.sector}</td>
                      <td className="py-3 px-2 font-bold text-[#0D44A2] dark:text-blue-400">KES {loan.amount.toLocaleString()}</td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-1">
                          {loan.is_overdue && <Flame className="size-3 text-rose-500 shrink-0" />}
                          <span className={`font-bold ${loan.outstanding > 0 ? loan.is_overdue ? "text-rose-600" : "text-zinc-700 dark:text-zinc-200" : "text-emerald-600"}`}>
                            KES {loan.outstanding.toLocaleString()}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-zinc-400">{loan.due_date || "—"}</td>
                      <td className="py-3 px-2"><StatusBadge status={loan.status} /></td>
                      <td className="py-3 px-2 text-right">
                        <Button onClick={() => setSelectedLoanId(loan.id)} variant="outline" size="sm"
                          className="rounded-xl border-zinc-200 h-7 text-[10px] font-bold cursor-pointer">
                          <Eye className="size-3 mr-1" />View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* New Application Modal */}
      {showNewForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-zinc-950/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-t-[28px] sm:rounded-[28px] p-6 w-full sm:max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-5">
              <h3 className="font-black text-zinc-900 dark:text-zinc-50 text-base">New Loan Application</h3>
              <button onClick={() => setShowNewForm(false)} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full cursor-pointer"><X className="size-4 text-zinc-500" /></button>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-3 mb-4 text-xs text-amber-700 dark:text-amber-400">
              <strong>Fee:</strong> KES {getApplicationFee(form.client, form.amount).toLocaleString()} Application Fee — collected manually.
              <br /><strong>Interest:</strong> 20% flat on principal added at disbursement.
            </div>

            <form onSubmit={(e) => { e.preventDefault(); if (!form.client || !form.amount) { toast.error("Client and amount required"); return; } createMut.mutate(); }}
              className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Client / Business Name <span className="text-rose-500">*</span></Label>
                <Input value={form.client} onChange={e => setForm({...form, client: e.target.value})} placeholder="e.g. Baraka Seeds & Fertilizers" required className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Business Sector <span className="text-rose-500">*</span></Label>
                <select value={form.sector} onChange={e => setForm({...form, sector: e.target.value})}
                  className="w-full h-10 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 rounded-xl text-sm px-3 focus:outline-none">
                  {SECTOR_OPTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Principal (KES) <span className="text-rose-500">*</span></Label>
                  <Input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} placeholder="e.g. 500000" required className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Duration (days)</Label>
                  <Input type="number" value={form.duration_days} onChange={e => setForm({...form, duration_days: e.target.value})} placeholder="90" className="rounded-xl" />
                </div>
              </div>
              {form.amount && (
                <div className="bg-[#0D44A2]/5 border border-[#0D44A2]/15 rounded-xl p-3 text-xs space-y-1">
                  <p className="font-semibold text-[#0D44A2]">💡 Auto-calculation preview</p>
                  <p className="text-zinc-600 dark:text-zinc-400">Interest (20%): <strong>KES {(parseFloat(form.amount || "0") * 0.20).toLocaleString()}</strong></p>
                  <p className="text-zinc-600 dark:text-zinc-400">Total Repayable: <strong>KES {(parseFloat(form.amount || "0") * 1.20).toLocaleString()}</strong></p>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Notes / Purpose</Label>
                <Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="e.g. Seasonal stock purchase" className="rounded-xl" />
              </div>
              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" onClick={() => setShowNewForm(false)} className="flex-1 rounded-xl h-10 text-xs font-bold">Cancel</Button>
                <Button type="submit" disabled={createMut.isPending} className="flex-1 bg-[#0D44A2] hover:bg-[#0A3682] text-white rounded-xl h-10 text-xs font-bold">
                  {createMut.isPending ? <Loader2 className="animate-spin size-4" /> : <Save className="size-4 mr-1" />}
                  Submit Application
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loan Detail Drawer */}
      {selectedLoanId && (
        <LoanDrawer loanId={selectedLoanId} onClose={() => setSelectedLoanId(null)} role={role} officerName={officerName} />
      )}
    </div>
  );
}
