from enum import StrEnum


class UserStatus(StrEnum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"
    LOCKED = "LOCKED"
    PENDING_APPROVAL = "PENDING_APPROVAL"


class LoanStatus(StrEnum):
    PENDING = "Pending"
    APPROVED = "Approved"
    DISBURSED = "Disbursed"
    REJECTED = "Rejected"
    CLOSED = "Closed"


class InstallmentStatus(StrEnum):
    PENDING = "Pending"
    PAID = "Paid"
    MISSED = "Missed"
    LATE = "Late"


class PaymentMode(StrEnum):
    CASH = "Cash"
    MPESA = "MPesa"
    BANK_TRANSFER = "BankTransfer"
    CHEQUE = "Cheque"
    OTHER = "Other"


class FeeType(StrEnum):
    APPLICATION = "Application"


class LoanProductType(StrEnum):
    FARAJA_4_WEEKS = "Faraja4Weeks"
    FARAJA_5_WEEKS = "Faraja5Weeks"
    LUMPSUM = "Lumpsum"
