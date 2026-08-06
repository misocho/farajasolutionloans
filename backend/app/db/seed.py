from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.branches import BRANCHES
from app.core.permissions import PERMISSIONS
from app.db.session import SessionLocal
from app.db.seed_data import ROLES, USERS
from app.models.branch import Branch
from app.models.loan_product import LoanProduct
from app.models.permission import Permission
from app.models.role import Role
from app.models.role_permission import RolePermission
from app.models.user import User
from app.models.user_branch import UserBranch
from app.models.user_role import UserRole
from app.core.security import get_password_hash
from app.models.enums import LoanProductType


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
    ],
    "Finance Officer": [
        "dashboard.view",
        "repayments.view",
        "repayments.record",
        "repayments.verify",
        "expenses.view",
        "expenses.create",
        "expenses.approve",
        "reports.view",
        "reports.export",
    ],
    "System Admin": [
        "dashboard.view",
        "users.view",
        "users.create",
        "users.update",
        "users.delete",
        "roles.view",
        "roles.manage",
        "branches.view",
        "branches.manage",
        "audit.view",
    ],
    "Auditor": [
        "dashboard.view",
        "clients.view",
        "loans.view",
        "repayments.view",
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


def seed() -> None:

    db = SessionLocal()

    try:

        seed_branches(db)

        seed_permissions(db)

        seed_roles(db)

        seed_role_permissions(db)

        seed_users(db)

        seed_loan_products(db)

        db.commit()

        log("Database seeded successfully.")

    except Exception:

        db.rollback()

        raise

    finally:

        db.close()


if __name__ == "__main__":
    seed()
