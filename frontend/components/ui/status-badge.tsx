"use client";

import React from "react";
import {
  Clock,
  CheckCircle2,
  ArrowUpRight,
  AlertTriangle,
  TrendingUp,
  XCircle,
  Flame,
  BadgeCheck,
} from "lucide-react";
import type { LoanStatus } from "@/features/clients/api";

const STATUS_CFG: Record<LoanStatus, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  Pending:      { color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800", icon: Clock, label: "Pending Approval" },
  Approved:     { color: "text-blue-700 dark:text-blue-400", bg: "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800", icon: CheckCircle2, label: "Approved" },
  Disbursed:    { color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800", icon: ArrowUpRight, label: "Disbursed" },
  "Almost Due": { color: "text-orange-700 dark:text-orange-400", bg: "bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800", icon: Clock, label: "Almost Due" },
  Due:          { color: "text-[#F57424] dark:text-orange-400", bg: "bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800", icon: AlertTriangle, label: "Due Today" },
  Performing:   { color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800", icon: TrendingUp, label: "Performing" },
  Arrears:      { color: "text-rose-700 dark:text-rose-400", bg: "bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-800", icon: AlertTriangle, label: "In Arrears" },
  "Past Maturity": { color: "text-rose-700 dark:text-rose-400", bg: "bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-800", icon: XCircle, label: "Past Maturity" },
  Defaulter:    { color: "text-rose-700 dark:text-rose-400", bg: "bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-800", icon: Flame, label: "Defaulter" },
  Paid:         { color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800", icon: CheckCircle2, label: "Paid" },
  Rejected:     { color: "text-rose-700 dark:text-rose-400", bg: "bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-800", icon: XCircle, label: "Rejected" },
  Closed:       { color: "text-zinc-600 dark:text-zinc-400", bg: "bg-zinc-100 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700", icon: BadgeCheck, label: "Closed" },
};

export function StatusBadge({ status }: { status: LoanStatus }) {
  const cfg = STATUS_CFG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>
      <Icon className="size-3" />{cfg.label}
    </span>
  );
}
