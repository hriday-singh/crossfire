import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CrossfireApiError,
  createCase,
  confirmCase,
  getCase,
  listCases,
  getStreamUrl,
  ingestImage,
  ingestMarkdown,
  ingestPdf,
  ingestUrl,
  getHealth,
  fileToBase64,
} from "@/lib/api";
import { Case, ConfirmCaseResponse, IngestResponse } from "@/types/crossfire";

describe("api client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("CrossfireApiError", () => {
    it("sets message, status, and data correctly", () => {
      const err = new CrossfireApiError("Not found", 404, { detail: "Case missing" });
      expect(err.message).toBe("Not found");
      expect(err.status).toBe(404);
      expect(err.data).toEqual({ detail: "Case missing" });
      expect(err.name).toBe("CrossfireApiError");
      expect(err instanceof Error).toBe(true);
    });
  });

  describe("createCase", () => {
    it("sends POST request to /cases with payload and returns created Case", async () => {
      const mockCreated: Partial<Case> = {
        id: "case-100",
        raw_input: "Launch AI college counsellor",
        status: "extracting",
      };

      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCreated,
      });

      const res = await createCase("Launch AI college counsellor", "Context note");
      expect(fetch).toHaveBeenCalledWith(
        "/cases",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            raw_input: "Launch AI college counsellor",
            context: "Context note",
          }),
        })
      );
      expect(res).toEqual(mockCreated);
    });

    it("throws CrossfireApiError on non-ok response with detail message", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ detail: "raw_input cannot be empty" }),
      });

      await expect(createCase("")).rejects.toThrow("raw_input cannot be empty");
    });

    it("falls back to generic message if json parse fails on error", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("JSON error");
        },
      });

      await expect(createCase("sample")).rejects.toThrow("Failed to create case (500)");
    });
  });

  describe("confirmCase", () => {
    it("sends POST request to /cases/:id/confirm with claims and returns status", async () => {
      const mockResponse: ConfirmCaseResponse = {
        status: "testing",
        case_id: "case-100",
        message: "Case confirmed and pipeline initiated",
      };

      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const res = await confirmCase("case-100", [
        { id: "c-1", statement: "Claim 1", load_bearing: true, status: null },
      ]);

      expect(fetch).toHaveBeenCalledWith(
        "/cases/case-100/confirm",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            claims: [{ id: "c-1", statement: "Claim 1", load_bearing: true, status: null }],
          }),
        })
      );
      expect(res).toEqual(mockResponse);
    });

    it("throws CrossfireApiError when confirm fails", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ detail: "Case not found" }),
      });

      await expect(confirmCase("nonexistent")).rejects.toThrow("Case not found");
    });
  });

  describe("getCase", () => {
    it("sends GET request to /cases/:id and returns Case", async () => {
      const mockCase: Partial<Case> = { id: "case-200", status: "done" };

      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCase,
      });

      const res = await getCase("case-200");
      expect(fetch).toHaveBeenCalledWith(
        "/cases/case-200",
        expect.objectContaining({
          method: "GET",
          headers: { Accept: "application/json" },
        })
      );
      expect(res).toEqual(mockCase);
    });

    it("throws CrossfireApiError on fetch failure", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => null,
      });

      await expect(getCase("secret-case")).rejects.toThrow("Failed to fetch case (403)");
    });
  });

  describe("listCases", () => {
    it("sends GET request to /cases?status=done by default and returns cases", async () => {
      const mockCases: Partial<Case>[] = [
        { id: "case-1", status: "done" },
        { id: "case-2", status: "done" },
      ];

      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCases,
      });

      const res = await listCases();
      expect(fetch).toHaveBeenCalledWith(
        "/cases?status=done",
        expect.objectContaining({
          method: "GET",
          headers: { Accept: "application/json" },
        })
      );
      expect(res).toEqual(mockCases);
    });

    it("sends GET request with custom status when specified", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await listCases("all");
      expect(fetch).toHaveBeenCalledWith(
        "/cases?status=all",
        expect.anything()
      );
    });

    it("throws CrossfireApiError on fetch failure", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ detail: "Database error" }),
      });

      await expect(listCases()).rejects.toThrow("Database error");
    });
  });

  describe("getStreamUrl", () => {
    it("constructs encoded stream URL properly", () => {
      expect(getStreamUrl("case-123")).toBe("/cases/case-123/stream");
      expect(getStreamUrl("case/with/slashes", "http://localhost:8000")).toBe(
        "http://localhost:8000/cases/case%2Fwith%2Fslashes/stream"
      );
    });
  });

  describe("fileToBase64", () => {
    it("converts Blob/File to raw base64 string", async () => {
      const blob = new Blob(["Hello PDF content"], { type: "application/pdf" });
      const b64 = await fileToBase64(blob);
      expect(typeof b64).toBe("string");
      expect(b64.length).toBeGreaterThan(0);
      // Verify decoded content equals original
      const decoded = atob(b64);
      expect(decoded).toBe("Hello PDF content");
    });
  });

  describe("ingestPdf", () => {
    it("posts base64 PDF payload to /ingest/pdf and returns IngestResponse", async () => {
      const mockResponse: IngestResponse = {
        context: "Extracted and curated context from PDF document",
        character_count: 48,
      };

      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const res = await ingestPdf("SGVsbG8gUERGCg==", "Focus claim statement");
      expect(fetch).toHaveBeenCalledWith(
        "/ingest/pdf",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pdf_base64: "SGVsbG8gUERGCg==",
            claim_statement: "Focus claim statement",
          }),
        })
      );
      expect(res).toEqual(mockResponse);
    });

    it("accepts a File object and encodes it automatically", async () => {
      const mockResponse: IngestResponse = {
        context: "Extracted file context",
        character_count: 22,
      };

      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const file = new File(["dummy pdf data"], "memo.pdf", { type: "application/pdf" });
      const res = await ingestPdf(file);
      expect(res).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        "/ingest/pdf",
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("throws CrossfireApiError on non-ok status like scanned PDF", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          detail: "Scanned or image-only PDF detected: no extractable text found.",
        }),
      });

      await expect(ingestPdf("dummy-base64")).rejects.toThrow(
        "Scanned or image-only PDF detected: no extractable text found."
      );
    });
  });

  describe("ingestUrl", () => {
    it("posts URL to /ingest/url and returns IngestResponse", async () => {
      const mockResponse: IngestResponse = {
        context: "Curated article text from target website",
        character_count: 41,
      };

      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const res = await ingestUrl("https://example.com/article", "Target claim");
      expect(fetch).toHaveBeenCalledWith(
        "/ingest/url",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: "https://example.com/article",
            claim_statement: "Target claim",
          }),
        })
      );
      expect(res).toEqual(mockResponse);
    });

    it("throws CrossfireApiError if SERP URL is rejected", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          detail: "Direct search engine results page ingestion is disallowed.",
        }),
      });

      await expect(ingestUrl("https://google.com/search?q=test")).rejects.toThrow(
        "Direct search engine results page ingestion is disallowed."
      );
    });
  });

  describe("ingestImage", () => {
    it("posts base64 image payload to /ingest/image and returns IngestResponse", async () => {
      const mockResponse: IngestResponse = {
        context: "Extracted and curated context from screenshot image",
        character_count: 50,
      };

      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const res = await ingestImage("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "Focus claim");
      expect(fetch).toHaveBeenCalledWith(
        "/ingest/image",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
            claim_statement: "Focus claim",
          }),
        })
      );
      expect(res).toEqual(mockResponse);
    });

    it("accepts a File object and encodes it automatically", async () => {
      const mockResponse: IngestResponse = {
        context: "Extracted screenshot context",
        character_count: 28,
      };

      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const file = new File(["dummy image png data"], "screenshot.png", { type: "image/png" });
      const res = await ingestImage(file);
      expect(res).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        "/ingest/image",
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("throws CrossfireApiError on non-ok status like no extractable text", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          detail: "No extractable text found in image: OCR detected no text.",
        }),
      });

      await expect(ingestImage("dummy-base64")).rejects.toThrow(
        "No extractable text found in image: OCR detected no text."
      );
    });
  });

  describe("ingestMarkdown", () => {
    it("posts string markdown payload to /ingest/markdown and returns IngestResponse", async () => {
      const mockResponse: IngestResponse = {
        context: "Extracted and curated context from markdown",
        character_count: 42,
      };

      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const res = await ingestMarkdown("# Title\n\nContent here", "Test claim");
      expect(fetch).toHaveBeenCalledWith(
        "/ingest/markdown",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            markdown_text: "# Title\n\nContent here",
            claim_statement: "Test claim",
          }),
        })
      );
      expect(res).toEqual(mockResponse);
    });

    it("accepts a File object and extracts text directly", async () => {
      const mockResponse: IngestResponse = {
        context: "Extracted notes",
        character_count: 15,
      };

      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const file = new File(["# My Markdown Notes"], "notes.md", { type: "text/markdown" });
      const res = await ingestMarkdown(file);
      expect(fetch).toHaveBeenCalledWith(
        "/ingest/markdown",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            markdown_text: "# My Markdown Notes",
            claim_statement: null,
          }),
        })
      );
      expect(res).toEqual(mockResponse);
    });

    it("throws CrossfireApiError on non-ok status", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ detail: "Empty Markdown document with no text content." }),
      });

      await expect(ingestMarkdown("")).rejects.toThrow("Empty Markdown document with no text content.");
    });
  });

  describe("getHealth", () => {
    it("fetches backend health and returns provider and model information", async () => {
      const mockHealth = {
        status: "ok",
        provider: "openai_compat",
        model: "gemini-3.7-flash",
      };

      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockHealth,
      });

      const res = await getHealth();
      expect(fetch).toHaveBeenCalledWith(
        "/health",
        expect.objectContaining({
          method: "GET",
        })
      );
      expect(res).toEqual(mockHealth);
    });

    it("throws CrossfireApiError on failure", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      await expect(getHealth()).rejects.toThrow("Failed to fetch health (503)");
    });
  });
});
