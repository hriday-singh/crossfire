import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent } from "@/components/ui/sheet";

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

      rerender(<Button variant="primary">Submit</Button>);
      expect(screen.getByRole("button")).toHaveClass("bg-primary-container", "hover:bg-blue-600", "text-white");

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
      expect(screen.getByText("Unresolved")).toHaveClass("text-indigo-400");
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

  describe("Sheet", () => {
    it("renders close button by default and omits it when hideDefaultClose is true", () => {
      const { rerender } = render(
        <Sheet open>
          <SheetContent>
            <div>Drawer content</div>
          </SheetContent>
        </Sheet>
      );
      expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();

      rerender(
        <Sheet open>
          <SheetContent hideDefaultClose>
            <div>Drawer content</div>
          </SheetContent>
        </Sheet>
      );
      expect(screen.queryByRole("button", { name: /close/i })).not.toBeInTheDocument();
    });
  });

  describe("DropdownMenu", () => {
    it("renders trigger, opens menu on click, selects item, and closes on Escape", async () => {
      const { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } = await import(
        "@/components/ui/dropdown-menu"
      );
      const handleSelect = vi.fn();

      render(
        <DropdownMenu>
          <DropdownMenuTrigger>
            <span>Open Menu</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => handleSelect("opt-1")}>
              Option 1
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleSelect("opt-2")}>
              Option 2
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      const trigger = screen.getByRole("button", { name: /open menu/i });
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();

      // Click to open
      fireEvent.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByRole("menu")).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: /option 1/i })).toBeInTheDocument();

      // Select option 1
      fireEvent.click(screen.getByRole("menuitem", { name: /option 1/i }));
      expect(handleSelect).toHaveBeenCalledWith("opt-1");
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();

      // Open again and close on Escape
      fireEvent.click(trigger);
      expect(screen.getByRole("menu")).toBeInTheDocument();
      fireEvent.keyDown(window, { key: "Escape" });
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });
});
