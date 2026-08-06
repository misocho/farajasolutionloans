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
