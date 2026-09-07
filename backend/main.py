"""FastAPI app + route wiring only — keep under ~20 lines. Shared file, see
docs/05-PARALLEL-WORKFLOW.md."""
import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import store
from api.routes import router
from config import get_settings
from providers import LLMFormatError, LLMProviderError

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
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(httpx.TimeoutException)
async def timeout_exception_handler(request: Request, exc: httpx.TimeoutException):
    logger.error("Request timed out on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=504,
        content={"detail": "Upstream LLM provider request timed out. Please retry."},
    )


@app.exception_handler(httpx.ConnectError)
async def connect_exception_handler(request: Request, exc: httpx.ConnectError):
    logger.error("Connection error on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=502,
        content={"detail": "Unable to connect to upstream LLM provider. Ensure the provider service is running."},
    )


@app.exception_handler(LLMFormatError)
async def format_exception_handler(request: Request, exc: LLMFormatError):
    logger.error("LLM format error on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=502,
        content={"detail": str(exc)},
    )


@app.exception_handler(LLMProviderError)
async def provider_exception_handler(request: Request, exc: LLMProviderError):
    logger.error("LLM provider error on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=502,
        content={"detail": str(exc)},
    )


@app.exception_handler(httpx.HTTPStatusError)
async def http_status_exception_handler(request: Request, exc: httpx.HTTPStatusError):
    logger.error("Upstream HTTP error on %s %s: %s", request.method, request.url.path, exc)
    is_rate_limit = exc.response.status_code == 429 or "429" in exc.response.text
    status_code = 429 if is_rate_limit else 502
    return JSONResponse(
        status_code=status_code,
        content={
            "detail": f"Upstream LLM error ({exc.response.status_code}): {exc.response.text}"
        },
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
