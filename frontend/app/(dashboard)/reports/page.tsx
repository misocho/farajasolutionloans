"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote, Calendar, CheckCircle2, Download, Flame, Loader2, Plus,
  Receipt, RefreshCw, TrendingUp, X,
} from "lucide-react";
import {
  BarChart, Bar, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";

import {
  fetchPortfolioReportApi, fetchArrearsReportApi, fetchCollectionsReportApi,
  fetchPnlReportApi, fetchPnlSeriesApi, fetchExpensesApi,
  createExpenseApi, verifyExpenseApi, fetchBranchesApi,
  EXPENSE_CATEGORIES,
  type PnlReport, type PnlSeriesPoint, type Expense, type ExpenseCreateData,
} from "@/features/clients/api";
import { fetchMeApi } from "@/features/auth/api";
import { formatKES } from "@/app/lib/format";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const CHART_COLORS = ["#0D44A2", "#F57424", "#10B981", "#8B5CF6", "#EC4899", "#F59E0B", "#06B6D4"];

// ── Types (mirror backend /reports/*) ─────────────────────────────────────────

interface PortfolioLoan {
  loan_number: string;
  client: string;
  branch: string | null;
  product: string | null;
  sector: string | null;
  principal: number;
  total_repayable: number;
  outstanding: number;
  days_overdue: number;
  penalty: number;
  due_date: string | null;
  days_to_due: number | null;
  is_overdue: boolean;
  is_almost_due: boolean;
}

interface PortfolioReport {
  generated_at: string;
  summary: {
    total_active_loans: number;
    total_principal: number;
    total_outstanding: number;
    total_penalty: number;
    overdue_count: number;
    on_track_count: number;
  };
  loans: PortfolioLoan[];
}

interface ArrearsLoan {
  loan_number: string;
  client: string;
  client_phone: string;
  branch: string | null;
  sector: string | null;
  principal: number;
  outstanding: number;
  days_overdue: number;
  penalty: number;
  total_due: number;
  due_date: string | null;
}

interface ArrearsReport {
  generated_at: string;
  summary: {
    total_overdue_loans: number;
    total_overdue_amount: number;
    total_penalty: number;
  };
  loans: ArrearsLoan[];
}

interface CollectionRepayment {
  id: string;
  date: string;
  client: string;
  loan_number: string;
  amount: number;
  mode: string;
  reference: string | null;
  recorded_by: string;
  verified: boolean;
}

interface CollectionsReport {
  generated_at: string;
  period: { from: string; to: string };
  summary: {
    total_repayments: number;
    verified_count: number;
    unverified_count: number;
    total_collected: number;
    total_pending_verification: number;
  };
  repayments: CollectionRepayment[];
}

// ── Shared ────────────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, color = "text-zinc-900 dark:text-zinc-50" }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3.5 sm:p-4 rounded-[20px] shadow-sm text-left">
      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{label}</p>
      <p className={`text-lg sm:text-2xl font-black mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Portfolio Report Tab ──────────────────────────────────────────────────────

function PortfolioTab() {
  const { data, isLoading } = useQuery<PortfolioReport>({
    queryKey: ["report-portfolio"],
    queryFn: () => fetchPortfolioReportApi(),
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#0D44A2] size-7" /></div>;
  if (!data) return null;

  const s = data.summary;
  const interestEarned = data.loans.reduce((sum, l) => sum + (l.total_repayable - l.principal), 0);

  const bySectorMap = new Map<string, number>();
  for (const l of data.loans) {
    const sector = l.sector || "Unspecified";
    bySectorMap.set(sector, (bySectorMap.get(sector) ?? 0) + l.principal);
  }
  const bySectorData = [...bySectorMap.entries()].map(([sector, amount], i) => ({
    sector, amount, fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const handleExport = () => {
    const rows: (string | number)[][] = [
      ["Faraja Solution Loans — Portfolio Report"],
      [],
      ["Loan No.", "Client", "Sector", "Principal", "Outstanding", "Due"],
      ...data.loans.map((l) => [
        l.loan_number, l.client, l.sector || "Retail", l.principal, l.outstanding,
        l.days_overdue > 0 ? `${l.days_overdue}d overdue` : l.days_to_due === 0 ? "Due today" : l.days_to_due !== null ? `in ${l.days_to_due}d` : "",
      ]),
    ];
    downloadCsv("portfolio.csv", rows);
  };

  return (
    <div className="space-y-5">
      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
        <KPICard label="Total Disbursed" value={formatKES(s.total_principal)} sub={`${s.total_active_loans} active loans`} color="text-[#0D44A2]" />
        <KPICard label="Outstanding" value={formatKES(s.total_outstanding)} sub={`${s.on_track_count} on track`} color="text-rose-600" />
        <KPICard label="Interest Earned" value={formatKES(interestEarned)} sub="Flat interest on disbursed" color="text-[#F57424]" />
        <KPICard label="Penalty Exposure" value={formatKES(s.total_penalty)} sub="3% per 2 days overdue" color={s.overdue_count > 0 ? "text-rose-600" : "text-zinc-500"} />
        <KPICard label="Overdue Loans" value={`${s.overdue_count}`} sub="Past due date" color="text-amber-600" />
      </div>

      {/* Sector chart */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[20px] shadow-sm">
        <p className="text-xs font-black text-zinc-700 dark:text-zinc-300 mb-3">Portfolio by Sector</p>
        {bySectorData.length > 0 ? (
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={bySectorData} dataKey="amount" nameKey="sector" cx="50%" cy="50%" outerRadius={60}>
                  {bySectorData.map((entry) => <Cell key={entry.sector} fill={entry.fill} />)}
                </Pie>
                <Tooltip formatter={(v) => [formatKES(Number(v)), ""]} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: "9px", fontWeight: 700 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="text-xs text-zinc-400 py-8 text-center">No disbursed loans yet</p>}
      </div>

      {/* Loans Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[20px] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
          <p className="text-xs font-black text-zinc-700 dark:text-zinc-300">Disbursed Loans</p>
          <Button variant="ghost" onClick={handleExport} className="h-9 rounded-xl text-xs font-bold gap-1.5">
            <Download className="size-3.5" /> Export CSV
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-zinc-50/50 dark:bg-zinc-800/20">
              <tr className="text-zinc-400 font-bold uppercase tracking-wider text-[9px]">
                <th className="py-2.5 px-3">Loan No.</th>
                <th className="py-2.5 px-3">Client</th>
                <th className="py-2.5 px-3">Sector</th>
                <th className="py-2.5 px-3">Principal</th>
                <th className="py-2.5 px-3">Outstanding</th>
                <th className="py-2.5 px-3">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100/50 dark:divide-zinc-800/50">
              {data.loans.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-zinc-400">No disbursed loans.</td></tr>
              ) : data.loans.map((l) => (
                <tr key={l.loan_number} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10">
                  <td className="py-2.5 px-3 font-mono text-[10px] text-zinc-500">{l.loan_number}</td>
                  <td className="py-2.5 px-3 font-bold text-zinc-900 dark:text-zinc-100">{l.client}</td>
                  <td className="py-2.5 px-3 text-zinc-500">{l.sector || "Retail"}</td>
                  <td className="py-2.5 px-3 font-bold text-[#0D44A2]">{formatKES(l.principal)}</td>
                  <td className="py-2.5 px-3">
                    <span className={`font-bold ${l.outstanding > 0 ? "text-zinc-700 dark:text-zinc-200" : "text-emerald-600"}`}>
                      {l.outstanding > 0 ? formatKES(l.outstanding) : "Fully Paid"}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    {l.days_overdue > 0 ? (
                      <span className="font-bold text-rose-600">{l.days_overdue}d overdue</span>
                    ) : l.days_to_due === 0 ? (
                      <span className="font-bold text-[#F57424]">Due today</span>
                    ) : l.days_to_due !== null ? (
                      <span className="text-zinc-500">in {l.days_to_due}d</span>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Arrears Report Tab ────────────────────────────────────────────────────────

function ArrearsTab() {
  const { data, isLoading } = useQuery<ArrearsReport>({
    queryKey: ["report-arrears"],
    queryFn: () => fetchArrearsReportApi(),
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-rose-500 size-7" /></div>;
  if (!data) return null;

  const s = data.summary;

  const handleExport = () => {
    const rows: (string | number)[][] = [
      ["Faraja Solution Loans — Arrears Report"],
      [],
      ["Loan No.", "Client", "Sector", "Due Date", "Days Overdue", "Outstanding", "Penalty"],
      ...data.loans.map((l) => [
        l.loan_number, l.client, l.sector || "Retail", l.due_date ?? "", l.days_overdue, l.outstanding, l.penalty,
      ]),
      [],
      ["TOTAL EXPOSURE", "", "", "", "", s.total_overdue_amount, s.total_penalty],
    ];
    downloadCsv("arrears.csv", rows);
  };

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <KPICard label="Overdue Loans" value={`${s.total_overdue_loans}`} sub="Past due date" color="text-rose-600" />
        <KPICard label="Overdue Outstanding" value={formatKES(s.total_overdue_amount)} sub="Principal + interest" color="text-rose-600" />
        <KPICard label="Penalty Exposure" value={formatKES(s.total_penalty)} sub="3% per 2 days overdue" color="text-[#F57424]" />
      </div>

      {data.loans.length === 0 ? (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 text-center">
          <CheckCircle2 className="size-8 text-emerald-500 mx-auto mb-2" />
          <p className="font-bold text-emerald-700 dark:text-emerald-400">No overdue loans!</p>
          <p className="text-xs text-emerald-600/70 mt-1">All disbursed loans are within their repayment period.</p>
        </div>
      ) : (
        <>
          <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-2xl p-3 flex items-center justify-between gap-2">
            <div className="flex items-start gap-2">
              <Flame className="size-4 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-700 dark:text-rose-400">
                <strong>{s.total_overdue_loans} loans</strong> are past their due date. Penalty accrues at <strong>3% every 2 days</strong> on the outstanding balance.
              </p>
            </div>
            <Button variant="ghost" onClick={handleExport} className="h-9 rounded-xl text-xs font-bold gap-1.5 shrink-0">
              <Download className="size-3.5" /> Export CSV
            </Button>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden flex flex-col gap-3">
            {data.loans.map((l) => (
              <div key={l.loan_number} className="border border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/10 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{l.client}</p>
                    <p className="text-[10px] font-mono text-zinc-400">{l.loan_number}</p>
                  </div>
                  <span className="text-xs font-black text-rose-600 bg-rose-100 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded-lg">
                    {l.days_overdue}d overdue
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1 pt-1 border-t border-rose-100 dark:border-rose-900 text-xs">
                  <div><p className="text-[10px] text-zinc-400">Outstanding</p><p className="font-bold text-rose-700">{formatKES(l.outstanding)}</p></div>
                  <div><p className="text-[10px] text-zinc-400">Penalty</p><p className="font-bold text-[#F57424]">{formatKES(l.penalty)}</p></div>
                  <div><p className="text-[10px] text-zinc-400">Due Date</p><p className="font-bold text-zinc-700 dark:text-zinc-300">{l.due_date ?? "—"}</p></div>
                  <div><p className="text-[10px] text-zinc-400">Sector</p><p className="font-bold text-zinc-600 dark:text-zinc-400">{l.sector || "Retail"}</p></div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[20px] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-rose-50/50 dark:bg-rose-950/10">
                  <tr className="text-zinc-400 font-bold uppercase tracking-wider text-[9px]">
                    <th className="py-2.5 px-3">Loan No.</th>
                    <th className="py-2.5 px-3">Client</th>
                    <th className="py-2.5 px-3">Sector</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3">Days Overdue</th>
                    <th className="py-2.5 px-3">Outstanding</th>
                    <th className="py-2.5 px-3">Penalty (KES)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100/50 dark:divide-zinc-800/50">
                  {data.loans.map((l) => (
                    <tr key={l.loan_number} className={`${l.days_overdue >= 8 ? "bg-rose-50/30 dark:bg-rose-950/5" : ""}`}>
                      <td className="py-2.5 px-3 font-mono text-[10px] text-zinc-500">{l.loan_number}</td>
                      <td className="py-2.5 px-3 font-bold text-zinc-900 dark:text-zinc-100">{l.client}</td>
                      <td className="py-2.5 px-3 text-zinc-500">{l.sector || "Retail"}</td>
                      <td className="py-2.5 px-3 text-zinc-500">{l.due_date ?? "—"}</td>
                      <td className="py-2.5 px-3">
                        <span className={`font-black ${l.days_overdue >= 8 ? "text-rose-600" : "text-amber-600"}`}>
                          {l.days_overdue} days
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-rose-700 dark:text-rose-400">{formatKES(l.outstanding)}</td>
                      <td className="py-2.5 px-3 font-bold text-[#F57424]">{formatKES(l.penalty)}</td>
                    </tr>
                  ))}
                  <tr className="bg-zinc-50 dark:bg-zinc-800/30 font-black">
                    <td colSpan={5} className="py-2.5 px-3 text-xs text-zinc-700 dark:text-zinc-300">TOTAL EXPOSURE</td>
                    <td className="py-2.5 px-3 text-xs text-rose-700 font-black">{formatKES(s.total_overdue_amount)}</td>
                    <td className="py-2.5 px-3 text-xs text-[#F57424] font-black">{formatKES(s.total_penalty)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Collections Report Tab ────────────────────────────────────────────────────

function CollectionsTab() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [queryKey, setQueryKey] = useState<[string, string?, string?]>(["report-collections"]);

  const { data, isLoading, refetch } = useQuery<CollectionsReport>({
    queryKey,
    queryFn: () => fetchCollectionsReportApi(dateFrom || undefined, dateTo || undefined),
  });

  const handleFilter = () => {
    setQueryKey(["report-collections", dateFrom, dateTo]);
    refetch();
  };

  const verified = (data?.repayments ?? []).filter((r) => r.verified);

  const byModeMap = new Map<string, number>();
  for (const r of verified) {
    byModeMap.set(r.mode, (byModeMap.get(r.mode) ?? 0) + r.amount);
  }
  const byModeData = [...byModeMap.entries()].map(([mode, amount], i) => ({
    mode, amount, fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const byLoanMap = new Map<string, { loan_number: string; client: string; count: number; amount: number }>();
  for (const r of verified) {
    const cur = byLoanMap.get(r.loan_number) ?? { loan_number: r.loan_number, client: r.client, count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += r.amount;
    byLoanMap.set(r.loan_number, cur);
  }
  const byLoanData = [...byLoanMap.values()];

  const handleExport = () => {
    const rows: (string | number)[][] = [
      ["Faraja Solution Loans — Collections Report"],
      ["Period", dateFrom || "all dates", dateTo || "all dates"],
      [],
      ["Loan No.", "Client", "Payments", "Total Collected"],
      ...byLoanData.map((l) => [l.loan_number, l.client, l.count, l.amount]),
    ];
    downloadCsv("collections.csv", rows);
  };

  return (
    <div className="space-y-5">
      {/* Date filter */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[20px] shadow-sm space-y-3">
        <p className="text-xs font-black text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
          <Calendar className="size-3.5 text-[#0D44A2]" />Filter by Date Range
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="flex-1 h-10 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 rounded-xl text-sm px-3 text-zinc-700 dark:text-zinc-300 focus:outline-none" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="flex-1 h-10 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 rounded-xl text-sm px-3 text-zinc-700 dark:text-zinc-300 focus:outline-none" />
          <button onClick={handleFilter} className="flex items-center gap-2 h-10 px-4 bg-[#0D44A2] hover:bg-[#0A3682] text-white rounded-xl text-xs font-bold shrink-0 cursor-pointer">
            <RefreshCw className="size-3.5" />Apply
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#0D44A2] size-7" /></div>
      ) : data ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <KPICard label="Total Collected" value={formatKES(data.summary.total_collected)} sub={`${data.summary.verified_count} verified payments`} color="text-emerald-600" />
            <KPICard label="Pending Verification" value={formatKES(data.summary.total_pending_verification)} sub={`${data.summary.unverified_count} payments`} color="text-amber-600" />
            <KPICard label="Payment Methods" value={`${byModeData.length}`} sub="Distinct modes used" color="text-[#0D44A2]" />
          </div>

          {/* By Mode chart */}
          {byModeData.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[20px] shadow-sm">
              <p className="text-xs font-black text-zinc-700 dark:text-zinc-300 mb-3">Verified Collections by Payment Mode</p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byModeData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <XAxis dataKey="mode" tick={{ fontSize: 9, fontWeight: 700 }} />
                    <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={(v) => [formatKES(Number(v)), ""]} />
                    <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                      {byModeData.map((entry) => <Cell key={entry.mode} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* By Loan */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[20px] shadow-sm overflow-hidden">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <p className="text-xs font-black text-zinc-700 dark:text-zinc-300">Collections per Loan</p>
              {byLoanData.length > 0 && (
                <Button variant="ghost" onClick={handleExport} className="h-9 rounded-xl text-xs font-bold gap-1.5">
                  <Download className="size-3.5" /> Export CSV
                </Button>
              )}
            </div>
            {byLoanData.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-8">No verified payments in this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-zinc-50/50 dark:bg-zinc-800/20">
                    <tr className="text-zinc-400 font-bold uppercase tracking-wider text-[9px]">
                      <th className="py-2.5 px-3">Loan No.</th>
                      <th className="py-2.5 px-3">Client</th>
                      <th className="py-2.5 px-3">Payments</th>
                      <th className="py-2.5 px-3">Total Collected</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100/50 dark:divide-zinc-800/50">
                    {byLoanData.map((l) => (
                      <tr key={l.loan_number} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10">
                        <td className="py-2.5 px-3 font-mono text-[10px] text-[#0D44A2]">{l.loan_number}</td>
                        <td className="py-2.5 px-3 font-bold text-zinc-900 dark:text-zinc-100">{l.client}</td>
                        <td className="py-2.5 px-3 text-zinc-500">{l.count} payment{l.count !== 1 ? "s" : ""}</td>
                        <td className="py-2.5 px-3 font-black text-emerald-600">{formatKES(l.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

// ── Profit & Loss Report Tab ─────────────────────────────────────────────────

const EXPENSE_MODES = ["Cash", "MPesa", "BankTransfer", "Cheque", "Other"];

const fmtMonth = (iso: string) => {
  const [y, m] = iso.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-KE", { month: "short", year: "2-digit" });
};

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function StatementRow({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-1.5 ${muted ? "opacity-50" : ""}`}>
      <span className="text-xs text-zinc-600 dark:text-zinc-300">{label}</span>
      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100 tabular-nums">{value}</span>
    </div>
  );
}

