import api from "@/app/lib/api";

// ── Sub-types ────────────────────────────────────────────────────────────────

export interface NextOfKin {
  fullName: string;
  idNo?: string;
  relationship: string;
  phone: string;
  address?: string;
  occupation?: string;
  school_note?: string;
}

export interface Dependant {
  fullName: string;
  age: string;
  relationship: string;
  is_school_going: boolean;
  school_name?: string;
  school_grade?: string;
  occupation?: string;
}

export interface PropertyItem {
  description: string;
  makeModel?: string;
  serialNo?: string;
  estValue: string;
}

export interface Repayment {
  id: string;
  loan_id: string;
  loan_number: string;
  client: string;
  client_id?: string;
  client_phone?: string | null;
  amount: number;
  date: string;
  mode: string;
  reference: string;
  receipt_photo?: string | null;
  notes?: string | null;
  recorded_by?: string;
  verified: boolean;
  verified_by?: string | null;
  verified_at?: string | null;
}

// ── Loan Interface ────────────────────────────────────────────────────────────

export type LoanStatus = "Pending" | "Approved" | "Disbursed" | "Rejected" | "Closed"
  | "Almost Due" | "Due" | "Performing" | "Arrears" | "Past Maturity" | "Defaulter" | "Paid";

export interface Loan {
  id: string;
  loan_number: string;
  client: string;
  sector: string;
  amount: number;
  duration_days: number;
  application_fee: number;
  notes?: string;
  submitted_by?: string;
  approved_by?: string | null;
  disbursed_by?: string | null;
  approval_note?: string | null;
  rejection_reason?: string | null;
  date: string;
  disbursed_date?: string | null;
  due_date?: string | null;
  status: LoanStatus;
  // Computed fields from backend
  interest_amount: number;
  total_repayable: number;
  amount_repaid: number;
  outstanding: number;
  is_overdue: boolean;
  days_overdue: number;
  penalty_amount: number;
  // When fetched by ID
  repayments?: Repayment[];
}

export interface LoanProduct {
  id: string;
  name: string;
  product_type: string;
  duration_days: number;
  interest_rate: number;
  penalty_rate: number;
  penalty_interval_days: number;
  max_penalty_amount?: number | null;
}

// ── Client Interface ─────────────────────────────────────────────────────────

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  id_no?: string;
  pin?: string;
  gender?: string;
  marital_status?: string;
  occupation?: string;
  address?: string;
  period_years?: string;
  accommodation?: string;
  landmark?: string;
  spouse_name?: string;
  spouse_id?: string;
  spouse_phone?: string;
  spouse_occupation?: string;
  spouse_address?: string;
  applicant_dependants?: Dependant[];
  spouse_dependants?: Dependant[];
  dependants_count?: string;
  dependants_ages?: string;
  school_going_count?: string;
  school_details?: string;
  next_of_kin_list?: NextOfKin[];
  business_name?: string;
  business_type: string;
  business_sector_custom?: string;
  business_landmark?: string;
  business_years?: string;
  business_location?: string;
  estimated_asset_value?: number | null;
  guarantor_surname?: string;
  guarantor_first_name?: string;
  guarantor_middle_name?: string;
  guarantor_id_no?: string;
  guarantor_phone?: string;
  guarantor_relationship?: string;
  guarantor_address?: string;
  guarantor_occupation?: string;
  guarantor_period_known?: string;
  properties_list?: PropertyItem[];
  applicant_id_photo?: string;
  applicant_passport_photo?: string;
  guarantor_id_photo?: string;
  guarantor_passport_photo?: string;
  applicant_signature?: string;
  guarantor_signature?: string;
  registration_fee?: number;
  application_fee?: number;
  date_registered: string;
}

export type ClientCreateData = Omit<Client, "id" | "date_registered">;

// ── Fee Constants ────────────────────────────────────────────────────────────

export const LOAN_APPLICATION_FEE = 500;
export const INTEREST_RATE = 0.20;       // 20% flat
export const PENALTY_RATE = 0.03;        // 3% per 2 days overdue

// ── Fee Interfaces ───────────────────────────────────────────────────────────

