import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MechanicalBlueprintRocket } from "@/components/ui/MechanicalBlueprintRocket";
import { RocketIllustration } from "@/components/ui/RocketIllustration";
import { RocketIntroAnimation } from "@/components/ui/RocketIntroAnimation";
import { EntryScreen } from "@/components/screens/EntryScreen";
import { CaseProvider } from "@/context/CaseContext";

describe("3D Mechanical Rocket Blueprint Linear Animation System", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("MechanicalBlueprintRocket", () => {
    it("renders 3D mechanical blueprint rocket without booster flame by default", () => {
      const { container } = render(<MechanicalBlueprintRocket isThrusting={false} />);
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute("viewBox", "0 0 540 260");
      // Check that flame is NOT present
      const flameGroup = container.querySelector(".blueprint-flame-group");
      expect(flameGroup).not.toBeInTheDocument();
      // Check CAD telemetry text elements
      expect(screen.getByText(/CAD STAGE-01/i)).toBeInTheDocument();
      expect(screen.getByText(/LOX TANK/i)).toBeInTheDocument();
      expect(screen.getByText(/RP-1 CELL/i)).toBeInTheDocument();
    });

    it("applies custom scale transform correctly", () => {
      const { container } = render(<MechanicalBlueprintRocket scale={1.5} />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.transform).toBe("scale(1.5)");
    });

    it("renders seamlessly through RocketIllustration wrapper without booster", () => {
      const { container } = render(<RocketIllustration isThrusting={false} />);
      expect(container.querySelector("svg")).toBeInTheDocument();
      expect(screen.getByText(/CAD STAGE-01/i)).toBeInTheDocument();
      expect(container.querySelector(".blueprint-flame-group")).not.toBeInTheDocument();
    });
  });

  describe("RocketIntroAnimation Orchestrator", () => {
    it("renders linear 3D mechanical blueprint container and skip button", () => {
      render(
        <RocketIntroAnimation
          onHeroReveal={vi.fn()}
          onComplete={vi.fn()}
          config={{ delay: 0.1, duration: 1.0 }}
        />
      );

      expect(screen.getByText(/Skip intro/i)).toBeInTheDocument();
    });

    it("handles skip button click immediately triggering reveal and complete", () => {
      const onHeroReveal = vi.fn();
      const onComplete = vi.fn();

      render(
        <RocketIntroAnimation
          onHeroReveal={onHeroReveal}
          onComplete={onComplete}
          config={{ delay: 0.5, duration: 2.0 }}
        />
      );

      const skipBtn = screen.getByText(/Skip intro/i);
      fireEvent.click(skipBtn);

      expect(onHeroReveal).toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalled();
    });

    it("handles Escape key shortcut to skip intro immediately", () => {
      const onHeroReveal = vi.fn();
      const onComplete = vi.fn();

      render(
        <RocketIntroAnimation
          onHeroReveal={onHeroReveal}
          onComplete={onComplete}
          config={{ delay: 0.5, duration: 2.0 }}
        />
      );

      fireEvent.keyDown(window, { key: "Escape" });

      expect(onHeroReveal).toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalled();
    });
  });

  describe("EntryScreen Opening Animation Integration", () => {
    it("renders EntryScreen with continuous background and interactive elements", () => {
      render(
        <CaseProvider>
          <EntryScreen />
        </CaseProvider>
      );

      expect(screen.getByRole("heading", { name: /What decision are you testing\?/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/customer support to a fine tuned LLM/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Test Decision/i })).toBeInTheDocument();
    });
  });
});
