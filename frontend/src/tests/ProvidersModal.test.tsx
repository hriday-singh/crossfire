import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { CaseProvider, useCase } from "@/context/CaseContext";
import { ProvidersModal } from "@/components/features/ProvidersModal";

const provider = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "gemini",
  label: "Google Gemini",
  requires_key: true,
  editable_base_url: false,
  base_url: "https://generativelanguage.googleapis.com/v1beta/openai",
  model: "gemini-3.7-flash",
  models: ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-flash-lite"],
  enabled_models: ["gemini-3.7-flash", "gemini-3.6-flash"],
  rpm: 10,
  key_count: 1,
  configured: true,
  notes: "Free-tier keys rate-limit hard.",
  removable: false,
  ...over,
});

const PROVIDERS = {
  active: "gemini",
  locked_provider: "ollama",
  fallback_chain: ["openai", "custom:vllm-box"],
  providers: [
    provider(),
    provider({
      id: "ollama",
      label: "Ollama (local)",
      requires_key: false,
      editable_base_url: true,
      base_url: "http://localhost:11434/v1",
    }),
    provider({
      id: "openai",
      label: "OpenAI",
      model: "gpt-5.6-luna",
      models: ["gpt-5.6-luna", "gpt-5"],
      enabled_models: ["gpt-5.6-luna"],
      key_count: 0,
      configured: false,
    }),
    provider({
      id: "custom:vllm-box",
      label: "vllm-box",
      model: "llama3.1",
      models: [],
      enabled_models: ["llama3.1"],
      editable_base_url: true,
      base_url: "http://box:8000/v1",
      requires_key: false,
      removable: true,
      notes: "",
    }),
  ],
};

const KEYS = [{ id: 4, provider: "gemini", label: "personal", hint: "AIza...9f2c", enabled: true }];

let calls: Array<{ url: string; method: string; body: any }> = [];

function mockBackend() {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
      const method = (init.method || "GET").toUpperCase();
      calls.push({ url, method, body: init.body ? JSON.parse(String(init.body)) : null });

      const json = (body: unknown, status = 200) =>
        Promise.resolve({ ok: true, status, json: async () => body });

      if (url.endsWith("/keys") && method === "GET") return json(KEYS);
      if (url.startsWith("/cases") && method === "GET") return json([]);
      if (url === "/providers" || url.startsWith("/providers/active") || url.startsWith("/providers/fallback"))
        return json(PROVIDERS);
      if (url === "/providers/test" && method === "POST")
        return json([{ ok: true, provider: "gemini", model: "gemini-3.7-flash", detail: "ok" }]);
      if (url.endsWith("/test") && method === "POST")
        return json({ ok: false, provider: "gemini", model: "gemini-3.7-flash", detail: "HTTP 401" });
      if (method === "DELETE") return Promise.resolve({ ok: true, status: 204 });
      return json({});
    })
  );
}

const Harness: React.FC = () => {
  const { setActiveModal } = useCase();
  return (
    <div>
      <button onClick={() => setActiveModal("providers")}>Open Providers</button>
      <ProvidersModal />
    </div>
  );
};

async function open() {
  render(
    <CaseProvider>
      <Harness />
    </CaseProvider>
  );
  fireEvent.click(screen.getByText("Open Providers"));
  await screen.findByRole("heading", { name: "Model Providers" });
  await screen.findByTestId("provider-item-gemini");
}

const calledWith = (url: string, method: string) =>
  calls.filter((call) => call.url === url && call.method === method);