export interface FeeQuote {
  amount: number;
  tier: "existing" | "new";
  is_existing_client: boolean;
  minimum_amount: number;
}

export interface FeePayment {
  id: string;
  client_id: string;
  client: string;
  loan_id?: string | null;
  loan_number?: string | null;
  fee_type: string;
  amount: number;
  mode: string;
  reference?: string | null;
  notes?: string | null;
  recorded_by?: string | null;
  verified: boolean;
  verified_by?: string | null;
  verified_at?: string | null;
  created_at?: string | null;
}

// ── API Functions ────────────────────────────────────────────────────────────

export async function fetchLoansApi(): Promise<Loan[]> {
  const res = await api.get<Loan[]>("/loans");
  return res.data;
}

export async function fetchLoanApi(id: string): Promise<Loan> {
  const res = await api.get<Loan>(`/loans/${id}`);
  return res.data;
}

export async function createLoanApi(data: {
  client_id: string; loan_product_id: string; amount: number;
  sector?: string; notes?: string;
}): Promise<Loan> {
  const res = await api.post<Loan>("/loans", data);
  return res.data;
}

export async function fetchLoanProductsApi() {
  const res = await api.get("/loan-products");
  return res.data;
}

// ── Fee API ──────────────────────────────────────────────────────────────────

export async function fetchFeeQuoteApi(client_id: string, amount: number): Promise<FeeQuote> {
  const res = await api.get<FeeQuote>("/fees/quote", { params: { client_id, amount } });
  return res.data;
}

export async function fetchFeesApi(client_id?: string): Promise<FeePayment[]> {
  const res = await api.get<FeePayment[]>("/fees", { params: client_id ? { client_id } : {} });
  return res.data;
}

export async function recordFeeApi(data: {
  client_id: string; amount: number; mode: string;
  reference?: string; notes?: string;
}): Promise<FeePayment> {
  const res = await api.post<FeePayment>("/fees", data);
  return res.data;
}

export async function verifyFeeApi(id: string): Promise<FeePayment> {
  const res = await api.post<FeePayment>(`/fees/${id}/verify`);
  return res.data;
}

export async function approveLoanApi(id: string, note?: string, officer_name?: string): Promise<Loan> {
  const res = await api.patch<Loan>(`/loans/${id}/approve`, { note, officer_name });
  return res.data;
}

export async function rejectLoanApi(id: string, note: string, officer_name?: string): Promise<Loan> {
  const res = await api.patch<Loan>(`/loans/${id}/reject`, { note, officer_name });
  return res.data;
}

export async function disburseLoanApi(id: string, officer_name?: string, duration_days?: number): Promise<Loan> {
  const res = await api.patch<Loan>(`/loans/${id}/disburse`, { officer_name, duration_days });
  return res.data;
}

export async function closeLoanApi(id: string, officer_name?: string): Promise<Loan> {
  const res = await api.patch<Loan>(`/loans/${id}/close`, { officer_name });
  return res.data;
}

// ── Repayment API ────────────────────────────────────────────────────────────

export async function fetchRepaymentsApi(loan_id?: string): Promise<Repayment[]> {
  const res = await api.get<Repayment[]>("/repayments", { params: loan_id ? { loan_id } : {} });
  return res.data;
}

export async function createRepaymentApi(data: {
  loan_id: string; client: string; amount: number;
  mode: string; reference?: string; receipt_photo?: string | null; recorded_by?: string;
}): Promise<Repayment> {
  const res = await api.post<Repayment>("/repayments", data);
  return res.data;
}

export async function verifyRepaymentApi(id: string, verified_by: string): Promise<Repayment> {
  const res = await api.patch<Repayment>(`/repayments/${id}/verify`, { verified_by });
  return res.data;
}

// ── Dashboard Stats API ───────────────────────────────────────────────────────

export interface DashboardActivity {
  type: "repayment" | "loan" | "client" | "fee";
  title: string;
  description: string;
  time: string;
}

