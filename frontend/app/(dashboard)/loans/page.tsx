"use client";

import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Banknote, Plus, Search, Eye, X, Loader2, CheckCircle2, Clock,
  XCircle, ArrowUpRight, Filter, AlertTriangle, ChevronRight, TrendingUp,
  ThumbsUp, ThumbsDown, Send, Lock, Info, Receipt, Calendar,
  BadgeCheck, Flame, Save, StickyNote, Tag,
} from "lucide-react";
import { toast } from "sonner";

import { fetchMeApi } from "@/features/auth/api";
import { useBranch } from "@/components/layout/branch-selector";
import { formatKES } from "@/app/lib/format";
import {
  fetchLoansApi, fetchLoanApi, createLoanApi, approveLoanApi,
  rejectLoanApi, disburseLoanApi, closeLoanApi, fetchClientsApi,
  fetchLoanProductsApi, fetchFeeQuoteApi, fetchFeesApi,
  recordFeeApi, verifyFeeApi, addLoanNoteApi, updateLoanStatusApi,
  type Loan, type LoanStatus, type Client, type LoanProduct,
} from "@/features/clients/api";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/status-badge";
import { InstallmentTimeline } from "@/components/loans/installment-timeline";

interface ApiError {
  response?: { data?: { detail?: string } };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SECTOR_OPTIONS = [
  "Retail & Trade", "Agriculture", "Logistics & Transport",
  "Construction", "Healthcare & Services", "Education",
  "Manufacturing", "Technology", "Hospitality & Tourism", "Other",
];

const WORKFLOW_STEPS: LoanStatus[] = ["Pending", "Approved", "Disbursed", "Closed"];

// ── Role Helper ───────────────────────────────────────────────────────────────

function useRole() {
  const { data: user } = useQuery({ queryKey: ["me"], queryFn: fetchMeApi });
  const role = (() => {
    if (!user) return "";
    // /auth/me exposes flat `role` + `roles[]` (backend-truth)
    if (user.role) return user.role;
    if (user.roles?.length) return user.roles[0];
    if (user.employee_number?.includes("DIR")) return "Director";
    if (user.employee_number?.includes("SYS")) return "System Admin";
    if (user.employee_number?.includes("MGR")) return "Manager";
    if (user.employee_number?.includes("LO")) return "Loan Officer";
    return "Auditor";
  })();
  const name = user ? `${user.first_name} ${user.last_name}` : "";
  return { role, name, permissions: user?.permissions ?? [] };
}

// ── Sub-components ────────────────────────────────────────────────────────────

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
  permissions,
  officerName,
}: {
  loanId: string;
  onClose: () => void;
  permissions: string[];
  officerName: string;
}) {
  const queryClient = useQueryClient();
  const [actionNote, setActionNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState<null | "approve" | "reject">(null);
  const [noteText, setNoteText] = useState("");

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

  const noteMut = useMutation({
    mutationFn: () => addLoanNoteApi(loanId, noteText.trim()),
    onSuccess: () => { toast.success("Note added"); setNoteText(""); invalidate(); },
    onError: (e) => toast.error((e as ApiError).response?.data?.detail || "Failed to add note"),
  });

  const statusMut = useMutation({
    mutationFn: (override: string | null) => updateLoanStatusApi(loanId, override),
    onSuccess: () => { toast.success("Loan status updated"); invalidate(); },
    onError: (e) => toast.error((e as ApiError).response?.data?.detail || "Failed to update status"),
  });

  const anyPending = approveMut.isPending || rejectMut.isPending || disburseMut.isPending || closeMut.isPending || noteMut.isPending || statusMut.isPending;

  const has = (p: string) => permissions.includes(p);
  const canApprove = has("loans.approve");
  const canDisburse = has("loans.disburse");
  const canReject = has("loans.reject");
  const canUpdate = has("loans.update");
  const canAct = canApprove || canDisburse || canReject;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-zinc-950/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 w-full max-w-lg h-full shadow-2xl overflow-y-auto flex flex-col">
        {/* Sticky header */}
        <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 px-5 py-4 flex justify-between items-start z-10 shrink-0">
          <div>
            <h3 className="font-black text-zinc-900 dark:text-zinc-50">{isLoading ? "Loading..." : loan?.client}</h3>
            <p className="text-xs font-mono text-zinc-400 mt-0.5">{!isLoading && loan?.loan_number}</p>
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
              <MoneyRow label="Principal" value={formatKES(loan.amount)} />
              {loan.status !== "Pending" && loan.status !== "Approved" && (
                <MoneyRow label="Interest (20% flat)" value={formatKES(loan.interest_amount)} color="text-[#F57424]" />
              )}
              {loan.status !== "Pending" && loan.status !== "Approved" && (
                <MoneyRow label="Total Repayable" value={formatKES(loan.total_repayable)} bold />
              )}
              <MoneyRow label="Amount Repaid (verified)" value={formatKES(loan.amount_repaid)} color="text-emerald-600" />
              <MoneyRow label="Outstanding Balance" value={formatKES(loan.outstanding)}
                color={loan.outstanding > 0 ? "text-rose-600" : "text-emerald-600"} bold />
              <MoneyRow label="Application Fee" value={formatKES(loan.application_fee)} color="text-zinc-400" />
            </div>

            {/* Installment Schedule */}
            {loan.installments && loan.installments.length > 0 && (
              <div className="bg-zinc-50 dark:bg-zinc-850/30 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-4 space-y-3">
                <InstallmentTimeline installments={loan.installments} />
              </div>
            )}

            {/* Overdue / Penalty */}
            {loan.is_overdue && (
              <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-2xl p-4 space-y-1">
                <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-bold text-xs">
                  <Flame className="size-3.5" /><span>OVERDUE — {loan.days_overdue} days past due</span>
                </div>
                <p className="text-xs text-rose-600 dark:text-rose-400">
                  Penalty: <strong>{formatKES(loan.penalty_amount)}</strong>
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
              {loan.status_override && loan.status_override_by && (
                <MoneyRow label="Status Marked By" value={`${loan.status_override_by} → ${loan.status_override}`} color="text-[#0D44A2]" />
              )}
              {loan.notes && (
                <div className="py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                  <p className="text-xs text-zinc-500 font-bold">Notes</p>
                  <p className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap mt-1">{loan.notes}</p>
                </div>
              )}
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
                      <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{formatKES(r.amount)}</p>
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

                {/* Manager/Director: manual status override on active loans */}
                {canUpdate && loan.db_status === "Disbursed" && (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Loan Status (manual override)</Label>
                    <select
                      value={loan.status_override ?? "Auto"}
                      onChange={(e) => statusMut.mutate(e.target.value === "Auto" ? null : e.target.value)}
                      disabled={statusMut.isPending}
                      className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="Auto">Auto (computed)</option>
                      <option value="Defaulter">Defaulter</option>
                      <option value="Past Maturity">Past Maturity</option>
                      <option value="Arrears">Arrears</option>
                      <option value="Performing">Performing</option>
                      <option value="Almost Due">Almost Due</option>
                      <option value="Due">Due</option>
                    </select>
                    {loan.status_override && (
                      <p className="text-[10px] text-zinc-400">
                        <Tag className="size-3 inline mr-1" />
                        Marked by {loan.status_override_by ?? "a manager"} — choose Auto to clear.
                      </p>
                    )}
                  </div>
                )}

                {/* Manager/Director: add a note to the loan */}
                {canUpdate && (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Add Note</Label>
                    <Textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="e.g. Client visited the branch, promised payment Friday"
                      className="rounded-xl text-sm min-h-[70px]"
                    />
                    <Button
                      onClick={() => noteMut.mutate()}
                      disabled={noteMut.isPending || !noteText.trim()}
                      className="w-full bg-zinc-800 hover:bg-zinc-900 text-white rounded-xl h-9 text-xs font-bold dark:bg-zinc-700"
                    >
                      {noteMut.isPending ? <Loader2 className="animate-spin size-3.5" /> : <StickyNote className="size-3.5 mr-1.5" />}
                      Add Note
                    </Button>
                  </div>
                )}

                {/* Role restriction message */}
                {!canAct && (
                  <div className="flex items-center gap-2 p-3 bg-zinc-50 dark:bg-zinc-850 rounded-xl border border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500">
                    <Lock className="size-3.5 shrink-0" />
                    <span>Your role is read-only for loans. Approve/Disburse actions require the relevant loan permission.</span>
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
  const { name: officerName, permissions } = useRole();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [deepLinkLoanId, setDeepLinkLoanId] = useState<string | null>(null);
  const [form, setForm] = useState({
    client_id: "", product_id: "", sector: "Retail & Trade", amount: "", notes: "",
  });
  const [feeForm, setFeeForm] = useState({ mode: "Cash", reference: "", notes: "" });

  // ── Deep-links: /loans?loan=<id> opens the drawer, /loans?apply=true opens the form ──
  // One-shot on mount (avoids useSearchParams Suspense constraint); param cleared via replaceState.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loanParam = params.get("loan");
    const applyParam = params.get("apply");
    if (loanParam) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDeepLinkLoanId(loanParam);
      window.history.replaceState({}, "", window.location.pathname);
    } else if (applyParam === "true" && !showNewForm) {
      setShowNewForm(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { selectedBranchId } = useBranch();

  const { data: loans = [], isLoading } = useQuery({
    queryKey: ["loans", selectedBranchId],
    queryFn: () => fetchLoansApi(selectedBranchId),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", selectedBranchId],
    queryFn: () => fetchClientsApi(selectedBranchId),
  });

  const { data: products = [] } = useQuery({ queryKey: ["loan-products"], queryFn: fetchLoanProductsApi });

  const parsedAmount = parseFloat(form.amount);

  const { data: quote } = useQuery({
    queryKey: ["feeQuote", form.client_id, parsedAmount],
    queryFn: () => fetchFeeQuoteApi(form.client_id, parsedAmount),
    enabled: !!form.client_id && !Number.isNaN(parsedAmount) && parsedAmount >= 4000,
  });

  const { data: fees = [], refetch: refetchFees } = useQuery({
    queryKey: ["fees", form.client_id],
    queryFn: () => fetchFeesApi(form.client_id),
    enabled: !!form.client_id,
  });

  const paidFee = fees.find((f) => f.verified && !f.loan_id && f.amount === quote?.amount);
  const canRecordFee = permissions.includes("fees.record");
  const canVerifyFee = permissions.includes("fees.verify");

  const recordFeeMut = useMutation({
    mutationFn: () =>
      recordFeeApi({
        client_id: form.client_id,
        amount: quote?.amount ?? 0,
        mode: feeForm.mode,
        reference: feeForm.reference || undefined,
        notes: feeForm.notes || undefined,
      }),
    onSuccess: () => {
      toast.success("Fee payment recorded — pending verification");
      refetchFees();
      setFeeForm({ mode: "Cash", reference: "", notes: "" });
    },
    onError: (e) => toast.error((e as ApiError).response?.data?.detail || "Failed to record fee"),
  });

  const verifyFeeMut = useMutation({
    mutationFn: (feeId: string) => verifyFeeApi(feeId),
    onSuccess: () => {
      toast.success("Fee payment verified");
      refetchFees();
    },
    onError: (e) => toast.error((e as ApiError).response?.data?.detail || "Failed to verify fee"),
  });

  const createMut = useMutation({
    mutationFn: () =>
      createLoanApi({
        client_id: form.client_id,
        loan_product_id: form.product_id,
        amount: parsedAmount,
        sector: form.sector,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      toast.success("Loan application submitted!");
      setShowNewForm(false);
      setForm({ client_id: "", product_id: "", sector: "Retail & Trade", amount: "", notes: "" });
      setFeeForm({ mode: "Cash", reference: "", notes: "" });
    },
    onError: (e) => toast.error((e as ApiError).response?.data?.detail || "Submission failed"),
  });


  const canCreate = permissions.includes("loans.create");

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
                      <p className="text-[10px] font-mono text-zinc-400">{loan.loan_number} · {loan.sector}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge status={loan.status} />
                      {loan.is_overdue && (
                        <span className="text-[9px] font-bold text-rose-600 flex items-center gap-0.5"><Flame className="size-2.5" />{loan.days_overdue}d overdue</span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-zinc-100 dark:border-zinc-800">
                    <span className="text-[10px] text-zinc-400">Principal: {formatKES(loan.amount)}</span>
                    <span className={`text-xs font-black ${loan.outstanding > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      Outstanding: {formatKES(loan.outstanding)}
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
                    <th className="py-3 px-2">Loan No.</th>
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
                      <td className="py-3 px-2 font-mono font-bold text-zinc-500 text-[10px]">{loan.loan_number}</td>
                      <td className="py-3 px-2 font-bold text-zinc-900 dark:text-zinc-100">{loan.client}</td>
                      <td className="py-3 px-2 text-zinc-500">{loan.sector}</td>
                      <td className="py-3 px-2 font-bold text-[#0D44A2] dark:text-blue-400">{formatKES(loan.amount)}</td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-1">
                          {loan.is_overdue && <Flame className="size-3 text-rose-500 shrink-0" />}
                          <span className={`font-bold ${loan.outstanding > 0 ? loan.is_overdue ? "text-rose-600" : "text-zinc-700 dark:text-zinc-200" : "text-emerald-600"}`}>
                            {formatKES(loan.outstanding)}
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

            <form onSubmit={(e) => {
              e.preventDefault();
              if (!form.client_id) return toast.error("Select a client");
              if (!form.product_id) return toast.error("Select a loan product");
              if (Number.isNaN(parsedAmount) || parsedAmount < 4000) return toast.error("Minimum loan amount is KES 4,000");
              if (!paidFee) return toast.error("Application fee must be paid and verified first");
              createMut.mutate();
            }} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Client <span className="text-rose-500">*</span></Label>
                <select value={form.client_id} onChange={e => setForm({...form, client_id: e.target.value})}
                  className="w-full h-10 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 rounded-xl text-sm px-3 focus:outline-none">
                  <option value="">Select client…</option>
                  {clients.map((c: Client) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Loan Product <span className="text-rose-500">*</span></Label>
                <select value={form.product_id} onChange={e => setForm({...form, product_id: e.target.value})}
                  className="w-full h-10 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 rounded-xl text-sm px-3 focus:outline-none">
                  <option value="">Select product…</option>
                  {products.map((p: LoanProduct) => (
                    <option key={p.id} value={p.id}>{p.name} — {p.duration_days} days @ {(p.interest_rate * 100).toFixed(0)}%</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Principal (KES) <span className="text-rose-500">*</span></Label>
                  <Input type="number" min={4000} value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} placeholder="e.g. 500000" required className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Sector <span className="text-rose-500">*</span></Label>
                  <select value={form.sector} onChange={e => setForm({...form, sector: e.target.value})}
                    className="w-full h-10 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 rounded-xl text-sm px-3 focus:outline-none">
                    {SECTOR_OPTIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Fee quote */}
              {form.client_id && !Number.isNaN(parsedAmount) && parsedAmount < 4000 && (
                <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-xl p-3 text-xs text-rose-700 dark:text-rose-400 font-semibold">
                  Minimum loan amount is KES 4,000.
                </div>
              )}
              {quote && (
                <div className="bg-[#0D44A2]/5 border border-[#0D44A2]/15 rounded-xl p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#0D44A2]">Application Fee ({quote.tier === "existing" ? "Existing client" : "New client"})</span>
                    <span className="font-black text-sm text-[#0D44A2]">{formatKES(quote.amount)}</span>
                  </div>
                  <p className="text-zinc-500 dark:text-zinc-400">Must be paid and verified before the application can be submitted.</p>
                </div>
              )}

              {/* Fee payment status */}
              {paidFee && (
                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 text-xs flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span><strong>{formatKES(paidFee.amount)}</strong> fee paid & verified{paidFee.verified_by ? ` by ${paidFee.verified_by}` : ""}.</span>
                </div>
              )}

              {!paidFee && quote && (
                <div className="space-y-3">
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <Clock className="size-4 shrink-0" />
                    <span>Awaiting verified fee payment of <strong>{formatKES(quote.amount)}</strong>.</span>
                  </div>

                  {/* Recent fees */}
                  {fees.length > 0 && (
                    <div className="space-y-1.5">
                      {fees.map((f) => (
                        <div key={f.id} className="flex items-center justify-between border border-zinc-100 dark:border-zinc-800 rounded-xl p-2.5 text-xs">
                          <div className="min-w-0">
                            <p className="font-bold text-zinc-900 dark:text-zinc-100">{formatKES(f.amount)} · {f.mode}</p>
                            <p className="text-[10px] text-zinc-400 truncate">
                              {f.reference || "No reference"} · recorded by {f.recorded_by || "—"}
                              {f.loan_number ? ` · used on ${f.loan_number}` : ""}
                            </p>
                          </div>
                          {f.verified ? (
                            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 shrink-0"><BadgeCheck className="size-3" />Verified</span>
                          ) : (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1"><Clock className="size-3" />Pending</span>
                              {canVerifyFee && (
                                <Button type="button" variant="outline" size="sm" disabled={verifyFeeMut.isPending}
                                  onClick={() => verifyFeeMut.mutate(f.id)}
                                  className="rounded-lg h-7 text-[10px] font-bold border-amber-200 text-amber-700 hover:bg-amber-50 cursor-pointer">
                                  Verify
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Record fee */}
                  {canRecordFee && (
                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 space-y-2.5 bg-zinc-50/50 dark:bg-zinc-900/50">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Record fee payment — {formatKES(quote.amount)}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <select value={feeForm.mode} onChange={e => setFeeForm({...feeForm, mode: e.target.value})}
                          className="h-10 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl text-xs px-3 focus:outline-none">
                          {["Cash", "MPesa", "BankTransfer", "Cheque", "Other"].map(m => <option key={m}>{m}</option>)}
                        </select>
                        <Input value={feeForm.reference} onChange={e => setFeeForm({...feeForm, reference: e.target.value})} placeholder="M-Pesa ref (optional)" className="rounded-xl text-xs" />
                      </div>
                      <Button type="button" disabled={recordFeeMut.isPending} onClick={() => recordFeeMut.mutate()}
                        className="w-full bg-[#0D44A2] hover:bg-[#0A3682] text-white rounded-xl h-10 text-xs font-bold cursor-pointer">
                        {recordFeeMut.isPending ? <Loader2 className="animate-spin size-4" /> : <Banknote className="size-4 mr-1" />}
                        Record Payment
                      </Button>
                      <p className="text-[10px] text-zinc-400">A manager must verify this payment before the application can be submitted.</p>
                    </div>
                  )}
                  {!canRecordFee && (
                    <p className="text-[10px] text-zinc-400">Ask a loan officer to record the fee payment.</p>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Notes / Purpose</Label>
                <Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="e.g. Seasonal stock purchase" className="rounded-xl" />
              </div>
              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" onClick={() => setShowNewForm(false)} className="flex-1 rounded-xl h-10 text-xs font-bold">Cancel</Button>
                <Button type="submit" disabled={createMut.isPending || !paidFee} className="flex-1 bg-[#0D44A2] hover:bg-[#0A3682] text-white rounded-xl h-10 text-xs font-bold">
                  {createMut.isPending ? <Loader2 className="animate-spin size-4" /> : <Save className="size-4 mr-1" />}
                  Submit Application
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loan Detail Drawer */}
      {(selectedLoanId || deepLinkLoanId) && (
        <LoanDrawer loanId={selectedLoanId ?? deepLinkLoanId!} onClose={() => { setSelectedLoanId(null); setDeepLinkLoanId(null); }} permissions={permissions} officerName={officerName} />
      )}
    </div>
  );
}
