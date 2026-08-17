"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileClock, Loader2, RefreshCw, SearchX, ShieldCheck } from "lucide-react";

import { fetchAuditLogsApi, type AuditLogEntry } from "@/features/audit/api";
import { fetchBranchesApi } from "@/features/clients/api";
import { formatDate } from "@/app/lib/format";
import { formatKES } from "@/app/lib/format";

const AUDIT_ACTIONS = [
  "client.create",
  "loan.create",
  "loan.approve",
  "loan.reject",
  "loan.disburse",
  "loan.close",
  "loan.note",
  "loan.status_override",
  "repayment.record",
  "repayment.verify",
  "fee.record",
  "fee.verify",
  "expense.record",
  "expense.verify",
];

const AUDIT_ENTITIES = ["client", "loan", "repayment", "fee", "expense"];

const ACTION_COLORS: Record<string, string> = {
  "client.create": "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900",
  "loan.create": "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900",
  "loan.approve": "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900",
  "loan.reject": "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900",
  "loan.disburse": "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-900",
  "loan.close": "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-300 dark:border-zinc-700",
  "loan.note": "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900",
  "loan.status_override": "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900",
  "repayment.record": "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900",
  "repayment.verify": "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-900",
  "fee.record": "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-900",
  "fee.verify": "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-900",
  "expense.record": "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900",
  "expense.verify": "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-900",
};

