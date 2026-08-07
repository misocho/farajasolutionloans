import api from "@/app/lib/api";

export interface AdminUserRole {
  role: {
    id: string;
    name: string;
    description: string | null;
    approval_limit_amount: number | null;
  };
}

export interface AdminUserBranch {
  branch: {
    id: string;
    name: string;
    code: string;
    active: boolean;
  };
}

export interface AdminUser {
  id: string;
  employee_number: string;
  email: string;
  first_name: string;
  last_name: string;
  status: string;
  last_login_at: string | null;
  roles: AdminUserRole[];
  branches: AdminUserBranch[];
}

export interface AdminRole {
  id: string;
  name: string;
  description: string | null;
  approval_limit_amount: number | null;
}

export interface AdminPermission {
  id: string;
  name: string;
  description: string | null;
}

export async function fetchAdminUsersApi(): Promise<AdminUser[]> {
  const response = await api.get<AdminUser[]>("/admin/users");
  return response.data;
}

export async function fetchAdminRolesApi(): Promise<AdminRole[]> {
  const response = await api.get<AdminRole[]>("/admin/roles");
  return response.data;
}

export async function fetchAdminPermissionsApi(): Promise<AdminPermission[]> {
  const response = await api.get<AdminPermission[]>("/admin/permissions");
  return response.data;
}

export async function fetchRolePermissionsApi(roleId: string): Promise<AdminPermission[]> {
  const response = await api.get<AdminPermission[]>(`/admin/roles/${roleId}/permissions`);
  return response.data;
}

export async function updateUserRolesApi(userId: string, roleNames: string[]): Promise<any> {
  const response = await api.put(`/admin/users/${userId}/roles`, { role_names: roleNames });
  return response.data;
}

export async function updateRolePermissionsApi(roleId: string, permissionNames: string[]): Promise<any> {
  const response = await api.put(`/admin/roles/${roleId}/permissions`, { permission_names: permissionNames });
  return response.data;
}

// ── Invites ──────────────────────────────────────────────────────────────────

export interface UserInviteBranch {
  id: string;
  name: string;
  code: string;
}

export interface UserInviteInviter {
  id: string;
  first_name: string;
  last_name: string;
  employee_number: string;
}

export interface UserInvite {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role_name: string;
  status: "pending" | "accepted" | "expired" | "cancelled";
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  branch: UserInviteBranch | null;
  invited_by: UserInviteInviter | null;
}

export interface InviteUserPayload {
  email: string;
  first_name: string;
  last_name: string;
  role_name: string;
  branch_id?: string | null;
}

export async function inviteUserApi(data: InviteUserPayload): Promise<UserInvite> {
  const response = await api.post<UserInvite>("/admin/users/invite", data);
  return response.data;
}

export async function fetchInvitesApi(): Promise<UserInvite[]> {
  const response = await api.get<UserInvite[]>("/admin/users/invites");
  return response.data;
}

export async function cancelInviteApi(inviteId: string): Promise<{ status: string; message: string }> {
  const response = await api.delete<{ status: string; message: string }>(`/admin/users/invites/${inviteId}`);
  return response.data;
}

export async function approveUserApi(userId: string): Promise<{ status: string; message: string }> {
  const response = await api.patch<{ status: string; message: string }>(`/admin/users/${userId}/approve`);
  return response.data;
}
