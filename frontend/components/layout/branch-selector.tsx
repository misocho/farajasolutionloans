"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, ChevronDown, Loader2 } from "lucide-react";
import { fetchBranchesApi, type Branch } from "@/features/clients/api";

// ── Branch Context — shared across the entire app ─────────────────────────────

interface BranchContextValue {
  selectedBranchId: string;
  setSelectedBranchId: (id: string) => void;
  selectedBranch: Branch | null;
  branches: Branch[];
}

const BranchContext = createContext<BranchContextValue>({
  selectedBranchId: "all",
  setSelectedBranchId: () => {},
  selectedBranch: null,
  branches: [],
});

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [selectedBranchId, setSelectedBranchIdState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("selectedBranchId") || "all";
    }
    return "all";
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: fetchBranchesApi,
    staleTime: 5 * 60 * 1000,
  });

  const selectedBranch = branches.find(b => b.id === selectedBranchId) ?? null;

  const setSelectedBranchId = (id: string) => {
    setSelectedBranchIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("selectedBranchId", id);
    }
  };

  return (
    <BranchContext.Provider value={{ selectedBranchId, setSelectedBranchId, selectedBranch, branches }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  return useContext(BranchContext);
}

// ── Branch Selector Component ──────────────────────────────────────────────────

export function BranchSelector() {
  const { selectedBranchId, setSelectedBranchId, selectedBranch, branches } = useBranch();
  const [open, setOpen] = useState(false);

  const activeBranches = branches.filter(b => b.is_active);
  const displayName = selectedBranchId === "all"
    ? "All Branches"
    : selectedBranch?.name ?? "Select Branch";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 h-10 px-3.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-2xl text-sm font-medium text-zinc-700 dark:text-zinc-300 shadow-sm transition-colors cursor-pointer w-[200px] min-w-0"
      >
        <MapPin className="size-4 text-[#0D44A2] shrink-0" />
        <span className="truncate flex-1 text-left text-xs font-semibold">{displayName}</span>
        <ChevronDown className={`size-3.5 text-zinc-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* Dropdown */}
          <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-xl p-1 min-w-[220px]">
            {/* All Branches option */}
            <button
              onClick={() => { setSelectedBranchId("all"); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-left ${
                selectedBranchId === "all"
                  ? "bg-[#0D44A2] text-white"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              <div className={`size-1.5 rounded-full shrink-0 ${selectedBranchId === "all" ? "bg-white" : "bg-emerald-500"}`} />
              All Branches
            </button>

            {activeBranches.length > 0 && (
              <>
                <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
                {activeBranches.map(branch => (
                  <button
                    key={branch.id}
                    onClick={() => { setSelectedBranchId(branch.id); setOpen(false); }}
                    className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl transition-colors cursor-pointer text-left ${
                      selectedBranchId === branch.id
                        ? "bg-[#0D44A2]/10 text-[#0D44A2] dark:bg-[#0D44A2]/20"
                        : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <MapPin className="size-3.5 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{branch.name}</p>
                      <p className="text-[10px] text-zinc-400 truncate">{branch.location}</p>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
