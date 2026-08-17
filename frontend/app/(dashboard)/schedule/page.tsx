"use client";

import React, { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft, ChevronRight, Calendar, Loader2,
  CheckCircle2, Flame, RefreshCw,
} from "lucide-react";
import { fetchInstallmentCalendarApi, type InstallmentEvent } from "@/features/clients/api";
import { formatKES } from "@/app/lib/format";

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_SHORT = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isoToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date());
}

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toISO(d.getFullYear(), d.getMonth(), d.getDate());
}

/** ISO of the Monday of the week containing the given date. */
function startOfWeekIso(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const diff = (d.getDay() + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  return toISO(d.getFullYear(), d.getMonth(), d.getDate());
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  paid:    "bg-emerald-500",
  overdue: "bg-rose-500",
  today:   "bg-[#F57424]",
  pending: "bg-[#0D44A2]",
};

function getEventColor(ev: InstallmentEvent): string {
  if (ev.status.toLowerCase() === "paid") return STATUS_DOT.paid;
  if (ev.is_today) return STATUS_DOT.today;
  if (ev.is_overdue) return STATUS_DOT.overdue;
  if ((ev.paid_amount ?? 0) > 0) return "bg-amber-500";
  return STATUS_DOT.pending;
}

function getEventBg(ev: InstallmentEvent): string {
  if (ev.status.toLowerCase() === "paid") return "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300";
  if (ev.is_today) return "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300";
  if (ev.is_overdue) return "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300";
  if ((ev.paid_amount ?? 0) > 0) return "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300";
  return "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-[#0D44A2] dark:text-blue-300";
}

// ── Day Cell (desktop month grid) ─────────────────────────────────────────────

function DayCell({
  day, year, month, events, isToday, isCurrent,
  onSelect, isSelected,
}: {
  day: number; year: number; month: number;
  events: InstallmentEvent[];
  isToday: boolean; isCurrent: boolean;
  onSelect: (iso: string) => void;
  isSelected: boolean;
}) {
  const iso = toISO(year, month, day);
  const overdueCount = events.filter(e => e.is_overdue).length;
  const paidCount = events.filter(e => e.status.toLowerCase() === "paid").length;
  const partialCount = events.filter(e => e.status.toLowerCase() !== "paid" && (e.paid_amount ?? 0) > 0).length;
  const pendingCount = events.filter(e => !e.is_overdue && e.status.toLowerCase() !== "paid" && !((e.paid_amount ?? 0) > 0)).length;
  const hasEvents = events.length > 0;

  return (
    <button
      onClick={() => hasEvents ? onSelect(iso) : undefined}
      className={`
        relative min-h-[80px] p-2 rounded-xl border text-left transition-all
        ${isSelected ? "ring-2 ring-[#0D44A2] ring-offset-1" : ""}
        ${isToday ? "border-[#F57424]/60 bg-orange-50/50 dark:bg-orange-950/10" : "border-zinc-100 dark:border-zinc-800"}
        ${!isCurrent ? "opacity-30" : ""}
        ${hasEvents ? "hover:border-[#0D44A2]/40 hover:shadow-sm cursor-pointer" : "cursor-default"}
        bg-white dark:bg-zinc-900
      `}
    >
      <span className={`
        text-xs font-bold inline-flex items-center justify-center
        w-6 h-6 rounded-full
        ${isToday ? "bg-[#F57424] text-white" : "text-zinc-700 dark:text-zinc-300"}
      `}>
        {day}
      </span>

      {hasEvents && (
        <div className="mt-1 space-y-0.5">
          {overdueCount > 0 && (
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
              <span className="text-[9px] font-bold text-rose-600 truncate">{overdueCount} overdue</span>
            </div>
          )}
          {partialCount > 0 && (
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              <span className="text-[9px] font-bold text-amber-600 truncate">{partialCount} partial</span>
            </div>
          )}
          {pendingCount > 0 && (
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0D44A2] shrink-0" />
              <span className="text-[9px] font-bold text-[#0D44A2] truncate">{pendingCount} due</span>
            </div>
          )}
          {paidCount > 0 && (
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-[9px] font-bold text-emerald-600 truncate">{paidCount} paid</span>
            </div>
          )}
        </div>
      )}

      {hasEvents && (
        <div className="mt-1">
          <span className="text-[9px] text-zinc-400">
            {formatKES(events.reduce((s, e) => s + e.amount, 0))}
          </span>
        </div>
      )}
    </button>
  );
}

