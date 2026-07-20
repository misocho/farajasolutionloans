"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, User, Settings, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { fetchMeApi } from "@/features/auth/api";
import { clearToken } from "@/app/lib/auth";

export function UserMenu() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Retrieve user info from Query cache
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMeApi,
    staleTime: Infinity, // Rely on cache
  });

  const handleLogout = () => {
    clearToken();
    queryClient.clear(); // Clear query cache
    toast.success("Logged out successfully");
    router.push("/login");
  };

  const getInitials = () => {
    if (!user) return "FS";
    return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
  };

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="focus:outline-none cursor-pointer">
        <div className="flex items-center gap-2.5 p-1 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
          <Avatar className="size-9 bg-[#0D44A2] text-white">
            <AvatarFallback className="font-semibold text-sm">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:flex flex-col text-left leading-none">
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              {user.first_name} {user.last_name}
            </span>
            <span className="text-xs text-zinc-500 mt-0.5">
              {user.role || "Director"}
            </span>
          </div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 shadow-xl mt-1">
        <DropdownMenuLabel className="px-2 py-2">
          <div className="flex flex-col space-y-0.5">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {user.first_name} {user.last_name}
            </p>
            <p className="text-xs text-zinc-500 truncate">
              {user.email}
            </p>
            <p className="text-[10px] bg-zinc-100 dark:bg-zinc-850 px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-400 w-fit font-mono mt-1">
              ID: {user.employee_number}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem className="text-zinc-700 dark:text-zinc-300">
          <User className="mr-2 size-4" />
          <span>My Profile</span>
        </DropdownMenuItem>

        <DropdownMenuItem className="text-zinc-700 dark:text-zinc-300">
          <ShieldCheck className="mr-2 size-4" />
          <span>Permissions</span>
        </DropdownMenuItem>

        <DropdownMenuItem className="text-zinc-700 dark:text-zinc-300">
          <Settings className="mr-2 size-4" />
          <span>Settings</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={handleLogout}
          variant="destructive"
          className="text-red-600 focus:bg-red-50 focus:text-red-700 cursor-pointer"
        >
          <LogOut className="mr-2 size-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
