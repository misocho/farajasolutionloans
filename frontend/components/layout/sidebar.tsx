"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  Banknote,
  Receipt,
  BarChart3,
  Settings,
  ShieldCheck,
  LogOut,
  MapPin,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

import { AppLogo } from "./app-logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { fetchMeApi } from "@/features/auth/api";
import { clearToken } from "@/app/lib/auth";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  // Query user info
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMeApi,
    staleTime: Infinity,
  });

  const getInitials = () => {
    if (!user) return "FS";
    return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
  };

  const getLimitText = () => {
    if (!user) return "KES 0.00";
    const role = user.role || "Director";
    switch (role) {
      case "Director":
        return "Unlimited Approval";
      case "Manager":
        return "KES 1,000,000.00 Limit";
      case "Finance Officer":
        return "KES 100,000.00 Limit";
      case "Loan Officer":
        return "KES 0.00 (Verification Only)";
      default:
        return "No Limit (Read-Only)";
    }
  };

  const getRole = (u: any) => {
    if (!u) return "";
    if (u.roles && u.roles.length > 0) {
      return u.roles[0].role.name;
    }
    if (u.employee_number?.includes("DIR")) return "Director";
    if (u.employee_number?.includes("SYS")) return "System Admin";
    return "";
  };

  const roleName = getRole(user);

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Loans", href: "/loans", icon: Banknote },
    { name: "Clients", href: "/clients", icon: Users },
    { name: "Repayments", href: "/repayments", icon: Receipt },
    { name: "Reports", href: "/reports", icon: BarChart3 },
  ];

  if (roleName === "Director" || roleName === "System Admin") {
    navItems.push({ name: "Admin Console", href: "/users", icon: ShieldCheck });
  }

  navItems.push({ name: "Settings", href: "/settings", icon: Settings });

  const queryClient = useQueryClient();

  const handleLogout = () => {
    clearToken();
    queryClient.clear(); // Clear cache to prevent stale user profile
    toast.success("Logged out successfully");
    router.push("/login");
  };

  return (
    <aside className="w-72 bg-white dark:bg-zinc-900 border-r border-zinc-150 dark:border-zinc-800 flex flex-col justify-between py-6 px-4 shrink-0 font-sans shadow-sm select-none">
      {/* Top Section */}
      <div className="flex flex-col space-y-8">
        {/* Brand Logo */}
        <div className="px-2">
          <AppLogo size="sm" />
        </div>

        {/* User Card (Premium inspiration-based card widget) */}
        {user && (
          <div className="bg-zinc-50 dark:bg-zinc-850/50 p-4 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col gap-4 text-center">
            <div className="flex flex-col items-center gap-2">
              <Avatar className="size-16 border-2 border-primary bg-primary text-white text-lg font-bold">
                <AvatarFallback>{getInitials()}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col leading-tight">
                <span className="font-bold text-zinc-900 dark:text-zinc-50 text-base">
                  {user.first_name} {user.last_name}
                </span>
                <span className="text-xs text-zinc-500 mt-0.5">{user.role || "Director"}</span>
              </div>
            </div>

            {/* Approval Limits display */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-2.5 rounded-2xl flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
                Authority Limit
              </span>
              <span className="text-xs font-bold text-primary dark:text-zinc-200">
                {getLimitText()}
              </span>
            </div>

            <Button
              onClick={() => router.push("/loans?apply=true")}
              className="w-full bg-primary hover:bg-[#0A3682] text-white rounded-2xl h-10 font-semibold text-xs transition-all shadow-sm"
            >
              Apply for Loan
            </Button>
          </div>
        )}

        {/* Navigation List */}
        <nav className="flex flex-col gap-1 px-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link key={item.name} href={item.href}>
                <span
                  className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-medium transition-all group ${
                    isActive
                      ? "bg-primary text-white shadow-md shadow-primary/10"
                      : "text-zinc-650 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  }`}
                >
                  <Icon
                    className={`size-5 transition-transform group-hover:scale-105 ${
                      isActive ? "text-white" : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  />
                  <span>{item.name}</span>
                  {isActive && <ChevronRight className="size-4 ml-auto text-white/70" />}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer User Widget */}
      <div className="flex flex-col gap-4">
        {user && (
          <div className="border-t border-zinc-100 dark:border-zinc-850 pt-4 flex items-center justify-between px-2">
            <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
              <MapPin className="size-4 text-primary" />
              <span className="text-xs font-semibold truncate max-w-[130px]">
                {user.branch || "Mombasa"}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-650 rounded-full transition-colors cursor-pointer"
              title="Logout"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
