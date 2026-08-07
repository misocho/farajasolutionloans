from fastapi import APIRouter

from app.api.routers.auth import router as auth_router
from app.api.routers.admin import router as admin_router
from app.api.routers.loans_clients import router as loans_clients_router
from app.api.routers.branches import router as branches_router
from app.api.routers.reports import router as reports_router
from app.api.routers.notifications import router as notifications_router
from app.api.routers.search import router as search_router
from app.api.routers.fees import router as fees_router
from app.api.routers.seed import router as seed_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth_router)
api_router.include_router(admin_router)
api_router.include_router(loans_clients_router)
api_router.include_router(branches_router)
api_router.include_router(reports_router)
api_router.include_router(notifications_router)
api_router.include_router(search_router)
api_router.include_router(fees_router)
api_router.include_router(seed_router)
