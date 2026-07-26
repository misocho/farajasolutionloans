"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Flame, Clock, CheckCircle2, ShieldAlert, RefreshCw, Loader2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverTitle,
} from "@/components/ui/popover";
import { fetchNotificationsApi, type AppNotification } from "@/features/clients/api";

const PRIORITY_CFG = {
  critical: { color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950/20", icon: Flame },
  high:     { color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20", icon: Clock },
  medium:   { color: "text-blue-600",  bg: "bg-blue-50 dark:bg-blue-950/20",  icon: CheckCircle2 },
  low:      { color: "text-zinc-500",  bg: "",                                 icon: ShieldAlert },
};

const TYPE_ICON: Record<string, React.ElementType> = {
  loan_pending:       Clock,
  loan_approved:      CheckCircle2,
  repayment_pending:  ShieldAlert,
  overdue:            Flame,
};

function timeAgo(dateStr: string) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const diffMs = Date.now() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    return `${diffDays}d ago`;
  } catch {
    return dateStr;
  }
}

export function Notifications() {
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotificationsApi,
    refetchInterval: 30_000, // refresh every 30s
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  const markAllRead = () => {
    setReadIds(new Set(notifications.map(n => n.id)));
  };

  const markRead = (id: string) => {
    setReadIds(prev => new Set([...prev, id]));
  };

  return (
    <Popover>
      <PopoverTrigger className="relative p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors cursor-pointer focus:outline-none">
        <Bell className="size-5 text-zinc-600 dark:text-zinc-300" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#F57424] text-[10px] font-bold text-white ring-2 ring-white dark:ring-zinc-950 animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 sm:w-96 p-0 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 shadow-xl mt-1 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <PopoverTitle className="font-bold text-sm text-zinc-800 dark:text-zinc-200">
            Notifications
            {unreadCount > 0 && (
              <span className="ml-2 text-[10px] font-black bg-[#F57424] text-white px-1.5 py-0.5 rounded-full">
                {unreadCount} new
              </span>
            )}
          </PopoverTitle>
          <div className="flex items-center gap-2">
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ["notifications"] })}
              className="text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className="size-3.5" />
            </button>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[10px] text-[#0D44A2] font-bold hover:underline cursor-pointer">
                Mark all read
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[380px] overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-zinc-400">
              <Loader2 className="animate-spin size-4" />
              <span className="text-xs">Loading...</span>
            </div>
          ) : isError ? (
            <div className="px-4 py-6 text-center text-xs text-rose-500">
              Could not load notifications. Is the server running?
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <CheckCircle2 className="size-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-zinc-500">All clear — no pending actions</p>
            </div>
          ) : (
            notifications.map((notif: AppNotification) => {
              const isRead = readIds.has(notif.id);
              const pCfg = PRIORITY_CFG[notif.priority] ?? PRIORITY_CFG.low;
              const Icon = TYPE_ICON[notif.type] ?? pCfg.icon;
              return (
                <button
                  key={notif.id}
                  onClick={() => markRead(notif.id)}
                  className={`w-full p-4 flex gap-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-850/30 cursor-pointer ${
                    !isRead ? "bg-[#0D44A2]/[0.03] dark:bg-[#0D44A2]/10" : ""
                  }`}
                >
                  <div className={`mt-0.5 shrink-0 p-1.5 rounded-full ${pCfg.bg}`}>
                    <Icon className={`size-3.5 ${pCfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex justify-between items-start gap-1">
                      <p className={`text-xs text-zinc-900 dark:text-zinc-100 ${!isRead ? "font-bold" : "font-semibold"} line-clamp-1`}>
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-zinc-400 whitespace-nowrap shrink-0 ml-1">
                        {timeAgo(notif.time)}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2 leading-relaxed">
                      {notif.description}
                    </p>
                    <span className={`inline-block mt-1 text-[9px] font-black uppercase tracking-wider ${pCfg.color}`}>
                      {notif.priority}
                    </span>
                  </div>
                  {!isRead && (
                    <div className="size-2 rounded-full bg-[#F57424] shrink-0 mt-1.5" />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
            <p className="text-[10px] text-zinc-400 text-center">
              {notifications.length} active notifications · Auto-refreshes every 30s
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
