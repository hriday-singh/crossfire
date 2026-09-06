import "@testing-library/jest-dom";
import { vi, beforeEach } from "vitest";

// Provide default fetch mock for component mounts in jsdom
beforeEach(() => {
  if (!globalThis.fetch || !(globalThis.fetch as any).mock) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (typeof url === "string" && url.includes("/health")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              status: "ok",
              provider: "openai_compat",
              model: "gemini-3.7-flash",
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      })
    );
  }

  window.scrollTo = vi.fn();
});
