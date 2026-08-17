import api from "@/app/lib/api";

export interface AuditLogEntry {
  id: string;
  actor_name: string;
  action: string;
  entity: string;
  entity_id: string;
  branch_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditLogsResponse {
  total: number;
  logs: AuditLogEntry[];
}

export interface AuditLogsParams {
  action?: string;
  entity?: string;
  branch_id?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export async function fetchAuditLogsApi(params: AuditLogsParams = {}): Promise<AuditLogsResponse> {
  const { data } = await api.get<AuditLogsResponse>("/audit-logs", { params });
  return data;
}