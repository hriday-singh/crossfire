import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  addProviderKey,
  createCustomProvider,
  deleteProvider,
  deleteProviderKey,
  listOllamaModels,
  listProviderKeys,
  listProviders,
  setActiveProvider,
  setEnabledModels,
  setFallbackChain,
  setKeyEnabled,
  setProviderConfig,
  testChain,
  testProvider,
} from "@/lib/providersApi";
import { CrossfireApiError } from "@/lib/api";

const okJson = (body: unknown, status = 200) =>
  vi.fn().mockResolvedValue({ ok: true, status, json: async () => body });

const lastCall = () => (globalThis.fetch as any).mock.calls[0];
const bodyOf = (init: RequestInit) => JSON.parse(String(init.body));

describe("providersApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lists providers from GET /providers", async () => {
    const payload = { active: "gemini", fallback_chain: ["openai"], providers: [] };
    vi.stubGlobal("fetch", okJson(payload));

    await expect(listProviders()).resolves.toEqual(payload);
    const [url, init] = lastCall();
    expect(url).toBe("/providers");
    expect(init.method).toBe("GET");
  });

  it("puts the enabled model list, in order, to /providers/:id/models", async () => {
    vi.stubGlobal("fetch", okJson({ id: "gemini_proxy" }));

    await setEnabledModels("gemini_proxy", ["gemini-3.7-flash", "gemini-flash-lite"]);
    const [url, init] = lastCall();
    expect(url).toBe("/providers/gemini_proxy/models");
    expect(init.method).toBe("PUT");
    expect(bodyOf(init)).toEqual({
      models: ["gemini-3.7-flash", "gemini-flash-lite"],
    });
  });

  it("sends provider plus config patch when setting the active provider", async () => {
    vi.stubGlobal("fetch", okJson({ active: "openai", fallback_chain: [], providers: [] }));

    await setActiveProvider("openai", { model: "gpt-5.6-luna" });

    const [url, init] = lastCall();
    expect(url).toBe("/providers/active");
    expect(init.method).toBe("PUT");
    expect(bodyOf(init)).toEqual({ provider: "openai", model: "gpt-5.6-luna" });
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("puts the fallback chain in priority order", async () => {
    vi.stubGlobal("fetch", okJson({ active: "gemini", fallback_chain: [], providers: [] }));

    await setFallbackChain(["openai", "ollama"]);

    const [url, init] = lastCall();
    expect(url).toBe("/providers/fallback");
    expect(bodyOf(init)).toEqual({ chain: ["openai", "ollama"] });
  });

  it("url-encodes custom provider ids in the path", async () => {
    vi.stubGlobal("fetch", okJson({ id: "custom:vllm-box" }));

    await setProviderConfig("custom:vllm-box", { model: "llama3.1", rpm: 30 });

    const [url, init] = lastCall();
    expect(url).toBe("/providers/custom%3Avllm-box/config");
    expect(init.method).toBe("PUT");
    expect(bodyOf(init)).toEqual({ model: "llama3.1", rpm: 30 });
  });

  it("defaults rpm to 0 when registering a custom endpoint", async () => {
    vi.stubGlobal("fetch", okJson({ id: "custom:box" }, 201));

    await createCustomProvider({ name: "Box", base_url: "http://x/v1", model: "m" });

    const [url, init] = lastCall();
    expect(url).toBe("/providers/custom");
    expect(init.method).toBe("POST");
    expect(bodyOf(init)).toEqual({ rpm: 0, name: "Box", base_url: "http://x/v1", model: "m" });
  });

  it("resolves without parsing a body on 204 deletes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 204 }));

    await expect(deleteProvider("custom:box")).resolves.toBeUndefined();
    await expect(deleteProviderKey(7)).resolves.toBeUndefined();
    expect((globalThis.fetch as any).mock.calls[0][0]).toBe("/providers/custom%3Abox");
    expect((globalThis.fetch as any).mock.calls[1][0]).toBe("/providers/keys/7");
  });

  it("posts a key and label to the provider key endpoint", async () => {
    vi.stubGlobal("fetch", okJson({ id: 1, provider: "gemini", label: "main", hint: "AIza...9f2c", enabled: true }, 201));

    const stored = await addProviderKey("gemini", "sk-secret", "main");

    const [url, init] = lastCall();
    expect(url).toBe("/providers/gemini/keys");
    expect(bodyOf(init)).toEqual({ api_key: "sk-secret", label: "main" });
    expect(stored.hint).toBe("AIza...9f2c");
  });

  it("lists and toggles keys", async () => {
    vi.stubGlobal("fetch", okJson([{ id: 3, provider: "gemini", label: "", hint: "AI...c", enabled: false }]));

    await listProviderKeys("gemini");
    expect(lastCall()[0]).toBe("/providers/gemini/keys");

    vi.stubGlobal("fetch", okJson([]));
    await setKeyEnabled(3, false);
    const [url, init] = lastCall();
    expect(url).toBe("/providers/keys/3");
    expect(init.method).toBe("PATCH");
    expect(bodyOf(init)).toEqual({ enabled: false });
  });

  it("pings a single provider and the whole chain", async () => {
    vi.stubGlobal("fetch", okJson({ ok: true, provider: "gemini", model: "m", detail: "ok" }));
    await testProvider("gemini", { api_key: "unsaved" });
    expect(lastCall()[0]).toBe("/providers/gemini/test");
    expect(bodyOf(lastCall()[1])).toEqual({ api_key: "unsaved" });

    vi.stubGlobal("fetch", okJson([{ ok: false, provider: "openai", model: "m", detail: "HTTP 401" }]));
    const results = await testChain();
    expect(lastCall()[0]).toBe("/providers/test");
    expect(results[0].ok).toBe(false);
  });

  it("unwraps the ollama model list and tolerates an empty response", async () => {
    vi.stubGlobal("fetch", okJson({ models: ["llama3.1", "qwen2.5"] }));
    await expect(listOllamaModels()).resolves.toEqual(["llama3.1", "qwen2.5"]);

    vi.stubGlobal("fetch", okJson({}));
    await expect(listOllamaModels()).resolves.toEqual([]);
  });

  it("raises CrossfireApiError carrying the backend detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ detail: "An endpoint named 'Box' already exists." }),
      })
    );

    await expect(
      createCustomProvider({ name: "Box", base_url: "http://x/v1", model: "m" })
    ).rejects.toMatchObject({
      name: "CrossfireApiError",
      status: 409,
      message: "An endpoint named 'Box' already exists.",
    });
  });

  it("falls back to a generic message when the error body is unreadable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("not json");
        },
      })
    );

    await expect(listProviders()).rejects.toBeInstanceOf(CrossfireApiError);
  });
});