function actionLabel(action: string): string {
  return action
    .replace(/^[a-z]+\./, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function metaDetail(log: AuditLogEntry): string {
  const m = log.meta;
  if (!m) return "";
  if (log.action === "repayment.record" || log.action === "fee.record" || log.action === "expense.record") {
    const amount = m.amount ? formatKES(Number(m.amount)) : "";
    const mode = typeof m.mode === "string" ? m.mode : "";
    return [amount, mode].filter(Boolean).join(" · ");
  }
  if (log.action === "repayment.verify" || log.action === "fee.verify" || log.action === "expense.verify") {
    return m.amount ? formatKES(Number(m.amount)) : "";
  }
  if (log.action === "loan.note") return typeof m.note === "string" ? m.note : "";
  if (log.action === "loan.status_override") return typeof m.status_override === "string" ? m.status_override : "";
  if (log.action === "loan.approve" || log.action === "loan.reject") {
    return typeof m.note === "string" ? m.note : (typeof m.reason === "string" ? m.reason : "");
  }
  return "";
}

function AuditRow({ log, branchName }: { log: AuditLogEntry; branchName?: string }) {
  const color = ACTION_COLORS[log.action] ?? "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700";
  const detail = metaDetail(log);
  return (
    <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10">
      <td className="py-2.5 px-3 text-zinc-500 whitespace-nowrap">{formatDate(log.created_at)}</td>
      <td className="py-2.5 px-3 font-bold text-zinc-900 dark:text-zinc-100">{log.actor_name}</td>
      <td className="py-2.5 px-3">
        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-lg border ${color}`}>
          {actionLabel(log.action)}
        </span>
      </td>
      <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-300 capitalize">{log.entity}</td>
      <td className="py-2.5 px-3 font-mono text-[10px] text-zinc-400">{log.entity_id.slice(0, 8)}</td>
      <td className="py-2.5 px-3 text-zinc-500 max-w-[220px] truncate">{detail || "—"}</td>
      <td className="py-2.5 px-3 text-zinc-500">{branchName ?? "—"}</td>
    </tr>
  );
}

function AuditCard({ log, branchName }: { log: AuditLogEntry; branchName?: string }) {
  const color = ACTION_COLORS[log.action] ?? "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700";
  const detail = metaDetail(log);
  return (
    <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-2xl p-4 space-y-2">
      <div className="flex justify-between items-start gap-2">
        <div>
          <p className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{log.actor_name}</p>
          <p className="text-[10px] text-zinc-400">{formatDate(log.created_at)}</p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border shrink-0 ${color}`}>
          {actionLabel(log.action)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1 pt-1 border-t border-zinc-100 dark:border-zinc-800 text-xs">
        <div><p className="text-[10px] text-zinc-400">Entity</p><p className="font-bold text-zinc-700 dark:text-zinc-300 capitalize">{log.entity} <span className="font-mono text-[9px] text-zinc-400">#{log.entity_id.slice(0, 8)}</span></p></div>
        <div><p className="text-[10px] text-zinc-400">Branch</p><p className="font-bold text-zinc-700 dark:text-zinc-300">{branchName ?? "—"}</p></div>
      </div>
      {detail && <p className="text-xs text-zinc-600 dark:text-zinc-400">{detail}</p>}
    </div>
  );
}

export default function AuditPage() {
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [applied, setApplied] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["audit-logs", action, entity, dateFrom, dateTo, applied],
    queryFn: () =>
      fetchAuditLogsApi({
        action: action || undefined,
        entity: entity || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      }),
  });

  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: fetchBranchesApi });
  const branchName = (id: string | null) => branches?.find((b) => b.id === id)?.name;

  const applyFilters = () => setApplied(true);
  const clearFilters = () => {
    setAction("");
    setEntity("");
    setDateFrom("");
    setDateTo("");
    setApplied(false);
  };

  const selectCls = "h-10 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 rounded-xl text-sm px-3 text-zinc-700 dark:text-zinc-300 focus:outline-none";
  const inputCls = "h-10 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 rounded-xl text-sm px-3 text-zinc-700 dark:text-zinc-300 focus:outline-none";

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[20px] sm:rounded-[24px] shadow-sm p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <FileClock className="size-5 text-[#0D44A2]" /> Audit Logs
            </h1>
            <p className="text-xs text-zinc-400 mt-1">Append-only trail of financial state changes.</p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 h-10 px-4 bg-[#0D44A2] hover:bg-[#0A3682] text-white rounded-xl text-xs font-bold cursor-pointer"
          >
            <RefreshCw className="size-3.5" /> Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 mt-4">
          <select value={action} onChange={(e) => setAction(e.target.value)} className={selectCls}>
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map((a) => <option key={a} value={a}>{actionLabel(a)}</option>)}
          </select>
          <select value={entity} onChange={(e) => setEntity(e.target.value)} className={selectCls}>
            <option value="">All entities</option>
            {AUDIT_ENTITIES.map((e) => <option key={e} value={e} className="capitalize">{e}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls} />
          <div className="flex gap-2">
            <button onClick={applyFilters} className="flex-1 h-10 px-4 bg-[#F57424] hover:bg-[#e0641a] text-white rounded-xl text-xs font-bold cursor-pointer">
              Apply
            </button>
            {(action || entity || dateFrom || dateTo) && (
              <button onClick={clearFilters} className="h-10 px-3 rounded-xl text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer">
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[20px] shadow-sm p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total Events</p>
          <p className="text-xl font-black text-zinc-900 dark:text-zinc-50 mt-1">{data?.total ?? "—"}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[20px] shadow-sm p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Shown</p>
          <p className="text-xl font-black text-zinc-900 dark:text-zinc-50 mt-1">{data?.logs.length ?? "—"}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[20px] shadow-sm p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Access</p>
          <p className="text-xl font-black text-zinc-900 dark:text-zinc-50 mt-1 flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-emerald-600" /> audit.view
          </p>
        </div>
      </div>

      {/* List */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[20px] shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#0D44A2] size-7" /></div>
        ) : isError ? (
          <div className="p-8 text-center">
            <SearchX className="size-8 text-rose-400 mx-auto mb-2" />
            <p className="text-sm text-zinc-500">Could not load the audit trail.</p>
            <button onClick={() => refetch()} className="mt-3 text-xs font-bold text-[#0D44A2] cursor-pointer">Retry</button>
          </div>
        ) : !data || data.logs.length === 0 ? (
          <div className="p-8 text-center">
            <FileClock className="size-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-xs text-zinc-400">No audit events match the current filters.</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden flex flex-col gap-3 p-4">
              {data.logs.map((log) => <AuditCard key={log.id} log={log} branchName={branchName(log.branch_id)} />)}
            </div>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-zinc-50/50 dark:bg-zinc-800/20">
                  <tr className="text-zinc-400 font-bold uppercase tracking-wider text-[9px]">
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Actor</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Entity</th>
                    <th className="py-2.5 px-3">Record #</th>
                    <th className="py-2.5 px-3">Detail</th>
                    <th className="py-2.5 px-3">Branch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100/50 dark:divide-zinc-800/50">
                  {data.logs.map((log) => <AuditRow key={log.id} log={log} branchName={branchName(log.branch_id)} />)}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}