import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CrossfireApiError,
  createCase,
  confirmCase,
  getCase,
  getStreamUrl,
} from "@/lib/api";
import { Case, ConfirmCaseResponse } from "@/types/crossfire";

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

  describe("getStreamUrl", () => {
    it("constructs encoded stream URL properly", () => {
      expect(getStreamUrl("case-123")).toBe("/cases/case-123/stream");
      expect(getStreamUrl("case/with/slashes", "http://localhost:8000")).toBe(
        "http://localhost:8000/cases/case%2Fwith%2Fslashes/stream"
      );
    });
  });
});
