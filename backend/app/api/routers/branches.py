"""
Branches Router — Faraja Solution Loans

Manages branch offices: create, list, update, and deactivate.
Each branch has aggregated stats derived from loans/clients data.
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────────

class BranchCreateRequest(BaseModel):
    name: str
    location: str
    manager_name: Optional[str] = None
    manager_phone: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: bool = True


class BranchUpdateRequest(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    manager_name: Optional[str] = None
    manager_phone: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None


# ── In-Memory Store ────────────────────────────────────────────────────────────

MOCK_BRANCHES: list[dict] = [
    {
        "id": "BR-001",
        "name": "Head Office — Miritini",
        "location": "Miritini, Mombasa County",
        "manager_name": "John Mwangi",
        "manager_phone": "+254 722 100 001",
        "phone": "+254 41 222 0001",
        "email": "headoffice@farajasolutions.co.ke",
        "is_active": True,
        "created_at": "2024-01-15",
        # Demo stats — will be replaced by real aggregation once DB is live
        "stats": {
            "total_clients": 48,
            "active_loans": 12,
            "disbursed_amount": 8200000,
            "collected_amount": 3100000,
            "overdue_loans": 2,
        },
    },
    {
        "id": "BR-002",
        "name": "Mombasa CBD Branch",
        "location": "Moi Avenue, Mombasa CBD",
        "manager_name": "Grace Njeri",
        "manager_phone": "+254 733 200 002",
        "phone": "+254 41 222 1002",
        "email": "mombasa@farajasolutions.co.ke",
        "is_active": True,
        "created_at": "2024-03-01",
        "stats": {
            "total_clients": 31,
            "active_loans": 8,
            "disbursed_amount": 4500000,
            "collected_amount": 1800000,
            "overdue_loans": 1,
        },
    },
    {
        "id": "BR-003",
        "name": "Kilifi Branch",
        "location": "Kilifi Town, Kilifi County",
        "manager_name": "Peter Otieno",
        "manager_phone": "+254 711 300 003",
        "phone": "+254 41 522 3003",
        "email": "kilifi@farajasolutions.co.ke",
        "is_active": True,
        "created_at": "2024-06-10",
        "stats": {
            "total_clients": 19,
            "active_loans": 5,
            "disbursed_amount": 2800000,
            "collected_amount": 900000,
            "overdue_loans": 1,
        },
    },
    {
        "id": "BR-004",
        "name": "Malindi Branch",
        "location": "Lamu Road, Malindi",
        "manager_name": "Amina Hassan",
        "manager_phone": "+254 744 400 004",
        "phone": "+254 42 212 4004",
        "email": "malindi@farajasolutions.co.ke",
        "is_active": False,
        "created_at": "2025-01-20",
        "stats": {
            "total_clients": 7,
            "active_loans": 0,
            "disbursed_amount": 600000,
            "collected_amount": 600000,
            "overdue_loans": 0,
        },
    },
]


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/branches")
def get_branches():
    return MOCK_BRANCHES


@router.get("/branches/{branch_id}")
def get_branch(branch_id: str):
    branch = next((b for b in MOCK_BRANCHES if b["id"] == branch_id), None)
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    return branch


@router.post("/branches", status_code=status.HTTP_201_CREATED)
def create_branch(request: BranchCreateRequest):
    new_id = f"BR-{len(MOCK_BRANCHES) + 1:03d}"
    new_branch = {
        "id": new_id,
        "name": request.name,
        "location": request.location,
        "manager_name": request.manager_name or "—",
        "manager_phone": request.manager_phone or "—",
        "phone": request.phone or "—",
        "email": request.email or "—",
        "is_active": request.is_active,
        "created_at": datetime.now().strftime("%Y-%m-%d"),
        "stats": {
            "total_clients": 0,
            "active_loans": 0,
            "disbursed_amount": 0,
            "collected_amount": 0,
            "overdue_loans": 0,
        },
    }
    MOCK_BRANCHES.append(new_branch)
    return new_branch


@router.patch("/branches/{branch_id}")
def update_branch(branch_id: str, request: BranchUpdateRequest):
    branch = next((b for b in MOCK_BRANCHES if b["id"] == branch_id), None)
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    update_data = request.model_dump(exclude_none=True)
    branch.update(update_data)
    return branch


@router.delete("/branches/{branch_id}", status_code=status.HTTP_200_OK)
def deactivate_branch(branch_id: str):
    branch = next((b for b in MOCK_BRANCHES if b["id"] == branch_id), None)
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    branch["is_active"] = False
    return {"status": "success", "message": f"Branch {branch['name']} deactivated"}


# ── Notifications (aggregated from pending system events) ──────────────────────

@router.get("/notifications")
def get_notifications():
    """
    Derive live notifications from loan & repayment state.
    Imported here to avoid circular imports with loans_clients.
    """
    from app.api.routers.loans_clients import MOCK_LOANS, MOCK_REPAYMENTS

    notifications = []
    now = datetime.now()

    # Pending loan approvals — alert managers
    pending_loans = [l for l in MOCK_LOANS if l.get("status") == "Pending"]
    for loan in pending_loans:
        notifications.append({
            "id": f"notif-loan-pending-{loan['id']}",
            "type": "loan_pending",
            "title": "Loan Awaiting Approval",
            "description": f"{loan['client']} submitted a loan application of KES {loan['amount']:,.0f}. Awaiting Manager review.",
            "time": loan.get("date", ""),
            "read": False,
            "priority": "high",
            "loan_id": loan["id"],
        })

    # Approved loans waiting disbursement — alert director
    approved_loans = [l for l in MOCK_LOANS if l.get("status") == "Approved"]
    for loan in approved_loans:
        notifications.append({
            "id": f"notif-loan-approved-{loan['id']}",
            "type": "loan_approved",
            "title": "Loan Ready for Disbursement",
            "description": f"Loan {loan['id']} for {loan['client']} (KES {loan['amount']:,.0f}) has been approved. Awaiting Director disbursement.",
            "time": loan.get("date", ""),
            "read": False,
            "priority": "high",
            "loan_id": loan["id"],
        })

    # Unverified repayments — alert managers/directors
    unverified = [r for r in MOCK_REPAYMENTS if not r.get("verified")]
    for rep in unverified:
        notifications.append({
            "id": f"notif-rep-unverified-{rep['id']}",
            "type": "repayment_pending",
            "title": "Payment Awaiting Verification",
            "description": f"KES {rep['amount']:,.0f} received from {rep['client']} via {rep['mode']} (Ref: {rep['reference']}) is unverified.",
            "time": rep.get("date", ""),
            "read": False,
            "priority": "medium",
            "repayment_id": rep["id"],
        })

    # Overdue loans
    from app.api.routers.loans_clients import _calc_penalty, _enrich_loan
    for loan in MOCK_LOANS:
        enriched = _enrich_loan(loan)
        if enriched.get("is_overdue"):
            notifications.append({
                "id": f"notif-overdue-{loan['id']}",
                "type": "overdue",
                "title": "Overdue Loan Alert",
                "description": f"{loan['client']} — Loan {loan['id']} is {enriched['days_overdue']} days overdue. Penalty: KES {enriched['penalty_amount']:,.0f}.",
                "time": loan.get("due_date", ""),
                "read": False,
                "priority": "critical",
                "loan_id": loan["id"],
            })

    # Sort: critical first, then high, then medium
    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    notifications.sort(key=lambda n: priority_order.get(n["priority"], 99))

    return {
        "notifications": notifications,
        "unread_count": len([n for n in notifications if not n["read"]]),
        "total": len(notifications),
    }
