import urllib.request
import urllib.error
import json
import time

def test_speed(url, model, prompt):
    data = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 150
    }).encode('utf-8')

    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})

    print(f"Testing {model} at {url}...")
    start_time = time.time()
    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode())
            content = result.get('choices', [{}])[0].get('message', {}).get('content', '')
            tokens = result.get('usage', {}).get('completion_tokens', 0)
    except urllib.error.URLError as e:
        print(f"Error: {e}")
        try:
            print(e.read().decode())
        except:
            pass
        return
    end_time = time.time()
    duration = end_time - start_time
    tps = tokens / duration if duration > 0 and tokens > 0 else 0
    print(f"Time: {duration:.2f} seconds", flush=True)
    print(f"Tokens: {tokens} (Speed: {tps:.2f} tokens/sec)", flush=True)
    print("-" * 40, flush=True)

prompt = "Write a 3 paragraph story about a very fast turtle."
print("Starting speed test...", flush=True)
print("=" * 40, flush=True)
test_speed("http://localhost:8081/v1/chat/completions", "gemini-3.7-flash", prompt)
test_speed("http://localhost:8082/v1/chat/completions", "deepseek-v4-flash", prompt)
