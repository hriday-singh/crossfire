import asyncio
import httpx
from config import get_settings
from providers import get_provider, build_adapter
import logging

async def test_llm():
    settings = get_settings()
    print(f"Using base URL: {settings.llm_base_url}")
    
    p = get_provider("gemini_proxy", api_key=settings.llm_api_key)
    p._model = "gemini-3.6-flash" # OVERRIDE MODEL HERE
    print(f"Adapter base_url: {p._base_url}")
    
    try:
        res = await p.generate("Reply with ok", [{"role": "user", "content": "ping"}])
        print(f"SUCCESS! Response: {res}")
    except httpx.HTTPStatusError as e:
        print(f"ERROR: {e.response.status_code}")
        body = e.response.text.encode('ascii', 'replace').decode('ascii')
        print(f"Body: {body}")
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(test_llm())
