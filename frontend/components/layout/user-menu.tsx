"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, User, Settings, ShieldCheck, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { AxiosError } from "axios";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchMeApi, changePasswordApi } from "@/features/auth/api";
import { clearToken } from "@/app/lib/auth";
import { formatDate } from "@/app/lib/format";

export function UserMenu() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [profileOpen, setProfileOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "", confirm: "" });
  const [pwError, setPwError] = useState<string | null>(null);

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

  const changePwMut = useMutation({
    mutationFn: () =>
      changePasswordApi({ current_password: pwForm.current_password, new_password: pwForm.new_password }),
    onSuccess: () => {
      toast.success("Password updated successfully");
      setPasswordOpen(false);
      setPwForm({ current_password: "", new_password: "", confirm: "" });
      setPwError(null);
    },
    onError: (e: AxiosError<{ detail?: string }>) => {
      setPwError(e.response?.data?.detail || "Failed to update password");
    },
  });

  const handleChangePassword = () => {
    setPwError(null);
    if (pwForm.new_password.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (pwForm.new_password !== pwForm.confirm) {
      setPwError("Passwords do not match.");
      return;
    }
    changePwMut.mutate();
  };

  const getInitials = () => {
    if (!user) return "FS";
    return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
  };

  if (!user) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="focus:outline-none cursor-pointer">
          <div className="flex items-center gap-2.5 p-1 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <Avatar className="size-9 bg-[#0D44A2] text-white">
              {user.profile_photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.profile_photo} alt={`${user.first_name} ${user.last_name}`} className="size-full rounded-full object-cover" />
              ) : (
                <AvatarFallback className="font-semibold text-sm">
                  {getInitials()}
                </AvatarFallback>
              )}
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
              <p className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-400 w-fit font-mono mt-1">
                ID: {user.employee_number}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => setProfileOpen(true)} className="text-zinc-700 dark:text-zinc-300 cursor-pointer">
            <User className="mr-2 size-4" />
            <span>My Profile</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setPermissionsOpen(true)} className="text-zinc-700 dark:text-zinc-300 cursor-pointer">
            <ShieldCheck className="mr-2 size-4" />
            <span>Permissions</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => router.push("/settings")} className="text-zinc-700 dark:text-zinc-300 cursor-pointer">
            <Settings className="mr-2 size-4" />
            <span>Settings</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setPasswordOpen(true)} className="text-zinc-700 dark:text-zinc-300 cursor-pointer">
            <KeyRound className="mr-2 size-4" />
            <span>Change Password</span>
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

      {/* ── My Profile dialog ─────────────────────────────────────────────────── */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>My Profile</DialogTitle>
            <DialogDescription>Your account details.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Full Name</p>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                {user.first_name} {user.last_name}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Employee Number</p>
              <p className="text-sm font-mono text-zinc-800 dark:text-zinc-200">{user.employee_number}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Email</p>
              <p className="text-sm text-zinc-800 dark:text-zinc-200 break-all">{user.email}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Role</p>
              <p className="text-sm text-zinc-800 dark:text-zinc-200">{user.role || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Branch(es)</p>
              <p className="text-sm text-zinc-800 dark:text-zinc-200">
                {user.branches?.length ? user.branches.join(", ") : "All branches"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Last Login</p>
              <p className="text-sm text-zinc-800 dark:text-zinc-200">
                {user.last_login_at ? formatDate(user.last_login_at) : "—"}
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setProfileOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Permissions dialog ────────────────────────────────────────────────── */}
      <Dialog open={permissionsOpen} onOpenChange={setPermissionsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>My Permissions</DialogTitle>
            <DialogDescription>
              Permissions granted to the {user.role || "your"} role.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-1.5 max-h-72 overflow-y-auto">
            {(user.permissions ?? []).map(perm => (
              <span
                key={perm}
                className="px-2 py-1 rounded-lg bg-[#0D44A2]/10 text-[#0D44A2] dark:bg-[#0D44A2]/20 text-[10px] font-bold"
              >
                {perm}
              </span>
            ))}
            {!user.permissions?.length && (
              <p className="text-xs text-zinc-400">No permissions assigned.</p>
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setPermissionsOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Change Password dialog ────────────────────────────────────────────── */}
      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and a new one (at least 8 characters).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={pwForm.current_password}
                onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={pwForm.new_password}
                onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })}
                placeholder="At least 8 characters"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={pwForm.confirm}
                onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                placeholder="Repeat new password"
              />
            </div>
            {pwError && (
              <p className="text-xs text-red-600">{pwError}</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPasswordOpen(false)}>Cancel</Button>
            <Button onClick={handleChangePassword} disabled={changePwMut.isPending}>
              {changePwMut.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Password"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
