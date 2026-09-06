import { Case, Claim, ConfirmCaseResponse, CreateCaseRequest } from "@/types/crossfire";

// Default API base points to /cases, which Vite proxies to http://localhost:8000/cases
// Can be overridden via VITE_API_BASE_URL (e.g. http://localhost:8000)
const DEFAULT_API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "";

export class CrossfireApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "CrossfireApiError";
    this.status = status;
    this.data = data;
  }
}

export async function createCase(
  rawInput: string,
  context?: string | null,
  baseUrl: string = DEFAULT_API_BASE
): Promise<Case> {
  const payload: CreateCaseRequest = {
    raw_input: rawInput,
    context: context || undefined,
  };

  const url = `${baseUrl}/cases`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new CrossfireApiError(
      errorBody?.detail || `Failed to create case (${res.status})`,
      res.status,
      errorBody
    );
  }

  return (await res.json()) as Case;
}

export async function confirmCase(
  caseId: string,
  claims?: Claim[],
  baseUrl: string = DEFAULT_API_BASE
): Promise<ConfirmCaseResponse> {
  const url = `${baseUrl}/cases/${encodeURIComponent(caseId)}/confirm`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ claims }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new CrossfireApiError(
      errorBody?.detail || `Failed to confirm case (${res.status})`,
      res.status,
      errorBody
    );
  }

  return (await res.json()) as ConfirmCaseResponse;
}

export async function getCase(
  caseId: string,
  baseUrl: string = DEFAULT_API_BASE
): Promise<Case> {
  const url = `${baseUrl}/cases/${encodeURIComponent(caseId)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new CrossfireApiError(
      errorBody?.detail || `Failed to fetch case (${res.status})`,
      res.status,
      errorBody
    );
  }

  return (await res.json()) as Case;
}

export function getStreamUrl(caseId: string, baseUrl: string = DEFAULT_API_BASE): string {
  return `${baseUrl}/cases/${encodeURIComponent(caseId)}/stream`;
}
