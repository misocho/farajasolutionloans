"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";

import { BranchSelector } from "./branch-selector";
import { Notifications } from "./notifications";
import { UserMenu } from "./user-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

export function Topbar() {
  const pathname = usePathname();

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
      case "settings":
        return "System Settings";
      default:
        return "Faraja Portal";
    }
  };

  return (
    <header className="h-16 border-b border-zinc-150 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 flex items-center justify-between shrink-0 font-sans select-none">
      {/* Left side: Page Name */}
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
          {getPageTitle()}
        </h1>
      </div>

      {/* Right side: Search, Branch Selector, Notifications, User Menu */}
      <div className="flex items-center gap-4">
        {/* Search Input (Hidden on tiny screens) */}
        <div className="hidden sm:block w-64">
          <InputGroup className="bg-zinc-50 border-zinc-200 focus-within:border-primary focus-within:ring-primary/20 dark:bg-zinc-950 dark:border-zinc-850 dark:focus-within:border-zinc-700 dark:focus-within:ring-zinc-700/20 h-9 rounded-2xl">
            <InputGroupAddon align="inline-start" className="pl-3 text-zinc-400">
              <Search className="size-4" />
            </InputGroupAddon>
            <InputGroupInput
              type="text"
              placeholder="Search loans, clients..."
              className="text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 text-xs"
            />
          </InputGroup>
        </div>

        {/* Branch Switcher */}
        <BranchSelector />

        <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800" />

        {/* Notification Bell */}
        <Notifications />

        {/* User Account Menu */}
        <UserMenu />
      </div>
    </header>
  );
}
