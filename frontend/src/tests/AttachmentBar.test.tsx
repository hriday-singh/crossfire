import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AttachmentBar, EntryAttachment } from "@/components/features/AttachmentBar";

describe("AttachmentBar Component", () => {
  it("renders null when attachments list is empty", () => {
    const { container } = render(
      <AttachmentBar attachments={[]} onRemoveAttachment={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders 1 and 2 attachments as individual compact pills without overflow badge", () => {
    const attachments: EntryAttachment[] = [
      { id: "1", type: "url", name: "stripe.com", url: "https://stripe.com" },
      { id: "2", type: "file", name: "report.pdf", charCount: 1500 },
    ];

    render(
      <AttachmentBar attachments={attachments} onRemoveAttachment={vi.fn()} />
    );

    expect(screen.getByTestId("attachment-bar")).toBeInTheDocument();
    expect(screen.getByText("stripe.com")).toBeInTheDocument();
    expect(screen.getByText("report.pdf")).toBeInTheDocument();
    expect(screen.getByText("(1,500c)")).toBeInTheDocument();
    expect(screen.queryByTestId("attachment-overflow-pill")).not.toBeInTheDocument();
  });

  it("renders first 2 items and a compact '+1' overflow badge when 3 items are present", () => {
    const attachments: EntryAttachment[] = [
      { id: "1", type: "url", name: "github.com", url: "https://github.com" },
      { id: "2", type: "url", name: "nytimes.com", url: "https://nytimes.com" },
      { id: "3", type: "text_blob", name: "Context Snippet #1", context: "Additional detail", charCount: 17 },
    ];

    render(
      <AttachmentBar attachments={attachments} onRemoveAttachment={vi.fn()} />
    );

    expect(screen.getByText("github.com")).toBeInTheDocument();
    expect(screen.getByText("nytimes.com")).toBeInTheDocument();
    expect(screen.queryByText("Context Snippet #1")).not.toBeInTheDocument();

    const overflowPill = screen.getByTestId("attachment-overflow-pill");
    expect(overflowPill).toBeInTheDocument();
    expect(overflowPill).toHaveTextContent("+1");
  });

  it("expands all items when clicking '+N' overflow badge, and compacts back", () => {
    const attachments: EntryAttachment[] = [
      { id: "1", type: "url", name: "github.com" },
      { id: "2", type: "url", name: "nytimes.com" },
      { id: "3", type: "url", name: "stripe.com" },
      { id: "4", type: "text_blob", name: "Context Snippet #1", context: "Extra" },
    ];

    render(
      <AttachmentBar attachments={attachments} onRemoveAttachment={vi.fn()} />
    );

    const overflowPill = screen.getByTestId("attachment-overflow-pill");
    expect(overflowPill).toHaveTextContent("+2");

    // Click to expand all
    fireEvent.click(overflowPill);
    expect(screen.getByText("stripe.com")).toBeInTheDocument();
    expect(screen.getByText("Context Snippet #1")).toBeInTheDocument();

    // Click compact
    const compactBtn = screen.getByText("Compact");
    fireEvent.click(compactBtn);
    expect(screen.queryByText("stripe.com")).not.toBeInTheDocument();
    expect(screen.getByTestId("attachment-overflow-pill")).toHaveTextContent("+2");
  });

  it("calls onRemoveAttachment when remove button is clicked", () => {
    const handleRemove = vi.fn();
    const attachments: EntryAttachment[] = [
      { id: "url-1", type: "url", name: "techcrunch.com" },
    ];

    render(
      <AttachmentBar attachments={attachments} onRemoveAttachment={handleRemove} />
    );

    const removeBtn = screen.getByLabelText("Remove attachment techcrunch.com");
    fireEvent.click(removeBtn);
    expect(handleRemove).toHaveBeenCalledWith("url-1");
  });

  it("opens and closes text blob preview dialog when clicking a text blob pill", () => {
    const attachments: EntryAttachment[] = [
      {
        id: "blob-1",
        type: "text_blob",
        name: "Context Snippet #1",
        context: "This is the full background text for the decision.",
        charCount: 50,
      },
    ];

    render(
      <AttachmentBar attachments={attachments} onRemoveAttachment={vi.fn()} />
    );

    // Click the snippet name to preview
    const snippetBtn = screen.getByText("Context Snippet #1");
    fireEvent.click(snippetBtn);

    // Modal dialog should open
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByText("This is the full background text for the decision.")
    ).toBeInTheDocument();
    expect(screen.getByText("50 characters")).toBeInTheDocument();

    // Close via Done button
    const doneBtn = screen.getByRole("button", { name: "Done" });
    fireEvent.click(doneBtn);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
