from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.api.dependencies.auth import get_current_user
from app.models.user import User
from app.models.role import Role
from app.models.permission import Permission
from app.models.user_role import UserRole
from app.models.role_permission import RolePermission
from app.models.user_branch import UserBranch
from app.schemas.users import (
    UserAdminResponse,
    RoleResponse,
    PermissionResponse,
    UpdateUserRolesRequest,
    UpdateRolePermissionsRequest,
)

router = APIRouter(
    prefix="/admin",
    tags=["Administration"],
)

def check_is_director(current_user: User = Depends(get_current_user)) -> User:
    user_roles = [ur.role.name for ur in current_user.roles]
    if "Director" not in user_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only System Directors are authorized to perform this operation."
        )
    return current_user

@router.get(
    "/users",
    response_model=list[UserAdminResponse],
)
def get_users(
    db: Session = Depends(get_db),
    admin_user: User = Depends(check_is_director),
):
    stmt = select(User).options(
        joinedload(User.roles).joinedload(UserRole.role),
        joinedload(User.branches).joinedload(UserBranch.branch),
    ).order_by(User.employee_number)
    
    users = db.scalars(stmt).unique().all()
    return users

@router.get(
    "/roles",
    response_model=list[RoleResponse],
)
def get_roles(
    db: Session = Depends(get_db),
    admin_user: User = Depends(check_is_director),
):
    stmt = select(Role).order_by(Role.name)
    roles = db.scalars(stmt).all()
    return roles

@router.get(
    "/permissions",
    response_model=list[PermissionResponse],
)
def get_permissions(
    db: Session = Depends(get_db),
    admin_user: User = Depends(check_is_director),
):
    stmt = select(Permission).order_by(Permission.name)
    permissions = db.scalars(stmt).all()
    return permissions

@router.get(
    "/roles/{role_id}/permissions",
    response_model=list[PermissionResponse],
)
def get_role_permissions(
    role_id: UUID,
    db: Session = Depends(get_db),
    admin_user: User = Depends(check_is_director),
):
    stmt = (
        select(Permission)
        .join(RolePermission)
        .where(RolePermission.role_id == role_id)
        .order_by(Permission.name)
    )
    permissions = db.scalars(stmt).all()
    return permissions

@router.put(
    "/users/{user_id}/roles",
    status_code=status.HTTP_200_OK,
)
def update_user_roles(
    user_id: UUID,
    request: UpdateUserRolesRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(check_is_director),
):
    user = db.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
        
    # Get roles from request
    stmt = select(Role).where(Role.name.in_(request.role_names))
    roles_to_assign = db.scalars(stmt).all()
    
    if len(roles_to_assign) != len(request.role_names):
        found_names = [r.name for r in roles_to_assign]
        missing_names = set(request.role_names) - set(found_names)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Some roles were not found: {list(missing_names)}"
        )
        
    # Clear existing roles
    db.execute(
        UserRole.__table__.delete().where(UserRole.user_id == user_id)
    )
    
    # Assign new roles
    for r in roles_to_assign:
        db.add(UserRole(user_id=user_id, role_id=r.id))
        
    db.commit()
    return {"status": "success", "message": f"Updated roles for employee {user.employee_number}"}

@router.put(
    "/roles/{role_id}/permissions",
    status_code=status.HTTP_200_OK,
)
def update_role_permissions(
    role_id: UUID,
    request: UpdateRolePermissionsRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(check_is_director),
):
    role = db.scalar(select(Role).where(Role.id == role_id))
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
        
    # Get permissions from request
    stmt = select(Permission).where(Permission.name.in_(request.permission_names))
    permissions_to_assign = db.scalars(stmt).all()
    
    if len(permissions_to_assign) != len(request.permission_names):
        found_names = [p.name for p in permissions_to_assign]
        missing_names = set(request.permission_names) - set(found_names)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Some permissions were not found: {list(missing_names)}"
        )
        
    # Clear existing permissions
    db.execute(
        RolePermission.__table__.delete().where(RolePermission.role_id == role_id)
    )
    
    # Assign new permissions
    for p in permissions_to_assign:
        db.add(RolePermission(role_id=role_id, permission_id=p.id))
        
    db.commit()
    return {"status": "success", "message": f"Updated permissions for role {role.name}"}
