import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SerpApiIcon, PoweredBySerpApiBadge } from "@/components/ui/serpapi";

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
});
