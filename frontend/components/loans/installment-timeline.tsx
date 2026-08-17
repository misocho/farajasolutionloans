"use client";

import { CheckCircle2, Circle, XCircle, AlertCircle } from "lucide-react";
import type { Installment } from "@/features/clients/api";
import { formatKES, formatDate } from "@/app/lib/format";

const STATUS_PILL: Record<Installment["status"], { label: string; cls: string; icon: React.ElementType }> = {
  Paid:    { label: "Paid",    cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800", icon: CheckCircle2 },
  Pending: { label: "Upcoming", cls: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700", icon: Circle },
  Late:    { label: "Late",    cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800", icon: AlertCircle },
  Missed:  { label: "Missed",  cls: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-800", icon: XCircle },
};

const PARTIAL_PILL = {
  label: "Partial",
  cls: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-800",
  icon: AlertCircle,
};

export function InstallmentTimeline({ installments }: { installments: Installment[] }) {
  const paid = installments.filter(i => i.status === "Paid").length;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Installment Schedule</p>
        <span className="text-[10px] font-bold text-zinc-500">
          {paid} of {installments.length} paid
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all"
          style={{ width: `${installments.length ? (paid / installments.length) * 100 : 0}%` }}
        />
      </div>
      <div className="space-y-1.5">
        {installments.map((inst) => {
          const isPartial = inst.status !== "Paid" && inst.paid_amount > 0;
          const pill = isPartial ? PARTIAL_PILL : STATUS_PILL[inst.status];
          const Icon = pill.icon;
          const remaining = Math.max(inst.amount - inst.paid_amount, 0);
          return (
            <div key={inst.id} className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/30">
              <div className="flex items-center gap-2 min-w-0">
                <Icon className={`size-3.5 shrink-0 ${inst.status === "Paid" ? "text-emerald-500" : isPartial ? "text-orange-500" : inst.status === "Missed" ? "text-rose-500" : inst.status === "Late" ? "text-amber-500" : "text-zinc-400"}`} />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{formatKES(inst.amount)}</p>
                  <p className="text-[10px] text-zinc-400">
                    Due {formatDate(inst.due_date, { day: "2-digit", month: "short", year: "numeric" })}
                    {inst.status === "Paid" && inst.paid_at && ` · Paid ${formatDate(inst.paid_at, { day: "2-digit", month: "short" })}`}
                    {isPartial && ` · ${formatKES(inst.paid_amount)} paid · ${formatKES(remaining)} remaining`}
                  </p>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border shrink-0 ${pill.cls}`}>
                {pill.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
