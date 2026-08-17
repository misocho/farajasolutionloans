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
  CalendarDays,
  Bell,
  Settings,
  ShieldCheck,
  LogOut,
  MapPin,
  Building2,
  ChevronRight,
  X,
  FileClock,
} from "lucide-react";

import { toast } from "sonner";

import { AppLogo } from "./app-logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { fetchMeApi } from "@/features/auth/api";
import { clearToken } from "@/app/lib/auth";

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Query user info — disable hydration flicker by waiting for data
  const { data: user, isLoading: userLoading } = useQuery({
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

  const getRole = (u: any): string => {
    if (!u) return "";
    // Prefer the authoritative role/roles array from backend
    if (u.role) return u.role;
    if (u.roles && u.roles.length > 0) return u.roles[0];
    // Fallback pattern matching
    if (u.employee_number?.includes("DIR")) return "Director";
    if (u.employee_number?.includes("SYS")) return "System Admin";
    if (u.employee_number?.includes("LO")) return "Loan Officer";
    if (u.employee_number?.includes("MGR")) return "Manager";
    return "";
  };

  const roleName = getRole(user);
  // Only show Admin Console after user data is loaded and role is confirmed
  const isAdminRole = !userLoading && (roleName === "Director" || roleName === "System Admin");

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Loans", href: "/loans", icon: Banknote },
    { name: "Clients", href: "/clients", icon: Users },
    { name: "Repayments", href: "/repayments", icon: Receipt },
    { name: "Schedule", href: "/schedule", icon: CalendarDays },
    { name: "Notifications", href: "/notifications", icon: Bell },
    { name: "Reports", href: "/reports", icon: BarChart3 },
  ];

  if (isAdminRole) {
    navItems.push({ name: "Branches", href: "/branches", icon: Building2 });
    navItems.push({ name: "Admin Console", href: "/users", icon: ShieldCheck });
  }

  if (!userLoading && user?.permissions?.includes("audit.view")) {
    navItems.push({ name: "Audit Logs", href: "/audit", icon: FileClock });
  }

  navItems.push({ name: "Settings", href: "/settings", icon: Settings });


  const queryClient = useQueryClient();

  const handleLogout = () => {
    clearToken();
    queryClient.clear();
    toast.success("Logged out successfully");
    router.push("/login");
  };

  const handleNavClick = () => {
    // Close mobile sidebar after navigation
    onClose?.();
  };

  return (
    <aside className="w-72 h-full bg-white dark:bg-zinc-900 border-r border-zinc-150 dark:border-zinc-800 flex flex-col justify-between py-5 px-4 shrink-0 font-sans shadow-sm select-none overflow-y-auto">
      {/* Top Section */}
      <div className="flex flex-col space-y-6">
        {/* Brand Logo + Mobile Close Button */}
        <div className="flex items-center justify-between px-1">
          <AppLogo size="sm" />
          {/* Close button — only visible on mobile */}
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors"
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* User Card */}
        {user && (
          <div className="bg-zinc-50 dark:bg-zinc-850/50 p-4 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col gap-3 text-center">
            <div className="flex flex-col items-center gap-2">
              <Avatar className="size-14 border-2 border-primary bg-primary text-white text-lg font-bold">
                {user.profile_photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.profile_photo} alt={`${user.first_name} ${user.last_name}`} className="size-full rounded-full object-cover" />
                ) : (
                  <AvatarFallback>{getInitials()}</AvatarFallback>
                )}
              </Avatar>
              <div className="flex flex-col leading-tight">
                <span className="font-bold text-zinc-900 dark:text-zinc-50 text-sm">
                  {user.first_name} {user.last_name}
                </span>
                <span className="text-xs text-zinc-500 mt-0.5">{user.role || roleName || "Officer"}</span>
              </div>
            </div>

            {/* Approval Limits */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-2.5 rounded-2xl flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
                Authority Limit
              </span>
              <span className="text-xs font-bold text-primary dark:text-zinc-200">
                {getLimitText()}
              </span>
            </div>

            <Button
              onClick={() => { router.push("/loans?apply=true"); handleNavClick(); }}
              className="w-full bg-primary hover:bg-[#0A3682] text-white rounded-2xl h-9 font-semibold text-xs transition-all shadow-sm"
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
              <Link key={item.name} href={item.href} onClick={handleNavClick}>
                <span
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all group ${
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

      {/* Footer */}
      <div className="flex flex-col gap-3 mt-6">
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
              className="p-2 hover:bg-red-50 dark:hover:bg-red-950/20 text-zinc-500 hover:text-red-600 rounded-xl transition-colors cursor-pointer"
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
