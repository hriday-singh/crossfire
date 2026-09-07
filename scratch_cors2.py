import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import httpx
import uvicorn
import threading
import time
import requests

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:5173'],
    allow_origin_regex=r"https://.*\.stratizone\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/cases")
async def cases():
    return {"status": "ok"}

def run_server():
    uvicorn.run(app, host="127.0.0.1", port=8006, log_level="error")

t = threading.Thread(target=run_server, daemon=True)
t.start()
time.sleep(2)

print("Testing OPTIONS /cases")
r = requests.options("http://127.0.0.1:8006/cases", headers={"Origin": "https://crossfire.stratizone.com", "Access-Control-Request-Method": "POST"})
print(f"OPTIONS: {r.headers}")

print("Testing POST /cases")
r = requests.post("http://127.0.0.1:8006/cases", headers={"Origin": "https://crossfire.stratizone.com"})
print(f"POST: {r.headers}")
