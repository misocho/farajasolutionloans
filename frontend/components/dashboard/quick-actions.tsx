"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, FileText, UserPlus, Coins, ChevronRight } from "lucide-react";

interface QuickActionsProps {
  onActionClick?: (actionType: "Apply for Loan" | "Register Client" | "Record Repayment" | "Generate Report") => void;
}

export function QuickActions({ onActionClick }: QuickActionsProps) {
  const router = useRouter();

  const actions = [
    {
      title: "Apply for Loan" as const,
      description: "Start a credit application",
      icon: PlusCircle,
      bgColor: "bg-[#0D44A2]/10 hover:bg-[#0D44A2]/20 dark:bg-[#0D44A2]/20",
      iconColor: "text-[#0D44A2] dark:text-blue-400",
      href: "/loans?action=new",
    },
    {
      title: "Register Client" as const,
      description: "Onboard a new borrower",
      icon: UserPlus,
      bgColor: "bg-[#F57424]/10 hover:bg-[#F57424]/20 dark:bg-[#F57424]/20",
      iconColor: "text-[#F57424] dark:text-orange-400",
      href: "/clients?action=new",
    },
    {
      title: "Record Repayment" as const,
      description: "Receive payments & receipts",
      icon: Coins,
      bgColor: "bg-emerald-500/10 hover:bg-emerald-500/20 dark:bg-emerald-500/20",
      iconColor: "text-emerald-600 dark:text-emerald-450",
      href: "/repayments?action=new",
    },
    {
      title: "Generate Report" as const,
      description: "Download financial audits",
      icon: FileText,
      bgColor: "bg-indigo-500/10 hover:bg-indigo-500/20 dark:bg-indigo-500/20",
      iconColor: "text-indigo-600 dark:text-indigo-400",
      href: "/reports",
    },
  ];

  const handleClick = (action: typeof actions[number]) => {
    if (onActionClick) {
      onActionClick(action.title);
    } else {
      router.push(action.href);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-5 rounded-[24px] shadow-sm flex flex-col gap-4">
      <div className="flex flex-col text-left">
        <h3 className="font-bold text-zinc-900 dark:text-zinc-50 text-base">Quick Actions</h3>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Frequent tasks and workflows</p>
      </div>

      <div className="flex flex-col gap-2">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.title}
              onClick={() => handleClick(act)}
              className="flex items-center justify-between p-3 rounded-2xl border border-zinc-100 hover:border-zinc-200 dark:border-zinc-800 dark:hover:border-zinc-700 bg-zinc-50/50 hover:bg-zinc-50 dark:bg-zinc-900/20 dark:hover:bg-zinc-900/60 transition-all duration-200 group text-left cursor-pointer focus:outline-none"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl shrink-0 transition-transform group-hover:scale-105 ${act.bgColor} ${act.iconColor}`}>
                  <Icon className="size-4" />
                </div>
                <div className="flex flex-col leading-none">
                  <span className="text-xs font-bold text-zinc-950 dark:text-zinc-100">
                    {act.title}
                  </span>
                  <span className="text-[10px] text-zinc-400 mt-0.5">
                    {act.description}
                  </span>
                </div>
              </div>
              <ChevronRight className="size-4 text-zinc-350 dark:text-zinc-650 group-hover:translate-x-0.5 transition-transform" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
