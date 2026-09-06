"""FastAPI app + route wiring only — keep under ~20 lines. Shared file, see
docs/05-PARALLEL-WORKFLOW.md."""
from fastapi import FastAPI

from api.routes import router

app = FastAPI(title="Crossfire")
app.include_router(router)
