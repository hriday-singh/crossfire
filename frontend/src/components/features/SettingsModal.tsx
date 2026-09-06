import React, { useState } from "react";
import { useCase } from "@/context/CaseContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  BrandAnthropicClaude,
  BrandGoogleGemini,
  BrandOllama,
  BrandOpenAI,
} from "@/components/icons/BrandIcons";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose }) => {
  const { state, toggleMockMode, setPlaybackSpeed } = useCase();
  const [provider, setProvider] = useState("gemini");
  const [localUrl, setLocalUrl] = useState("http://localhost:8000");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Engine & Model Provider Settings
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure LLM inference providers, search verification engines, and mock simulation mode.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* Active Model Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-zinc-400 uppercase">
              Active LLM Provider
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setProvider("gemini")}
                className={`flex items-center gap-2 rounded-md border p-2.5 text-left text-xs transition-colors ${
                  provider === "gemini"
                    ? "border-blue-400 bg-blue-400/10 text-foreground font-medium"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                <BrandGoogleGemini size={18} className="text-blue-400 shrink-0" />
                <div className="truncate">
                  <div className="font-semibold text-foreground">Google Gemini</div>
                  <div className="text-[10px] text-zinc-500">2.5 Pro (Active)</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setProvider("claude")}
                className={`flex items-center gap-2 rounded-md border p-2.5 text-left text-xs transition-colors ${
                  provider === "claude"
                    ? "border-blue-400 bg-blue-400/10 text-foreground font-medium"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                <BrandAnthropicClaude size={18} className="text-amber-500 shrink-0" />
                <div className="truncate">
                  <div className="font-semibold text-foreground">Claude 3.7</div>
                  <div className="text-[10px] text-zinc-500">Anthropic</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setProvider("openai")}
                className={`flex items-center gap-2 rounded-md border p-2.5 text-left text-xs transition-colors ${
                  provider === "openai"
                    ? "border-blue-400 bg-blue-400/10 text-foreground font-medium"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                <BrandOpenAI size={18} className="text-emerald-400 shrink-0" />
                <div className="truncate">
                  <div className="font-semibold text-foreground">OpenAI GPT-4o</div>
                  <div className="text-[10px] text-zinc-500">Direct API</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setProvider("ollama")}
                className={`flex items-center gap-2 rounded-md border p-2.5 text-left text-xs transition-colors ${
                  provider === "ollama"
                    ? "border-blue-400 bg-blue-400/10 text-foreground font-medium"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                <BrandOllama size={18} className="text-zinc-300 shrink-0" />
                <div className="truncate">
                  <div className="font-semibold text-foreground">Local Ollama</div>
                  <div className="text-[10px] text-zinc-500">Offline / Self-hosted</div>
                </div>
              </button>
            </div>
          </div>

          {/* Backend API URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-zinc-400 uppercase">
              Crossfire Backend API Endpoint
            </label>
            <input
              type="text"
              value={localUrl}
              onChange={(e) => setLocalUrl(e.target.value)}
              className="w-full rounded-md border border-border bg-zinc-950 px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {provider === "ollama" && (
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-zinc-400 uppercase">
                Ollama Endpoint URL
              </label>
              <input
                type="text"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                className="w-full rounded-md border border-border bg-zinc-950 px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}

          {/* Search Verification Engine */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-zinc-400 uppercase">
              Search Verification Engine
            </label>
            <div className="flex items-center justify-between rounded-md border border-border bg-zinc-950 px-3.5 py-2 text-xs">
              <span className="font-medium text-foreground">Tavily Web Search API</span>
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-mono text-[11px]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Ready
              </span>
            </div>
          </div>

          {/* Mock Mode Toggle */}
          <div className="flex items-center justify-between rounded-md border border-border/70 bg-zinc-950/60 p-3">
            <div>
              <div className="text-xs font-semibold text-foreground">Mock Simulation Mode</div>
              <div className="text-[11px] text-muted-foreground">
                Run tests with simulated realistic data without backend dependencies
              </div>
            </div>
            <Button
              variant={state.isMockMode ? "default" : "outline"}
              size="sm"
              onClick={toggleMockMode}
              className="text-xs h-7 px-2.5"
            >
              {state.isMockMode ? "Enabled" : "Disabled"}
            </Button>
          </div>

          {/* Playback Speed */}
          {state.isMockMode && (
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-zinc-400 uppercase">
                Simulation Playback Speed
              </label>
              <div className="flex items-center gap-2">
                {[
                  { label: "Normal (1x)", val: 1 },
                  { label: "Fast (2x)", val: 2 },
                  { label: "Instant", val: 0 },
                ].map((sp) => (
                  <button
                    key={sp.val}
                    type="button"
                    onClick={() => setPlaybackSpeed(sp.val)}
                    className={`flex-1 rounded-md border py-1.5 text-center text-xs font-mono transition-colors ${
                      state.playbackSpeed === sp.val
                        ? "border-blue-400 bg-blue-400/15 text-blue-300 font-semibold"
                        : "border-border bg-zinc-950 text-zinc-400 hover:text-foreground"
                    }`}
                  >
                    {sp.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={onClose}>
            Save & Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
