import api from "@/app/lib/api";
import { LoginRequest, LoginResponse, UserProfile } from "./types";

export async function loginApi(data: LoginRequest): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>("/auth/login", data);
  return response.data;
}

export async function fetchMeApi(): Promise<UserProfile> {
  const response = await api.get<UserProfile>("/auth/me");
  return response.data;
}

export interface AcceptInviteResponse {
  message: string;
  employee_number: string;
}

export async function acceptInviteApi(data: { token: string; password: string }): Promise<AcceptInviteResponse> {
  const response = await api.post<AcceptInviteResponse>("/auth/accept-invite", data);
  return response.data;
}

export async function completeProfileApi(data: {
  token: string;
  phone: string;
  id_no: string;
  photo?: string;
}): Promise<AcceptInviteResponse> {
  const response = await api.post<AcceptInviteResponse>("/auth/complete-profile", data);
  return response.data;
}

export interface ChangePasswordResponse {
  status: string;
  message: string;
}

export async function changePasswordApi(data: {
  current_password: string;
  new_password: string;
}): Promise<ChangePasswordResponse> {
  const response = await api.patch<ChangePasswordResponse>("/auth/change-password", data);
  return response.data;
}
