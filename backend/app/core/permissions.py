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
    "branches.view_all",
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


def get_user_branch_ids(db: Session, user) -> list | None:
    """Branch scope for a user.

    Returns None (unrestricted — sees everything) for users holding the
    `branches.view_all` permission (granted to Director, System Admin,
    Auditor). Returns a list of branch UUIDs for scoped users (Loan
    Officers, Managers, Finance Officers). An empty list means no branch
    assigned — callers must filter to nothing.
    """
    perms = get_user_permissions(db, user)
    if "branches.view_all" in perms:
        return None  # No filter — sees everything
    return [ub.branch_id for ub in user.branches]
