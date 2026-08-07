from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.permission import Permission
from app.models.role_permission import RolePermission

PERMISSIONS = [
    # Dashboard
    "dashboard.view",

    # Clients
    "clients.view",
    "clients.create",
    "clients.update",
    "clients.delete",

    # Loans
    "loans.view",
    "loans.create",
    "loans.update",
    "loans.approve",
    "loans.reject",
    "loans.disburse",
    "loans.writeoff",

    # Repayments
    "repayments.view",
    "repayments.record",
    "repayments.verify",

    # Fees
    "fees.view",
    "fees.record",
    "fees.verify",

    # Expenses
    "expenses.view",
    "expenses.create",
    "expenses.approve",

    # Reports
    "reports.view",
    "reports.export",

    # Users
    "users.view",
    "users.create",
    "users.update",
    "users.delete",

    # Roles
    "roles.view",
    "roles.manage",

    # Branches
    "branches.view",
    "branches.manage",

    # Audit
    "audit.view",

    # Settings
    "settings.manage",
]


def get_user_permissions(db: Session, user) -> set[str]:
    """All permission names granted to a user through their roles.

    Resolves via the join tables (UserRole → RolePermission → Permission);
    the Role model has no `permissions` relationship. Uses the role ids
    already loaded on the user to avoid one query per role.
    """
    if not user.roles:
        return set()

    role_ids = {ur.role_id for ur in user.roles}
    rows = db.scalars(
        select(Permission.name)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .where(RolePermission.role_id.in_(role_ids))
    ).all()
    return set(rows)


def get_user_branch_ids(user) -> list | None:
    """Branch scope for a user.

    Returns None for unrestricted roles (Director, System Admin, Auditor).
    Returns a list of branch UUIDs for scoped roles (Loan Officers, Managers).
    An empty list means no branch assigned — callers must filter to nothing.
    """
    UNRESTRICTED_ROLES = {"Director", "System Admin", "Auditor"}
    role_names = {ur.role.name for ur in user.roles}
    if role_names & UNRESTRICTED_ROLES:
        return None  # No filter — sees everything
    return [ub.branch_id for ub in user.branches]
