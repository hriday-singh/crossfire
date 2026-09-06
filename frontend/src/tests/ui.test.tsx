import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

describe("UI Primitives", () => {
  describe("Button", () => {
    it("renders default button and handles click event", () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click Me</Button>);

      const btn = screen.getByRole("button", { name: "Click Me" });
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("applies variant classes correctly", () => {
      const { rerender } = render(<Button variant="destructive">Delete</Button>);
      expect(screen.getByRole("button")).toHaveClass("bg-rose-950/40");

      rerender(<Button variant="outline">Cancel</Button>);
      expect(screen.getByRole("button")).toHaveClass("border");

      rerender(<Button variant="ghost">Ghost</Button>);
      expect(screen.getByRole("button")).toHaveClass("hover:bg-zinc-800/60");
    });

    it("handles disabled state", () => {
      const handleClick = vi.fn();
      render(<Button disabled onClick={handleClick}>Disabled</Button>);

      const btn = screen.getByRole("button", { name: "Disabled" });
      expect(btn).toBeDisabled();
      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe("Badge", () => {
    it("renders badges with semantic status variants", () => {
      const { rerender } = render(<Badge variant="survived">Survived</Badge>);
      expect(screen.getByText("Survived")).toHaveClass("text-emerald-400");

      rerender(<Badge variant="broken">Broken</Badge>);
      expect(screen.getByText("Broken")).toHaveClass("text-rose-400");

      rerender(<Badge variant="weakened">Weakened</Badge>);
      expect(screen.getByText("Weakened")).toHaveClass("text-amber-400");

      rerender(<Badge variant="unresolved">Unresolved</Badge>);
      expect(screen.getByText("Unresolved")).toHaveClass("text-purple-400");
    });
  });

  describe("Alert", () => {
    it("renders alert role and slots title and description", () => {
      render(
        <Alert variant="destructive">
          <AlertTitle>Warning Title</AlertTitle>
          <AlertDescription>Alert description content</AlertDescription>
        </Alert>
      );

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Warning Title")).toBeInTheDocument();
      expect(screen.getByText("Alert description content")).toBeInTheDocument();
    });
  });

  describe("Card", () => {
    it("renders card hierarchy with title and content", () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Card Heading</CardTitle>
          </CardHeader>
          <CardContent>Body of the card</CardContent>
        </Card>
      );

      expect(screen.getByText("Card Heading")).toBeInTheDocument();
      expect(screen.getByText("Body of the card")).toBeInTheDocument();
    });
  });
});
