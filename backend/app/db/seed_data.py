from decimal import Decimal

from app.core.permissions import PERMISSIONS

ROLES = [
    {
        "name": "Director",
        "description": "System Director",
        "approval_limit": Decimal("999999999.99"),
    },
    {
        "name": "Manager",
        "description": "Branch Manager",
        "approval_limit": Decimal("1000000.00"),
    },
    {
        "name": "Loan Officer",
        "description": "Loan Officer",
        "approval_limit": Decimal("0.00"),
    },
    {
        "name": "Finance Officer",
        "description": "Finance Officer",
        "approval_limit": Decimal("100000.00"),
    },
    {
        "name": "System Admin",
        "description": "System Administrator",
        "approval_limit": Decimal("0.00"),
    },
    {
        "name": "Auditor",
        "description": "Auditor",
        "approval_limit": Decimal("0.00"),
    },
]

USERS = [
    {
        "employee_number": "FS-DIR001",
        "first_name": "System",
        "last_name": "Director",
        "email": "admin@enkaai.net",
        "password": "Faraja@2026",
        "role": "Director",
        "branch": "Head Office - Miritini",
    },
    {
        "employee_number": "FS-MGR001",
        "first_name": "Branch",
        "last_name": "Manager",
        "email": "manager@enkaai.net",
        "password": "Faraja@2026",
        "role": "Manager",
        "branch": "Mombasa",
    },
    {
        "employee_number": "FS-LO001",
        "first_name": "Loan",
        "last_name": "Officer",
        "email": "loanofficer@enkaai.net",
        "password": "Faraja@2026",
        "role": "Loan Officer",
        "branch": "Mombasa",
    },
    {
        "employee_number": "FS-ACC001",
        "first_name": "Finance",
        "last_name": "Officer",
        "email": "finance@enkaai.net",
        "password": "Faraja@2026",
        "role": "Finance Officer",
        "branch": "Head Office - Miritini",
    },
    {
        "employee_number": "FS-SYS001",
        "first_name": "System",
        "last_name": "Administrator",
        "email": "sysadmin@enkaai.net",
        "password": "Faraja@2026",
        "role": "System Admin",
        "branch": "Head Office - Miritini",
    },
    {
        "employee_number": "FS-AUD001",
        "first_name": "System",
        "last_name": "Auditor",
        "email": "auditor@enkaai.net",
        "password": "Faraja@2026",
        "role": "Auditor",
        "branch": "Head Office - Miritini",
    },
]
