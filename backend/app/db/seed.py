from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.branches import BRANCHES
from app.core.permissions import PERMISSIONS
from app.core.security import get_password_hash
from app.db.seed_data import CLIENTS, FEE_PAYMENTS, LOANS, REPAYMENTS, ROLES, USERS
from app.db.session import SessionLocal
from app.models.branch import Branch
from app.models.client import Client
from app.models.enums import FeeType, InstallmentStatus, LoanProductType, LoanStatus, PaymentMode
from app.models.fee_payment import FeePayment
from app.models.installment import Installment
from app.models.loan import Loan
from app.models.loan_product import LoanProduct
from app.models.permission import Permission
from app.models.repayment import Repayment
from app.models.role import Role
from app.models.role_permission import RolePermission
from app.models.user import User
from app.models.user_branch import UserBranch
from app.models.user_role import UserRole
from app.services import fee_service, loan_service


def log(message: str) -> None:
    print(f"[Faraja Seeder] {message}")

def get_or_create(
    db: Session,
    model,
    defaults: dict | None = None,
    **filters,
):
    instance = db.scalar(
        select(model).filter_by(**filters)
    )

    if instance:
        return instance

    params = dict(filters)

    if defaults:
        params.update(defaults)

    instance = model(**params)

    db.add(instance)
    db.flush()

    return instance


def days_ago(n: int, hour: int = 10) -> datetime:
    """UTC datetime `n` days before today at the given hour (deterministic seeding)."""
    today = datetime.now(UTC).date()
    return datetime.combine(today - timedelta(days=n), datetime.min.time()).replace(
        hour=hour, tzinfo=UTC
    )


def _user(db: Session, employee_number: str) -> User | None:
    return db.scalar(select(User).where(User.employee_number == employee_number))


def _branch(db: Session, name: str) -> Branch | None:
    return db.scalar(select(Branch).where(Branch.name == name))


def _client(db: Session, client_number: str) -> Client | None:
    return db.scalar(select(Client).where(Client.client_number == client_number))


def _product(db: Session, name: str) -> LoanProduct | None:
    return db.scalar(select(LoanProduct).where(LoanProduct.name == name))


def seed_branches(db: Session) -> None:
    print("Seeding branches...")

    for branch in BRANCHES:
        get_or_create(
            db,
            Branch,
            name=branch["name"],
            defaults={
                "code": branch["code"],
                "active": True,
            },
        )

    log("Seeding branches...")
    log(f"Seeded {len(BRANCHES)} branches")


def seed_permissions(db: Session) -> None:
    log("Seeding permissions...")

    for permission in PERMISSIONS:
        get_or_create(
            db,
            Permission,
            name=permission,
            defaults={
                "description": permission.replace(".", " ").title(),
            },
        )


def seed_roles(db: Session) -> None:
    log("Seeding roles...")

    for role in ROLES:
        get_or_create(
            db,
            Role,
            name=role["name"],
            defaults={
                "description": role["description"],
                "approval_limit_amount": role["approval_limit"],
            },
        )

ROLE_PERMISSIONS = {
    "Director": PERMISSIONS,
    "Manager": [
        p for p in PERMISSIONS
        if p not in {
            "settings.manage",
            "users.delete",
            "roles.manage",
            "loans.writeoff",
        }
    ],
    "Loan Officer": [
        "dashboard.view",
        "clients.view",
        "clients.create",
        "clients.update",
        "loans.view",
        "loans.create",
        "repayments.view",
        "repayments.record",
        "fees.view",
        "fees.record",
    ],
    "Finance Officer": [
        "dashboard.view",
        "repayments.view",
        "repayments.record",
        "repayments.verify",
        "fees.view",
        "fees.record",
        "fees.verify",
        "expenses.view",
        "expenses.create",
        "expenses.approve",
        "reports.view",
        "reports.export",
    ],
    "System Admin": [
        p for p in PERMISSIONS
    ],
    "Auditor": [
        "dashboard.view",
        "clients.view",
        "loans.view",
        "repayments.view",
        "fees.view",
        "reports.view",
        "audit.view",
    ],
}

def seed_role_permissions(db: Session) -> None:
    log("Assigning permissions to roles...")

    for role_name, permissions in ROLE_PERMISSIONS.items():

        role = db.scalar(
            select(Role).where(Role.name == role_name)
        )

        if role is None:
            continue

        for permission_name in permissions:

            permission = db.scalar(
                select(Permission).where(
                    Permission.name == permission_name
                )
            )

            if permission is None:
                continue

            exists = db.scalar(
                select(RolePermission).where(
                    RolePermission.role_id == role.id,
                    RolePermission.permission_id == permission.id,
                )
            )

            if exists:
                continue

            db.add(
                RolePermission(
                    role_id=role.id,
                    permission_id=permission.id,
                )
            )

    db.flush()

    log("Role permissions complete.")


