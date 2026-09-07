import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useCase } from "@/context/CaseContext";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ProviderIcon } from "@/components/ui/providerIcons";
import { ArrowDown, ArrowUp, Check, Layers, Plus, X } from "lucide-react";
import {
  ProviderKey,
  ProviderTestResult,
  ProvidersResponse,
  addProviderKey,
  createCustomProvider,
  deleteProvider,
  deleteProviderKey,
  listOllamaModels,
  listProviderKeys,
  listProviders,
  setActiveProvider,
  setFallbackChain,
  setKeyEnabled,
  setProviderConfig,
  testChain,
  testProvider,
} from "@/lib/providersApi";

const SECTION_LABEL =
  "font-label-mono text-label-mono uppercase tracking-wider text-outline font-semibold";
const CARD = "bg-surface-container border border-outline-variant/60 rounded-lg p-space-4";
const INPUT =
  "w-full bg-surface-container-low border border-outline-variant/60 rounded px-space-3 py-2 font-code-sm text-code-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary-container/70 disabled:opacity-50";
const BTN =
  "font-code-sm text-code-sm px-space-3 py-1.5 rounded border border-outline-variant/60 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-40 cursor-pointer";
const BTN_PRIMARY =
  "font-code-sm text-code-sm px-space-3 py-1.5 rounded bg-primary-container text-on-primary-container font-medium hover:brightness-110 transition-all disabled:opacity-40 cursor-pointer";
const BTN_DANGER =
  "font-code-sm text-code-sm px-space-3 py-1.5 rounded border border-error/40 text-error hover:bg-error/10 transition-colors disabled:opacity-40 cursor-pointer";

/** Chain position of a provider, for the badge in the rail. */
function chainRole(id: string, data: ProvidersResponse | null): string | null {
  if (!data) return null;
  if (data.active === id) return "ACTIVE";
  const index = (data.fallback_chain || []).indexOf(id);
  return index >= 0 ? `FB ${index + 1}` : null;
}

