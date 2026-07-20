import api from "@/app/lib/api";

export interface Loan {
  id: string;
  client: string;
  sector: string;
  amount: number;
  date: string;
  status: string;
}

export interface LoanCreateData {
  client: string;
  sector: string;
  amount: number;
}

export async function fetchLoansApi(): Promise<Loan[]> {
  const response = await api.get<Loan[]>("/loans");
  return response.data;
}

export async function createLoanApi(data: LoanCreateData): Promise<Loan> {
  const response = await api.post<Loan>("/loans", data);
  return response.data;
}