describe("ProvidersModal", () => {
  beforeEach(() => {
    mockBackend();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists every provider with its chain role and selects the active one", async () => {
    await open();

    expect(screen.getByTestId("provider-item-gemini")).toHaveTextContent("ACTIVE");
    expect(screen.getByTestId("provider-item-ollama")).toBeInTheDocument();
    expect(screen.getByTestId("provider-item-openai")).toHaveTextContent("FB 1");
    expect(screen.getByTestId("provider-item-custom:vllm-box")).toHaveTextContent("FB 2");
    expect(screen.getByRole("heading", { name: "Global Provider Routing" })).toBeInTheDocument();
    expect(screen.getByTestId("provider-item-gemini")).toHaveAttribute("aria-pressed", "false");
  });

  it("shows only masked key hints and adds a new key for the selected provider", async () => {
    await open();
    fireEvent.click(screen.getByTestId("provider-item-gemini"));
    await screen.findByTestId("key-row-4");
    expect(screen.getByText("AIza...9f2c")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("New API key"), { target: { value: "sk-live-123" } });
    fireEvent.change(screen.getByLabelText("Key label"), { target: { value: "work" } });
    fireEvent.click(screen.getByTestId("add-key-button"));

    await waitFor(() => expect(calledWith("/providers/gemini/keys", "POST")).toHaveLength(1));
    expect(calledWith("/providers/gemini/keys", "POST")[0].body).toEqual({
      api_key: "sk-live-123",
      label: "work",
    });
  });

  it("toggles and deletes a stored key", async () => {
    await open();
    fireEvent.click(screen.getByTestId("provider-item-gemini"));
    await screen.findByTestId("key-row-4");

    fireEvent.click(screen.getByLabelText("Toggle key AIza...9f2c"));
    await waitFor(() => expect(calledWith("/providers/keys/4", "PATCH")).toHaveLength(1));
    expect(calledWith("/providers/keys/4", "PATCH")[0].body).toEqual({ enabled: false });

    fireEvent.click(screen.getByLabelText("Delete key AIza...9f2c"));
    await waitFor(() => expect(calledWith("/providers/keys/4", "DELETE")).toHaveLength(1));
  });

  it("switches the detail pane when another provider is picked", async () => {
    await open();

    fireEvent.click(screen.getByTestId("provider-item-openai"));

    expect(screen.getByRole("heading", { name: "OpenAI" })).toBeInTheDocument();
    expect(screen.getByTestId("model-row-gpt-5.6-luna")).toBeInTheDocument();
    expect(screen.getByTestId("set-active-button")).toBeInTheDocument();
  });

  it("promotes another model to primary", async () => {
    await open();
    fireEvent.click(screen.getByTestId("provider-item-gemini"));
    fireEvent.click(screen.getByTestId("model-chip-gemini-3.6-flash"));

    await waitFor(() => expect(calledWith("/providers/gemini/config", "PUT")).toHaveLength(1));
    expect(calledWith("/providers/gemini/config", "PUT")[0].body).toEqual({
      model: "gemini-3.6-flash",
    });
  });

  it("labels each model with its place in the fallback order", async () => {
    await open();
    fireEvent.click(screen.getByTestId("provider-item-gemini"));

    expect(screen.getByTestId("model-row-gemini-3.7-flash")).toHaveTextContent("PRIMARY");
    expect(screen.getByTestId("model-row-gemini-3.6-flash")).toHaveTextContent("FB 1");
    expect(screen.getByTestId("model-row-gemini-flash-lite")).toHaveTextContent("OFF");
  });

  it("enables a disabled model and disables an enabled one", async () => {
    await open();
    fireEvent.click(screen.getByTestId("provider-item-gemini"));

    fireEvent.click(screen.getByLabelText("Enable gemini-flash-lite"));
    await waitFor(() => expect(calledWith("/providers/gemini/models", "PUT")).toHaveLength(1));
    expect(calledWith("/providers/gemini/models", "PUT")[0].body).toEqual({
      models: ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-flash-lite"],
    });

    fireEvent.click(screen.getByLabelText("Enable gemini-3.6-flash"));
    await waitFor(() => expect(calledWith("/providers/gemini/models", "PUT")).toHaveLength(2));
    expect(calledWith("/providers/gemini/models", "PUT")[1].body).toEqual({
      models: ["gemini-3.7-flash"],
    });
  });

  it("keeps the primary model enabled and unmovable", async () => {
    await open();
    fireEvent.click(screen.getByTestId("provider-item-gemini"));
    await screen.findByLabelText("Enable gemini-3.7-flash");

    expect(screen.getByLabelText("Enable gemini-3.7-flash")).toBeDisabled();
    expect(screen.getByLabelText("Move gemini-3.7-flash up")).toBeDisabled();
    expect(screen.getByLabelText("Move gemini-3.7-flash down")).toBeDisabled();
  });

  it("reorders the model fallback order", async () => {
    await open();

    fireEvent.click(screen.getByTestId("provider-item-openai"));
    expect(screen.getByTestId("model-row-gpt-5")).toHaveTextContent("OFF");

    fireEvent.click(screen.getByTestId("provider-item-gemini"));
    fireEvent.click(screen.getByLabelText("Enable gemini-flash-lite"));
    await waitFor(() => expect(calledWith("/providers/gemini/models", "PUT")).toHaveLength(1));
  });

  it("says which provider runs while the pipeline is pinned", async () => {
    await open();
    fireEvent.click(screen.getByTestId("provider-item-gemini"));
    await screen.findByTestId("locked-notice");

    expect(screen.getByTestId("locked-notice")).toHaveTextContent("ollama");

    fireEvent.click(screen.getByTestId("provider-item-ollama"));
    expect(screen.getByTestId("locked-notice")).toHaveTextContent("PINNED");
  });

  it("promotes a provider to active with its selected model", async () => {
    await open();
    fireEvent.click(screen.getByTestId("provider-item-openai"));
    fireEvent.click(screen.getByTestId("set-active-button"));

    await waitFor(() => expect(calledWith("/providers/active", "PUT")).toHaveLength(1));
    expect(calledWith("/providers/active", "PUT")[0].body).toEqual({
      provider: "openai",
      model: "gpt-5.6-luna",
    });
  });

  it("saves base url and rpm only where the endpoint is editable", async () => {
    await open();
    fireEvent.click(screen.getByTestId("provider-item-gemini"));
    await screen.findByLabelText("Base URL");
    expect(screen.getByLabelText("Base URL")).toBeDisabled();

    fireEvent.click(screen.getByTestId("provider-item-custom:vllm-box"));
    const baseUrl = screen.getByLabelText("Base URL");
    expect(baseUrl).not.toBeDisabled();

    fireEvent.change(baseUrl, { target: { value: "http://box:9000/v1" } });
    fireEvent.change(screen.getByLabelText("Requests per minute"), { target: { value: "45" } });
    fireEvent.click(screen.getByTestId("save-config-button"));

    await waitFor(() =>
      expect(calledWith("/providers/custom%3Avllm-box/config", "PUT")).toHaveLength(1)
    );
    expect(calledWith("/providers/custom%3Avllm-box/config", "PUT")[0].body).toEqual({
      base_url: "http://box:9000/v1",
      rpm: 45,
    });
  });

  it("reorders the fallback chain by priority", async () => {
    await open();

    fireEvent.click(screen.getByLabelText("Move custom:vllm-box up"));

    await waitFor(() => expect(calledWith("/providers/fallback", "PUT")).toHaveLength(1));
    expect(calledWith("/providers/fallback", "PUT")[0].body).toEqual({
      chain: ["custom:vllm-box", "openai"],
    });
  });

  it("removes a provider from the fallback chain", async () => {
    await open();

    fireEvent.click(screen.getByLabelText("Enable openai"));

    await waitFor(() => expect(calledWith("/providers/fallback", "PUT")).toHaveLength(1));
    expect(calledWith("/providers/fallback", "PUT")[0].body).toEqual({
      chain: ["custom:vllm-box"],
    });
  });

  it("registers a custom endpoint from the rail form", async () => {
    await open();

    fireEvent.click(screen.getByTestId("toggle-add-endpoint"));
    fireEvent.change(screen.getByLabelText("Endpoint name"), { target: { value: "vLLM Box" } });
    fireEvent.change(screen.getByLabelText("Endpoint base URL"), {
      target: { value: "http://box:8000/v1" },
    });
    fireEvent.change(screen.getByLabelText("Endpoint model"), { target: { value: "llama3.1" } });
    fireEvent.click(screen.getByTestId("create-endpoint-button"));

    await waitFor(() => expect(calledWith("/providers/custom", "POST")).toHaveLength(1));
    expect(calledWith("/providers/custom", "POST")[0].body).toEqual({
      rpm: 0,
      name: "vLLM Box",
      base_url: "http://box:8000/v1",
      model: "llama3.1",
      api_key: null,
    });
  });

  it("offers delete only for user-added endpoints", async () => {
    await open();
    expect(screen.queryByTestId("delete-endpoint-button")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("provider-item-custom:vllm-box"));
    fireEvent.click(screen.getByTestId("delete-endpoint-button"));

    await waitFor(() => expect(calledWith("/providers/custom%3Avllm-box", "DELETE")).toHaveLength(1));
  });

  it("reports a failed provider ping and a chain test", async () => {
    await open();
    fireEvent.click(screen.getByTestId("provider-item-gemini"));

    fireEvent.click(screen.getByTestId("ping-provider-button"));
    const ping = await screen.findByTestId("ping-result");
    expect(ping).toHaveTextContent("FAILED");
    expect(ping).toHaveTextContent("HTTP 401");

        fireEvent.click(screen.getByTestId("test-chain-button"));
    fireEvent.click(screen.getByText("Provider Routing"));
    const chain = await screen.findByTestId("chain-results");
    expect(within(chain).getByText(/OK - gemini/)).toBeInTheDocument();
  });

  it("surfaces a backend error instead of failing silently", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ detail: "keyring unavailable" }),
      })
    );

    render(
      <CaseProvider>
        <Harness />
      </CaseProvider>
    );
    fireEvent.click(screen.getByText("Open Providers"));

    expect(await screen.findByRole("alert")).toHaveTextContent("keyring unavailable");
  });
});
