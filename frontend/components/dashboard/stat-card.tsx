"use client";

import React from "react";
import { ArrowUpRight, ArrowDownRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  isPositive?: boolean;
  icon: LucideIcon;
  iconBgColor: string;
  iconColor: string;
}

export function StatCard({
  title,
  value,
  change,
  isPositive,
  icon: Icon,
  iconBgColor,
  iconColor,
}: StatCardProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-3.5 sm:p-5 rounded-[20px] sm:rounded-[24px] shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between h-32 sm:h-40">
      {/* Top row */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col text-left gap-0.5 sm:gap-1">
          <span className="text-[10px] sm:text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            {title}
          </span>
          <span className="text-lg sm:text-2xl font-black text-zinc-900 dark:text-zinc-50 font-sans tracking-tight mt-0.5 sm:mt-1 leading-tight">
            {value}
          </span>
        </div>
        <div className={cn("p-2 sm:p-3 rounded-xl sm:rounded-2xl shrink-0", iconBgColor, iconColor)}>
          <Icon className="size-4 sm:size-5" />
        </div>
      </div>

      {/* Bottom trend info */}
      {change && (
        <div className="flex items-center gap-1 sm:gap-1.5 border-t border-zinc-100 dark:border-zinc-850 pt-2 sm:pt-3">
          <span
            className={cn(
              "flex items-center text-[10px] sm:text-xs font-bold px-1 sm:px-1.5 py-0.5 rounded-lg",
              isPositive
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-red-500/10 text-red-600"
            )}
          >
            {isPositive ? (
              <ArrowUpRight className="size-3 sm:size-3.5 mr-0.5" />
            ) : (
              <ArrowDownRight className="size-3 sm:size-3.5 mr-0.5" />
            )}
            {change}
          </span>
          <span className="text-[9px] sm:text-[11px] text-zinc-400 dark:text-zinc-500">
            vs last month
          </span>
        </div>
      )}
    </div>
  );
}