def seed_users(db: Session) -> None:

    log("Creating users...")

    for data in USERS:

        user = db.scalar(
            select(User).where(
                User.employee_number == data["employee_number"]
            )
        )

        if user is None:

            user = User(
                employee_number=data["employee_number"],
                email=data["email"],
                first_name=data["first_name"],
                last_name=data["last_name"],
                hashed_password=get_password_hash(
                    data["password"]
                ),
            )

            db.add(user)

            db.flush()

        role = db.scalar(
            select(Role).where(
                Role.name == data["role"]
            )
        )

        branch = db.scalar(
            select(Branch).where(
                Branch.name == data["branch"]
            )
        )

        if role:

            exists = db.scalar(
                select(UserRole).where(
                    UserRole.user_id == user.id,
                    UserRole.role_id == role.id,
                )
            )

            if not exists:
                db.add(
                    UserRole(
                        user_id=user.id,
                        role_id=role.id,
                    )
                )

        if branch:

            exists = db.scalar(
                select(UserBranch).where(
                    UserBranch.user_id == user.id,
                    UserBranch.branch_id == branch.id,
                )
            )

            if not exists:
                db.add(
                    UserBranch(
                        user_id=user.id,
                        branch_id=branch.id,
                    )
                )

    db.flush()

    log("Users seeded.")


LOAN_PRODUCTS = [
    {
        "name": "Faraja 4 Weeks",
        "product_type": LoanProductType.FARAJA_4_WEEKS,
        "duration_days": 28,
        "interest_rate": Decimal("0.2000"),
        "penalty_rate": Decimal("0.0300"),
        "penalty_interval_days": 2,
        "max_penalty_amount": None,
        "is_active": True,
    },
    {
        "name": "Faraja 5 Weeks",
        "product_type": LoanProductType.FARAJA_5_WEEKS,
        "duration_days": 35,
        "interest_rate": Decimal("0.3000"),
        "penalty_rate": Decimal("0.0300"),
        "penalty_interval_days": 2,
        "max_penalty_amount": None,
        "is_active": True,
    },
    {
        "name": "Lumpsum",
        "product_type": LoanProductType.LUMPSUM,
        "duration_days": 90,
        "interest_rate": Decimal("0.2000"),  # TBD — using 20% placeholder
        "penalty_rate": Decimal("0.0300"),
        "penalty_interval_days": 2,
        "max_penalty_amount": None,
        "is_active": True,
    },
]


def seed_loan_products(db: Session) -> None:
    log("Seeding loan products...")
    for p in LOAN_PRODUCTS:
        existing = db.scalar(select(LoanProduct).where(LoanProduct.name == p["name"]))
        if not existing:
            db.add(LoanProduct(**p))
    db.flush()
    log(f"Seeded {len(LOAN_PRODUCTS)} loan products")


# ── Staging demo data ──────────────────────────────────────────────────────────

def seed_clients(db: Session) -> None:
    log("Seeding demo clients...")

    for data in CLIENTS:
        branch = _branch(db, data["branch"])
        registered_by = _user(db, data["registered_by"])
        params = dict(data)
        params.pop("branch")
        params.pop("registered_by")
        params.pop("registered_days_ago")
        if params.get("estimated_asset_value") is not None:
            params["estimated_asset_value"] = Decimal(str(params["estimated_asset_value"]))
        client = get_or_create(
            db,
            Client,
            client_number=data["client_number"],
            defaults={
                **params,
                "branch_id": branch.id if branch else None,
                "registered_by_id": registered_by.id if registered_by else None,
            },
        )
        client.created_at = days_ago(data["registered_days_ago"])

    db.flush()
    log(f"Seeded {len(CLIENTS)} demo clients")


