"""
Full Loan & Client Router — Faraja Solution Loans

Loan Workflow:
  Loan Officer  → POST /loans               (status: Pending)
  Manager       → PATCH /loans/{id}/approve  (status: Pending → Approved)
  Manager/Dir   → PATCH /loans/{id}/reject   (any → Rejected)
  Director      → PATCH /loans/{id}/disburse (Approved → Disbursed, sets due_date)
  Director      → PATCH /loans/{id}/close    (Disbursed, fully repaid → Closed)

Interest: 20% flat on principal (added at disbursement)
Penalty:  3% of outstanding per every 2 days overdue

Repayment Workflow:
  Loan Officer  → POST /repayments           (verified: false)
  Manager/Dir   → PATCH /repayments/{id}/verify
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from datetime import datetime, date, timedelta
from typing import Optional, List

router = APIRouter()

INTEREST_RATE = 0.20          # 20% flat on principal
PENALTY_RATE  = 0.03          # 3% per 2-day period overdue


# ── Utility ────────────────────────────────────────────────────────────────────

def _calc_penalty(outstanding: float, disbursed_date_str: str, due_date_str: str) -> dict:
    """Return penalty amount and days overdue for a loan."""
    if not disbursed_date_str or not due_date_str:
        return {"days_overdue": 0, "penalty": 0.0}
    today = date.today()
    due = date.fromisoformat(due_date_str)
    if today <= due:
        return {"days_overdue": 0, "penalty": 0.0}
    days_overdue = (today - due).days
    two_day_periods = days_overdue // 2
    penalty = round(outstanding * PENALTY_RATE * two_day_periods, 2)
    return {"days_overdue": days_overdue, "penalty": penalty}


def _enrich_loan(loan: dict) -> dict:
    """Attach computed fields to a loan dict."""
    loan = dict(loan)
    amount = loan.get("amount", 0)
    interest = round(amount * INTEREST_RATE, 2)
    total_repayable = round(amount + interest, 2)

    # Sum verified repayments for this loan
    verified_paid = sum(
        r["amount"] for r in MOCK_REPAYMENTS
        if r["loan_id"] == loan["id"] and r.get("verified", False)
    )
    outstanding = max(round(total_repayable - verified_paid, 2), 0)

    # Penalty
    pen = _calc_penalty(outstanding, loan.get("disbursed_date"), loan.get("due_date"))

    loan["interest_amount"] = interest if loan.get("status") in ("Disbursed", "Closed") else 0.0
    loan["total_repayable"] = total_repayable if loan.get("status") in ("Disbursed", "Closed") else amount
    loan["amount_repaid"] = verified_paid
    loan["outstanding"] = outstanding
    loan["is_overdue"] = pen["days_overdue"] > 0
    loan["days_overdue"] = pen["days_overdue"]
    loan["penalty_amount"] = pen["penalty"]
    return loan


# ── Schemas ────────────────────────────────────────────────────────────────────

class LoanCreateRequest(BaseModel):
    client: str
    sector: str
    amount: float
    duration_days: int = 90               # Set by LO at application time
    application_fee: Optional[float] = None
    notes: Optional[str] = None
    submitted_by: Optional[str] = None


def calc_application_fee(client_name: str, amount: float) -> float:
    name_clean = client_name.strip().lower()
    is_existing = any(c.get("name", "").strip().lower() == name_clean for c in MOCK_CLIENTS) or \
                  any(l.get("client", "").strip().lower() == name_clean for l in MOCK_LOANS)
    
    if 4000 <= amount <= 10000:
        return 600.0 if is_existing else 800.0
    elif amount > 10000:
        return 1000.0 if is_existing else 1500.0
    return 500.0



class LoanActionRequest(BaseModel):
    note: Optional[str] = None
    officer_name: Optional[str] = None
    duration_days: Optional[int] = None   # Director may adjust at disbursement


class RepaymentCreateRequest(BaseModel):
    loan_id: str
    client: str
    amount: float
    mode: str = "Cash"
    reference: Optional[str] = None
    recorded_by: Optional[str] = None


class RepaymentVerifyRequest(BaseModel):
    verified_by: str


class NextOfKinSchema(BaseModel):
    fullName: str
    idNo: Optional[str] = None
    relationship: str
    phone: str
    address: Optional[str] = None
    occupation: Optional[str] = None
    school_note: Optional[str] = None


class DependantSchema(BaseModel):
    fullName: str
    age: str
    relationship: str
    is_school_going: bool = False
    school_name: Optional[str] = None
    school_grade: Optional[str] = None
    occupation: Optional[str] = None


class PropertyItemSchema(BaseModel):
    description: str
    makeModel: Optional[str] = None
    serialNo: Optional[str] = None
    estValue: str


class ClientCreateRequest(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    id_no: Optional[str] = None
    pin: Optional[str] = None
    gender: Optional[str] = "Male"
    marital_status: Optional[str] = "Single"
    occupation: Optional[str] = None
    address: Optional[str] = None
    period_years: Optional[str] = None
    accommodation: Optional[str] = "Family"
    landmark: Optional[str] = None
    spouse_name: Optional[str] = None
    spouse_id: Optional[str] = None
    spouse_phone: Optional[str] = None
    spouse_occupation: Optional[str] = None
    spouse_address: Optional[str] = None
    applicant_dependants: List[DependantSchema] = []
    spouse_dependants: List[DependantSchema] = []
    dependants_count: Optional[str] = None
    dependants_ages: Optional[str] = None
    school_going_count: Optional[str] = None
    school_details: Optional[str] = None
    next_of_kin_list: List[NextOfKinSchema] = []
    business_name: Optional[str] = None
    business_type: str = "Retail"
    business_sector_custom: Optional[str] = None
    business_landmark: Optional[str] = None
    business_years: Optional[str] = None
    business_location: Optional[str] = None
    guarantor_surname: Optional[str] = None
    guarantor_first_name: Optional[str] = None
    guarantor_middle_name: Optional[str] = None
    guarantor_id_no: Optional[str] = None
    guarantor_phone: Optional[str] = None
    guarantor_relationship: Optional[str] = None
    guarantor_address: Optional[str] = None
    guarantor_occupation: Optional[str] = None
    guarantor_period_known: Optional[str] = None
    properties_list: List[PropertyItemSchema] = []
    applicant_id_photo: Optional[str] = None
    applicant_passport_photo: Optional[str] = None
    guarantor_id_photo: Optional[str] = None
    guarantor_passport_photo: Optional[str] = None
    applicant_signature: Optional[str] = None
    guarantor_signature: Optional[str] = None
    registration_fee: Optional[float] = None
    application_fee: Optional[float] = None


# ── In-Memory Storage ──────────────────────────────────────────────────────────

MOCK_LOANS: list[dict] = [
    {
        "id": "LN-2026-901",
        "client": "Zawadi Enterprises Ltd",
        "sector": "Retail & Trade",
        "amount": 450000.0,
        "duration_days": 90,
        "application_fee": 500.0,
        "notes": "Business expansion — Miritini branch",
        "submitted_by": "Brian Kamau (LO)",
        "approved_by": "Grace Njeri (MGR)",
        "disbursed_by": None,
        "approval_note": "Client has good repayment history",
        "rejection_reason": None,
        "date": "2026-07-18",
        "disbursed_date": None,
        "due_date": None,
        "status": "Approved",
    },
    {
        "id": "LN-2026-894",
        "client": "Baraka Agro-Supplies",
        "sector": "Agriculture",
        "amount": 1200000.0,
        "duration_days": 180,
        "application_fee": 500.0,
        "notes": "Seasonal stock purchase — long rains",
        "submitted_by": "Brian Kamau (LO)",
        "approved_by": "Grace Njeri (MGR)",
        "disbursed_by": "John Mwangi (DIR)",
        "approval_note": "Approved within agri-fund limit",
        "rejection_reason": None,
        "date": "2026-07-10",
        "disbursed_date": "2026-07-16",
        "due_date": "2027-01-12",
        "status": "Disbursed",
    },
    {
        "id": "LN-2026-882",
        "client": "Pwani Logistics Co.",
        "sector": "Logistics & Transport",
        "amount": 800000.0,
        "duration_days": 120,
        "application_fee": 500.0,
        "notes": "Fleet maintenance and new tyre purchase",
        "submitted_by": "Brian Kamau (LO)",
        "approved_by": "Grace Njeri (MGR)",
        "disbursed_by": "John Mwangi (DIR)",
        "approval_note": None,
        "rejection_reason": None,
        "date": "2026-06-20",
        "disbursed_date": "2026-06-25",
        "due_date": "2026-10-23",
        "status": "Disbursed",
    },
    {
        "id": "LN-2026-870",
        "client": "Mama Faida Boutique",
        "sector": "Retail & Trade",
        "amount": 150000.0,
        "duration_days": 60,
        "application_fee": 500.0,
        "notes": "Clothing stock — festive season",
        "submitted_by": "Brian Kamau (LO)",
        "approved_by": None,
        "disbursed_by": None,
        "approval_note": None,
        "rejection_reason": None,
        "date": "2026-07-24",
        "disbursed_date": None,
        "due_date": None,
        "status": "Pending",
    },
    {
        "id": "LN-2026-855",
        "client": "Kilifi Fisheries Ltd",
        "sector": "Agriculture",
        "amount": 600000.0,
        "duration_days": 90,
        "application_fee": 500.0,
        "notes": "",
        "submitted_by": "Brian Kamau (LO)",
        "approved_by": "Grace Njeri (MGR)",
        "disbursed_by": "John Mwangi (DIR)",
        "approval_note": None,
        "rejection_reason": None,
        "date": "2026-04-01",
        "disbursed_date": "2026-04-05",
        # OVERDUE: due 3 months ago
        "due_date": "2026-07-04",
        "status": "Disbursed",
    },
]

MOCK_REPAYMENTS: list[dict] = [
    {
        "id": "RP-001",
        "loan_id": "LN-2026-894",
        "client": "Baraka Agro-Supplies",
        "amount": 200000.0,
        "date": "2026-07-20",
        "mode": "Bank Transfer",
        "reference": "EFT-9923",
        "recorded_by": "Brian Kamau (LO)",
        "verified": True,
        "verified_by": "Grace Njeri (MGR)",
        "verified_at": "2026-07-21",
    },
    {
        "id": "RP-002",
        "loan_id": "LN-2026-882",
        "client": "Pwani Logistics Co.",
        "amount": 120000.0,
        "date": "2026-07-18",
        "mode": "Cash",
        "reference": "CSH-002",
        "recorded_by": "Brian Kamau (LO)",
        "verified": True,
        "verified_by": "John Mwangi (DIR)",
        "verified_at": "2026-07-18",
    },
    {
        "id": "RP-003",
        "loan_id": "LN-2026-882",
        "client": "Pwani Logistics Co.",
        "amount": 80000.0,
        "date": "2026-07-22",
        "mode": "Cash",
        "reference": "CSH-005",
        "recorded_by": "Brian Kamau (LO)",
        "verified": False,
        "verified_by": None,
        "verified_at": None,
    },
    {
        "id": "RP-004",
        "loan_id": "LN-2026-855",
        "client": "Kilifi Fisheries Ltd",
        "amount": 100000.0,
        "date": "2026-07-15",
        "mode": "M-Pesa",
        "reference": "QER7X9KL2",
        "recorded_by": "Brian Kamau (LO)",
        "verified": False,
        "verified_by": None,
        "verified_at": None,
    },
]

MOCK_CLIENTS: list[dict] = [
    {
        "id": "CL-001",
        "name": "Zawadi Enterprises Ltd",
        "phone": "+254 711 000 111",
        "email": "zawadi@gmail.com",
        "id_no": "29100200",
        "pin": "A001928374Z",
        "gender": "Female",
        "marital_status": "Married",
        "occupation": "Businesswoman",
        "address": "Miritini Estate, Mombasa",
        "period_years": "8",
        "accommodation": "Own",
        "landmark": "Near Miritini Primary School",
        "spouse_name": "Samuel Mwangi",
        "spouse_id": "28192839",
        "spouse_phone": "+254 711 999 888",
        "spouse_occupation": "Transporter",
        "spouse_address": "Miritini Estate, Mombasa",
        "applicant_dependants": [
            {"fullName": "Grace Mwangi", "age": "12", "relationship": "Daughter",
             "is_school_going": True, "school_name": "Mombasa Academy", "school_grade": "Grade 7", "occupation": "Student"}
        ],
        "spouse_dependants": [],
        "dependants_count": "3", "dependants_ages": "12, 10, 6",
        "school_going_count": "2", "school_details": "Mombasa Academy",
        "next_of_kin_list": [
            {"fullName": "Grace Mwangi", "idNo": "34928394", "relationship": "Daughter",
             "phone": "+254 712 345 678", "address": "Miritini, House 14", "occupation": "Student", "school_note": None}
        ],
        "business_name": "Zawadi Groceries & Wholesalers",
        "business_type": "Retail & Trade",
        "business_sector_custom": None,
        "business_landmark": "Opposite Caltex Petrol Station",
        "business_years": "5", "business_location": "Shimanzi Road, Mombasa",
        "guarantor_surname": "Njuguna", "guarantor_first_name": "Kamau",
        "guarantor_middle_name": "John", "guarantor_id_no": "29384756",
        "guarantor_phone": "+254 722 555 444", "guarantor_relationship": "Trade Partner",
        "guarantor_address": "Majengo, Mombasa", "guarantor_occupation": "Hardware Owner",
        "guarantor_period_known": "6 years",
        "properties_list": [
            {"description": "Double Door Refrigerator", "makeModel": "LG Linear", "serialNo": "LG-99283-F", "estValue": "120000"},
            {"description": "Toyota Probox Courier Car", "makeModel": "Toyota Probox 2014", "serialNo": "KCD 123X", "estValue": "850000"}
        ],
        "applicant_id_photo": None, "applicant_passport_photo": None,
        "guarantor_id_photo": None, "guarantor_passport_photo": None,
        "applicant_signature": None, "guarantor_signature": None,
        "registration_fee": 1000.0, "application_fee": 500.0,
        "date_registered": "2026-06-12",
    },
    {
        "id": "CL-002",
        "name": "Baraka Agro-Supplies",
        "phone": "+254 722 000 222",
        "email": "baraka@gmail.com",
        "id_no": "20993849",
        "pin": "A002049384B",
        "gender": "Male",
        "marital_status": "Married",
        "occupation": "Agro-dealer",
        "address": "Mazeras Town",
        "period_years": "12",
        "accommodation": "Own",
        "landmark": "Mazeras Junction",
        "spouse_name": "Lucy Kemunto",
        "spouse_id": "24930293",
        "spouse_phone": "+254 722 888 111",
        "spouse_occupation": "Teacher",
        "spouse_address": "Mazeras Town, Kilifi County",
        "applicant_dependants": [],
        "spouse_dependants": [],
        "dependants_count": "2", "dependants_ages": "16, 14",
        "school_going_count": "2", "school_details": "Shimo La Tewa High",
        "next_of_kin_list": [
            {"fullName": "Peter Njoroge", "idNo": "32094859", "relationship": "Son",
             "phone": "+254 734 909 090", "address": "Mazeras", "occupation": "Student",
             "school_note": "Currently in school - Form 3, Shimo La Tewa"}
        ],
        "business_name": "Baraka Seeds & Fertilizers",
        "business_type": "Agriculture",
        "business_sector_custom": None,
        "business_landmark": "Next to KCB Agent",
        "business_years": "7", "business_location": "Mazeras Main Road",
        "guarantor_surname": "Kuria", "guarantor_first_name": "David",
        "guarantor_middle_name": "Mutua", "guarantor_id_no": "20394857",
        "guarantor_phone": "+254 733 444 555", "guarantor_relationship": "Neighbor",
        "guarantor_address": "Mazeras", "guarantor_occupation": "Farmer",
        "guarantor_period_known": "10 years",
        "properties_list": [
            {"description": "Store Warehouse Stock", "makeModel": "DAP/CAN Seeds", "serialNo": "N/A", "estValue": "500000"}
        ],
        "applicant_id_photo": None, "applicant_passport_photo": None,
        "guarantor_id_photo": None, "guarantor_passport_photo": None,
        "applicant_signature": None, "guarantor_signature": None,
        "registration_fee": 1000.0, "application_fee": 500.0,
        "date_registered": "2026-06-14",
    },
]


# ── LOAN ROUTES ────────────────────────────────────────────────────────────────

@router.get("/loans")
def get_loans():
    return [_enrich_loan(l) for l in MOCK_LOANS]


@router.get("/loans/{loan_id}")
def get_loan(loan_id: str):
    loan = next((l for l in MOCK_LOANS if l["id"] == loan_id), None)
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    enriched = _enrich_loan(loan)
    enriched["repayments"] = [r for r in MOCK_REPAYMENTS if r["loan_id"] == loan_id]
    return enriched


@router.post("/loans", status_code=status.HTTP_201_CREATED)
def create_loan(request: LoanCreateRequest):
    new_id = f"LN-2026-{1000 + len(MOCK_LOANS)}"
    new_loan = {
        "id": new_id,
        "client": request.client,
        "sector": request.sector,
        "amount": request.amount,
        "duration_days": request.duration_days,
        "application_fee": request.application_fee if request.application_fee is not None else calc_application_fee(request.client, request.amount),
        "notes": request.notes or "",
        "submitted_by": request.submitted_by or "Loan Officer",
        "approved_by": None,
        "disbursed_by": None,
        "approval_note": None,
        "rejection_reason": None,
        "date": datetime.now().strftime("%Y-%m-%d"),
        "disbursed_date": None,
        "due_date": None,
        "status": "Pending",
    }
    MOCK_LOANS.insert(0, new_loan)
    return _enrich_loan(new_loan)


@router.patch("/loans/{loan_id}/approve")
def approve_loan(loan_id: str, body: LoanActionRequest):
    loan = next((l for l in MOCK_LOANS if l["id"] == loan_id), None)
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    if loan["status"] != "Pending":
        raise HTTPException(status_code=400, detail=f"Loan must be Pending to approve (currently {loan['status']})")
    loan["status"] = "Approved"
    loan["approved_by"] = body.officer_name or "Manager"
    loan["approval_note"] = body.note
    return _enrich_loan(loan)


@router.patch("/loans/{loan_id}/reject")
def reject_loan(loan_id: str, body: LoanActionRequest):
    loan = next((l for l in MOCK_LOANS if l["id"] == loan_id), None)
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    if loan["status"] in ("Disbursed", "Closed"):
        raise HTTPException(status_code=400, detail="Cannot reject a disbursed or closed loan")
    loan["status"] = "Rejected"
    loan["rejection_reason"] = body.note or "No reason provided"
    return _enrich_loan(loan)


@router.patch("/loans/{loan_id}/disburse")
def disburse_loan(loan_id: str, body: LoanActionRequest):
    loan = next((l for l in MOCK_LOANS if l["id"] == loan_id), None)
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    if loan["status"] != "Approved":
        raise HTTPException(status_code=400, detail="Loan must be Approved before disbursement")
    disbursed_date = date.today()
    duration = body.duration_days or loan.get("duration_days", 90)
    loan["status"] = "Disbursed"
    loan["disbursed_by"] = body.officer_name or "Director"
    loan["disbursed_date"] = disbursed_date.isoformat()
    loan["due_date"] = (disbursed_date + timedelta(days=duration)).isoformat()
    loan["duration_days"] = duration
    return _enrich_loan(loan)


@router.patch("/loans/{loan_id}/close")
def close_loan(loan_id: str, body: LoanActionRequest):
    loan = next((l for l in MOCK_LOANS if l["id"] == loan_id), None)
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    enriched = _enrich_loan(loan)
    if loan["status"] != "Disbursed":
        raise HTTPException(status_code=400, detail="Only disbursed loans can be closed")
    if enriched["outstanding"] > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Loan still has KES {enriched['outstanding']:,.2f} outstanding. Clear balance first."
        )
    loan["status"] = "Closed"
    return _enrich_loan(loan)


# ── REPAYMENT ROUTES ───────────────────────────────────────────────────────────

@router.get("/repayments")
def get_repayments(loan_id: str | None = None):
    if loan_id:
        return [r for r in MOCK_REPAYMENTS if r["loan_id"] == loan_id]
    return MOCK_REPAYMENTS


@router.post("/repayments", status_code=status.HTTP_201_CREATED)
def create_repayment(request: RepaymentCreateRequest):
    # Validate loan exists
    loan = next((l for l in MOCK_LOANS if l["id"] == request.loan_id), None)
    if not loan:
        raise HTTPException(status_code=404, detail=f"Loan {request.loan_id} not found")
    if loan["status"] not in ("Disbursed",):
        raise HTTPException(status_code=400, detail="Can only record repayments for Disbursed loans")

    new_id = f"RP-{len(MOCK_REPAYMENTS) + 1:03d}"
    new_rep = {
        "id": new_id,
        "loan_id": request.loan_id,
        "client": request.client,
        "amount": request.amount,
        "date": datetime.now().strftime("%Y-%m-%d"),
        "mode": request.mode,
        "reference": request.reference or f"REF-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "recorded_by": request.recorded_by or "Loan Officer",
        "verified": False,
        "verified_by": None,
        "verified_at": None,
    }
    MOCK_REPAYMENTS.insert(0, new_rep)
    return new_rep


@router.patch("/repayments/{repayment_id}/verify")
def verify_repayment(repayment_id: str, body: RepaymentVerifyRequest):
    rep = next((r for r in MOCK_REPAYMENTS if r["id"] == repayment_id), None)
    if not rep:
        raise HTTPException(status_code=404, detail="Repayment not found")
    if rep.get("verified"):
        raise HTTPException(status_code=400, detail="Payment already verified")
    rep["verified"] = True
    rep["verified_by"] = body.verified_by
    rep["verified_at"] = datetime.now().strftime("%Y-%m-%d")
    return rep


# ── CLIENT ROUTES ──────────────────────────────────────────────────────────────

@router.get("/clients")
def get_clients():
    return MOCK_CLIENTS


@router.post("/clients", status_code=status.HTTP_201_CREATED)
def create_client(request: ClientCreateRequest):
    new_id = f"CL-{len(MOCK_CLIENTS) + 1:03d}"
    new_client = request.model_dump()
    new_client["id"] = new_id
    new_client["date_registered"] = datetime.now().strftime("%Y-%m-%d")
    MOCK_CLIENTS.insert(0, new_client)
    return new_client


# ── REPORTS ROUTES ─────────────────────────────────────────────────────────────

@router.get("/reports/portfolio")
def report_portfolio():
    enriched = [_enrich_loan(l) for l in MOCK_LOANS]
    total_disbursed = sum(l["amount"] for l in enriched if l["status"] in ("Disbursed", "Closed"))
    total_outstanding = sum(l["outstanding"] for l in enriched if l["status"] == "Disbursed")
    total_collected = sum(r["amount"] for r in MOCK_REPAYMENTS if r.get("verified"))
    total_interest = sum(l["interest_amount"] for l in enriched if l["status"] in ("Disbursed", "Closed"))
    total_penalties = sum(l["penalty_amount"] for l in enriched if l.get("is_overdue"))

    by_status = {}
    for l in enriched:
        by_status[l["status"]] = by_status.get(l["status"], 0) + 1

    by_sector = {}
    for l in enriched:
        by_sector[l["sector"]] = by_sector.get(l["sector"], {"count": 0, "amount": 0})
        by_sector[l["sector"]]["count"] += 1
        by_sector[l["sector"]]["amount"] += l["amount"]

    return {
        "total_disbursed": total_disbursed,
        "total_outstanding": total_outstanding,
        "total_collected": total_collected,
        "total_interest": total_interest,
        "total_penalties": total_penalties,
        "loan_count": len(MOCK_LOANS),
        "active_loans": len([l for l in enriched if l["status"] in ("Pending", "Approved", "Disbursed")]),
        "overdue_loans": len([l for l in enriched if l.get("is_overdue")]),
        "by_status": by_status,
        "by_sector": [{"sector": k, **v} for k, v in by_sector.items()],
        "loans": enriched,
    }


@router.get("/reports/arrears")
def report_arrears():
    enriched = [_enrich_loan(l) for l in MOCK_LOANS]
    overdue = [l for l in enriched if l.get("is_overdue") and l["status"] == "Disbursed"]
    total_penalty_exposure = sum(l["penalty_amount"] for l in overdue)
    total_overdue_outstanding = sum(l["outstanding"] for l in overdue)
    return {
        "overdue_loans": overdue,
        "count": len(overdue),
        "total_penalty_exposure": total_penalty_exposure,
        "total_overdue_outstanding": total_overdue_outstanding,
    }


@router.get("/reports/collections")
def report_collections(date_from: str | None = None, date_to: str | None = None):
    reps = [r for r in MOCK_REPAYMENTS if r.get("verified")]

    if date_from:
        reps = [r for r in reps if r["date"] >= date_from]
    if date_to:
        reps = [r for r in reps if r["date"] <= date_to]

    by_mode: dict = {}
    for r in reps:
        by_mode[r["mode"]] = by_mode.get(r["mode"], 0) + r["amount"]

    by_loan: dict = {}
    for r in reps:
        loan_id = r["loan_id"]
        if loan_id not in by_loan:
            by_loan[loan_id] = {"loan_id": loan_id, "client": r["client"], "amount": 0, "count": 0}
        by_loan[loan_id]["amount"] += r["amount"]
        by_loan[loan_id]["count"] += 1

    return {
        "total_collected": sum(r["amount"] for r in reps),
        "payment_count": len(reps),
        "by_mode": [{"mode": k, "amount": v} for k, v in by_mode.items()],
        "by_loan": list(by_loan.values()),
        "repayments": reps,
        "date_from": date_from,
        "date_to": date_to,
    }


@router.get("/reports/clients")
def report_clients():
    by_sector: dict = {}
    for c in MOCK_CLIENTS:
        s = c.get("business_type", "Other")
        by_sector[s] = by_sector.get(s, 0) + 1

    return {
        "total_clients": len(MOCK_CLIENTS),
        "by_sector": [{"sector": k, "count": v} for k, v in by_sector.items()],
        "recent": MOCK_CLIENTS[:5],
    }
