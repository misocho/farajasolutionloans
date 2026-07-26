"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, LogOut, Search } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { BranchSelector } from "./branch-selector";
import { Notifications } from "./notifications";
import { UserMenu } from "./user-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { clearToken } from "@/app/lib/auth";

interface TopbarProps {
  onMenuClick?: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    clearToken();
    queryClient.clear();
    toast.success("Logged out successfully");
    router.push("/login");
  };

  // Get human-readable page name based on route
  const getPageTitle = () => {
    const route = pathname.split("/").filter(Boolean)[0] || "";
    switch (route.toLowerCase()) {
      case "dashboard":
        return "Dashboard";
      case "loans":
        return "Loans & Credits";
      case "clients":
        return "Clients Registry";
      case "repayments":
        return "Repayments & Receipts";
      case "reports":
        return "Financial Reports";
      case "branches":
        return "Branch Network";
      case "settings":
        return "System Settings";
      case "users":
        return "Admin Console";
      default:
        return "Faraja Portal";
    }
  };

  return (
    <header className="h-14 sm:h-16 border-b border-zinc-150 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 sm:px-6 flex items-center justify-between shrink-0 font-sans select-none gap-3">
      {/* Left side: Hamburger (mobile) + Page Name */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger — only on mobile */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors shrink-0"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </button>

        <h1 className="text-base sm:text-xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight truncate">
          {getPageTitle()}
        </h1>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Search — hidden on small screens */}
        <div className="hidden md:block w-48 lg:w-64">
          <InputGroup className="bg-zinc-50 border-zinc-200 focus-within:border-primary focus-within:ring-primary/20 dark:bg-zinc-950 dark:border-zinc-850 dark:focus-within:border-zinc-700 dark:focus-within:ring-zinc-700/20 h-9 rounded-2xl">
            <InputGroupAddon align="inline-start" className="pl-3 text-zinc-400">
              <Search className="size-4" />
            </InputGroupAddon>
            <InputGroupInput
              type="text"
              placeholder="Search..."
              className="text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 text-xs"
            />
          </InputGroup>
        </div>

        {/* Branch Switcher — hidden on smallest screens */}
        <div className="hidden sm:block">
          <BranchSelector />
        </div>

        <div className="hidden sm:block h-5 w-px bg-zinc-200 dark:bg-zinc-800" />

        {/* Notifications */}
        <Notifications />

        {/* User Menu — hidden on small screens, use logout button instead */}
        <div className="hidden sm:block">
          <UserMenu />
        </div>

        {/* Quick Logout — always visible, compact on mobile */}
        <button
          onClick={handleLogout}
          title="Logout"
          className="p-2 hover:bg-red-50 dark:hover:bg-red-950/20 text-zinc-500 hover:text-red-600 rounded-xl transition-colors cursor-pointer"
        >
          <LogOut className="size-4 sm:size-[18px]" />
        </button>
      </div>
    </header>
  );
}