// ── Week Strip (mobile) ───────────────────────────────────────────────────────

function WeekStrip({
  weekStart, today, selectedDate, eventsByDate,
  onSelect, onPrevWeek, onNextWeek, onToday,
  onTouchStart, onTouchEnd,
}: {
  weekStart: string;
  today: string;
  selectedDate: string | null;
  eventsByDate: Record<string, InstallmentEvent[]>;
  onSelect: (iso: string) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}) {
  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i));
  const weekEvents = weekDays.flatMap((d) => eventsByDate[d] ?? []);
  const monthLabel = (() => {
    const d = new Date(weekStart + "T00:00:00");
    const end = new Date(addDaysIso(weekStart, 6) + "T00:00:00");
    const fmt = (x: Date) => x.toLocaleDateString("en-KE", { month: "short", day: "numeric" });
    return `${fmt(d)} – ${fmt(end)}, ${end.getFullYear()}`;
  })();

  return (
    <div className="md:hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[20px] shadow-sm overflow-hidden">
      {/* Week nav */}
      <div
        className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <button
          onClick={onPrevWeek}
          aria-label="Previous week"
          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
        >
          <ChevronLeft className="size-4 text-zinc-600 dark:text-zinc-300" />
        </button>
        <div className="flex flex-col items-center">
          <p className="text-xs font-black text-zinc-900 dark:text-zinc-100">{monthLabel}</p>
          {weekEvents.length > 0 && (
            <p className="text-[9px] text-zinc-400 mt-0.5">{weekEvents.length} installment{weekEvents.length !== 1 ? "s" : ""} this week</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToday}
            className="text-[10px] font-bold text-[#0D44A2] border border-[#0D44A2]/30 px-2 py-1 rounded-lg hover:bg-[#0D44A2]/5 cursor-pointer"
          >
            Today
          </button>
          <button
            onClick={onNextWeek}
            aria-label="Next week"
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
          >
            <ChevronRight className="size-4 text-zinc-600 dark:text-zinc-300" />
          </button>
        </div>
      </div>

      {/* Swipe hint */}
      <p className="text-[9px] text-zinc-400 text-center pt-1.5 select-none">
        Swipe left or right to change weeks
      </p>

      {/* Day cells */}
      <div
        className="grid grid-cols-7 gap-1 p-2"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {weekDays.map((iso) => {
          const d = new Date(iso + "T00:00:00");
          const dayIndex = d.getDay();
          const events = eventsByDate[iso] ?? [];
          const isSelected = selectedDate === iso;
          const isToday = iso === today;
          const dotColors = events.slice(0, 3).map((ev) => getEventColor(ev));

          return (
            <button
              key={iso}
              onClick={() => events.length > 0 || isSelected ? onSelect(iso) : undefined}
              className={`
                flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all cursor-pointer
                ${isSelected ? "bg-[#0D44A2] shadow-md" : isToday ? "bg-orange-50 dark:bg-orange-950/20" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"}
              `}
            >
              <span className={`text-[9px] font-bold uppercase ${isSelected ? "text-white/70" : "text-zinc-400"}`}>
                {WEEKDAYS_SHORT[dayIndex]}
              </span>
              <span className={`
                inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-black
                ${isSelected ? "bg-white text-[#0D44A2]" : isToday ? "bg-[#F57424] text-white" : "text-zinc-700 dark:text-zinc-300"}
              `}>
                {d.getDate()}
              </span>
              <span className="flex items-center gap-0.5 h-1.5">
                {dotColors.map((color, i) => (
                  <span key={i} className={`w-1.5 h-1.5 rounded-full ${color}`} />
                ))}
                {events.length > 3 && (
                  <span className={`text-[8px] font-bold ${isSelected ? "text-white" : "text-zinc-400"}`}>
                    +{events.length - 3}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 px-3 py-2 border-t border-zinc-100 dark:border-zinc-800 flex-wrap">
        {[
          { color: "bg-rose-500", label: "Overdue" },
          { color: "bg-[#F57424]", label: "Due Today" },
          { color: "bg-[#0D44A2]", label: "Upcoming" },
          { color: "bg-emerald-500", label: "Paid" },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${l.color}`} />
            <span className="text-[9px] font-semibold text-zinc-500">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Selected Day Panel ────────────────────────────────────────────────────────

function DayPanel({ dateIso, events }: { dateIso: string; events: InstallmentEvent[] }) {
  const d = new Date(dateIso + "T00:00:00");
  const label = d.toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const total = events.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[20px] shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-black text-zinc-900 dark:text-zinc-100">{label}</p>
          <p className="text-[10px] text-zinc-400">{events.length} installment{events.length !== 1 ? "s" : ""} · {formatKES(total)} total</p>
        </div>
      </div>

      <div className="space-y-2">
        {events.map(ev => {
          const isPartial = ev.status.toLowerCase() !== "paid" && (ev.paid_amount ?? 0) > 0;
          const remaining = Math.max(ev.amount - (ev.paid_amount ?? 0), 0);
          return (
          <div key={ev.id} className={`border rounded-xl p-3 text-xs ${getEventBg(ev)}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${getEventColor(ev)}`} />
                <div className="min-w-0">
                  <p className="font-bold truncate">{ev.client}</p>
                  <p className="text-[10px] opacity-70 font-mono">{ev.loan_number}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-black">{formatKES(ev.amount)}</p>
                <span className={`text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md ${
                  ev.status.toLowerCase() === "paid" ? "bg-emerald-100 text-emerald-700" :
                  ev.is_overdue ? "bg-rose-100 text-rose-700" :
                  ev.is_today ? "bg-orange-100 text-orange-700" :
                  isPartial ? "bg-amber-100 text-amber-700" :
                  "bg-blue-100 text-blue-700"
                }`}>
                  {ev.status.toLowerCase() === "paid" ? "Paid" : ev.is_overdue ? `${ev.days_overdue}d overdue` : ev.is_today ? "Due Today" : isPartial ? "Partial" : "Pending"}
                </span>
              </div>
            </div>
            {isPartial && (
              <p className="text-[10px] font-semibold text-amber-700 mt-1.5 pl-4">
                {formatKES(ev.paid_amount ?? 0)} paid · {formatKES(remaining)} remaining
              </p>
            )}
            {!isPartial && ev.client_phone && (
              <p className="text-[10px] opacity-60 mt-1.5 pl-4">{ev.client_phone}</p>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const today = isoToday();
  const todayDate = new Date(today);
  const [viewYear, setViewYear] = useState(todayDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(today);
  const [weekStart, setWeekStart] = useState<string>(startOfWeekIso(today));
  const [weeksAhead, setWeeksAhead] = useState(8);
  const detailRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["installment-calendar", weeksAhead],
    queryFn: () => fetchInstallmentCalendarApi(weeksAhead),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, InstallmentEvent[]> = {};
    (data?.events ?? []).forEach(ev => {
      if (!map[ev.due_date]) map[ev.due_date] = [];
      map[ev.due_date].push(ev);
    });
    return map;
  }, [data?.events]);

  // Calendar grid (desktop)
  const firstDayOfMonth = startOfMonth(viewYear, viewMonth).getDay();
  const totalDays = daysInMonth(viewYear, viewMonth);
  const cells: { day: number; isCurrent: boolean }[] = [];

  const prevMonthDays = daysInMonth(viewYear, viewMonth === 0 ? 11 : viewMonth - 1);
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, isCurrent: false });
  }
  for (let d = 1; d <= totalDays; d++) {
    cells.push({ day: d, isCurrent: true });
  }
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, isCurrent: false });
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    const ny = viewMonth === 11 ? viewYear + 1 : viewYear;
    const nm = viewMonth === 11 ? 0 : viewMonth + 1;
    extendHorizonIfNeeded(toISO(ny, nm, daysInMonth(ny, nm)));
    setViewYear(ny);
    setViewMonth(nm);
  };
  const goToToday = () => {
    setViewYear(todayDate.getFullYear());
    setViewMonth(todayDate.getMonth());
    setSelectedDate(today);
    setWeekStart(startOfWeekIso(today));
  };

  const goPrevWeek = () => setWeekStart((w) => addDaysIso(w, -7));
  const goNextWeek = () => {
    const next = addDaysIso(weekStart, 7);
    extendHorizonIfNeeded(addDaysIso(next, 6));
    setWeekStart(next);
  };

  // When navigation goes past the fetched window, widen it so the view always has data
  const extendHorizonIfNeeded = (iso: string) => {
    const needed = Math.ceil(
      (new Date(iso + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime())
      / (7 * 24 * 3600 * 1000)
    );
    if (needed > weeksAhead && weeksAhead < 26) {
      setWeeksAhead(Math.min(Math.max(weeksAhead, needed + 1), 26));
    }
  };

  const handleSelectDate = (iso: string) => {
    setSelectedDate(iso);
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (isMobile && detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      if (dx < 0) goNextWeek();
      else goPrevWeek();
    }
    touchStartX.current = null;
  };

  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] ?? []) : [];

  // Summary stats for the visible month (desktop) / current week (mobile)
  const monthEvents = useMemo(() => {
    const prefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;
    return Object.entries(eventsByDate)
      .filter(([date]) => date.startsWith(prefix))
      .flatMap(([, evs]) => evs);
  }, [eventsByDate, viewYear, viewMonth]);

  const weekEvents = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i)).flatMap((d) => eventsByDate[d] ?? []),
    [eventsByDate, weekStart]
  );

  const overdueAll = (data?.events ?? []).filter(e => e.is_overdue);
  const todayEvents = eventsByDate[today] ?? [];

  return (
    <div className="space-y-4 sm:space-y-5 max-w-5xl mx-auto pb-16 select-none">

      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center gap-2">
              <Calendar className="size-5 text-[#0D44A2]" />
              Installment Schedule
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">Weekly repayment calendar · Tap a day to view due installments</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={weeksAhead}
              onChange={e => setWeeksAhead(Number(e.target.value))}
              className="h-8 text-xs border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded-lg px-2"
            >
              <option value={4}>4 weeks ahead</option>
              <option value={8}>8 weeks ahead</option>
              <option value={12}>12 weeks ahead</option>
              <option value={26}>6 months ahead</option>
            </select>
            <button onClick={() => refetch()} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg cursor-pointer">
              <RefreshCw className="size-3.5 text-zinc-500" />
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3.5 rounded-[20px] sm:rounded-[24px] shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Today Due</p>
          <p className="text-xl font-black text-[#F57424] mt-1">{todayEvents.length}</p>
          <p className="text-[10px] text-zinc-400">
            {formatKES(todayEvents.reduce((s, e) => s + e.amount, 0))}
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3.5 rounded-[20px] sm:rounded-[24px] shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Overdue</p>
          <p className={`text-xl font-black mt-1 ${overdueAll.length > 0 ? "text-rose-600" : "text-emerald-600"}`}>
            {overdueAll.length}
          </p>
          <p className="text-[10px] text-zinc-400">
            {formatKES(overdueAll.reduce((s, e) => s + Math.max(e.amount - (e.paid_amount ?? 0), 0), 0))}
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3.5 rounded-[20px] sm:rounded-[24px] shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider hidden sm:block">This Month</p>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider sm:hidden">This Week</p>
          <p className="text-xl font-black text-[#0D44A2] mt-1 sm:hidden">{weekEvents.length}</p>
          <p className="text-xl font-black text-[#0D44A2] mt-1 hidden sm:block">{monthEvents.length}</p>
          <p className="text-[10px] text-zinc-400 sm:hidden">
            {formatKES(weekEvents.reduce((s, e) => s + e.amount, 0))} due
          </p>
          <p className="text-[10px] text-zinc-400 hidden sm:block">
            {formatKES(monthEvents.reduce((s, e) => s + e.amount, 0))} due
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3.5 rounded-[20px] sm:rounded-[24px] shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider hidden sm:block">Paid This Month</p>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider sm:hidden">Paid This Week</p>
          <p className="text-xl font-black text-emerald-600 mt-1 sm:hidden">
            {weekEvents.filter(e => e.status.toLowerCase() === "paid").length}
          </p>
          <p className="text-xl font-black text-emerald-600 mt-1 hidden sm:block">
            {monthEvents.filter(e => e.status.toLowerCase() === "paid").length}
          </p>
          <p className="text-[10px] text-zinc-400">installments confirmed</p>
        </div>
      </div>

      {/* Loading overlay */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[20px] sm:rounded-[24px]">
          <Loader2 className="animate-spin text-[#0D44A2] size-6" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Mobile week strip */}
          <WeekStrip
            weekStart={weekStart}
            today={today}
            selectedDate={selectedDate}
            eventsByDate={eventsByDate}
            onSelect={handleSelectDate}
            onPrevWeek={goPrevWeek}
            onNextWeek={goNextWeek}
            onToday={goToToday}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          />

          {/* Desktop month grid */}
          <div className="hidden md:grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[20px] sm:rounded-[24px] shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                <button onClick={prevMonth} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer">
                  <ChevronLeft className="size-4 text-zinc-600 dark:text-zinc-300" />
                </button>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-black text-zinc-900 dark:text-zinc-100">
                    {MONTHS[viewMonth]} {viewYear}
                  </p>
                  <button
                    onClick={goToToday}
                    className="text-[10px] font-bold text-[#0D44A2] border border-[#0D44A2]/30 px-2 py-0.5 rounded-lg hover:bg-[#0D44A2]/5 cursor-pointer"
                  >
                    Today
                  </button>
                </div>
                <button onClick={nextMonth} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer">
                  <ChevronRight className="size-4 text-zinc-600 dark:text-zinc-300" />
                </button>
              </div>

              <div className="grid grid-cols-7 border-b border-zinc-100 dark:border-zinc-800">
                {DAYS.map(d => (
                  <div key={d} className="py-2 text-center text-[10px] font-black text-zinc-400 uppercase tracking-wider">
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-px bg-zinc-100 dark:bg-zinc-800 p-px">
                {cells.map((cell, idx) => {
                  const cellYear = !cell.isCurrent
                    ? (idx < 7 ? (viewMonth === 0 ? viewYear - 1 : viewYear) : (viewMonth === 11 ? viewYear + 1 : viewYear))
                    : viewYear;
                  const cellMonth = !cell.isCurrent
                    ? (idx < 7 ? (viewMonth === 0 ? 11 : viewMonth - 1) : (viewMonth === 11 ? 0 : viewMonth + 1))
                    : viewMonth;
                  const iso = toISO(cellYear, cellMonth, cell.day);
                  const dayEvents = eventsByDate[iso] ?? [];

                  return (
                    <DayCell
                      key={`${iso}-${idx}`}
                      day={cell.day}
                      year={cellYear}
                      month={cellMonth}
                      events={dayEvents}
                      isToday={iso === today}
                      isCurrent={cell.isCurrent}
                      isSelected={selectedDate === iso}
                      onSelect={setSelectedDate}
                    />
                  );
                })}
              </div>

              <div className="flex items-center gap-4 px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 flex-wrap">
                {[
                  { color: "bg-rose-500", label: "Overdue" },
                  { color: "bg-[#F57424]", label: "Due Today" },
                  { color: "bg-amber-500", label: "Partial" },
                  { color: "bg-[#0D44A2]", label: "Upcoming" },
                  { color: "bg-emerald-500", label: "Paid" },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${l.color}`} />
                    <span className="text-[10px] font-semibold text-zinc-500">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Side panel — selected day detail */}
            <div className="space-y-3">
              {selectedDate ? (
                selectedEvents.length > 0 ? (
                  <DayPanel dateIso={selectedDate} events={selectedEvents} />
                ) : (
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[20px] shadow-sm p-6 text-center">
                    <CheckCircle2 className="size-8 text-emerald-400 mx-auto mb-2" />
                    <p className="text-xs font-bold text-zinc-500">No installments on this date</p>
                  </div>
                )
              ) : (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[20px] shadow-sm p-6 text-center">
                  <Calendar className="size-8 text-zinc-300 mx-auto mb-2" />
                  <p className="text-xs text-zinc-400">Select a date to see due installments</p>
                </div>
              )}

              {overdueAll.length > 0 && (
                <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-[20px] p-4 space-y-2">
                  <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-black text-xs">
                    <Flame className="size-4" />
                    {overdueAll.length} Overdue Installment{overdueAll.length !== 1 ? "s" : ""}
                  </div>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {overdueAll.slice(0, 10).map(ev => (
                      <button
                        key={ev.id}
                        onClick={() => handleSelectDate(ev.due_date)}
                        className="w-full text-left flex items-center justify-between gap-2 p-2 bg-rose-100/60 dark:bg-rose-950/30 rounded-xl cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-rose-800 dark:text-rose-300 truncate">{ev.client}</p>
                          <p className="text-[9px] text-rose-600/70">{ev.due_date} · {ev.days_overdue}d overdue</p>
                        </div>
                        <span className="text-[10px] font-black text-rose-700 shrink-0">
                          {formatKES(Math.max(ev.amount - (ev.paid_amount ?? 0), 0))}
                        </span>
                      </button>
                    ))}
                    {overdueAll.length > 10 && (
                      <p className="text-[9px] text-rose-400 text-center pt-1">+{overdueAll.length - 10} more overdue</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile: selected day detail below the week strip */}
          <div ref={detailRef} className="md:hidden space-y-3 scroll-mt-24">
            {selectedDate && (
              selectedEvents.length > 0 ? (
                <DayPanel dateIso={selectedDate} events={selectedEvents} />
              ) : (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[20px] shadow-sm p-6 text-center">
                  <CheckCircle2 className="size-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-zinc-500">No installments on this date</p>
                </div>
              )
            )}

            {overdueAll.length > 0 && (
              <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-[20px] p-4 space-y-2">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-black text-xs">
                  <Flame className="size-4" />
                  {overdueAll.length} Overdue Installment{overdueAll.length !== 1 ? "s" : ""}
                </div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {overdueAll.slice(0, 10).map(ev => (
                    <button
                      key={ev.id}
                      onClick={() => handleSelectDate(ev.due_date)}
                      className="w-full text-left flex items-center justify-between gap-2 p-2 bg-rose-100/60 dark:bg-rose-950/30 rounded-xl cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-rose-800 dark:text-rose-300 truncate">{ev.client}</p>
                        <p className="text-[9px] text-rose-600/70">{ev.due_date} · {ev.days_overdue}d overdue</p>
                      </div>
                      <span className="text-[10px] font-black text-rose-700 shrink-0">
                        {formatKES(ev.amount)}
                      </span>
                    </button>
                  ))}
                  {overdueAll.length > 10 && (
                    <p className="text-[9px] text-rose-400 text-center pt-1">+{overdueAll.length - 10} more overdue</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