function PnlTab() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [branchId, setBranchId] = useState("all");
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(today.toISOString().slice(0, 10));
  const [mode, setMode] = useState("Cash");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [expenseBranchId, setExpenseBranchId] = useState("");

  const queryClient = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: fetchMeApi });
  const meName = me ? `${me.first_name} ${me.last_name}`.trim() : "";
  const permissions = me?.permissions ?? [];
  // Mirrors backend get_user_branch_ids: branches.view_all holders are unrestricted
  const isScoped = !permissions.includes("branches.view_all");

  const periodFrom = `${year}-${String(month).padStart(2, "0")}-01`;
  const periodTo = `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;

  const { data: pnl, isLoading, isError, refetch } = useQuery<PnlReport>({
    queryKey: ["report-pnl", month, year, branchId],
    queryFn: () => fetchPnlReportApi(month, year, branchId),
  });
  const { data: seriesData } = useQuery<{ series: PnlSeriesPoint[] }>({
    queryKey: ["report-pnl-series", branchId],
    queryFn: () => fetchPnlSeriesApi(6, branchId),
  });
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: fetchBranchesApi, enabled: !isScoped });
  const { data: expenses } = useQuery<Expense[]>({
    queryKey: ["expenses", periodFrom, periodTo, branchId],
    queryFn: () => fetchExpensesApi({ date_from: periodFrom, date_to: periodTo, branch_id: branchId }),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["report-pnl"] });
    queryClient.invalidateQueries({ queryKey: ["report-pnl-series"] });
    queryClient.invalidateQueries({ queryKey: ["expenses"] });
  };

  const createExpense = useMutation({
    mutationFn: (payload: ExpenseCreateData) => createExpenseApi(payload),
    onSuccess: () => {
      toast.success("Expense recorded — pending approval");
      setShowExpenseForm(false);
      setAmount("");
      setReference("");
      setDescription("");
      invalidateAll();
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Failed to record expense"),
  });

  const verifyExpense = useMutation({
    mutationFn: (id: string) => verifyExpenseApi(id),
    onSuccess: () => {
      toast.success("Expense approved");
      invalidateAll();
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Approval failed"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    const branch = isScoped ? undefined : expenseBranchId || branches?.[0]?.id;
    createExpense.mutate({
      category: category as ExpenseCreateData["category"],
      amount: value,
      expense_date: expenseDate,
      mode,
      reference: reference || undefined,
      description: description || undefined,
      branch_id: branch,
    });
  };

  const handleExport = () => {
    if (!pnl) return;
    const totalIncome = pnl.income.interest_income + pnl.income.application_fee_income;
    const rows: (string | number)[][] = [
      ["Faraja Solution Loans — Profit & Loss"],
      [`Period`, `${pnl.period.month}/${pnl.period.year} (${pnl.period.from} to ${pnl.period.to})`],
      ["Branch", pnl.branch_name ?? "All branches"],
      [],
      ["REVENUE", ""],
      ["Interest income (loans disbursed)", pnl.income.interest_income],
      ["Application fees (verified)", pnl.income.application_fee_income],
      ["Unverified fees (pending)", pnl.income.unverified_fees],
      ["Penalties accrued (uncollected)", pnl.income.penalties_accrued],
      ["Total income", totalIncome],
      [],
      ["EXPENSES", ""],
      ["Verified operating expenses", pnl.expenses.verified],
      ["Unverified expenses (pending)", pnl.expenses.unverified],
      ["Total expenses", pnl.expenses.verified],
      [],
      ["NET INCOME", pnl.net_income],
      [],
      ["ACTIVITY", ""],
      ["Loans disbursed", pnl.activity.loans_disbursed],
      ["Principal disbursed", pnl.activity.principal_disbursed],
      ["Repayments collected", pnl.activity.repayments_collected],
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pnl-${pnl.period.year}-${String(pnl.period.month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalIncome = pnl ? pnl.income.interest_income + pnl.income.application_fee_income : 0;
  const chartData = (seriesData?.series ?? []).map((p) => ({
    name: fmtMonth(p.month),
    income: p.income,
    expenses: p.expenses,
    net: p.net,
  }));

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[20px] shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Month</Label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="h-9 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 px-3 text-xs font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{new Date(year, m - 1, 1).toLocaleDateString("en-KE", { month: "long" })}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Year</Label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="h-9 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 px-3 text-xs font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none"
            >
              {Array.from({ length: 6 }, (_, i) => today.getFullYear() - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          {!isScoped && (
            <div className="space-y-1 min-w-40 flex-1">
              <Label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Branch</Label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="h-9 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 px-3 text-xs font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none"
              >
                <option value="all">All branches</option>
                {(branches ?? []).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
          <Button
            variant="ghost"
            onClick={handleExport}
            disabled={!pnl}
            className="h-9 rounded-xl text-xs font-bold gap-1.5"
          >
            <Download className="size-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin size-6 text-zinc-400" />
        </div>
      ) : isError || !pnl ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-[20px] text-center shadow-sm">
          <p className="text-sm text-zinc-500">Could not load the report.</p>
          <button onClick={() => refetch()} className="mt-3 text-xs font-bold text-[#0D44A2] flex items-center gap-1.5 mx-auto cursor-pointer">
            <RefreshCw className="size-3.5" /> Retry
          </button>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KPICard label="Total Income" value={formatKES(totalIncome)} sub="Interest + application fees" color="text-[#0D44A2]" />
            <KPICard label="Expenses" value={formatKES(pnl.expenses.verified)} sub={`${pnl.expenses.unverified ? `${formatKES(pnl.expenses.unverified)} pending approval` : "All approved"}`} color="text-[#F57424]" />
            <KPICard label="Net Income" value={formatKES(pnl.net_income)} sub={pnl.net_income >= 0 ? "Profitable month" : "Loss-making month"} color={pnl.net_income >= 0 ? "text-emerald-600" : "text-rose-600"} />
            <KPICard label="Collected" value={formatKES(pnl.activity.repayments_collected)} sub={`${pnl.activity.loans_disbursed} loans disbursed`} color="text-zinc-900 dark:text-zinc-50" />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Statement */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[20px] shadow-sm">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                Profit &amp; Loss Statement — {pnl.period.month}/{pnl.period.year}
                {pnl.branch_name ? ` · ${pnl.branch_name}` : ""}
              </p>
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider py-1">Revenue</p>
                <StatementRow label="Interest income (loans disbursed)" value={formatKES(pnl.income.interest_income)} />
                <StatementRow label="Application fees (verified)" value={formatKES(pnl.income.application_fee_income)} />
                <StatementRow label="Unverified fees (pending approval)" value={formatKES(pnl.income.unverified_fees)} muted />
                <StatementRow label="Penalties accrued (not yet collected)" value={formatKES(pnl.income.penalties_accrued)} muted />
                <div className="flex justify-between items-center py-1.5 border-t border-zinc-100 dark:border-zinc-800 mt-1">
                  <span className="text-xs font-black text-zinc-800 dark:text-zinc-100">Total Income</span>
                  <span className="text-xs font-black text-zinc-800 dark:text-zinc-100 tabular-nums">{formatKES(totalIncome)}</span>
                </div>
              </div>
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider py-1">Expenses</p>
                <StatementRow label="Verified operating expenses" value={formatKES(pnl.expenses.verified)} />
                <StatementRow label="Unverified expenses (pending approval)" value={formatKES(pnl.expenses.unverified)} muted />
                <div className="flex justify-between items-center py-1.5 border-t border-zinc-100 dark:border-zinc-800 mt-1">
                  <span className="text-xs font-black text-zinc-800 dark:text-zinc-100">Total Expenses</span>
                  <span className="text-xs font-black text-zinc-800 dark:text-zinc-100 tabular-nums">{formatKES(pnl.expenses.verified)}</span>
                </div>
              </div>
              <div className={`flex justify-between items-center py-2.5 mt-2 px-3 rounded-xl ${pnl.net_income >= 0 ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-rose-50 dark:bg-rose-950/40"}`}>
                <span className="text-sm font-black text-zinc-900 dark:text-zinc-50">Net Income</span>
                <span className={`text-sm font-black tabular-nums ${pnl.net_income >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {formatKES(pnl.net_income)}
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-2">
                Income recognized when loans disburse (flat interest); fees and expenses only when verified.
              </p>
            </div>

            {/* Trend chart */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[20px] shadow-sm">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Income vs Expenses — last 6 months</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} width={36} />
                    <Tooltip formatter={(v) => [formatKES(Number(v)), ""]} contentStyle={{ fontSize: 11, borderRadius: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="income" name="Income" fill="#0D44A2" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Expenses" fill="#F57424" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] text-zinc-400 mt-2">
                Principal disbursed this period: {formatKES(pnl.activity.principal_disbursed)}
              </p>
            </div>
          </div>

          {/* Expenses */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[20px] shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Expenses</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {expenses?.filter((e) => e.verified).length ?? 0} approved · {expenses?.filter((e) => !e.verified).length ?? 0} pending approval
                </p>
              </div>
              {permissions.includes("expenses.create") && (
                <Button
                  onClick={() => setShowExpenseForm(true)}
                  className="h-9 rounded-xl bg-[#0D44A2] hover:bg-[#0A3682] text-white text-xs font-bold shadow flex items-center gap-1.5"
                >
                  <Plus className="size-3.5" /> Record Expense
                </Button>
              )}
            </div>
            {!permissions.includes("expenses.view") ? (
              <p className="text-xs text-zinc-400 py-4 text-center">You don&apos;t have permission to view expenses.</p>
            ) : (expenses ?? []).length === 0 ? (
              <p className="text-xs text-zinc-400 py-4 text-center">No expenses recorded for this period.</p>
            ) : (
              <div className="space-y-2">
                {(expenses ?? []).map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100">
                        {e.category} · {formatKES(e.amount)}
                        <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${e.verified ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300" : "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300"}`}>
                          {e.verified ? "Approved" : "Pending"}
                        </span>
                      </p>
                      <p className="text-[10px] text-zinc-400 truncate">
                        {e.expense_date} · {e.branch_name ?? "No branch"} · {e.mode}
                        {e.description ? ` — ${e.description}` : ""}
                        {e.recorded_by ? ` · by ${e.recorded_by}` : ""}
                      </p>
                    </div>
                    {!e.verified && permissions.includes("expenses.approve") && e.recorded_by !== meName && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => verifyExpense.mutate(e.id)}
                        disabled={verifyExpense.isPending}
                        className="h-8 rounded-lg text-[11px] font-bold text-emerald-600 gap-1.5 shrink-0"
                      >
                        <CheckCircle2 className="size-3.5" /> Approve
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal: Record Expense */}
      {showExpenseForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[28px] p-6 w-full max-w-md shadow-2xl animate-in fade-in-50 zoom-in-95 duration-200 text-left max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-50 text-base">Record Expense</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Needs approval before it counts in the P&amp;L.</p>
              </div>
              <button
                onClick={() => setShowExpenseForm(false)}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full cursor-pointer focus:outline-none"
              >
                <X className="size-5 text-zinc-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="expense-category" className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Category</Label>
                  <select
                    id="expense-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 px-3 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="expense-amount" className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Amount (KES)</Label>
                  <Input
                    id="expense-amount"
                    type="number"
                    min="1"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    className="h-10 rounded-xl border-zinc-200 dark:border-zinc-700 bg-zinc-50"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="expense-date" className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Date</Label>
                  <Input
                    id="expense-date"
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="h-10 rounded-xl border-zinc-200 dark:border-zinc-700 bg-zinc-50"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="expense-mode" className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Mode</Label>
                  <select
                    id="expense-mode"
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                    className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 px-3 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {EXPENSE_MODES.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="expense-ref" className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Reference (optional)</Label>
                <Input
                  id="expense-ref"
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. Invoice INV-1234"
                  className="h-10 rounded-xl border-zinc-200 dark:border-zinc-700 bg-zinc-50"
                />
              </div>

              {!isScoped && (
                <div className="space-y-1.5">
                  <Label htmlFor="expense-branch" className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Branch</Label>
                  <select
                    id="expense-branch"
                    value={expenseBranchId || branches?.[0]?.id || ""}
                    onChange={(e) => setExpenseBranchId(e.target.value)}
                    className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 px-3 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {(branches ?? []).map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="expense-desc" className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Description (optional)</Label>
                <Input
                  id="expense-desc"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What was it for?"
                  className="h-10 rounded-xl border-zinc-200 dark:border-zinc-700 bg-zinc-50"
                />
              </div>

              <div className="flex gap-2.5 justify-end pt-1">
                <Button
                  type="button"
                  onClick={() => setShowExpenseForm(false)}
                  variant="ghost"
                  className="h-10 rounded-xl text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createExpense.isPending}
                  className="h-10 rounded-xl bg-[#0D44A2] hover:bg-[#0A3682] text-white text-xs font-bold shadow flex items-center gap-1.5"
                >
                  {createExpense.isPending && <Loader2 className="animate-spin size-3.5" />}
                  Save Expense
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<"portfolio" | "arrears" | "collections" | "pnl">("portfolio");

  const tabs = [
    { id: "portfolio" as const, label: "Portfolio", icon: Banknote },
    { id: "arrears" as const, label: "Arrears", icon: Flame },
    { id: "collections" as const, label: "Collections", icon: Receipt },
    { id: "pnl" as const, label: "Profit & Loss", icon: TrendingUp },
  ];

  return (
    <div className="space-y-4 sm:space-y-5 max-w-4xl mx-auto pb-16 select-none">

      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] shadow-sm">
        <h2 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">Financial Reports</h2>
        <p className="text-xs text-zinc-400 mt-0.5">Live data — Portfolio summary, Arrears with penalties, Collections by mode, Profit &amp; Loss</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-2xl w-fit overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === t.id
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              <Icon className="size-3.5" />{t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "portfolio" && <PortfolioTab />}
      {activeTab === "arrears" && <ArrearsTab />}
      {activeTab === "collections" && <CollectionsTab />}
      {activeTab === "pnl" && <PnlTab />}
    </div>
  );
}
