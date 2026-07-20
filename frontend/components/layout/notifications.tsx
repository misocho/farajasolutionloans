"use client";

import React, { useState } from "react";
import { Bell, Check, Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverTitle,
} from "@/components/ui/popover";

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
}

export function Notifications() {
  const [items, setItems] = useState<NotificationItem[]>([
    {
      id: "1",
      title: "New Loan Application",
      description: "Jane M. submitted a business loan application for KES 250,000.",
      time: "5m ago",
      read: false,
    },
    {
      id: "2",
      title: "Repayment Received",
      description: "Acme Corp completed a payment of KES 45,000 for Loan #FS-902.",
      time: "1h ago",
      read: false,
    },
    {
      id: "3",
      title: "Audit Alert",
      description: "Employee FS-MGR001 modified approval limit for Mombasa Branch.",
      time: "3h ago",
      read: true,
    },
  ]);

  const unreadCount = items.filter((item) => !item.read).length;

  const markAllAsRead = () => {
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
  };

  return (
    <Popover>
      <PopoverTrigger className="relative p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors cursor-pointer focus:outline-none">
        <Bell className="size-5 text-zinc-600 dark:text-zinc-300" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#F57424] text-[10px] font-bold text-white ring-2 ring-white dark:ring-zinc-950">
            {unreadCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 shadow-xl mt-1 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <PopoverTitle className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">
            Notifications
          </PopoverTitle>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs text-primary hover:text-primary-foreground flex items-center gap-1 font-medium hover:underline focus:outline-none cursor-pointer"
            >
              <Check className="size-3" />
              <span>Mark all as read</span>
            </button>
          )}
        </div>
        <div className="max-h-[300px] overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
          {items.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
              No notifications yet.
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className={`p-4 flex gap-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-850/50 ${
                  !item.read ? "bg-[#0D44A2]/5 dark:bg-primary/5" : ""
                }`}
              >
                <div className="mt-0.5 shrink-0 text-primary">
                  <Info className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-1">
                    <p className={`text-xs font-semibold text-zinc-950 dark:text-zinc-50 ${!item.read ? "font-bold" : ""}`}>
                      {item.title}
                    </p>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
                      {item.time}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5 line-clamp-2">
                    {item.description}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
