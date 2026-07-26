"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3, Download, TrendingUp, Banknote, Users, Receipt,
  Calendar, Loader2, Flame, AlertTriangle, CheckCircle2,
  Clock, ArrowUpRight, RefreshCw,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { toast } from "sonner";

import {
  fetchPortfolioReportApi, fetchArrearsReportApi,
  fetchCollectionsReportApi, type Loan,
} from "@/features/clients/api";

const CHART_COLORS = ["#0D44A2", "#F57424", "#10B981", "#8B5CF6", "#EC4899", "#F59E0B", "#06B6D4"];

const STATUS_CFG: Record<string, { color: string; icon: React.ElementType }> = {
  Pending:  { color: "text-amber-600", icon: Clock },
  Approved: { color: "text-blue-600", icon: CheckCircle2 },
  Disbursed:{ color: "text-emerald-600", icon: ArrowUpRight },
  Rejected: { color: "text-rose-600", icon: TrendingUp },
  Closed:   { color: "text-zinc-500", icon: CheckCircle2 },
};

function KPICard({ label, value, sub, color = "text-zinc-900 dark:text-zinc-50" }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-3.5 sm:p-4 rounded-[18px] sm:rounded-[20px] shadow-sm text-left">
      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{label}</p>
      <p className={`text-lg sm:text-2xl font-black mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, color = "text-[#0D44A2]" }: {
  icon: React.ElementType; title: string; color?: string;
}) {
  return (
    <div className={`flex items-center gap-2 font-black text-sm ${color}`}>
      <Icon className="size-4 shrink-0" />
      <span>{title}</span>
    </div>
  );
}

// ── Portfolio Report Tab ──────────────────────────────────────────────────────

function PortfolioTab() {
  const { data, isLoading } = useQuery({ queryKey: ["report-portfolio"], queryFn: fetchPortfolioReportApi });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#0D44A2] size-7" /></div>;
  if (!data) return null;

  const byStatusData = Object.entries(data.by_status || {}).map(([status, count]) => ({ status, count }));
  const bySectorData = (data.by_sector || []).map((s: any, i: number) => ({ ...s, fill: CHART_COLORS[i % CHART_COLORS.length] }));

  return (
    <div className="space-y-5">
      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
        <KPICard label="Total Disbursed" value={`KES ${(data.total_disbursed / 1000).toFixed(0)}K`} sub={`${data.loan_count} total loans`} color="text-[#0D44A2]" />
        <KPICard label="Outstanding" value={`KES ${(data.total_outstanding / 1000).toFixed(0)}K`} sub={`${data.active_loans} active loans`} color="text-rose-600" />
        <KPICard label="Collected" value={`KES ${(data.total_collected / 1000).toFixed(0)}K`} sub="Verified repayments" color="text-emerald-600" />
        <KPICard label="Interest Earned" value={`KES ${(data.total_interest / 1000).toFixed(0)}K`} sub="20% flat on disbursed" color="text-[#F57424]" />
        <KPICard label="Penalty Exposure" value={`KES ${(data.total_penalties / 1000).toFixed(1)}K`} sub={`${data.overdue_loans} overdue loans`} color={data.overdue_loans > 0 ? "text-rose-600" : "text-zinc-500"} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* By Status */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-4 rounded-[18px] shadow-sm">
          <p className="text-xs font-black text-zinc-700 dark:text-zinc-300 mb-3">Loans by Status</p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byStatusData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <XAxis dataKey="status" tick={{ fontSize: 9, fontWeight: 700 }} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip formatter={(v: any) => [`${v} loans`]} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {byStatusData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* By Sector */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-4 rounded-[18px] shadow-sm">
          <p className="text-xs font-black text-zinc-700 dark:text-zinc-300 mb-3">Portfolio by Sector</p>
          {bySectorData.length > 0 ? (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={bySectorData} dataKey="amount" nameKey="sector" cx="50%" cy="50%" outerRadius={60}>
                    {bySectorData.map((entry: any, i: number) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => [`KES ${Number(v).toLocaleString()}`]} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: "9px", fontWeight: 700 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-xs text-zinc-400 py-8 text-center">No sector data</p>}
        </div>
      </div>

      {/* Loans Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-[18px] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
          <p className="text-xs font-black text-zinc-700 dark:text-zinc-300">All Loans</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-zinc-50/50 dark:bg-zinc-850/20">
              <tr className="text-zinc-400 font-bold uppercase tracking-wider text-[9px]">
                <th className="py-2.5 px-3">ID</th>
                <th className="py-2.5 px-3">Client</th>
                <th className="py-2.5 px-3">Principal</th>
                <th className="py-2.5 px-3">Outstanding</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100/50 dark:divide-zinc-850/50">
              {(data.loans || []).map((l: any) => {
                const cfg = STATUS_CFG[l.status] || STATUS_CFG.Pending;
                return (
                  <tr key={l.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/10">
                    <td className="py-2.5 px-3 font-mono text-[10px] text-zinc-500">{l.id}</td>
                    <td className="py-2.5 px-3 font-bold text-zinc-900 dark:text-zinc-100">{l.client}</td>
                    <td className="py-2.5 px-3 font-bold text-[#0D44A2]">KES {l.amount.toLocaleString()}</td>
                    <td className="py-2.5 px-3">
                      <span className={`font-bold ${l.is_overdue ? "text-rose-600" : l.outstanding > 0 ? "text-zinc-700 dark:text-zinc-200" : "text-emerald-600"}`}>
                        {l.outstanding > 0 ? `KES ${l.outstanding.toLocaleString()}` : "Fully Paid"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`font-bold text-[10px] ${cfg.color}`}>{l.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Arrears Report Tab ────────────────────────────────────────────────────────

function ArrearsTab() {
  const { data, isLoading } = useQuery({ queryKey: ["report-arrears"], queryFn: fetchArrearsReportApi });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-rose-500 size-7" /></div>;
  if (!data) return null;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <KPICard label="Overdue Loans" value={`${data.count}`} sub="Past due date" color="text-rose-600" />
        <KPICard label="Overdue Outstanding" value={`KES ${(data.total_overdue_outstanding / 1000).toFixed(0)}K`} sub="Total principal + interest" color="text-rose-600" />
        <KPICard label="Penalty Exposure" value={`KES ${(data.total_penalty_exposure / 1000).toFixed(1)}K`} sub="3% per 2 days overdue" color="text-[#F57424]" />
      </div>

      {data.count === 0 ? (
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
              <strong>{data.count} loans</strong> are past their due date. Penalty accrues at <strong>3% every 2 days</strong> on the outstanding balance.
            </p>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden flex flex-col gap-3">
            {(data.overdue_loans || []).map((l: any) => (
              <div key={l.id} className="border border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/10 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{l.client}</p>
                    <p className="text-[10px] font-mono text-zinc-400">{l.id}</p>
                  </div>
                  <span className="text-xs font-black text-rose-600 bg-rose-100 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded-lg">
                    {l.days_overdue}d overdue
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1 pt-1 border-t border-rose-100 dark:border-rose-900 text-xs">
                  <div><p className="text-[10px] text-zinc-400">Outstanding</p><p className="font-bold text-rose-700">KES {l.outstanding.toLocaleString()}</p></div>
                  <div><p className="text-[10px] text-zinc-400">Penalty</p><p className="font-bold text-[#F57424]">KES {l.penalty_amount.toLocaleString()}</p></div>
                  <div><p className="text-[10px] text-zinc-400">Due Date</p><p className="font-bold text-zinc-700 dark:text-zinc-300">{l.due_date}</p></div>
                  <div><p className="text-[10px] text-zinc-400">Sector</p><p className="font-bold text-zinc-600 dark:text-zinc-400">{l.sector}</p></div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-[18px] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-rose-50/50 dark:bg-rose-950/10">
                  <tr className="text-zinc-400 font-bold uppercase tracking-wider text-[9px]">
                    <th className="py-2.5 px-3">Loan ID</th>
                    <th className="py-2.5 px-3">Client</th>
                    <th className="py-2.5 px-3">Sector</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3">Days Overdue</th>
                    <th className="py-2.5 px-3">Outstanding</th>
                    <th className="py-2.5 px-3">Penalty (KES)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100/50 dark:divide-zinc-850/50">
                  {(data.overdue_loans || []).map((l: any) => (
                    <tr key={l.id} className={`${l.days_overdue >= 8 ? "bg-rose-50/30 dark:bg-rose-950/5" : ""}`}>
                      <td className="py-2.5 px-3 font-mono text-[10px] text-zinc-500">{l.id}</td>
                      <td className="py-2.5 px-3 font-bold text-zinc-900 dark:text-zinc-100">{l.client}</td>
                      <td className="py-2.5 px-3 text-zinc-500">{l.sector}</td>
                      <td className="py-2.5 px-3 text-zinc-500">{l.due_date}</td>
                      <td className="py-2.5 px-3">
                        <span className={`font-black ${l.days_overdue >= 8 ? "text-rose-600" : "text-amber-600"}`}>
                          {l.days_overdue} days
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-rose-700 dark:text-rose-400">KES {l.outstanding.toLocaleString()}</td>
                      <td className="py-2.5 px-3 font-bold text-[#F57424]">KES {l.penalty_amount.toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className="bg-zinc-50 dark:bg-zinc-850/30 font-black">
                    <td colSpan={5} className="py-2.5 px-3 text-xs text-zinc-700 dark:text-zinc-300">TOTAL EXPOSURE</td>
                    <td className="py-2.5 px-3 text-xs text-rose-700 font-black">KES {data.total_overdue_outstanding.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-xs text-[#F57424] font-black">KES {data.total_penalty_exposure.toLocaleString()}</td>
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

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchCollectionsReportApi(dateFrom || undefined, dateTo || undefined),
  });

  const handleFilter = () => {
    setQueryKey(["report-collections", dateFrom, dateTo]);
    refetch();
  };

  const byModeData = (data?.by_mode || []).map((m: any, i: number) => ({ ...m, fill: CHART_COLORS[i] }));

  return (
    <div className="space-y-5">
      {/* Date filter */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-4 rounded-[18px] shadow-sm space-y-3">
        <p className="text-xs font-black text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
          <Calendar className="size-3.5 text-[#0D44A2]" />Filter by Date Range
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="flex-1 h-10 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 rounded-xl text-sm px-3 text-zinc-700 dark:text-zinc-300 focus:outline-none" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
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
          <div className="grid grid-cols-2 gap-2.5">
            <KPICard label="Total Collected" value={`KES ${(data.total_collected / 1000).toFixed(0)}K`} sub={`${data.payment_count} verified payments`} color="text-emerald-600" />
            <KPICard label="Payment Methods" value={`${byModeData.length}`} sub="Distinct modes used" color="text-[#0D44A2]" />
          </div>

          {/* By Mode chart */}
          {byModeData.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-4 rounded-[18px] shadow-sm">
              <p className="text-xs font-black text-zinc-700 dark:text-zinc-300 mb-3">Collections by Payment Mode</p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byModeData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <XAxis dataKey="mode" tick={{ fontSize: 9, fontWeight: 700 }} />
                    <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={(v: any) => [`KES ${Number(v).toLocaleString()}`]} />
                    <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                      {byModeData.map((entry: any, i: number) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* By Loan */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-[18px] shadow-sm overflow-hidden">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
              <p className="text-xs font-black text-zinc-700 dark:text-zinc-300">Collections per Loan</p>
            </div>
            {data.by_loan.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-8">No verified payments in this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-zinc-50/50 dark:bg-zinc-850/20">
                    <tr className="text-zinc-400 font-bold uppercase tracking-wider text-[9px]">
                      <th className="py-2.5 px-3">Loan ID</th>
                      <th className="py-2.5 px-3">Client</th>
                      <th className="py-2.5 px-3">Payments</th>
                      <th className="py-2.5 px-3">Total Collected</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100/50 dark:divide-zinc-850/50">
                    {data.by_loan.map((l: any) => (
                      <tr key={l.loan_id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/10">
                        <td className="py-2.5 px-3 font-mono text-[10px] text-[#0D44A2]">{l.loan_id}</td>
                        <td className="py-2.5 px-3 font-bold text-zinc-900 dark:text-zinc-100">{l.client}</td>
                        <td className="py-2.5 px-3 text-zinc-500">{l.count} payment{l.count !== 1 ? "s" : ""}</td>
                        <td className="py-2.5 px-3 font-black text-emerald-600">KES {l.amount.toLocaleString()}</td>
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
      <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] shadow-sm">
        <h2 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">Financial Reports</h2>
        <p className="text-xs text-zinc-400 mt-0.5">Live data — Portfolio summary, Arrears with penalties, Collections by mode</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-2xl w-fit overflow-x-auto">
        {tabs.map(t => {
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
