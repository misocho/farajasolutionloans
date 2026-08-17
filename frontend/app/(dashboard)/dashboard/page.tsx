"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  Banknote,
  Users,
  Coins,
  TrendingUp,
  FileText,
  Building2,
  Clock,
  Loader2,
  UserPlus,
  Receipt,
  CheckCircle2,
  Send,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

import { StatCard } from "@/components/dashboard/stat-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { LoanCalculator } from "@/components/dashboard/loan-calculator";
import { useBranch } from "@/components/layout/branch-selector";
import { fetchMeApi } from "@/features/auth/api";
import {
  fetchLoansApi,
  fetchDashboardStatsApi,
  type DashboardActivity,
} from "@/features/clients/api";
import { formatKES, formatDate } from "@/app/lib/format";

const ACTIVITY_ICONS: Record<DashboardActivity["type"], { icon: typeof Coins; bg: string; color: string }> = {
  repayment: { icon: Coins, bg: "bg-emerald-500/10 text-emerald-600", color: "text-emerald-600" },
  loan: { icon: FileText, bg: "bg-[#0D44A2]/10", color: "text-[#0D44A2]" },
  approval: { icon: CheckCircle2, bg: "bg-[#0D44A2]/10", color: "text-[#0D44A2]" },
  disbursement: { icon: Send, bg: "bg-emerald-500/10 text-emerald-600", color: "text-emerald-600" },
  client: { icon: UserPlus, bg: "bg-[#F57424]/10", color: "text-[#F57424]" },
  fee: { icon: Receipt, bg: "bg-amber-500/10", color: "text-amber-600" },
};

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    approved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    disbursed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    rejected: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    performing: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    paid: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    "almost due": "bg-orange-500/10 text-orange-600 border-orange-500/20",
    due: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    arrears: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    "past maturity": "bg-rose-500/10 text-rose-600 border-rose-500/20",
    defaulter: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  };
  return (
    <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${styles[status.toLowerCase()] ?? "bg-zinc-500/10 text-zinc-600 border-zinc-500/20"}`}>
      {status}
    </span>
  );
}

const monthLabel = (monthKey: string) =>
  new Date(`${monthKey}-01`).toLocaleDateString("en-US", { month: "short" });

export default function DashboardPage() {
  const [selectedTab, setSelectedTab] = useState("All");
  const { selectedBranchId } = useBranch();

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMeApi,
    staleTime: Infinity,
  });

  const { data: loans = [], isLoading: loansLoading } = useQuery({
    queryKey: ["loans", selectedBranchId],
    queryFn: () => fetchLoansApi(selectedBranchId),
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats", selectedBranchId],
    queryFn: () => fetchDashboardStatsApi(selectedBranchId),
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const filteredLoans = loans.filter((loan) => {
    if (selectedTab === "All") return true;
    return loan.status.toLowerCase() === selectedTab.toLowerCase();
  });

  const chartData = (stats?.monthly_series ?? []).map((m) => ({
    name: monthLabel(m.month),
    Disbursements: m.disbursed,
    Repayments: m.collected,
  }));
  const chartEmpty = (stats?.monthly_series ?? []).every((m) => m.disbursed === 0 && m.collected === 0);

  const changeLabel = (v: number | null | undefined) => (v === null || v === undefined ? undefined : `${v > 0 ? "+" : ""}${v}%`);
  const isPositive = (v: number | null | undefined) => (v ?? 0) >= 0;

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-10 text-left relative select-none">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 rounded-[20px] sm:rounded-[24px] shadow-sm">
        <div>
          <h2 className="text-lg sm:text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center gap-2">
            <span>{getGreeting()}, {user?.first_name || "System"}!</span>
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
            Credit activity summary for {new Date().toLocaleDateString("en-US", {
              weekday: "short",
              year: "numeric",
              month: "short",
              day: "numeric",
            })}.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 px-3.5 py-2 rounded-2xl w-fit">
          <Building2 className="size-4 text-[#0D44A2]" />
          <span>{user?.branches?.[0] || "No branch assigned"}</span>
        </div>
      </div>

      {statsLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-[#0D44A2] size-8" />
        </div>
      ) : (
        <>
          {/* Stat Cards Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              title="Active Portfolio"
              value={formatKES(stats?.portfolio_outstanding ?? 0)}
              icon={Banknote}
              iconBgColor="bg-[#0D44A2]/10"
              iconColor="text-[#0D44A2]"
            />
            <StatCard
              title="Active Clients"
              value={(stats?.total_clients ?? 0).toLocaleString()}
              change={changeLabel(stats?.changes.clients)}
              isPositive={isPositive(stats?.changes.clients)}
              icon={Users}
              iconBgColor="bg-[#F57424]/10"
              iconColor="text-[#F57424]"
            />
            <StatCard
              title="Disbursed (Month)"
              value={formatKES(stats?.disbursed_month ?? 0)}
              change={changeLabel(stats?.changes.disbursed)}
              isPositive={isPositive(stats?.changes.disbursed)}
              icon={TrendingUp}
              iconBgColor="bg-emerald-500/10"
              iconColor="text-emerald-500"
            />
            <StatCard
              title="Repayments (Month)"
              value={formatKES(stats?.collected_month ?? 0)}
              change={changeLabel(stats?.changes.collected)}
              isPositive={isPositive(stats?.changes.collected)}
              icon={Coins}
              iconBgColor="bg-amber-500/10"
              iconColor="text-amber-500"
            />
          </div>

          {/* Main Grid Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Left Column (Chart + Table) */}
            <div className="lg:col-span-2 space-y-4 sm:space-y-6 flex flex-col">
              {/* Lending Dynamics Chart */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col text-left">
                    <h3 className="font-bold text-zinc-900 dark:text-zinc-50 text-base">Lending Dynamics</h3>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Disbursement vs Repayment trends — last 6 months</p>
                  </div>
                </div>

                {chartEmpty ? (
                  <div className="h-52 sm:h-72 flex flex-col items-center justify-center gap-2 text-zinc-400">
                    <TrendingUp className="size-8" />
                    <p className="text-xs">No disbursements or repayments yet — activity will appear here.</p>
                  </div>
                ) : (
                  <div className="h-52 sm:h-72 w-full text-xs mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorDisb" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0D44A2" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#0D44A2" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorRepay" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#F57424" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#F57424" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7/50" className="dark:stroke-zinc-800/50" />
                        <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${(val / 1000000).toFixed(1)}M`} />
                        <Tooltip formatter={(value) => formatKES(Number(value))} />
                        <Legend verticalAlign="top" height={36} iconType="circle" />
                        <Area type="monotone" dataKey="Disbursements" stroke="#0D44A2" strokeWidth={2.5} fillOpacity={1} fill="url(#colorDisb)" />
                        <Area type="monotone" dataKey="Repayments" stroke="#F57424" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRepay)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Recent Loan Applications */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] shadow-sm flex flex-col gap-4 flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div className="flex flex-col text-left">
                    <h3 className="font-bold text-zinc-900 dark:text-zinc-50 text-base">Recent Loan Applications</h3>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Latest submissions for credit approval</p>
                  </div>

                  <div className="flex bg-zinc-50 dark:bg-zinc-950 p-1 rounded-xl w-fit border border-zinc-100 dark:border-zinc-800 self-start sm:self-center">
                    {["All", "Pending", "Approved", "Disbursed"].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setSelectedTab(tab)}
                        className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                          selectedTab === tab
                            ? "bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 shadow-sm"
                            : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-700"
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto w-full -mx-4 sm:mx-0 px-4 sm:px-0">
                  {loansLoading ? (
                    <div className="flex justify-center items-center py-10">
                      <Loader2 className="animate-spin text-primary size-6" />
                    </div>
                  ) : (
                    <table className="w-full text-xs text-left border-collapse min-w-[520px]">
                      <thead>
                        <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 font-bold">
                          <th className="py-3 px-2">Loan</th>
                          <th className="py-3 px-2">Client</th>
                          <th className="py-3 px-2">Sector</th>
                          <th className="py-3 px-2">Amount</th>
                          <th className="py-3 px-2">Submission</th>
                          <th className="py-3 px-2 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100/50 dark:divide-zinc-800/50">
                        {filteredLoans.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-zinc-400 dark:text-zinc-500">
                              No loans match the selected state filter.
                            </td>
                          </tr>
                        ) : (
                          filteredLoans.map((loan) => (
                            <tr key={loan.id} className="hover:bg-zinc-50/55 dark:hover:bg-zinc-800/20 transition-colors">
                              <td className="py-3 px-2 font-mono font-semibold text-[#0D44A2] dark:text-blue-400">
                                {loan.loan_number}
                              </td>
                              <td className="py-3 px-2 font-bold text-zinc-950 dark:text-zinc-100">
                                {loan.client}
                              </td>
                              <td className="py-3 px-2 text-zinc-500 dark:text-zinc-400">{loan.sector}</td>
                              <td className="py-3 px-2 font-bold text-zinc-900 dark:text-zinc-200">
                                {formatKES(loan.amount)}
                              </td>
                              <td className="py-3 px-2 text-zinc-500 dark:text-zinc-400">{formatDate(loan.date)}</td>
                              <td className="py-3 px-2 text-right">{getStatusBadge(loan.status)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column (Quick Actions + Recent Activity) */}
            <div className="space-y-4 sm:space-y-6">
              <QuickActions />

              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] shadow-sm flex flex-col gap-4">
                <div className="flex flex-col text-left">
                  <h3 className="font-bold text-zinc-900 dark:text-zinc-50 text-base">Recent Activities</h3>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Latest repayments, loan applications, approvals, disbursements, registrations and fees</p>
                </div>

                <div className="flex flex-col gap-3.5 mt-2">
                  {(stats?.recent_activity ?? []).length === 0 ? (
                    <p className="text-xs text-zinc-400 text-center py-6">No activity yet.</p>
                  ) : (
                    (stats?.recent_activity ?? []).slice(0, 5).map((act, i) => {
                      const cfg = ACTIVITY_ICONS[act.type] ?? ACTIVITY_ICONS.loan;
                      const Icon = cfg.icon;
                      return (
                        <div key={`${act.type}-${i}`} className="flex gap-3 text-left">
                          <div className={`p-1.5 rounded-xl h-fit shrink-0 ${cfg.bg}`}>
                            <Icon className={`size-3.5 ${cfg.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-zinc-950 dark:text-zinc-100">
                              {act.title}
                            </p>
                            <p className="text-[10px] text-zinc-500 mt-0.5 leading-snug">
                              {act.description}
                            </p>
                            <span className="text-[9px] text-zinc-400 flex items-center gap-1 mt-1">
                              <Clock className="size-3" />
                              <span>{formatDate(act.time)}</span>
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      <LoanCalculator />
    </div>
  );
}
