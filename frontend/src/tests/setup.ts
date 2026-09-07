import "@testing-library/jest-dom";
import { vi, beforeEach, beforeAll, afterAll } from "vitest";

const originalConsoleError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (typeof args[0] === 'string' && (
      args[0].includes('was not wrapped in act(') ||
      args[0].includes('React does not recognize the') ||
      args[0].includes('is using incorrect casing') ||
      args[0].includes('Invalid event handler property') ||
      args[0].includes('The tag <') ||
      args[0].includes('Cannot update a component (') ||
      args[0].includes('Invalid value for prop `draw`')
    )) {
      return;
    }
    originalConsoleError(...args);
  };
});

afterAll(() => {
  console.error = originalConsoleError;
});

HTMLCanvasElement.prototype.getContext = () => {
  return {} as any;
};

// Provide default fetch mock for component mounts in jsdom
beforeEach(() => {
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

  window.scrollTo = vi.fn();
});
