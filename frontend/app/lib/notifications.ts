import type { ElementType } from "react";
import { Flame, Clock, CheckCircle2, ShieldAlert, CalendarClock, Hourglass } from "lucide-react";
import type { AppNotification } from "@/features/clients/api";

// ── Shared notification helpers (bell dropdown + notifications page) ────────────

export const PRIORITY_CFG: Record<string, { color: string; bg: string; icon: ElementType }> = {
  critical: { color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950/20", icon: Flame },
  high:     { color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20", icon: Clock },
  medium:   { color: "text-blue-600",  bg: "bg-blue-50 dark:bg-blue-950/20",  icon: CheckCircle2 },
  low:      { color: "text-zinc-500",  bg: "",                                 icon: ShieldAlert },
};

export const TYPE_ICON: Record<string, ElementType> = {
  due_today:        Flame,
  due_tomorrow:     Clock,
  almost_due:       CalendarClock,
  arrears:          Hourglass,
  repayment_pending: ShieldAlert,
  pending_approval: CheckCircle2,
};

export const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function timeAgo(dateStr: string) {
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

/** Where a notification should navigate: repayments module for verification,
 *  otherwise the loan drawer via the loans module deep-link. */
export function notificationTarget(notif: AppNotification): string | null {
  if (notif.type === "repayment_pending") return "/repayments";
  if (notif.loan_id) return `/loans?loan=${notif.loan_id}`;
  return null;
}