def seed_loans(db: Session) -> None:
    log("Seeding demo loans, installments and repayments...")

    for data in LOANS:
        loan = db.scalar(select(Loan).where(Loan.loan_number == data["loan_number"]))
        if loan is not None:
            continue

        client = _client(db, data["client"])
        product = _product(db, data["product"])
        branch = _branch(db, data["branch"])
        submitted_by = _user(db, data["submitted_by"])
        approved_by = _user(db, data["approved_by"]) if data.get("approved_by") else None
        disbursed_by = _user(db, data["disbursed_by"]) if data.get("disbursed_by") else None

        if product is None or client is None:
            log(f"SKIP {data['loan_number']}: missing product/client")
            continue

        amount = Decimal(data["amount"])
        expected_fee = loan_service.calculate_application_fee(
            amount, fee_service.has_loan_history(db, client.id)
        )
        fee_payment = db.scalar(
            select(FeePayment).where(
                FeePayment.client_id == client.id,
                FeePayment.amount == expected_fee,
                FeePayment.verified.is_(True),
                FeePayment.loan_id.is_(None),
            ).order_by(FeePayment.verified_at.desc())
        )
        application_fee = fee_payment.amount if fee_payment else expected_fee

        loan = Loan(
            loan_number=data["loan_number"],
            client_id=client.id,
            branch_id=branch.id if branch else None,
            loan_product_id=product.id,
            amount=amount,
            application_fee=application_fee,
            duration_days=product.duration_days,
            sector=data["sector"],
            notes=data.get("notes"),
            status=LoanStatus(data["status"]),
            submitted_by_id=submitted_by.id if submitted_by else None,
            date_submitted=days_ago(data["submitted_days_ago"]),
        )
        db.add(loan)
        db.flush()
        loan.created_at = days_ago(data["submitted_days_ago"])

        if fee_payment:
            fee_payment.loan_id = loan.id

        if data.get("approved_by"):
            loan.approved_by_id = approved_by.id if approved_by else None
            loan.approval_note = data.get("approval_note")
            if loan.status != LoanStatus.REJECTED:
                loan.date_approved = days_ago(data["approved_days_ago"])
            else:
                loan.rejection_reason = data.get("rejection_reason")

        if data.get("disbursed_by"):
            interest = loan_service.calculate_interest(product, amount)
            total = amount + interest
            num_weeks = product.duration_days // 7
            disbursed_at = days_ago(data["disbursed_days_ago"])

            loan.status = LoanStatus.DISBURSED
            loan.disbursed_by_id = disbursed_by.id if disbursed_by else None
            loan.disbursed_date = disbursed_at
            loan.due_date = disbursed_at + timedelta(days=product.duration_days)
            loan.interest_amount = interest
            loan.total_repayable = total
            loan.installment_amount = loan_service.calculate_installment_amount(total, num_weeks)

            for week in range(1, num_weeks + 1):
                db.add(
                    Installment(
                        loan_id=loan.id,
                        due_date=disbursed_at + timedelta(weeks=week),
                        amount=loan.installment_amount,
                        status=InstallmentStatus.PENDING,
                    )
                )

        db.flush()

    db.flush()
    log(f"Seeded {len(LOANS)} demo loans")


def seed_repayments(db: Session) -> None:
    log("Seeding demo repayments...")

    for data in REPAYMENTS:
        loan = db.scalar(select(Loan).where(Loan.loan_number == data["loan"]))
        if loan is None:
            log(f"SKIP repayment {data['reference']}: loan not found")
            continue

        exists = db.scalar(
            select(Repayment).where(
                Repayment.reference == data["reference"],
                Repayment.loan_id == loan.id,
            )
        )
        if exists:
            continue

        recorded_by = _user(db, data["recorded_by"])
        verified_by = _user(db, data["verified_by"]) if data.get("verified_by") else None

        repayment = Repayment(
                loan_id=loan.id,
                client_id=loan.client_id,
                amount=Decimal(data["amount"]),
                date=days_ago(data["days_ago"]),
                mode=PaymentMode(data["mode"]),
                reference=data["reference"],
                recorded_by_id=recorded_by.id if recorded_by else None,
                verified=data["verified"],
                verified_by_id=verified_by.id if verified_by else None,
                verified_at=days_ago(data["days_ago"]) if data["verified"] else None,
            )
        db.add(repayment)
        repayment.created_at = days_ago(data["days_ago"])

    db.flush()

    for loan in db.scalars(select(Loan)).all():
        if loan.status == LoanStatus.DISBURSED:
            loan_service.mark_installments_paid(db, loan)

    db.flush()
    log(f"Seeded {len(REPAYMENTS)} demo repayments")


def seed_fee_payments(db: Session) -> None:
    log("Seeding demo fee payments...")

    for data in FEE_PAYMENTS:
        client = _client(db, data["client"])
        if client is None:
            log(f"SKIP fee {data['reference']}: client not found")
            continue

        exists = db.scalar(select(FeePayment).where(FeePayment.reference == data["reference"]))
        if exists:
            continue

        loan = db.scalar(
            select(Loan).where(Loan.loan_number == data["loan"])
        ) if data["loan"] else None
        recorded_by = _user(db, data["recorded_by"])
        verified_by = _user(db, data["verified_by"]) if data.get("verified_by") else None

        fee_payment = FeePayment(
                client_id=client.id,
                loan_id=loan.id if loan else None,
                fee_type=FeeType.APPLICATION,
                amount=Decimal(data["amount"]),
                mode=PaymentMode(data["mode"]),
                reference=data["reference"],
                notes=data.get("notes"),
                recorded_by_id=recorded_by.id if recorded_by else None,
                verified=data["verified"],
                verified_by_id=verified_by.id if verified_by else None,
                verified_at=days_ago(data["days_ago"]) if data["verified"] else None,
            )
        db.add(fee_payment)
        fee_payment.created_at = days_ago(data["days_ago"])

    db.flush()
    log(f"Seeded {len(FEE_PAYMENTS)} demo fee payments")


def seed() -> None:

    db = SessionLocal()

    try:

        seed_branches(db)

        seed_permissions(db)

        seed_roles(db)

        seed_role_permissions(db)

        seed_users(db)

        seed_loan_products(db)

        seed_clients(db)

        seed_fee_payments(db)

        seed_loans(db)

        seed_repayments(db)

        db.commit()

        log("Database seeded successfully.")

    except Exception:

        db.rollback()

        raise

    finally:

        db.close()


if __name__ == "__main__":
    seed()
