from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging
from app.core.exceptions import register_exception_handlers


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        debug=settings.APP_DEBUG,
        version="1.0.0",
        lifespan=lifespan,
    )

    app.include_router(api_router)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "https://faraja.enkaai.net",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    configure_logging()
    register_exception_handlers(app)

    @app.get("/", tags=["System"])
    def root() -> dict[str, str]:
        return {
            "name": settings.APP_NAME,
            "version": "1.0.0",
            "status": "running",
        }

    return app
