import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  SerpApiIcon,
  PoweredBySerpApiBadge,
  SerpApiInlinePill,
  renderWithSerpApi,
  SerpApiText,
} from "@/components/ui/serpapi";

describe("SerpApi Branding Components", () => {
  describe("SerpApiIcon", () => {
    it("renders the official SerpApi SVG icon with accessibility attributes", () => {
      render(<SerpApiIcon size={24} data-testid="serpapi-icon" />);
      const svg = screen.getByTestId("serpapi-icon");
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute("role", "img");
      expect(svg).toHaveAttribute("aria-label", "SerpApi logo");
      expect(svg).toHaveAttribute("width", "24");
      expect(svg).toHaveAttribute("height", "24");
      expect(svg.querySelector("linearGradient")).toBeInTheDocument();
      expect(svg.querySelector("path")).toBeInTheDocument();
    });

    it("accepts custom className and applies default size", () => {
      render(<SerpApiIcon className="custom-serp-class" data-testid="serpapi-default" />);
      const svg = screen.getByTestId("serpapi-default");
      expect(svg).toHaveClass("custom-serp-class");
      expect(svg).toHaveAttribute("width", "16");
      expect(svg).toHaveAttribute("height", "16");
    });
  });

  describe("PoweredBySerpApiBadge", () => {
    it("renders hero variant with link to serpapi.com and proper attribution", () => {
      render(<PoweredBySerpApiBadge variant="hero" />);
      const link = screen.getByRole("link", { name: /Powered by SerpApi/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", expect.stringContaining("https://serpapi.com"));
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(screen.getByText("Real-time Web Grounding")).toBeInTheDocument();
    });

    it("renders banner variant with grounding explanation and about link", () => {
      render(<PoweredBySerpApiBadge variant="banner" />);
      expect(screen.getByText(/Evidence Grounding powered by SerpApi/i)).toBeInTheDocument();
      expect(screen.getByText(/Live Search API/i)).toBeInTheDocument();
      const aboutLink = screen.getByRole("link", { name: /About SerpApi/i });
      expect(aboutLink).toHaveAttribute("href", expect.stringContaining("https://serpapi.com"));
    });

    it("renders header variant with compact attribution pill", () => {
      render(<PoweredBySerpApiBadge variant="header" />);
      const headerPill = screen.getByRole("link", { name: /powered by SerpApi/i });
      expect(headerPill).toBeInTheDocument();
      expect(headerPill).toHaveAttribute("href", expect.stringContaining("https://serpapi.com"));
    });

    it("renders inline variant for evidence citations", () => {
      render(<PoweredBySerpApiBadge variant="inline" />);
      const inlinePill = screen.getByRole("link", { name: /via SerpApi/i });
      expect(inlinePill).toBeInTheDocument();
      expect(inlinePill).toHaveAttribute("href", expect.stringContaining("https://serpapi.com"));
    });
  });

  describe("SerpApiInlinePill", () => {
    it("renders inline pill with SerpApi logo and bold font without interactive tags", () => {
      render(<SerpApiInlinePill data-testid="serpapi-pill" />);
      const pill = screen.getByTestId("serpapi-pill");
      expect(pill).toBeInTheDocument();
      expect(pill.tagName.toLowerCase()).toBe("span");
      expect(pill).toHaveTextContent("SerpApi");
      expect(pill.querySelector("svg")).toBeInTheDocument();
      // Must not be a link or button so it does not intercept parent clicks
      expect(pill.closest("button")).toBeNull();
      expect(pill.closest("a")).toBeNull();
    });
  });

  describe("renderWithSerpApi and SerpApiText", () => {
    it("returns null or empty string for null/undefined/empty input", () => {
      expect(renderWithSerpApi(null)).toBeNull();
      expect(renderWithSerpApi(undefined)).toBeNull();
      expect(renderWithSerpApi("")).toBe("");
    });

    it("leaves string without serp/serpapi/serp api unchanged (including Serve API)", () => {
      const result = renderWithSerpApi("Regular Serve API text with no search engine reference");
      expect(result).toBe("Regular Serve API text with no search engine reference");
    });

    it("does not match unrelated words starting with serp like server or serpentine", () => {
      const result = renderWithSerpApi("Connecting to server host");
      expect(result).toBe("Connecting to server host");
    });

    it("replaces 'serp', 'serpapi', 'serp api' case-insensitively with SerpApiInlinePill", () => {
      render(
        <div data-testid="test-serp-variants">
          <SerpApiText text='Testing via SERP, confirmed with SerpApi and query via serp api' />
        </div>
      );
      const container = screen.getByTestId("test-serp-variants");
      const svgs = container.querySelectorAll("svg");
      expect(svgs.length).toBe(3);
      expect(container).toHaveTextContent("Testing via SerpApi, confirmed with SerpApi and query via SerpApi");
    });

    it("replaces standalone 'serp' in lowercase without touching non-serp words", () => {
      render(
        <div data-testid="test-standalone-serp">
          <SerpApiText text="Search provider: serp for claims" />
        </div>
      );
      const container = screen.getByTestId("test-standalone-serp");
      expect(container.querySelector("svg")).toBeInTheDocument();
      expect(container).toHaveTextContent("Search provider: SerpApi for claims");
    });
  });
});
