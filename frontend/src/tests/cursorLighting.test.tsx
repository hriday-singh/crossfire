import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { CursorLighting } from "../components/ui/CursorLighting";
import { StageContainer } from "../components/canvas/StageContainer";
import { SettingsModal } from "../components/features/SettingsModal";
import { CaseProvider, useCase } from "../context/CaseContext";

// Mock matchMedia & PointerEvent for jsdom
beforeEach(() => {
  localStorage.clear();
  if (typeof window.PointerEvent === "undefined") {
    // @ts-ignore
    window.PointerEvent = window.MouseEvent;
  }
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe("Cursor Lighting & Reticle Animation System", () => {
  it("renders the cursor spotlight, reticle and shockwave elements", () => {
    render(<CursorLighting />);

    const container = screen.getByTestId("cursor-lighting-container");
    const spotlight = screen.getByTestId("cursor-spotlight");
    const reticle = screen.getByTestId("cursor-reticle");
    const shockwave = screen.getByTestId("cursor-shockwave");

    expect(container).toBeInTheDocument();
    expect(spotlight).toBeInTheDocument();
    expect(reticle).toBeInTheDocument();
    expect(shockwave).toBeInTheDocument();
  });

  it("becomes visible on pointermove and updates position coordinates", () => {
    render(<CursorLighting />);

    const container = screen.getByTestId("cursor-lighting-container");
    expect(container).toHaveClass("opacity-0");

    act(() => {
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          clientX: 300,
          clientY: 400,
          bubbles: true,
        })
      );
    });

    expect(container).toHaveClass("opacity-100");
  });

  it("responds to pointerdown with shockwave animation", () => {
    render(<CursorLighting />);

    const shockwave = screen.getByTestId("cursor-shockwave");
    expect(shockwave).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(
        new PointerEvent("pointerdown", {
          clientX: 150,
          clientY: 250,
          bubbles: true,
        })
      );
    });

    // Shockwave receives transform at clientX, clientY
    expect(shockwave.style.transform).toContain("150px");
    expect(shockwave.style.transform).toContain("250px");
  });

  it("reacts dynamically when hovering over an interactive button", () => {
    render(
      <div>
        <CursorLighting />
        <button type="button" data-testid="test-btn">
          Test Button
        </button>
      </div>
    );

    const btn = screen.getByTestId("test-btn");
    const spotlight = screen.getByTestId("cursor-spotlight");

    act(() => {
      btn.dispatchEvent(
        new PointerEvent("pointermove", {
          clientX: 100,
          clientY: 100,
          bubbles: true,
        })
      );
    });

    // Spotlight brightness increases on hover
    expect(spotlight.style.filter).toBe("brightness(1.25)");
  });

  it("adapts hue when hovering over an agent element", () => {
    render(
      <div>
        <CursorLighting />
        <div data-agent="devils_advocate" data-testid="devil-card">
          Devil Advocate Area
        </div>
      </div>
    );

    const devilCard = screen.getByTestId("devil-card");
    const spotlight = screen.getByTestId("cursor-spotlight");

    act(() => {
      devilCard.dispatchEvent(
        new PointerEvent("pointermove", {
          clientX: 200,
          clientY: 200,
          bubbles: true,
        })
      );
    });

    // Should adapt spotlight background to crimson red (#f87171 / rgba(248, 113, 113))
    expect(spotlight.style.background).toContain("248, 113, 113");
  });

  it("fades out when mouse leaves the document window", () => {
    render(<CursorLighting />);

    const container = screen.getByTestId("cursor-lighting-container");

    act(() => {
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          clientX: 100,
          clientY: 100,
          bubbles: true,
        })
      );
    });
    expect(container).toHaveClass("opacity-100");

    act(() => {
      document.documentElement.dispatchEvent(new MouseEvent("mouseleave"));
    });
    expect(container).toHaveClass("opacity-0");
  });

  it("does not render when disabled via localStorage or hook", () => {
    localStorage.setItem("crossfire_cursor_lighting", "false");

    const { queryByTestId } = render(<CursorLighting />);
    expect(queryByTestId("cursor-lighting-container")).toBeNull();
  });
});

describe("StageContainer In-World Cursor Lighting", () => {
  it("renders stage-cursor-lighting element and responds to pointer events", () => {
    render(<StageContainer agents={[]} characterPositions={{}} />);

    const stageLight = screen.getByTestId("stage-cursor-lighting");
    expect(stageLight).toBeInTheDocument();
    expect(stageLight).toHaveClass("opacity-0");

    // Move pointer over stage container
    const stageDiv = stageLight.parentElement!;
    fireEvent.pointerMove(stageDiv, { clientX: 200, clientY: 150 });

    expect(stageLight).toHaveClass("opacity-100");

    // Leave pointer
    fireEvent.pointerLeave(stageDiv);
    expect(stageLight).toHaveClass("opacity-0");
  });
});

describe("SettingsModal Cursor Lighting Toggle", () => {
  it("allows toggling cursor lighting setting on and off", () => {
    const Consumer = () => {
      const { setActiveModal } = useCase();
      return (
        <div>
          <button onClick={() => setActiveModal("settings")}>Open Settings</button>
          <SettingsModal />
        </div>
      );
    };

    render(<Consumer />, {
      wrapper: ({ children }) => <CaseProvider>{children}</CaseProvider>,
    });

    fireEvent.click(screen.getByText("Open Settings"));

    const toggle = screen.getByTestId("cursor-lighting-toggle");
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-checked", "true");

    // Click to toggle off
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(localStorage.getItem("crossfire_cursor_lighting")).toBe("false");

    // Click to toggle back on
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(localStorage.getItem("crossfire_cursor_lighting")).toBe("true");
  });
});
