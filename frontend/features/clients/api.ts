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
  product?: string | null;
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
  // DB status (the 5 workflow states) — `status` above is the computed one
  db_status: "Pending" | "Approved" | "Disbursed" | "Rejected" | "Closed";
  status_override?: string | null;
  status_override_by?: string | null;
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
  installments?: Installment[];
}

export interface Installment {
  id: string;
  due_date: string;
  amount: number;
  status: "Pending" | "Paid" | "Missed" | "Late";
  paid_at: string | null;
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

export interface LoanQuote {
  interest_amount: number;
  total_repayable: number;
  num_installments: number;
  installment_amount: number;
  application_fee_new: number;
  application_fee_existing: number;
}

// ── Client Interface ─────────────────────────────────────────────────────────

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  id_no?: string;
  branch_id?: string;
  pin?: string;
  gender?: string;
  marital_status?: string;
  occupation?: string;
  address?: string;
  period_years?: string;
  accommodation?: string;
  landmark?: string;
  residential_maps_link?: string;
  business_maps_link?: string;
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

export async function fetchLoansApi(branchId?: string): Promise<Loan[]> {
  const res = await api.get<Loan[]>("/loans", {
    params: { branch_id: branchId === "all" ? undefined : branchId },
  });
  return res.data;
}

export async function fetchLoanApi(id: string): Promise<Loan> {
  const res = await api.get<Loan>(`/loans/${id}`);
  return res.data;
}

export async function fetchClientLoansApi(clientId: string): Promise<Loan[]> {
  const res = await api.get<Loan[]>("/loans", {
    params: { client_id: clientId },
  });
  return res.data;
}

export async function createLoanApi(data: {
  client_id: string; loan_product_id: string; amount: number;
  sector?: string; notes?: string;
}): Promise<Loan> {
  const res = await api.post<Loan>("/loans", data);
  return res.data;
}

export async function fetchLoanProductsApi(): Promise<LoanProduct[]> {
  const res = await api.get<LoanProduct[]>("/loan-products");
  return res.data;
}

export async function fetchLoanQuoteApi(productId: string, amount: number): Promise<LoanQuote> {
  const res = await api.get<LoanQuote>(`/loan-products/${productId}/quote`, {
    params: { amount },
  });
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

export async function addLoanNoteApi(id: string, note: string): Promise<Loan> {
  const res = await api.patch<Loan>(`/loans/${id}/notes`, { note });
  return res.data;
}

export async function updateLoanStatusApi(id: string, status_override: string | null): Promise<Loan> {
  const res = await api.patch<Loan>(`/loans/${id}/status`, { status_override });
  return res.data;
}

// ── Repayment API ────────────────────────────────────────────────────────────

export async function fetchRepaymentsApi(options?: {
  loan_id?: string;
  branch_id?: string;
  verified?: boolean;
}): Promise<Repayment[]> {
  const res = await api.get<Repayment[]>("/repayments", {
    params: {
      loan_id: options?.loan_id,
      branch_id: options?.branch_id === "all" ? undefined : options?.branch_id,
      verified: options?.verified,
    },
  });
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
  type: "repayment" | "loan" | "approval" | "disbursement" | "client" | "fee";
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

export async function fetchDashboardStatsApi(branchId?: string): Promise<DashboardStats> {
  const res = await api.get<DashboardStats>("/dashboard/stats", {
    params: { branch_id: branchId === "all" ? undefined : branchId },
  });
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

// ── Profit & Loss Report API ─────────────────────────────────────────────────

export interface PnlReport {
  generated_at: string;
  period: { month: number; year: number; from: string; to: string };
  branch_id: string | null;
  branch_name: string | null;
  income: {
    interest_income: number;
    application_fee_income: number;
    unverified_fees: number;
    penalties_accrued: number;
  };
  expenses: { verified: number; unverified: number };
  net_income: number;
  activity: {
    loans_disbursed: number;
    principal_disbursed: number;
    repayments_collected: number;
  };
}

export interface PnlSeriesPoint {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export async function fetchPnlReportApi(
  month?: number,
  year?: number,
  branchId?: string,
): Promise<PnlReport> {
  const res = await api.get<PnlReport>("/reports/pnl", {
    params: { month, year, branch_id: branchId === "all" ? undefined : branchId },
  });
  return res.data;
}

export async function fetchPnlSeriesApi(
  months = 6,
  branchId?: string,
): Promise<{ series: PnlSeriesPoint[] }> {
  const res = await api.get("/reports/pnl/series", {
    params: { months, branch_id: branchId === "all" ? undefined : branchId },
  });
  return res.data;
}

// ── Expenses API ─────────────────────────────────────────────────────────────

export const EXPENSE_CATEGORIES = [
  "Salaries",
  "Rent",
  "Utilities",
  "Transport",
  "Marketing",
  "Stationery",
  "Operations",
  "Other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface Expense {
  id: string;
  branch_id: string | null;
  branch_name: string | null;
  category: ExpenseCategory;
  amount: number;
  expense_date: string;
  mode: string;
  reference: string | null;
  description: string | null;
  recorded_by: string | null;
  verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
}

export interface ExpenseCreateData {
  category: ExpenseCategory;
  amount: number;
  expense_date?: string;
  mode?: string;
  reference?: string;
  description?: string;
  branch_id?: string;
}

export async function fetchExpensesApi(params?: {
  date_from?: string;
  date_to?: string;
  branch_id?: string;
  verified?: boolean;
}): Promise<Expense[]> {
  const res = await api.get<Expense[]>("/expenses", {
    params: {
      ...params,
      branch_id: params?.branch_id === "all" ? undefined : params?.branch_id,
    },
  });
  return res.data;
}

export async function createExpenseApi(data: ExpenseCreateData): Promise<Expense> {
  const res = await api.post<Expense>("/expenses", data);
  return res.data;
}

export async function verifyExpenseApi(id: string): Promise<Expense> {
  const res = await api.post<Expense>(`/expenses/${id}/verify`);
  return res.data;
}

// ── Client API ───────────────────────────────────────────────────────────────

export async function fetchClientsApi(branchId?: string): Promise<Client[]> {
  const res = await api.get<Client[]>("/clients", {
    params: { branch_id: branchId === "all" ? undefined : branchId },
  });
  return res.data;
}

export async function fetchClientApi(clientId: string): Promise<Client> {
  const res = await api.get<Client>(`/clients/${clientId}`);
  return res.data;
}

export async function createClientApi(data: ClientCreateData): Promise<Client> {
  const res = await api.post<Client>("/clients", data);
  return res.data;
}

// ── Global search ─────────────────────────────────────────────────────────────

export interface SearchResult {
  type: "client" | "loan";
  id: string;
  title: string;
  subtitle: string;
}

export async function fetchGlobalSearchApi(q: string): Promise<SearchResult[]> {
  const res = await api.get<SearchResult[]>("/search", { params: { q } });
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

export async function fetchClientPdfApi(clientId: string): Promise<Blob> {
  const res = await api.get<Blob>(`/clients/${clientId}/pdf`, { responseType: "blob" });
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

export interface NotificationPrefs {
  due_today: boolean;
  due_tomorrow: boolean;
  almost_due: boolean;
  arrears: boolean;
  repayment_pending: boolean;
  pending_approval: boolean;
}

export async function fetchNotificationPrefsApi(): Promise<NotificationPrefs> {
  const res = await api.get<{ preferences: NotificationPrefs }>("/notifications/preferences");
  return res.data.preferences;
}

export async function updateNotificationPrefsApi(preferences: Partial<NotificationPrefs>): Promise<NotificationPrefs> {
  const res = await api.patch<{ preferences: NotificationPrefs }>("/notifications/preferences", { preferences });
  return res.data.preferences;
}