export const ProvidersModal: React.FC = () => {
  const { state, setActiveModal } = useCase();
  const isOpen = state.activeModal === "providers";

  const [data, setData] = useState<ProvidersResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [keys, setKeys] = useState<ProviderKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // drafts for the detail pane
  const [modelDraft, setModelDraft] = useState("");
  const [baseUrlDraft, setBaseUrlDraft] = useState("");
  const [rpmDraft, setRpmDraft] = useState("0");
  const [keyDraft, setKeyDraft] = useState("");
  const [keyLabelDraft, setKeyLabelDraft] = useState("");
  const [discovered, setDiscovered] = useState<string[]>([]);

  const [pingResult, setPingResult] = useState<ProviderTestResult | null>(null);
  const [chainResults, setChainResults] = useState<ProviderTestResult[] | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newEndpoint, setNewEndpoint] = useState({ name: "", base_url: "", model: "", api_key: "" });

  const providers = data?.providers || [];
  const selected = useMemo(
    () => providers.find((p) => p.id === selectedId) || null,
    [providers, selectedId]
  );

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 3000);
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await listProviders();
      setData(next);
      setSelectedId((current) => {
        const list = next.providers || [];
        if (current && list.some((p) => p.id === current)) return current;
        return next.active || list[0]?.id || null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load providers");
    } finally {
      setLoading(false);
    }
  }, []);

  /** Any mutation: run it, surface failures, then re-read the server's truth. */
  const run = async (action: () => Promise<unknown>, successMessage: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refresh();
      flash(successMessage);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      return false;
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (isOpen) void refresh();
  }, [isOpen, refresh]);

  // Reset the detail drafts whenever the selection (or its saved config) changes.
  useEffect(() => {
    if (!selected) return;
    setModelDraft(selected.model || "");
    setBaseUrlDraft(selected.base_url || "");
    setRpmDraft(String(selected.rpm ?? 0));
    setPingResult(null);
    setDiscovered([]);
  }, [selected?.id, selected?.model, selected?.base_url, selected?.rpm]);

  useEffect(() => {
    let cancelled = false;
    if (!isOpen || !selectedId) {
      setKeys([]);
      return;
    }
    listProviderKeys(selectedId)
      .then((list) => !cancelled && setKeys(list || []))
      .catch(() => !cancelled && setKeys([]));
    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedId, data]);

  const inFallback = selected ? (data?.fallback_chain || []).includes(selected.id) : false;
  const isActive = selected ? data?.active === selected.id : false;

  const moveInChain = (index: number, delta: number) => {
    const chain = [...(data?.fallback_chain || [])];
    const target = index + delta;
    if (target < 0 || target >= chain.length) return;
    [chain[index], chain[target]] = [chain[target], chain[index]];
    void run(() => setFallbackChain(chain), "Fallback priority updated");
  };

  const removeFromChain = (id: string) => {
    const chain = (data?.fallback_chain || []).filter((entry) => entry !== id);
    void run(() => setFallbackChain(chain), `${id} removed from fallback chain`);
  };

  const addToChain = (id: string) => {
    const chain = [...(data?.fallback_chain || []), id];
    void run(() => setFallbackChain(chain), `${id} added as fallback #${chain.length}`);
  };

  const modelOptions = useMemo(() => {
    if (!selected) return [];
    return Array.from(new Set([...(selected.models || []), ...discovered].filter(Boolean)));
  }, [selected, discovered]);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && setActiveModal("none")}>
      <SheetContent
        side="right"
        hideDefaultClose
        className="w-full sm:w-[820px] sm:max-w-full p-0 flex flex-col h-full bg-surface-container-low border-l border-outline-variant shadow-2xl text-on-surface select-text overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-space-4 pt-space-6 px-space-6 border-b border-outline-variant shrink-0">
          <div className="flex items-center gap-space-2">
            <Layers size={18} className="text-primary-container" aria-hidden />
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Model Providers
            </h2>
          </div>
          <div className="flex items-center gap-space-2">
            <button
              type="button"
              onClick={() =>
                void run(async () => setChainResults(await testChain()), "Chain tested")
              }
              disabled={busy || loading}
              className={BTN}
              data-testid="test-chain-button"
            >
              Test chain
            </button>
            <button
              type="button"
              onClick={() => setActiveModal("none")}
              aria-label="Close providers modal"
              className="text-on-surface-variant hover:text-on-surface transition-colors p-2 rounded hover:bg-surface-container-high flex items-center justify-center cursor-pointer min-h-[44px] min-w-[44px]"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        </div>

        {(error || notice) && (
          <div className="px-space-6 pt-space-3 shrink-0 space-y-space-2">
            {error && (
              <div
                role="alert"
                className="bg-error/10 border border-error/40 text-error px-space-4 py-space-2 rounded font-code-sm text-code-sm"
              >
                {error}
              </div>
            )}
            {notice && (
              <div className="bg-primary-container/20 border border-primary-container/40 text-primary-container px-space-4 py-space-2 rounded font-code-sm text-code-sm flex items-center gap-2">
                <Check size={14} aria-hidden />
                <span>{notice}</span>
              </div>
            )}
          </div>
        )}

        {/* Rail + detail */}
        <div className="flex-1 min-h-0 flex flex-col sm:flex-row">
          {/* Provider rail */}
          <div className="shrink-0 sm:w-[248px] sm:h-full sm:overflow-y-auto border-b sm:border-b-0 sm:border-r border-outline-variant/60 p-space-4 space-y-space-2">
            <p className={SECTION_LABEL}>Providers</p>
            {loading && providers.length === 0 && (
              <p className="font-code-sm text-code-sm text-outline">Loading providers…</p>
            )}
            {providers.map((provider) => {
              const role = chainRole(provider.id, data);
              const active = provider.id === selectedId;
              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => setSelectedId(provider.id)}
                  data-testid={`provider-item-${provider.id}`}
                  aria-pressed={active}
                  className={`w-full text-left rounded-lg p-space-3 border transition-all cursor-pointer ${
                    active
                      ? "bg-surface-container-high border-primary-container/60 ring-1 ring-primary-container/30"
                      : "bg-surface-container border-outline-variant/40 hover:border-outline-variant hover:bg-surface-container-high/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-space-2 min-w-0">
                      <ProviderIcon providerId={provider.id} size={16} className="text-on-surface" />
                      <span className="font-body-sm text-body-sm text-on-surface font-medium truncate">
                        {provider.label}
                      </span>
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        provider.configured ? "bg-verdict-survived" : "bg-outline"
                      }`}
                      aria-label={provider.configured ? "configured" : "not configured"}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span className="font-code-sm text-code-sm text-outline truncate">
                      {provider.model || "no model"}
                    </span>
                    {role && (
                      <span className="font-code-sm text-[10px] px-1.5 py-0.5 rounded bg-primary-container/15 text-primary-container font-semibold shrink-0">
                        {role}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setShowAddForm((open) => !open)}
              data-testid="toggle-add-endpoint"
              className={`${BTN} w-full flex items-center justify-center gap-1`}
            >
              <Plus size={14} aria-hidden />
              Add endpoint
            </button>

            {showAddForm && (
              <div className="space-y-space-2 pt-space-2" data-testid="add-endpoint-form">
                <input
                  className={INPUT}
                  placeholder="Name (e.g. vLLM box)"
                  aria-label="Endpoint name"
                  value={newEndpoint.name}
                  onChange={(e) => setNewEndpoint({ ...newEndpoint, name: e.target.value })}
                />
                <input
                  className={INPUT}
                  placeholder="https://host/v1"
                  aria-label="Endpoint base URL"
                  value={newEndpoint.base_url}
                  onChange={(e) => setNewEndpoint({ ...newEndpoint, base_url: e.target.value })}
                />
                <input
                  className={INPUT}
                  placeholder="Model id"
                  aria-label="Endpoint model"
                  value={newEndpoint.model}
                  onChange={(e) => setNewEndpoint({ ...newEndpoint, model: e.target.value })}
                />
                <input
                  className={INPUT}
                  type="password"
                  placeholder="API key (optional)"
                  aria-label="Endpoint API key"
                  value={newEndpoint.api_key}
                  onChange={(e) => setNewEndpoint({ ...newEndpoint, api_key: e.target.value })}
                />
                <button
                  type="button"
                  className={`${BTN_PRIMARY} w-full`}
                  disabled={
                    busy ||
                    !newEndpoint.name.trim() ||
                    !newEndpoint.base_url.trim() ||
                    !newEndpoint.model.trim()
                  }
                  onClick={async () => {
                    const ok = await run(
                      () =>
                        createCustomProvider({
                          name: newEndpoint.name.trim(),
                          base_url: newEndpoint.base_url.trim(),
                          model: newEndpoint.model.trim(),
                          api_key: newEndpoint.api_key.trim() || null,
                        }),
                      `Endpoint ${newEndpoint.name.trim()} registered`
                    );
                    if (ok) {
                      setNewEndpoint({ name: "", base_url: "", model: "", api_key: "" });
                      setShowAddForm(false);
                    }
                  }}
                  data-testid="create-endpoint-button"
                >
                  Register endpoint
                </button>
              </div>
            )}
          </div>

          {/* Detail pane */}
          <div className="flex-1 min-w-0 sm:h-full sm:overflow-y-auto p-space-6 space-y-space-6 scrollbar-visible">
            {!selected && !loading && (
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                No providers available.
              </p>
            )}

            {selected && (
              <>
                {/* Identity + primary actions */}
                <div className="space-y-space-3">
                  <div className="flex items-start justify-between gap-space-3">
                    <div className="min-w-0 flex items-start gap-space-3">
                      <span className="p-2 rounded-lg bg-surface-container-high border border-outline-variant/40 shrink-0">
                        <ProviderIcon providerId={selected.id} size={20} className="text-on-surface" />
                      </span>
                      <div className="min-w-0">
                      <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                        {selected.label}
                      </h3>
                      <p className="font-code-sm text-code-sm text-outline truncate">{selected.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-space-2 shrink-0">
                      {isActive ? (
                        <span className="flex items-center gap-1 font-code-sm text-code-sm text-verdict-survived font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-verdict-survived" />
                          ACTIVE
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={BTN_PRIMARY}
                          disabled={busy}
                          data-testid="set-active-button"
                          onClick={() =>
                            void run(
                              () => setActiveProvider(selected.id, { model: modelDraft || null }),
                              `${selected.label} is now the active provider`
                            )
                          }
                        >
                          Set active
                        </button>
                      )}
                      {selected.removable && (
                        <button
                          type="button"
                          className={BTN_DANGER}
                          disabled={busy}
                          data-testid="delete-endpoint-button"
                          onClick={() =>
                            void run(
                              () => deleteProvider(selected.id),
                              `${selected.label} deleted`
                            )
                          }
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                  {selected.notes && (
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      {selected.notes}
                    </p>
                  )}
                </div>

                {/* Models */}
                <div className="space-y-space-3">
                  <div className="flex items-center justify-between">
                    <h4 className={SECTION_LABEL}>Model</h4>
                    {selected.id === "ollama" && (
                      <button
                        type="button"
                        className={BTN}
                        disabled={busy}
                        data-testid="discover-models-button"
                        onClick={async () => {
                          try {
                            setDiscovered(await listOllamaModels());
                          } catch (err) {
                            setError(
                              err instanceof Error ? err.message : "Ollama host not reachable"
                            );
                          }
                        }}
                      >
                        Discover installed
                      </button>
                    )}
                  </div>

                  <div className={`${CARD} space-y-space-3`}>
                    <div className="flex flex-wrap gap-space-2">
                      {modelOptions.map((model) => {
                        const current = model === modelDraft;
                        return (
                          <button
                            key={model}
                            type="button"
                            data-testid={`model-chip-${model}`}
                            onClick={() => {
                              setModelDraft(model);
                              void run(
                                () => setProviderConfig(selected.id, { model }),
                                `Model set to ${model}`
                              );
                            }}
                            className={`font-code-sm text-code-sm px-space-3 py-1.5 rounded border transition-colors cursor-pointer ${
                              current
                                ? "bg-primary-container/15 border-primary-container/60 text-primary-container font-semibold"
                                : "bg-surface-container-low border-outline-variant/50 text-on-surface-variant hover:border-outline-variant hover:text-on-surface"
                            }`}
                          >
                            {model}
                          </button>
                        );
                      })}
                      {modelOptions.length === 0 && (
                        <span className="font-code-sm text-code-sm text-outline">
                          No catalog models — type one below.
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-space-2">
                      <input
                        className={INPUT}
                        aria-label="Model id"
                        placeholder="custom model id"
                        value={modelDraft}
                        onChange={(e) => setModelDraft(e.target.value)}
                      />
                      <button
                        type="button"
                        className={BTN}
                        disabled={busy || !modelDraft.trim()}
                        data-testid="save-model-button"
                        onClick={() =>
                          void run(
                            () => setProviderConfig(selected.id, { model: modelDraft.trim() }),
                            `Model set to ${modelDraft.trim()}`
                          )
                        }
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>

                {/* Endpoint config */}
                <div className="space-y-space-3">
                  <h4 className={SECTION_LABEL}>Endpoint &amp; Pacing</h4>
                  <div className={`${CARD} space-y-space-3`}>
                    <label className="block space-y-space-1">
                      <span className="font-code-sm text-code-sm text-on-surface-variant">
                        Base URL
                      </span>
                      <input
                        className={INPUT}
                        aria-label="Base URL"
                        disabled={!selected.editable_base_url}
                        value={baseUrlDraft}
                        onChange={(e) => setBaseUrlDraft(e.target.value)}
                      />
                    </label>
                    <label className="block space-y-space-1">
                      <span className="font-code-sm text-code-sm text-on-surface-variant">
                        Requests per minute, per key (0 = unpaced)
                      </span>
                      <input
                        className={INPUT}
                        aria-label="Requests per minute"
                        type="number"
                        min={0}
                        value={rpmDraft}
                        onChange={(e) => setRpmDraft(e.target.value)}
                      />
                    </label>
                    <div className="flex items-center gap-space-2">
                      <button
                        type="button"
                        className={BTN_PRIMARY}
                        disabled={busy}
                        data-testid="save-config-button"
                        onClick={() =>
                          void run(
                            () =>
                              setProviderConfig(selected.id, {
                                base_url: selected.editable_base_url ? baseUrlDraft.trim() : null,
                                rpm: Number(rpmDraft) || 0,
                              }),
                            "Endpoint settings saved"
                          )
                        }
                      >
                        Save settings
                      </button>
                      <button
                        type="button"
                        className={BTN}
                        disabled={busy}
                        data-testid="ping-provider-button"
                        onClick={() =>
                          void run(async () => {
                            setPingResult(
                              await testProvider(selected.id, { model: modelDraft || null })
                            );
                          }, "Connection tested")
                        }
                      >
                        Test connection
                      </button>
                    </div>
                    {pingResult && (
                      <p
                        data-testid="ping-result"
                        className={`font-code-sm text-code-sm ${
                          pingResult.ok ? "text-verdict-survived" : "text-error"
                        }`}
                      >
                        {pingResult.ok ? "OK" : "FAILED"} — {pingResult.detail}
                      </p>
                    )}
                  </div>
                </div>

                {/* Keys */}
                <div className="space-y-space-3">
                  <div className="flex items-center justify-between">
                    <h4 className={SECTION_LABEL}>API Keys</h4>
                    <span className="font-code-sm text-code-sm text-outline">
                      {keys.length} stored{selected.requires_key ? "" : " (optional)"}
                    </span>
                  </div>

                  <div className={`${CARD} space-y-space-3`}>
                    {keys.length === 0 && (
                      <p className="font-code-sm text-code-sm text-outline">
                        No keys stored for this provider.
                      </p>
                    )}
                    {keys.map((key) => (
                      <div
                        key={key.id}
                        data-testid={`key-row-${key.id}`}
                        className="flex items-center justify-between gap-space-3 border-b border-outline-variant/30 pb-space-2 last:border-b-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="font-code-sm text-code-sm text-on-surface truncate">
                            {key.hint}
                          </p>
                          {key.label && (
                            <p className="font-code-sm text-code-sm text-outline truncate">
                              {key.label}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-space-2 shrink-0">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={key.enabled}
                            aria-label={`Toggle key ${key.hint}`}
                            disabled={busy}
                            onClick={() =>
                              void run(
                                () => setKeyEnabled(key.id, !key.enabled),
                                key.enabled ? "Key disabled" : "Key enabled"
                              )
                            }
                            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer focus:outline-none shrink-0 ${
                              key.enabled ? "bg-primary-container" : "bg-surface-container-highest"
                            }`}
                          >
                            <span
                              className={`block w-4 h-4 rounded-full bg-on-primary-container transition-transform absolute top-1 left-1 ${
                                key.enabled ? "translate-x-5" : ""
                              }`}
                            />
                          </button>
                          <button
                            type="button"
                            className={BTN_DANGER}
                            disabled={busy}
                            aria-label={`Delete key ${key.hint}`}
                            onClick={() =>
                              void run(() => deleteProviderKey(key.id), "Key deleted")
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-space-2 pt-space-1">
                      <input
                        className={INPUT}
                        type="password"
                        aria-label="New API key"
                        placeholder="Paste API key"
                        value={keyDraft}
                        onChange={(e) => setKeyDraft(e.target.value)}
                      />
                      <input
                        className={`${INPUT} sm:w-40`}
                        aria-label="Key label"
                        placeholder="Label"
                        value={keyLabelDraft}
                        onChange={(e) => setKeyLabelDraft(e.target.value)}
                      />
                      <button
                        type="button"
                        className={BTN_PRIMARY}
                        disabled={busy || !keyDraft.trim()}
                        data-testid="add-key-button"
                        onClick={async () => {
                          const ok = await run(
                            () => addProviderKey(selected.id, keyDraft.trim(), keyLabelDraft.trim()),
                            "Key added"
                          );
                          if (ok) {
                            setKeyDraft("");
                            setKeyLabelDraft("");
                          }
                        }}
                      >
                        Add key
                      </button>
                    </div>
                    <p className="font-code-sm text-code-sm text-outline">
                      Multiple keys are rotated across, so free-tier limits multiply.
                    </p>
                  </div>
                </div>

                {/* Fallback chain */}
                <div className="space-y-space-3">
                  <div className="flex items-center justify-between">
                    <h4 className={SECTION_LABEL}>Fallback Priority</h4>
                    {!isActive && !inFallback && (
                      <button
                        type="button"
                        className={BTN}
                        disabled={busy}
                        data-testid="add-to-chain-button"
                        onClick={() => addToChain(selected.id)}
                      >
                        Add this provider
                      </button>
                    )}
                  </div>

                  <div className={`${CARD} space-y-space-2`}>
                    <div className="flex items-center justify-between gap-space-3">
                      <span className="font-code-sm text-code-sm text-on-surface-variant">
                        0. {data?.active} (active)
                      </span>
                      <span className="font-code-sm text-code-sm text-outline">primary</span>
                    </div>
                    {(data?.fallback_chain || []).map((id, index) => (
                      <div
                        key={id}
                        data-testid={`chain-row-${id}`}
                        className="flex items-center justify-between gap-space-3 border-t border-outline-variant/30 pt-space-2"
                      >
                        <span className="font-code-sm text-code-sm text-on-surface truncate">
                          {index + 1}. {id}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            className={BTN}
                            aria-label={`Move ${id} up`}
                            disabled={busy || index === 0}
                            onClick={() => moveInChain(index, -1)}
                          >
                            <ArrowUp size={14} aria-hidden />
                          </button>
                          <button
                            type="button"
                            className={BTN}
                            aria-label={`Move ${id} down`}
                            disabled={busy || index === (data?.fallback_chain || []).length - 1}
                            onClick={() => moveInChain(index, 1)}
                          >
                            <ArrowDown size={14} aria-hidden />
                          </button>
                          <button
                            type="button"
                            className={BTN_DANGER}
                            aria-label={`Remove ${id} from fallback chain`}
                            disabled={busy}
                            onClick={() => removeFromChain(id)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                    {(data?.fallback_chain || []).length === 0 && (
                      <p className="font-code-sm text-code-sm text-outline border-t border-outline-variant/30 pt-space-2">
                        No fallbacks — a rate-limited run stops instead of switching provider.
                      </p>
                    )}
                  </div>

                  {chainResults && (
                    <div className={`${CARD} space-y-space-2`} data-testid="chain-results">
                      {chainResults.map((result, index) => (
                        <p
                          key={`${result.provider}-${index}`}
                          className={`font-code-sm text-code-sm ${
                            result.ok ? "text-verdict-survived" : "text-error"
                          }`}
                        >
                          {result.ok ? "OK" : "FAILED"} · {result.provider} · {result.model} —{" "}
                          {result.detail}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
