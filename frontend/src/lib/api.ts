import {
  Case,
  Claim,
  ConfirmCaseResponse,
  CreateCaseRequest,
  IngestImageRequest,
  IngestMarkdownRequest,
  IngestPdfRequest,
  IngestResponse,
  IngestUrlRequest,
} from "@/types/crossfire";

// Default API base points to /cases, which Vite proxies to http://localhost:8000/cases
// Can be overridden via VITE_API_BASE_URL (e.g. https://api.mydomain.com)
// If running on localhost, we force relative paths ("") to ensure local DB/backend is used instead of external Cloudflare deployment.
const getApiBase = () => {
  if (typeof window === "undefined") return "";
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "";
  }
  return (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "https://api.crossfire.stratizone.com";
};

const DEFAULT_API_BASE = getApiBase();

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
  agentMode?: "auto" | "custom",
  selectedAgents?: string[],
  baseUrl: string = DEFAULT_API_BASE
): Promise<Case> {
  const payload: CreateCaseRequest = {
    raw_input: rawInput,
    context: context || undefined,
    agent_mode: agentMode || undefined,
    selected_agents: selectedAgents || undefined,
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
  selectedAgents?: string[],
  baseUrl: string = DEFAULT_API_BASE
): Promise<ConfirmCaseResponse> {
  const url = `${baseUrl}/cases/${encodeURIComponent(caseId)}/confirm`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ claims, selected_agents: selectedAgents }),
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

export async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

export async function ingestPdf(
  fileOrBase64: File | Blob | string,
  claimStatement?: string | null,
  baseUrl: string = DEFAULT_API_BASE
): Promise<IngestResponse> {
  let base64: string;
  if (typeof fileOrBase64 === "string") {
    base64 = fileOrBase64.includes(",") ? fileOrBase64.split(",")[1] : fileOrBase64;
  } else {
    base64 = await fileToBase64(fileOrBase64);
  }

  const payload: IngestPdfRequest = {
    pdf_base64: base64,
    claim_statement: claimStatement || null,
  };

  const url = `${baseUrl}/ingest/pdf`;
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
      errorBody?.detail || `Failed to ingest PDF (${res.status})`,
      res.status,
      errorBody
    );
  }

  return (await res.json()) as IngestResponse;
}

export async function ingestImage(
  fileOrBase64: File | Blob | string,
  claimStatement?: string | null,
  baseUrl: string = DEFAULT_API_BASE
): Promise<IngestResponse> {
  let base64: string;
  if (typeof fileOrBase64 === "string") {
    base64 = fileOrBase64.includes(",") ? fileOrBase64.split(",")[1] : fileOrBase64;
  } else {
    base64 = await fileToBase64(fileOrBase64);
  }

  const payload: IngestImageRequest = {
    image_base64: base64,
    claim_statement: claimStatement || null,
  };

  const url = `${baseUrl}/ingest/image`;
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
      errorBody?.detail || `Failed to ingest image (${res.status})`,
      res.status,
      errorBody
    );
  }

  return (await res.json()) as IngestResponse;
}

export async function ingestUrl(
  targetUrl: string,
  claimStatement?: string | null,
  baseUrl: string = DEFAULT_API_BASE
): Promise<IngestResponse> {
  const payload: IngestUrlRequest = {
    url: targetUrl,
    claim_statement: claimStatement || null,
  };

  const url = `${baseUrl}/ingest/url`;
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
      errorBody?.detail || `Failed to ingest URL (${res.status})`,
      res.status,
      errorBody
    );
  }

  return (await res.json()) as IngestResponse;
}

export async function fileToText(file: File | Blob): Promise<string> {
  if (typeof (file as Blob).text === "function") {
    try {
      return await (file as Blob).text();
    } catch {
      // Fallback to FileReader if text() throws
    }
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || "");
    reader.onerror = (err) => reject(err);
    reader.readAsText(file);
  });
}

export async function ingestMarkdown(
  fileOrText: File | Blob | string,
  claimStatement?: string | null,
  baseUrl: string = DEFAULT_API_BASE
): Promise<IngestResponse> {
  let text: string;

  if (typeof fileOrText === "string") {
    text = fileOrText;
  } else {
    text = await fileToText(fileOrText);
  }

  const payload: IngestMarkdownRequest = {
    markdown_text: text,
    claim_statement: claimStatement || null,
  };

  const url = `${baseUrl}/ingest/markdown`;
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
      errorBody?.detail || `Failed to ingest Markdown (${res.status})`,
      res.status,
      errorBody
    );
  }

  return (await res.json()) as IngestResponse;
}

export interface HealthStatus {
  status: string;
  provider: string;
  model: string;
  llm_base_url?: string;
  backend_port?: number;
}

export async function getHealth(baseUrl: string = DEFAULT_API_BASE): Promise<HealthStatus> {
  const url = `${baseUrl}/health`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const errorBody =
      typeof res.json === "function" ? await res.json().catch(() => null) : null;
    throw new CrossfireApiError(
      errorBody?.detail || `Failed to fetch health (${res.status})`,
      res.status,
      errorBody
    );
  }

  return (await res.json()) as HealthStatus;
}

export async function retestClaim(
  caseId: string,
  claimId: string,
  action: "test_salvaged" | "counter_evidence" = "test_salvaged",
  counterEvidence?: string | null,
  baseUrl: string = DEFAULT_API_BASE
): Promise<Case> {
  const url = `${baseUrl}/cases/${encodeURIComponent(caseId)}/claims/${encodeURIComponent(claimId)}/retest`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action,
      counter_evidence: counterEvidence || null,
    }),
  });

  if (!res.ok) {
    const errorBody =
      typeof res.json === "function" ? await res.json().catch(() => null) : null;
    throw new CrossfireApiError(
      errorBody?.detail || `Failed to retest claim (${res.status})`,
      res.status,
      errorBody
    );
  }

  return (await res.json()) as Case;
}


