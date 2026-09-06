"""FastAPI app + route wiring only — keep under ~20 lines. Shared file, see
docs/05-PARALLEL-WORKFLOW.md."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import store
from api.routes import router
from config import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    store.recover_interrupted_cases()
    yield


app = FastAPI(title="Crossfire", lifespan=lifespan)

settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
@app.get("/ready")
def health_check():
    return {
        "status": "ok",
        "provider": settings.llm_provider,
        "model": settings.llm_model,
        "llm_base_url": settings.llm_base_url,
        "backend_port": settings.port,
    }


app.include_router(router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=settings.port, reload=True)
