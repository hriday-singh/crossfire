// Backup of FaqDrawer.tsx prior to formatting and header polish
import React, { useState, useMemo } from "react";
import { useCase } from "@/context/CaseContext";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { FAQ_ITEMS, FaqItem } from "@/lib/faqData";

export const FaqDrawer: React.FC = () => {
  const { state, setActiveModal } = useCase();
  const isOpen = state.activeModal === "faq";

  // Initially open the first item
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({
    "what-is-crossfire": true,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const categories = ["All", "Overview", "Architecture", "Comparisons"];

  const toggleItem = (id: string) => {
    setOpenIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredItems = useMemo(() => {
    return FAQ_ITEMS.filter((item) => {
      const matchesCategory =
        selectedCategory === "All" || item.category === selectedCategory;
      const query = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !query ||
        item.question.toLowerCase().includes(query) ||
        item.answer.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [searchQuery, selectedCategory]);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && setActiveModal("none")}>
      <SheetContent
        side="right"
        hideDefaultClose
        className="w-full sm:w-[680px] sm:max-w-full p-0 flex flex-col h-full bg-surface-container-low border-l border-outline-variant shadow-2xl text-on-surface select-text overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-space-4 pt-space-6 px-space-6 border-b border-outline-variant shrink-0 bg-surface-container-low">
          <div className="flex items-center gap-space-2.5">
            <span className="material-symbols-outlined text-primary-container text-[22px]">
              help
            </span>
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-normal">
                Frequently Asked Questions
              </h2>
              <p className="font-code-sm text-code-sm text-outline mt-0.5">
                How Crossfire stress-tests decisions independently
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveModal("none")}
            aria-label="Close FAQ drawer"
            className="text-outline hover:text-on-surface p-1.5 rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-space-4 border-b border-outline-variant/60 bg-surface-container-lowest flex flex-col gap-space-3 shrink-0">
          {/* Search Input */}
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search questions or keywords..."
              className="w-full bg-surface-container-low text-on-surface placeholder:text-outline font-body-sm text-body-sm pl-9 pr-8 py-2 rounded-lg border border-outline-variant/80 outline-none focus:border-primary-container transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface p-0.5 rounded cursor-pointer"
                aria-label="Clear search"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-space-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-space-2.5 py-1 rounded text-xs font-code-sm font-medium transition-colors cursor-pointer shrink-0 ${
                    isSelected
                      ? "bg-primary-container text-on-primary-container"
                      : "bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high border border-outline-variant/60"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* FAQ Items List (Accordion) */}
        <div className="flex-1 overflow-y-auto p-space-4 space-y-space-3">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-outline">
              <span className="material-symbols-outlined text-[32px] mb-2 opacity-60">
                search_off
              </span>
              <p className="font-body-md text-body-md">No questions found matching your search.</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("All");
                }}
                className="mt-3 text-xs font-code-sm text-primary underline cursor-pointer"
              >
                Reset filters
              </button>
            </div>
          ) : (
            filteredItems.map((item: FaqItem) => {
              const isExpanded = Boolean(openIds[item.id]);

              return (
                <div
                  key={item.id}
                  className={`border rounded-xl transition-colors duration-150 overflow-hidden ${
                    isExpanded
                      ? "bg-surface-container-lowest border-outline-variant shadow-xs"
                      : "bg-surface-container-low border-outline-variant/60 hover:border-outline-variant hover:bg-surface-container/60"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleItem(item.id)}
                    aria-expanded={isExpanded}
                    aria-controls={`faq-answer-${item.id}`}
                    className="w-full text-left p-space-4 flex items-start justify-between gap-space-3 cursor-pointer group"
                  >
                    <div className="flex flex-col gap-1.5 min-w-0 pr-1">
                      <div className="flex items-center gap-2">
                        <span className="font-code-sm text-[11px] px-1.5 py-0.5 rounded bg-surface-container border border-outline-variant/50 text-outline uppercase tracking-wider">
                          {item.category}
                        </span>
                      </div>
                      <span className="font-body-md text-body-md font-semibold text-on-surface group-hover:text-primary transition-colors leading-snug">
                        {item.question}
                      </span>
                    </div>

                    <span
                      className={`material-symbols-outlined text-[20px] text-outline group-hover:text-on-surface transition-transform duration-200 shrink-0 mt-1 ${
                        isExpanded ? "rotate-180 text-primary-container" : ""
                      }`}
                    >
                      expand_more
                    </span>
                  </button>

                  {isExpanded && (
                    <div
                      id={`faq-answer-${item.id}`}
                      role="region"
                      aria-labelledby={`faq-question-${item.id}`}
                      className="px-space-4 pb-space-4 pt-1 border-t border-outline-variant/40 animate-in fade-in-50 duration-150"
                    >
                      <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                        {item.answer}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-space-4 border-t border-outline-variant bg-surface-container-lowest flex items-center justify-between text-outline font-code-sm text-code-sm shrink-0">
          <span>Crossfire — Independent Decision Testing</span>
          <a
            href="https://github.com/hriday-singh/crossfire"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-on-surface transition-colors flex items-center gap-1"
          >
            <span>GitHub</span>
            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
};
