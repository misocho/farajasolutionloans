"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldAlert,
  Users,
  Key,
  Building,
  CheckCircle,
  Mail,
  UserCog,
  Loader2,
  X,
  UserPlus,
  Send,
  Ban,
  BadgeCheck,
  Hourglass,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { fetchMeApi } from "@/features/auth/api";
import {
  fetchAdminUsersApi,
  fetchAdminRolesApi,
  fetchAdminPermissionsApi,
  fetchRolePermissionsApi,
  updateUserRolesApi,
  updateRolePermissionsApi,
  inviteUserApi,
  fetchInvitesApi,
  cancelInviteApi,
  approveUserApi,
  type AdminUser,
  type AdminRole,
  type AdminPermission,
  type InviteUserPayload,
} from "@/features/admin/api";
import { fetchBranchesApi } from "@/features/clients/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


export default function UsersAdminPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"directory" | "permissions">("directory");

  // State for User Role Edit Modal
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [editedUserRoles, setEditedUserRoles] = useState<string[]>([]);

  // State for Role Permission Editor
  const [selectedRole, setSelectedRole] = useState<AdminRole | null>(null);
  const [activeRolePermissions, setActiveRolePermissions] = useState<string[]>([]);

  // State for Invite Modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [inviteBranch, setInviteBranch] = useState("");

  // 1. Fetch current logged-in user profile
  const { data: currentUser } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMeApi,
  });

  // Verify access level using role-based check (consistent with sidebar)
  const getRole = (u: any): string => {
    if (!u) return "";
    if (u.role) return u.role;
    if (u.roles && u.roles.length > 0) return u.roles[0];
    if (u.employee_number?.includes("DIR")) return "Director";
    if (u.employee_number?.includes("SYS")) return "System Admin";
    return "";
  };

  const userRole = getRole(currentUser);
  const userIsAdmin = currentUser !== undefined && (
    userRole === "Director" || userRole === "System Admin"
  );

  // 2. Fetch admin data
  const { data: users, isLoading: usersLoading, isError: usersError } = useQuery({
    queryKey: ["admin-users"],
    queryFn: fetchAdminUsersApi,
    enabled: userIsAdmin,
  });

  const { data: roles, isLoading: rolesLoading, isError: rolesError } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: fetchAdminRolesApi,
    enabled: userIsAdmin,
  });

  const { data: permissions, isError: permissionsError } = useQuery({
    queryKey: ["admin-permissions"],
    queryFn: fetchAdminPermissionsApi,
    enabled: userIsAdmin,
  });

  const { data: invites, isLoading: invitesLoading, isError: invitesError } = useQuery({
    queryKey: ["admin-invites"],
    queryFn: fetchInvitesApi,
    enabled: userIsAdmin,
  });

  const adminQueryError = usersError || rolesError || permissionsError || invitesError;

  const { data: branches } = useQuery({
    queryKey: ["branches-list"],
    queryFn: fetchBranchesApi,
    enabled: userIsAdmin && showInviteModal,
  });

  // Query permissions for active role in the matrix editor
  const { data: rolePermissionsData, isFetching: rolePermsLoading } = useQuery({
    queryKey: ["role-permissions-matrix", selectedRole?.id],
    queryFn: () => fetchRolePermissionsApi(selectedRole!.id),
    enabled: !!selectedRole,
  });

  // Sync role permissions state when data loads or changes
  React.useEffect(() => {
    if (rolePermissionsData) {
      setActiveRolePermissions(rolePermissionsData.map((p) => p.name));
    }
  }, [rolePermissionsData]);

  // Mutations
  const updateRolesMutation = useMutation({
    mutationFn: ({ userId, roleNames }: { userId: string; roleNames: string[] }) =>
      updateUserRolesApi(userId, roleNames),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("User roles updated successfully");
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast.error("Failed to update user roles", {
        description: error.response?.data?.detail || "An error occurred.",
      });
    },
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: ({ roleId, permissionNames }: { roleId: string; permissionNames: string[] }) =>
      updateRolePermissionsApi(roleId, permissionNames),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-permissions-matrix"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("Role permissions updated successfully");
    },
    onError: (error: any) => {
      toast.error("Failed to update role permissions", {
        description: error.response?.data?.detail || "An error occurred.",
      });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (payload: InviteUserPayload) => inviteUserApi(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-invites"] });
      toast.success("Invite sent", {
        description: `An invitation email was sent to ${data.email}.`,
      });
      setShowInviteModal(false);
      setInviteFirstName("");
      setInviteLastName("");
      setInviteEmail("");
      setInviteRole("");
      setInviteBranch("");
    },
    onError: (error: any) => {
      toast.error("Failed to send invite", {
        description: error.response?.data?.detail || "An error occurred.",
      });
    },
  });

  const cancelInviteMutation = useMutation({
    mutationFn: (inviteId: string) => cancelInviteApi(inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-invites"] });
      toast.success("Invite cancelled");
    },
    onError: (error: any) => {
      toast.error("Failed to cancel invite", {
        description: error.response?.data?.detail || "An error occurred.",
      });
    },
  });

  const approveUserMutation = useMutation({
    mutationFn: (userId: string) => approveUserApi(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-invites"] });
      toast.success("User approved — account activated");
    },
    onError: (error: any) => {
      toast.error("Failed to approve user", {
        description: error.response?.data?.detail || "An error occurred.",
      });
    },
  });

  // Security Lock check: Redirect/Lock screen if unauthorized
  if (currentUser && !userIsAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-8 text-center bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-[20px] sm:rounded-[24px] max-w-xl mx-auto shadow-md">
        <div className="p-4 bg-rose-500/10 text-rose-500 rounded-3xl mb-6">
          <ShieldAlert className="size-16" />
        </div>
        <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
          Access Level Denied
        </h2>
        <p className="text-zinc-500 mt-2 text-sm max-w-sm">
          Administrative directories and system privilege matrix configurations are restricted to System Directors and System Admins.
        </p>
        <Button
          onClick={() => window.location.href = "/dashboard"}
          className="mt-6 bg-[#0D44A2] hover:bg-[#0A3682] text-white px-6 rounded-xl"
        >
          Return to Dashboard
        </Button>
      </div>
    );
  }

  // Handle Edit Role Action Click
  const handleOpenEditUser = (user: AdminUser) => {
    setSelectedUser(user);
    setEditedUserRoles(user.roles.map((ur) => ur.role.name));
  };

  // Toggle user role checkboxes
  const handleToggleUserRole = (roleName: string) => {
    setEditedUserRoles((prev) =>
      prev.includes(roleName)
        ? prev.filter((r) => r !== roleName)
        : [...prev, roleName]
    );
  };

  // Save User Role Assignments
  const handleSaveUserRoles = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    updateRolesMutation.mutate({
      userId: selectedUser.id,
      roleNames: editedUserRoles,
    });
  };

  // Toggle role permission checkboxes
  const handleTogglePermission = (permName: string) => {
    setActiveRolePermissions((prev) =>
      prev.includes(permName)
        ? prev.filter((p) => p !== permName)
        : [...prev, permName]
    );
  };

  // Save Role Permission mapping
  const handleSaveRolePermissions = () => {
    if (!selectedRole) return;
    updatePermissionsMutation.mutate({
      roleId: selectedRole.id,
      permissionNames: activeRolePermissions,
    });
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteRole) {
      toast.error("Select a role for the invite.");
      return;
    }
    inviteMutation.mutate({
      email: inviteEmail,
      first_name: inviteFirstName,
      last_name: inviteLastName,
      role_name: inviteRole,
      branch_id: inviteBranch || null,
    });
  };

  const formatInviteExpiry = (expiresAt: string) => {
    const d = new Date(expiresAt);
    return `${d.toLocaleDateString("en-KE")} ${d.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}`;
  };

  const userStatusCfg: Record<string, { label: string; className: string }> = {
    ACTIVE: { label: "Active", className: "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-300" },
    PENDING_APPROVAL: { label: "Pending Approval", className: "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-300" },
    SUSPENDED: { label: "Suspended", className: "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:border-rose-800 dark:text-rose-300" },
    LOCKED: { label: "Locked", className: "bg-zinc-100 border-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300" },
    INACTIVE: { label: "Inactive", className: "bg-zinc-100 border-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300" },
  };

  const inviteStatusCfg: Record<string, { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-300" },
    accepted: { label: "Accepted", className: "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-300" },
    expired: { label: "Expired", className: "bg-zinc-100 border-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400" },
    cancelled: { label: "Cancelled", className: "bg-zinc-100 border-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400" },
  };

  // Group permissions by category (first word before ".")
  const getGroupedPermissions = () => {
    if (!permissions) return {};
    const grouped: Record<string, AdminPermission[]> = {};
    permissions.forEach((perm) => {
      const category = perm.name.split(".")[0] || "General";
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(perm);
    });
    return grouped;
  };

  const groupedPermissions = getGroupedPermissions();

  // Invites whose invitee is already an active employee are done — hide them
  const activeUserEmails = new Set(
    (users ?? [])
      .filter((u) => u.status === "ACTIVE")
      .map((u) => u.email.toLowerCase())
  );
  const visibleInvites = (invites ?? []).filter(
    (i) => !activeUserEmails.has(i.email.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10 text-left select-none">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-6 rounded-[24px] shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-[#0D44A2]/10 text-primary rounded-2xl hidden sm:block">
            <UserCog className="size-6 text-[#0D44A2]" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
              Administrative Console
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              Manage system access roles, branch authorities, and general permission matrices.
            </p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-zinc-50 dark:bg-zinc-950 p-1 rounded-2xl border border-zinc-100 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab("directory")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "directory"
                ? "bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-500 shadow-sm"
                : "text-zinc-500 dark:text-zinc-500 hover:text-zinc-700"
            }`}
          >
            <Users className="size-4" />
            <span>User Directory</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("permissions");
              if (roles && roles.length > 0 && !selectedRole) {
                setSelectedRole(roles[0]);
              }
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "permissions"
                ? "bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-500 shadow-sm"
                : "text-zinc-500 dark:text-zinc-500 hover:text-zinc-700"
            }`}
          >
            <Key className="size-4" />
            <span>Permissions Matrix</span>
          </button>
        </div>
      </div>

      {adminQueryError && (
        <div className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-rose-500 shrink-0" />
            <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">
              Couldn't load the admin console. You may not have access — check with a System Director.
            </p>
          </div>
          <Button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["admin-users"] });
              queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
              queryClient.invalidateQueries({ queryKey: ["admin-permissions"] });
              queryClient.invalidateQueries({ queryKey: ["admin-invites"] });
            }}
            variant="outline"
            size="sm"
            className="h-8 shrink-0 rounded-xl border-rose-300 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:text-rose-300"
          >
            <RefreshCw className="size-3 mr-1" /> Retry
          </Button>
        </div>
      )}

      {/* Directory Tab View */}
      {activeTab === "directory" && (
        <>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-[24px] p-6 shadow-sm overflow-hidden flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-50 text-base">Registered Users</h3>
              <div className="flex items-center gap-2.5">
                <span className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-3 py-1 rounded-full font-semibold">
                  Total Employees: {users?.length || 0}
                </span>
                <Button
                  onClick={() => setShowInviteModal(true)}
                  className="bg-[#0D44A2] hover:bg-[#0A3682] text-white rounded-xl h-9 px-3.5 sm:px-4 font-bold text-xs shadow flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="size-4" />
                  <span className="hidden sm:inline">Invite Employee</span>
                  <span className="sm:hidden">Invite</span>
                </Button>
              </div>
            </div>

          {usersLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-zinc-500">
              <Loader2 className="animate-spin size-8 text-[#0D44A2]" />
              <span className="text-xs">Loading employee records...</span>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 font-bold">
                    <th className="py-3 px-3">Employee ID</th>
                    <th className="py-3 px-3">Name</th>
                    <th className="py-3 px-3">Email Address</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Assigned Roles</th>
                    <th className="py-3 px-3">Branches</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100/50 dark:divide-zinc-800/50">
                  {users?.map((user) => (
                    <tr key={user.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/10 transition-colors">
                      <td className="py-4 px-3 font-mono font-bold text-zinc-700 dark:text-zinc-400">
                        {user.employee_number}
                      </td>
                      <td className="py-4 px-3 font-bold text-zinc-950 dark:text-zinc-100">
                        {user.first_name} {user.last_name}
                      </td>
                      <td className="py-4 px-3 text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 mt-1.5">
                        <Mail className="size-3.5 shrink-0" />
                        <span>{user.email}</span>
                      </td>
                      <td className="py-4 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-bold ${userStatusCfg[user.status]?.className ?? userStatusCfg.INACTIVE.className}`}>
                          {user.status === "PENDING_APPROVAL" && <Hourglass className="size-3" />}
                          {userStatusCfg[user.status]?.label ?? user.status}
                        </span>
                      </td>
                      <td className="py-4 px-3">
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((ur) => (
                            <span
                              key={ur.role.id}
                              className="px-2 py-0.5 rounded-lg border border-[#0D44A2]/25 text-[#0D44A2] bg-[#0D44A2]/5 dark:text-blue-450 dark:border-blue-900/40 text-[10px] font-bold"
                            >
                              {ur.role.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-4 px-3">
                        <div className="flex flex-wrap gap-1 text-zinc-600 dark:text-zinc-500">
                          {user.branches.map((ub) => (
                            <span key={ub.branch.id} className="flex items-center gap-1 text-[11px]">
                              <Building className="size-3 text-[#F57424]" />
                              <span>{ub.branch.name}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-4 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {user.status === "PENDING_APPROVAL" && (
                            <Button
                              onClick={() => approveUserMutation.mutate(user.id)}
                              disabled={approveUserMutation.isPending}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-8 px-3 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                            >
                              {approveUserMutation.isPending ? <Loader2 className="animate-spin size-3" /> : <BadgeCheck className="size-3.5" />}
                              Approve
                            </Button>
                          )}
                          <Button
                            onClick={() => handleOpenEditUser(user)}
                            variant="outline"
                            size="sm"
                            className="rounded-xl border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 h-8"
                          >
                            Manage Roles
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pending Invitations */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-[24px] p-6 shadow-sm overflow-hidden flex flex-col gap-4">
          <div className="flex items-center justify-between pb-2 gap-3">
            <h3 className="font-bold text-zinc-900 dark:text-zinc-50 text-base">Pending Invitations</h3>
            <span className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-3 py-1 rounded-full font-semibold">
              {visibleInvites.filter((i) => i.status === "pending").length || 0} awaiting acceptance
            </span>
          </div>

          {invitesLoading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-zinc-500">
              <Loader2 className="animate-spin size-6 text-[#0D44A2]" />
              <span className="text-xs">Loading invitations...</span>
            </div>
          ) : visibleInvites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-zinc-400">
              <Send className="size-8 text-zinc-300" />
              <p className="text-xs">No pending invitations — all invited staff have been onboarded.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {visibleInvites.map((invite) => {
                const status = inviteStatusCfg[invite.status] ?? inviteStatusCfg.cancelled;
                return (
                  <div
                    key={invite.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/30"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2.5 bg-[#0D44A2]/10 rounded-xl shrink-0">
                        <Mail className="size-4 text-[#0D44A2]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                          {invite.first_name} {invite.last_name}
                          <span className="text-zinc-400 font-medium"> · {invite.email}</span>
                        </p>
                        <p className="text-[11px] text-zinc-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span>{invite.role_name}</span>
                          {invite.branch && (
                            <>
                              <span className="text-zinc-300">•</span>
                              <span className="flex items-center gap-1">
                                <Building className="size-3 text-[#F57424]" />
                                {invite.branch.name}
                              </span>
                            </>
                          )}
                          <span className="text-zinc-300">•</span>
                          <span>Expires {formatInviteExpiry(invite.expires_at)}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
                      <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold ${status.className}`}>
                        {status.label}
                      </span>
                      {invite.status === "pending" && (
                        <Button
                          onClick={() => cancelInviteMutation.mutate(invite.id)}
                          disabled={cancelInviteMutation.isPending}
                          variant="outline"
                          size="sm"
                          className="rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/20 h-8 flex items-center gap-1.5"
                        >
                          <Ban className="size-3.5" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </>
      )}
      {activeTab === "permissions" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Roles Selector Sidebar */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-[24px] p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-zinc-900 dark:text-zinc-50 text-sm pb-2 border-b border-zinc-100 dark:border-zinc-800">
              System Roles
            </h3>
            {rolesLoading ? (
              <div className="flex items-center justify-center py-6 text-zinc-500">
                <Loader2 className="animate-spin size-5 text-[#0D44A2]" />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {roles?.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => {
                      setSelectedRole(role);
                      setActiveRolePermissions([]);
                    }}
                    className={`p-3 rounded-2xl border text-left flex justify-between items-center transition-all cursor-pointer focus:outline-none w-full ${
                      selectedRole?.id === role.id
                        ? "bg-primary border-primary text-white shadow-md shadow-primary/10"
                        : "bg-zinc-50/50 hover:bg-zinc-50 border-zinc-100 hover:border-zinc-200 text-zinc-800 dark:bg-zinc-900/20 dark:border-zinc-800 dark:hover:border-zinc-700 dark:text-zinc-200"
                    }`}
                  >
                    <div className="flex flex-col leading-none">
                      <span className="text-xs font-bold">{role.name}</span>
                      <span
                        className={`text-[9px] mt-1 truncate max-w-[170px] ${
                          selectedRole?.id === role.id ? "text-white/70" : "text-zinc-400"
                        }`}
                      >
                        {role.description || "No description"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Permissions Matrix Content */}
          <div className="lg:col-span-3 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-[24px] p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex flex-col text-left">
                  <h3 className="font-bold text-zinc-900 dark:text-zinc-50 text-base">
                    Privilege Configurations: <span className="text-primary">{selectedRole?.name}</span>
                  </h3>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                    Assign granular system permissions using checks.
                  </p>
                </div>

                <Button
                  onClick={handleSaveRolePermissions}
                  disabled={updatePermissionsMutation.isPending || !selectedRole || rolePermsLoading}
                  className="bg-[#F57424] hover:bg-[#DE6218] text-white rounded-xl h-9 px-5 shadow font-bold text-xs"
                >
                  {updatePermissionsMutation.isPending && <Loader2 className="animate-spin size-3 mr-1" />}
                  Save Permissions Matrix
                </Button>
              </div>

              {rolePermsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-2 text-zinc-500">
                  <Loader2 className="animate-spin size-8 text-primary" />
                  <span className="text-xs">Fetching active privileges...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 max-h-[500px] overflow-y-auto pr-2">
                  {Object.entries(groupedPermissions).map(([category, perms]) => (
                    <div
                      key={category}
                      className="border border-zinc-100 dark:border-zinc-800 p-4 rounded-[20px] bg-zinc-50/20"
                    >
                      <h4 className="font-bold text-xs text-[#0D44A2] uppercase tracking-wider mb-3">
                        {category} Rights
                      </h4>
                      <div className="flex flex-col gap-2.5">
                        {perms.map((perm) => (
                          <label
                            key={perm.id}
                            className="flex items-start gap-2.5 cursor-pointer text-left group"
                          >
                            <input
                              type="checkbox"
                              checked={activeRolePermissions.includes(perm.name)}
                              onChange={() => handleTogglePermission(perm.name)}
                              className="mt-0.5 rounded border-zinc-300 text-primary focus:ring-primary size-4 cursor-pointer"
                            />
                            <div className="flex flex-col leading-none">
                              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-zinc-950 dark:group-hover:text-zinc-50 transition-colors">
                                {perm.name.split(".")[1]?.toUpperCase() || perm.name}
                              </span>
                              <span className="text-[10px] text-zinc-400 mt-1">
                                {perm.description || "Access control right"}
                              </span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- ADMINISTRATIVE DIALOGS --- */}

      {/* Modal: Edit User Roles */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[28px] p-6 w-full max-w-md shadow-2xl animate-in fade-in-50 zoom-in-95 duration-200 text-left">
            <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-50 text-base">Assign User Roles</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Update employee permissions for {selectedUser.first_name} {selectedUser.last_name}
                </p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full cursor-pointer focus:outline-none"
              >
                <X className="size-5 text-zinc-500" />
              </button>
            </div>

            <form onSubmit={handleSaveUserRoles} className="space-y-4 mt-4">
              <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-2xl flex flex-col gap-1 border border-zinc-100 dark:border-zinc-800">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">User details</span>
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  {selectedUser.first_name} {selectedUser.last_name} ({selectedUser.employee_number})
                </span>
                <span className="text-[11px] text-zinc-500">{selectedUser.email}</span>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Roles Selection</Label>
                <div className="grid grid-cols-1 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {roles?.map((role) => (
                    <label
                      key={role.id}
                      className="flex items-center gap-3 p-3 rounded-2xl border border-zinc-100 hover:border-zinc-200 dark:border-zinc-800/80 dark:hover:border-zinc-700 bg-zinc-50/20 hover:bg-zinc-50/50 cursor-pointer select-none transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={editedUserRoles.includes(role.name)}
                        onChange={() => handleToggleUserRole(role.name)}
                        className="rounded border-zinc-300 text-primary focus:ring-primary size-4 cursor-pointer"
                      />
                      <div className="flex flex-col leading-none">
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200">{role.name}</span>
                        <span className="text-[10px] text-zinc-400 mt-1">{role.description}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={updateRolesMutation.isPending}
                  className="w-full bg-[#0D44A2] hover:bg-[#0A3682] text-white rounded-xl h-11 font-semibold flex items-center justify-center gap-2 cursor-pointer shadow"
                >
                  {updateRolesMutation.isPending ? (
                    <Loader2 className="animate-spin size-4" />
                  ) : (
                    <CheckCircle className="size-4" />
                  )}
                  <span>{updateRolesMutation.isPending ? "Applying user roles..." : "Save Assigned Roles"}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Invite Employee */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[20px] sm:rounded-[24px] p-6 w-full max-w-md shadow-2xl animate-in fade-in-50 zoom-in-95 duration-200 text-left">
            <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-50 text-base">Invite Employee</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  An email with a setup link will be sent to the invitee.
                </p>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full cursor-pointer focus:outline-none"
              >
                <X className="size-5 text-zinc-500" />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-first-name" className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    First Name
                  </Label>
                  <Input
                    id="invite-first-name"
                    value={inviteFirstName}
                    onChange={(e) => setInviteFirstName(e.target.value)}
                    placeholder="e.g. Wanjiru"
                    className="h-10 rounded-xl border-zinc-200 dark:border-zinc-700 bg-zinc-50"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-last-name" className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Last Name
                  </Label>
                  <Input
                    id="invite-last-name"
                    value={inviteLastName}
                    onChange={(e) => setInviteLastName(e.target.value)}
                    placeholder="e.g. Kamau"
                    className="h-10 rounded-xl border-zinc-200 dark:border-zinc-700 bg-zinc-50"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="invite-email" className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Email Address
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="name@farajasolutions.co.ke"
                  className="h-10 rounded-xl border-zinc-200 dark:border-zinc-700 bg-zinc-50"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-role" className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Role
                  </Label>
                  <select
                    id="invite-role"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 text-xs text-zinc-700 dark:text-zinc-300 focus:ring-primary/20 focus:border-primary"
                    required
                  >
                    <option value="" disabled>Select a role...</option>
                    {roles?.map((role) => (
                      <option key={role.id} value={role.name}>{role.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-branch" className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Branch <span className="text-zinc-400 font-medium">(optional)</span>
                  </Label>
                  <select
                    id="invite-branch"
                    value={inviteBranch}
                    onChange={(e) => setInviteBranch(e.target.value)}
                    className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 text-xs text-zinc-700 dark:text-zinc-300 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="">No branch</option>
                    {branches?.map((branch) => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={inviteMutation.isPending}
                  className="w-full bg-[#0D44A2] hover:bg-[#0A3682] text-white rounded-xl h-11 font-semibold flex items-center justify-center gap-2 cursor-pointer shadow"
                >
                  {inviteMutation.isPending ? (
                    <Loader2 className="animate-spin size-4" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  <span>{inviteMutation.isPending ? "Sending invite..." : "Send Invitation"}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
