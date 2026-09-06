"""FastAPI app + route wiring only — keep under ~20 lines. Shared file, see
docs/05-PARALLEL-WORKFLOW.md."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router
from config import get_settings

app = FastAPI(title="Crossfire")

settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(router)
