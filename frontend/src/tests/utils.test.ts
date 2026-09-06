import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn utility", () => {
  it("merges basic class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("handles conditional classes correctly", () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn("btn", isActive && "btn-active", isDisabled && "btn-disabled")).toBe(
      "btn btn-active"
    );
  });

  it("resolves conflicting Tailwind utilities via tailwind-merge", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    expect(cn("bg-red-500 p-4", "bg-blue-500 p-2")).toBe("bg-blue-500 p-2");
  });

  it("handles null, undefined, boolean, and empty inputs gracefully", () => {
    expect(cn(null, undefined, false, "", "text-sm")).toBe("text-sm");
    expect(cn()).toBe("");
  });

  it("supports array and object class representations", () => {
    expect(cn(["font-bold", "text-center"], { "opacity-50": true, hidden: false })).toBe(
      "font-bold text-center opacity-50"
    );
  });
});
