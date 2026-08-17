"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Loader2, RefreshCw } from "lucide-react";
import {
  fetchNotificationsApi,
  markAllNotificationsReadApi,
  markNotificationReadApi,
  type AppNotification,
} from "@/features/clients/api";
import {
  PRIORITY_CFG,
  TYPE_ICON,
  PRIORITY_ORDER,
  timeAgo,
  notificationTarget,
} from "@/app/lib/notifications";

// ── Notifications Page ────────────────────────────────────────────────────────

function KpiTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[20px] shadow-sm p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{label}</p>
      <p className={`text-xl font-black mt-1 ${color}`}>{value}</p>
    </div>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotificationsApi,
    refetchInterval: 30_000,
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unread_count ?? notifications.filter((n) => !n.read).length;
  const criticalCount = notifications.filter((n) => n.priority === "critical").length;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsReadApi,
    onSuccess: invalidate,
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationReadApi,
    onSuccess: invalidate,
  });

  const visible = showUnreadOnly ? notifications.filter((n) => !n.read) : notifications;
  const sorted = [...visible].sort((a, b) => {
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    return p !== 0 ? p : new Date(b.time).getTime() - new Date(a.time).getTime();
  });

  const handleClick = (notif: AppNotification) => {
    if (!notif.read) markReadMutation.mutate(notif.id);
    const target = notificationTarget(notif);
    if (target) router.push(target);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[20px] sm:rounded-[24px] shadow-sm p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <Bell className="size-5 text-[#0D44A2]" />
            Notifications
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread · taps open the related record` : "All caught up"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={invalidate}
            className="h-9 px-3 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="size-3.5" />Refresh
          </button>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllReadMutation.mutate()}
              className="h-9 px-3 rounded-xl text-xs font-bold bg-[#0D44A2] hover:bg-[#0A3682] text-white flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCheck className="size-3.5" />Mark all read
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2.5">
        <KpiTile label="Unread" value={String(unreadCount)} color="text-[#F57424]" />
        <KpiTile label="Total" value={String(notifications.length)} color="text-zinc-900 dark:text-zinc-100" />
        <KpiTile label="Critical" value={String(criticalCount)} color="text-rose-600" />
      </div>

      {/* Toggle */}
      <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-1 w-fit">
        {[
          { key: false, label: "All" },
          { key: true, label: "Unread" },
        ].map(({ key, label }) => (
          <button
            key={label}
            onClick={() => setShowUnreadOnly(key)}
            className={`px-4 h-8 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
              showUnreadOnly === key
                ? "bg-[#0D44A2] text-white"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[20px] sm:rounded-[24px] shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-zinc-400">
            <Loader2 className="animate-spin size-5" />
            <span className="text-xs">Loading notifications...</span>
          </div>
        ) : isError ? (
          <div className="px-4 py-12 text-center">
            <p className="text-xs text-rose-500">Could not load notifications. Is the server running?</p>
            <button onClick={invalidate} className="mt-3 text-xs font-bold text-[#0D44A2] hover:underline cursor-pointer">
              Retry
            </button>
          </div>
        ) : sorted.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <Bell className="size-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-zinc-500">
              {showUnreadOnly ? "No unread notifications" : "All clear — no pending actions"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {sorted.map((notif: AppNotification) => {
              const isRead = notif.read;
              const pCfg = PRIORITY_CFG[notif.priority] ?? PRIORITY_CFG.low;
              const Icon = TYPE_ICON[notif.type] ?? pCfg.icon;
              const target = notificationTarget(notif);
              return (
                <button
                  key={notif.id}
                  onClick={() => handleClick(notif)}
                  className={`w-full p-4 sm:p-5 flex gap-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/30 cursor-pointer ${
                    !isRead ? "bg-[#0D44A2]/[0.03] dark:bg-[#0D44A2]/10" : ""
                  }`}
                >
                  <div className={`mt-0.5 shrink-0 p-2 rounded-full ${pCfg.bg}`}>
                    <Icon className={`size-4 ${pCfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <p className={`text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 ${!isRead ? "font-bold" : "font-semibold"}`}>
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-zinc-400 whitespace-nowrap shrink-0">{timeAgo(notif.time)}</span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                      {notif.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`inline-block text-[9px] font-black uppercase tracking-wider ${pCfg.color}`}>
                        {notif.priority}
                      </span>
                      {target && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#0D44A2]">Open record →</span>
                      )}
                      {!isRead && <span className="size-2 rounded-full bg-[#F57424]" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}