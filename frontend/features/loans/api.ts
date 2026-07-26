// Re-export everything from the canonical API module so old imports still work
export {
  fetchLoansApi,
  createLoanApi,
  approveLoanApi,
  rejectLoanApi,
  disburseLoanApi,
  closeLoanApi,
  type Loan,
  type LoanStatus,
} from "@/features/clients/api";
