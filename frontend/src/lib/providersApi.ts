/**
 * Client for the backend provider/key management API (backend/api/provider_routes.py).
 *
 * Raw API keys only ever travel outbound — responses carry masked hints.
 */
import { API_BASE, CrossfireApiError } from "@/lib/api";

export interface ProviderKey {
  id: number;
  provider: string;
  label: string;
  /** Masked credential, e.g. "AIza...9f2c". */
  hint: string;
  enabled: boolean;
}

export interface ProviderInfo {
  id: string;
  label: string;
  requires_key: boolean;
  editable_base_url: boolean;
  base_url: string;
  model: string;
  models: string[];
  /** Models this provider may run, in fallback order. The primary is first. */
  enabled_models: string[];
  rpm: number;
  key_count: number;
  configured: boolean;
  notes: string;
  /** User-added endpoint — safe to offer a delete button. */
  removable: boolean;
}

export interface ProvidersResponse {
  active: string;
  fallback_chain: string[];
  providers: ProviderInfo[];
  /** Provider the pipeline actually runs on right now, whatever `active` says. */
  locked_provider?: string;
}

export interface ProviderConfigPatch {
  model?: string | null;
  base_url?: string | null;
  rpm?: number | null;
}

export interface CreateCustomProviderRequest {
  name: string;
  base_url: string;
  model: string;
  api_key?: string | null;
  rpm?: number;
}

export interface ProviderTestResult {
  ok: boolean;
  provider: string;
  model: string;
  detail: string;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  baseUrl: string = API_BASE
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new CrossfireApiError(
      errorBody?.detail || `Provider request failed (${res.status})`,
      res.status,
      errorBody
    );
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Provider id in a URL path — custom ids contain a colon. */
const seg = (providerId: string) => encodeURIComponent(providerId);

export function listProviders(baseUrl?: string): Promise<ProvidersResponse> {
  return request<ProvidersResponse>("/providers", { method: "GET" }, baseUrl);
}

export function setActiveProvider(
  provider: string,
  patch: ProviderConfigPatch = {},
  baseUrl?: string
): Promise<ProvidersResponse> {
  return request<ProvidersResponse>(
    "/providers/active",
    { method: "PUT", body: JSON.stringify({ provider, ...patch }) },
    baseUrl
  );
}

export function setFallbackChain(
  chain: string[],
  baseUrl?: string
): Promise<ProvidersResponse> {
  return request<ProvidersResponse>(
    "/providers/fallback",
    { method: "PUT", body: JSON.stringify({ chain }) },
    baseUrl
  );
}

export function setProviderConfig(
  providerId: string,
  patch: ProviderConfigPatch,
  baseUrl?: string
): Promise<ProviderInfo> {
  return request<ProviderInfo>(
    `/providers/${seg(providerId)}/config`,
    { method: "PUT", body: JSON.stringify(patch) },
    baseUrl
  );
}

/** Enable/disable models and set the order they are tried in. */
export function setEnabledModels(
  providerId: string,
  models: string[],
  baseUrl?: string
): Promise<ProviderInfo> {
  return request<ProviderInfo>(
    `/providers/${seg(providerId)}/models`,
    { method: "PUT", body: JSON.stringify({ models }) },
    baseUrl
  );
}

export function createCustomProvider(
  payload: CreateCustomProviderRequest,
  baseUrl?: string
): Promise<ProviderInfo> {
  return request<ProviderInfo>(
    "/providers/custom",
    { method: "POST", body: JSON.stringify({ rpm: 0, ...payload }) },
    baseUrl
  );
}

export function deleteProvider(providerId: string, baseUrl?: string): Promise<void> {
  return request<void>(`/providers/${seg(providerId)}`, { method: "DELETE" }, baseUrl);
}

export function listProviderKeys(
  providerId: string,
  baseUrl?: string
): Promise<ProviderKey[]> {
  return request<ProviderKey[]>(`/providers/${seg(providerId)}/keys`, { method: "GET" }, baseUrl);
}

export function addProviderKey(
  providerId: string,
  apiKey: string,
  label = "",
  baseUrl?: string
): Promise<ProviderKey> {
  return request<ProviderKey>(
    `/providers/${seg(providerId)}/keys`,
    { method: "POST", body: JSON.stringify({ api_key: apiKey, label }) },
    baseUrl
  );
}

export function setKeyEnabled(
  keyId: number,
  enabled: boolean,
  baseUrl?: string
): Promise<ProviderKey[]> {
  return request<ProviderKey[]>(
    `/providers/keys/${keyId}`,
    { method: "PATCH", body: JSON.stringify({ enabled }) },
    baseUrl
  );
}

export function deleteProviderKey(keyId: number, baseUrl?: string): Promise<void> {
  return request<void>(`/providers/keys/${keyId}`, { method: "DELETE" }, baseUrl);
}

export function testProvider(
  providerId: string,
  payload: ProviderConfigPatch & { api_key?: string | null } = {},
  baseUrl?: string
): Promise<ProviderTestResult> {
  return request<ProviderTestResult>(
    `/providers/${seg(providerId)}/test`,
    { method: "POST", body: JSON.stringify(payload) },
    baseUrl
  );
}

export function testChain(baseUrl?: string): Promise<ProviderTestResult[]> {
  return request<ProviderTestResult[]>("/providers/test", { method: "POST" }, baseUrl);
}

export function listOllamaModels(baseUrl?: string): Promise<string[]> {
  return request<{ models: string[] }>("/providers/ollama/models", { method: "GET" }, baseUrl).then(
    (data) => data.models || []
  );
}
