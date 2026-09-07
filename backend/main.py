"""FastAPI app + route wiring only — keep under ~20 lines. Shared file, see
docs/05-PARALLEL-WORKFLOW.md."""
import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import store
from api.provider_routes import router as provider_router
from api.routes import router
from config import get_settings
from providers import LLMFormatError, LLMProviderError
from providers import keyring

logger = logging.getLogger("crossfire")


@asynccontextmanager
async def lifespan(app: FastAPI):
    store.recover_interrupted_cases()
    yield


app = FastAPI(title="Crossfire", lifespan=lifespan)

settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_origin_regex=r"https://.*\.stratizone\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(httpx.TimeoutException)
async def timeout_exception_handler(request: Request, exc: httpx.TimeoutException):
    logger.error("Request timed out on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=408,
        content={"detail": "Upstream LLM provider request timed out. Please retry."},
    )


@app.exception_handler(httpx.ConnectError)
async def connect_exception_handler(request: Request, exc: httpx.ConnectError):
    logger.error("Connection error on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=424,
        content={"detail": "Unable to connect to upstream LLM provider. Ensure the provider service is running."},
    )


@app.exception_handler(LLMFormatError)
async def format_exception_handler(request: Request, exc: LLMFormatError):
    logger.error("LLM format error on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=424,
        content={"detail": str(exc)},
    )


@app.exception_handler(LLMProviderError)
async def provider_exception_handler(request: Request, exc: LLMProviderError):
    logger.error("LLM provider error on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=424,
        content={"detail": str(exc)},
    )


@app.exception_handler(httpx.HTTPStatusError)
async def http_status_exception_handler(request: Request, exc: httpx.HTTPStatusError):
    logger.error("Upstream HTTP error on %s %s: %s", request.method, request.url.path, exc)
    is_rate_limit = exc.response.status_code == 429 or "429" in exc.response.text
    status_code = 429 if is_rate_limit else 424
    return JSONResponse(
        status_code=status_code,
        content={
            "detail": f"Upstream LLM error ({exc.response.status_code}): {exc.response.text}"
        },
    )



@app.get("/health")
@app.get("/ready")
def health_check():
    # Provider/model come from the saved settings, not .env — the user picks
    # them in the UI (api/provider_routes.py).
    active = keyring.get_active_provider()
    config = keyring.get_config(active)
    return {
        "status": "ok",
        "provider": active,
        "model": config.model,
        "llm_base_url": config.base_url,
        "fallback_chain": keyring.get_fallback_chain(),
        "backend_port": settings.port,
    }


app.include_router(router)
app.include_router(provider_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=settings.port, reload=True)
