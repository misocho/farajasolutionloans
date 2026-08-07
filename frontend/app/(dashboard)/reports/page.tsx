"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Banknote, Calendar, CheckCircle2, Flame, Loader2,
  Receipt, RefreshCw,
} from "lucide-react";
import {
  BarChart, Bar, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import {
  fetchPortfolioReportApi, fetchArrearsReportApi, fetchCollectionsReportApi,
} from "@/features/clients/api";
import { formatKES } from "@/app/lib/format";

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
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
          <p className="text-xs font-black text-zinc-700 dark:text-zinc-300">Disbursed Loans</p>
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
          <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-2xl p-3 flex items-start gap-2">
            <Flame className="size-4 text-rose-500 shrink-0 mt-0.5" />
            <p className="text-xs text-rose-700 dark:text-rose-400">
              <strong>{s.total_overdue_loans} loans</strong> are past their due date. Penalty accrues at <strong>3% every 2 days</strong> on the outstanding balance.
            </p>
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
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
              <p className="text-xs font-black text-zinc-700 dark:text-zinc-300">Collections per Loan</p>
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<"portfolio" | "arrears" | "collections">("portfolio");

  const tabs = [
    { id: "portfolio" as const, label: "Portfolio", icon: Banknote },
    { id: "arrears" as const, label: "Arrears", icon: Flame },
    { id: "collections" as const, label: "Collections", icon: Receipt },
  ];

  return (
    <div className="space-y-4 sm:space-y-5 max-w-4xl mx-auto pb-16 select-none">

      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] shadow-sm">
        <h2 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">Financial Reports</h2>
        <p className="text-xs text-zinc-400 mt-0.5">Live data — Portfolio summary, Arrears with penalties, Collections by mode</p>
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
    </div>
  );
}