export interface DashboardStats {
  total_clients: number;
  total_loans: number;
  active_loans: number;
  pending_loans: number;
  total_disbursed: number;
  total_collected: number;
  unverified_repayments: number;
  fee_income: number;
  portfolio_outstanding: number;
  disbursed_month: number;
  collected_month: number;
  clients_month: number;
  quality: { arrears_count: number; arrears_amount: number; overdue_count: number };
  changes: { clients: number | null; disbursed: number | null; collected: number | null };
  monthly_series: { month: string; disbursed: number; collected: number; fees: number }[];
  recent_activity: DashboardActivity[];
}

export async function fetchDashboardStatsApi(): Promise<DashboardStats> {
  const res = await api.get<DashboardStats>("/dashboard/stats");
  return res.data;
}

// ── Report API ───────────────────────────────────────────────────────────────

export async function fetchPortfolioReportApi() {
  const res = await api.get("/reports/portfolio");
  return res.data;
}

export async function fetchArrearsReportApi() {
  const res = await api.get("/reports/arrears");
  return res.data;
}

export async function fetchCollectionsReportApi(date_from?: string, date_to?: string) {
  const res = await api.get("/reports/collections", { params: { date_from, date_to } });
  return res.data;
}

export async function fetchClientsReportApi() {
  const res = await api.get("/reports/clients");
  return res.data;
}

// ── Client API ───────────────────────────────────────────────────────────────

export async function fetchClientsApi(): Promise<Client[]> {
  const res = await api.get<Client[]>("/clients");
  return res.data;
}

export async function createClientApi(data: ClientCreateData): Promise<Client> {
  const res = await api.post<Client>("/clients", data);
  return res.data;
}

// ── Branch API ────────────────────────────────────────────────────────────────

export interface BranchStats {
  total_clients: number;
  active_loans: number;
  disbursed_amount: number;
  collected_amount: number;
  overdue_loans: number;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  is_active: boolean;
  created_at: string;
  stats: BranchStats;
}

export type BranchCreateData = Omit<Branch, "id" | "created_at" | "stats">;

export async function fetchBranchesApi(): Promise<Branch[]> {
  const res = await api.get<Branch[]>("/branches");
  return res.data;
}

export async function createBranchApi(data: Partial<BranchCreateData>): Promise<Branch> {
  const res = await api.post<Branch>("/branches", data);
  return res.data;
}

export async function updateBranchApi(id: string, data: Partial<BranchCreateData>): Promise<Branch> {
  const res = await api.patch<Branch>(`/branches/${id}`, data);
  return res.data;
}

export async function deactivateBranchApi(id: string): Promise<{ status: string; message: string }> {
  const res = await api.delete(`/branches/${id}`);
  return res.data;
}

// ── Installment Calendar API ──────────────────────────────────────────────────

export interface InstallmentEvent {
  id: string;
  loan_id: string;
  loan_number: string;
  client: string;
  client_phone: string;
  due_date: string;
  amount: number;
  status: string;
  is_overdue: boolean;
  is_today: boolean;
  days_overdue: number;
}

export interface InstallmentCalendarResponse {
  period: { from: string; to: string };
  total: number;
  events: InstallmentEvent[];
}

export async function fetchInstallmentCalendarApi(weeksAhead = 8): Promise<InstallmentCalendarResponse> {
  const res = await api.get<InstallmentCalendarResponse>("/installments/calendar", {
    params: { weeks_ahead: weeksAhead },
  });
  return res.data;
}

// ── Notifications API ─────────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  priority: "critical" | "high" | "medium" | "low";
  loan_id?: string;
  repayment_id?: string;
}

export interface NotificationsResponse {
  notifications: AppNotification[];
  unread_count: number;
  total: number;
}

export async function fetchNotificationsApi(): Promise<NotificationsResponse> {
  const res = await api.get<NotificationsResponse>("/notifications");
  return res.data;
}

export async function markAllNotificationsReadApi(): Promise<{ status: string; message: string }> {
  const res = await api.patch("/notifications/read-all");
  return res.data;
}

export async function markNotificationReadApi(notificationId: string): Promise<{ status: string; message: string }> {
  const res = await api.patch(`/notifications/${notificationId}/read`);
  return res.data;
}
