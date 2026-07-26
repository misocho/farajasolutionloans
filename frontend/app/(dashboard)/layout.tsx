"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getToken, clearToken } from "@/app/lib/auth";
import { fetchMeApi } from "@/features/auth/api";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = getToken();
    if (!token) {
      router.replace("/login");
    }
  }, [router]);

  const { isPending, isError } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMeApi,
    retry: false,
    enabled: mounted && !!getToken(),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (isError) {
      clearToken();
      router.replace("/login?expired=true");
    }
  }, [isError, router]);

  if (!mounted || isPending) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 font-sans gap-4">
        <div className="flex items-center justify-center relative">
          <Loader2 className="animate-spin text-[#0D44A2] size-12" />
          <span className="absolute text-[10px] font-extrabold text-[#F57424] uppercase tracking-widest mt-0.5">
            Faraja
          </span>
        </div>
        <p className="text-sm font-semibold text-zinc-650 dark:text-zinc-400 animate-pulse">
          Securing session context...
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-50 dark:bg-zinc-950 font-sans">
      {/* ── Mobile overlay backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-zinc-950/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar (fixed on desktop, drawer on mobile) ── */}
      <div
        className={`
          fixed inset-y-0 left-0 z-40 lg:static lg:z-auto
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* ── Main Workspace Column ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header bar */}
        <Topbar onMenuClick={() => setSidebarOpen((o) => !o)} />

        {/* Scrollable Content Container */}
        <main className="flex-1 overflow-y-auto bg-[#F8FAFC] dark:bg-zinc-950 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
