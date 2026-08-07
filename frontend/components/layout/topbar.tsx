"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, LogOut, Search, Loader2, Users, FileText } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { BranchSelector } from "./branch-selector";
import { Notifications } from "./notifications";
import { UserMenu } from "./user-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { clearToken } from "@/app/lib/auth";
import { fetchGlobalSearchApi, type SearchResult } from "@/features/clients/api";

interface TopbarProps {
  onMenuClick?: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    clearToken();
    queryClient.clear();
    toast.success("Logged out successfully");
    router.push("/login");
  };

  // Debounced global search
  useEffect(() => {
    let cancelled = false;
    const term = query.trim();
    const timer = setTimeout(async () => {
      if (term.length < 2) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      try {
        const matches = await fetchGlobalSearchApi(term);
        if (!cancelled) {
          setResults(matches);
          setSearching(false);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
          setSearching(false);
        }
      }
    }, term.length < 2 ? 0 : 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  // Close the dropdown on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleSelectResult = (result: SearchResult) => {
    setSearchOpen(false);
    setQuery("");
    setResults([]);
    router.push(result.type === "client" ? `/clients?client=${result.id}` : `/loans?loan=${result.id}`);
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
    <header className="h-14 sm:h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 sm:px-6 flex items-center justify-between shrink-0 font-sans select-none gap-3">
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
        <div className="hidden md:block w-48 lg:w-64 relative" ref={searchRef}>
          <InputGroup className="bg-zinc-50 border-zinc-200 focus-within:border-primary focus-within:ring-primary/20 dark:bg-zinc-950 dark:border-zinc-800 dark:focus-within:border-zinc-700 dark:focus-within:ring-zinc-700/20 h-9 rounded-2xl">
            <InputGroupAddon align="inline-start" className="pl-3 text-zinc-400">
              <Search className="size-4" />
            </InputGroupAddon>
            <InputGroupInput
              type="text"
              placeholder="Search clients or loans..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSearchOpen(false);
                if (e.key === "Enter" && results.length > 0) handleSelectResult(results[0]);
              }}
              className="text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 text-xs"
            />
          </InputGroup>

          {searchOpen && query.trim().length >= 2 && (
            <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-xl p-1 min-w-[280px] max-h-96 overflow-y-auto">
              {searching ? (
                <div className="flex items-center gap-2 px-3 py-3 text-xs text-zinc-500">
                  <Loader2 className="size-3.5 animate-spin" />
                  Searching...
                </div>
              ) : results.length === 0 ? (
                <p className="px-3 py-3 text-xs text-zinc-400">
                  No matches for &quot;{query.trim()}&quot;
                </p>
              ) : (
                results.map((result) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleSelectResult(result)}
                    className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl transition-colors cursor-pointer text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <div className="size-8 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      {result.type === "client" ? (
                        <Users className="size-4" />
                      ) : (
                        <FileText className="size-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">
                        {result.title}
                      </p>
                      <p className="text-[10px] text-zinc-400 truncate">{result.subtitle}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
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
