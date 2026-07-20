"use client";

import React, { useState } from "react";
import { MapPin } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function BranchSelector() {
  const [branch, setBranch] = useState("Head Office - Miritini");

  return (
    <div className="flex items-center">
      <Select value={branch} onValueChange={setBranch}>
        <SelectTrigger className="border-zinc-200/80 bg-white hover:bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 rounded-2xl px-3 py-1.5 h-10 w-[200px] shadow-sm select-none shrink-0">
          <SelectValue>
            <span className="flex items-center gap-2 font-medium text-sm">
              <MapPin className="size-4 text-[#0D44A2] shrink-0" />
              <span className="truncate">{branch}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end" className="p-1 rounded-2xl bg-white dark:bg-zinc-900 shadow-xl border border-zinc-100 dark:border-zinc-800 min-w-[200px]">
          <SelectItem value="Head Office - Miritini">Head Office - Miritini</SelectItem>
          <SelectItem value="Mombasa">Mombasa Branch</SelectItem>
          <SelectItem value="Nairobi">Nairobi Branch</SelectItem>
          <SelectItem value="Kisumu">Kisumu Branch</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
