import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCase } from "@/context/CaseContext";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ProviderIcon } from "@/components/ui/providerIcons";
import { ArrowDown, ArrowUp, Check, Download, Layers, Plus, Star, Trash2, X } from "lucide-react";
import {
  ProviderInfo,
  ProviderKey,
  ProviderTestResult,
  ProvidersResponse,
  addModels,
  addProviderKey,
  createCustomProvider,
  deleteProvider,
  deleteProviderKey,
  discoverModels,
  listProviderKeys,
  listProviders,
  removeModel,
  setActiveProvider,
  setEnabledModels,
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
const ICON_BTN =
  "p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed";
const RAIL_ITEM = "w-full text-left rounded-lg p-space-3 border transition-all cursor-pointer";
const RAIL_ON = "bg-surface-container-high border-primary-container/60 ring-1 ring-primary-container/30";
const RAIL_OFF =
  "bg-surface-container border-outline-variant/40 hover:border-outline-variant hover:bg-surface-container-high/60";

/** Pseudo-selections of the rail that are not providers. */
const ROUTING = "routing";
const NEW_ENDPOINT = "new";
/** Show the model filter once a list gets longer than this. */
const FILTER_THRESHOLD = 8;

const EMPTY_ENDPOINT = { name: "", base_url: "", model: "", api_key: "" };

/** Models the endpoint reported, waiting for the user to confirm which to save. */
interface DiscoveryPicker {
  providerId: string;
  /** reported but not saved yet - all pre-checked */
  fresh: string[];
  picked: string[];
  alreadySaved: number;
}

/** Chain position of a provider, for the badge in the rail. */
function chainRole(id: string, data: ProvidersResponse | null): string | null {
  if (!data) return null;
  if (data.active === id) return "ACTIVE";
  const index = (data.fallback_chain || []).indexOf(id);
  return index >= 0 ? `FB ${index + 1}` : null;
}

const isProvidersResponse = (value: unknown): value is ProvidersResponse =>
  !!value && typeof value === "object" && Array.isArray((value as ProvidersResponse).providers);

const isProviderInfo = (value: unknown): value is ProviderInfo =>
  !!value &&
  typeof value === "object" &&
  typeof (value as ProviderInfo).id === "string" &&
  Array.isArray((value as ProviderInfo).enabled_models);

function patchProvider(
  data: ProvidersResponse,
  id: string,
  patch: Partial<ProviderInfo>
): ProvidersResponse {
  return { ...data, providers: data.providers.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
}

function upsertProvider(data: ProvidersResponse, info: ProviderInfo): ProvidersResponse {
  return data.providers.some((p) => p.id === info.id)
    ? patchProvider(data, info.id, info)
    : { ...data, providers: [...data.providers, info] };
}

const message = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

export const ProvidersModal: React.FC = () => {
  const { state, setActiveModal, refreshEngineInfo } = useCase();
  const isOpen = state.activeModal === "providers";

  const [data, setData] = useState<ProvidersResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string>(ROUTING);
  const [keys, setKeys] = useState<ProviderKey[]>([]);
  const [loading, setLoading] = useState(false);
  /** the one long-running action (live test, create) in flight, which blocks its own button */
  const [busy, setBusy] = useState<null | "chain" | "ping" | "create">(null);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** id of the endpoint or key whose Delete was clicked once and awaits confirmation */
  const [confirming, setConfirming] = useState<string | null>(null);

  // drafts for the detail pane
  const [baseUrlDraft, setBaseUrlDraft] = useState("");
  const [rpmDraft, setRpmDraft] = useState("0");
  const [keyDraft, setKeyDraft] = useState("");
  const [keyLabelDraft, setKeyLabelDraft] = useState("");
  const [newModelDraft, setNewModelDraft] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [picker, setPicker] = useState<DiscoveryPicker | null>(null);
  const [discovering, setDiscovering] = useState<string | null>(null);

  const [pingResult, setPingResult] = useState<ProviderTestResult | null>(null);
  const [chainResults, setChainResults] = useState<ProviderTestResult[] | null>(null);
  const [newEndpoint, setNewEndpoint] = useState(EMPTY_ENDPOINT);

  const providers = data?.providers || [];
  const selected = useMemo(
    () => providers.find((p) => p.id === selectedId) || null,
    [providers, selectedId]
  );

  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Mutations run one at a time, in click order, so optimistic edits never race. */
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const seqRef = useRef(0);

  const flash = (text: string) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setNotice(text);
    noticeTimerRef.current = setTimeout(() => setNotice(null), 3000);
  };

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await listProviders();
      setData(next);
      setSelectedId((current) => {
        if (current === ROUTING || current === NEW_ENDPOINT) return current;
        return (next.providers || []).some((p) => p.id === current) ? current : ROUTING;
      });
    } catch (err) {
      setError(message(err, "Failed to load providers"));
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Any mutation. The UI updates at once (`optimistic`), the request is queued
   * behind earlier ones, and the server's answer replaces the guess. Only the
   * latest queued answer is applied, so a burst of clicks never flickers back.
   * On failure the server's truth is re-read.
   */
  const run = (
    action: () => Promise<unknown>,
    successMessage: string,
    optimistic?: (current: ProvidersResponse) => ProvidersResponse
  ): Promise<boolean> => {
    setError(null);
    if (optimistic) setData((current) => (current ? optimistic(current) : current));
    const seq = ++seqRef.current;
    setPending((n) => n + 1);
    const task = queueRef.current.then(async () => {
      try {
        const result = await action();
        if (seq === seqRef.current) {
          if (isProvidersResponse(result)) setData(result);
          else if (isProviderInfo(result))
            setData((current) => (current ? upsertProvider(current, result) : current));
          else await refresh();
        }
        void refreshEngineInfo();
        flash(successMessage);
        return true;
      } catch (err) {
        setError(message(err, "Request failed"));
        await refresh();
        return false;
      } finally {
        setPending((n) => n - 1);
      }
    });
    queueRef.current = task;
    return task;
  };

  useEffect(() => {
    if (isOpen) void refresh();
  }, [isOpen, refresh]);

  // Reset the detail drafts whenever the selection (or its saved config) changes.
  useEffect(() => {
    if (!selected) return;
    setBaseUrlDraft(selected.base_url || "");
    setRpmDraft(String(selected.rpm ?? 0));
  }, [selected?.id, selected?.base_url, selected?.rpm]);

  useEffect(() => {
    setPingResult(null);
    setConfirming(null);
    setModelFilter("");
    setNewModelDraft("");
  }, [selectedId]);

  const loadKeys = useCallback(async (providerId: string) => {
    try {
      setKeys((await listProviderKeys(providerId)) || []);
    } catch {
      setKeys([]);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || selectedId === ROUTING || selectedId === NEW_ENDPOINT) {
      setKeys([]);
      return;
    }
    void loadKeys(selectedId);
  }, [isOpen, selectedId, loadKeys]);

  /** Key mutations: run, then re-read this provider's keys (counts come with the refresh). */
  const runKey = async (action: () => Promise<unknown>, successMessage: string) => {
    if (!selected) return false;
    const providerId = selected.id;
    const ok = await run(action, successMessage);
    if (ok) await loadKeys(providerId);
    return ok;
  };

  // while the backend pins one provider, everything else is configuration only
  const locked = data?.locked_provider || null;
  const isActive = selected ? data?.active === selected.id : false;

  // --------------------------------------------------------------- routing

  const chainOf = (d: ProvidersResponse | null) =>
    Array.from(new Set((d?.fallback_chain || []).filter((id) => id && id !== d?.active)));

  const saveChain = (chain: string[], successMessage: string) =>
    void run(() => setFallbackChain(chain), successMessage, (d) => ({ ...d, fallback_chain: chain }));

  const moveInChain = (index: number, delta: number) => {
    const chain = chainOf(data);
    const target = index + delta;
    if (target < 0 || target >= chain.length) return;
    [chain[index], chain[target]] = [chain[target], chain[index]];
    saveChain(chain, "Fallback priority updated");
  };

  const removeFromChain = (id: string) =>
    saveChain(
      chainOf(data).filter((entry) => entry !== id),
      `${id} removed from fallback chain`
    );

  const addToChain = (id: string) => {
    const chain = [...chainOf(data).filter((entry) => entry !== id), id];
    saveChain(chain, `${id} added as fallback #${chain.length}`);
  };

  /** Make `id` the active provider; the old active becomes fallback #1. */
  const promote = (id: string, label: string) => {
    if (!data) return;
    const previous = data.active;
    const chain = [previous, ...chainOf(data).filter((x) => x !== id)];
    void run(
      async () => {
        await setActiveProvider(id, {});
        return setFallbackChain(chain);
      },
      `${label} is now the active provider`,
      (d) => ({ ...d, active: id, fallback_chain: chain })
    );
  };

  // ---------------------------------------------------------------- models

  /** Enabled models first, in the order they are tried, then the disabled rest. */
  const enabledModels = useMemo(() => selected?.enabled_models || [], [selected]);
  const modelRows = useMemo(() => {
    if (!selected) return [];
    const saved = (selected.models || []).filter((m) => m && !enabledModels.includes(m));
    return [...enabledModels, ...saved];
  }, [selected, enabledModels]);
  const visibleRows = useMemo(() => {
    const needle = modelFilter.trim().toLowerCase();
    // ponytail: plain list; virtualize if gateways with 1000+ models become common
    return needle ? modelRows.filter((m) => m.toLowerCase().includes(needle)) : modelRows;
  }, [modelRows, modelFilter]);

  const saveEnabled = (models: string[], successMessage: string) =>
    selected &&
    void run(() => setEnabledModels(selected.id, models), successMessage, (d) =>
      patchProvider(d, selected.id, { enabled_models: models })
    );

  const toggleModel = (model: string, enabled: boolean) =>
    saveEnabled(
      enabled ? enabledModels.filter((m) => m !== model) : [...enabledModels, model],
      enabled ? `${model} disabled` : `${model} enabled`
    );

  /** Reorder the fallback order. Index 0 is the primary and does not move. */
  const moveModel = (index: number, delta: number) => {
    const order = [...enabledModels];
    const target = index + delta;
    if (index < 1 || target < 1 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    saveEnabled(order, "Fallback order updated");
  };

  /** New primary; the old one stays enabled as fallback #1 (mirrors the backend). */
  const makePrimary = (model: string) => {
    if (!selected) return;
    const enabled = [model, ...enabledModels.filter((m) => m !== model)];
    void run(
      () => setProviderConfig(selected.id, { model }),
      `${model} is now the primary model`,
      (d) => patchProvider(d, selected.id, { model, enabled_models: enabled })
    );
  };

  const forgetModel = (model: string) => {
    if (!selected) return;
    void run(() => removeModel(selected.id, model), `${model} removed`, (d) =>
      patchProvider(d, selected.id, {
        models: selected.models.filter((m) => m !== model),
        enabled_models: enabledModels.filter((m) => m !== model),
      })
    );
  };

  const addTypedModel = async () => {
    const model = newModelDraft.trim();
    if (!selected || !model) return;
    if (modelRows.includes(model)) {
      setError(`${model} is already in the list`);
      return;
    }
    setNewModelDraft("");
    await run(() => addModels(selected.id, [model]), `${model} added`, (d) =>
      patchProvider(d, selected.id, {
        model: selected.model || model,
        models: [...selected.models, model],
        enabled_models: [...enabledModels, model],
      })
    );
  };

  /** Ask the endpoint for its list; new models open the picker, all pre-checked. */
  const fetchModels = async (provider: ProviderInfo, auto = false) => {
    setDiscovering(provider.id);
    setError(null);
    try {
      const found = await discoverModels(provider.id);
      const fresh = found.filter((m) => !provider.models.includes(m));
      if (fresh.length === 0) {
        flash(
          found.length ? `All ${found.length} models are already saved` : "Endpoint listed no models"
        );
        setPicker(null);
      } else {
        setPicker({
          providerId: provider.id,
          fresh,
          picked: fresh,
          alreadySaved: found.length - fresh.length,
        });
      }
    } catch (err) {
      const detail = message(err, "Endpoint not reachable");
      setError(auto ? `Couldn't fetch models automatically - add one below. ${detail}` : detail);
    } finally {
      setDiscovering(null);
    }
  };

  const savePicked = async (models: string[]) => {
    if (!picker || models.length === 0) return;
    const { providerId } = picker;
    const ok = await run(
      () => addModels(providerId, models),
      `${models.length} model${models.length === 1 ? "" : "s"} saved`
    );
    if (ok) setPicker(null);
  };

  const togglePicked = (model: string) =>
    setPicker((current) =>
      current && {
        ...current,
        picked: current.picked.includes(model)
          ? current.picked.filter((m) => m !== model)
          : [...current.picked, model],
      }
    );

  // -------------------------------------------------------------- endpoint

  const createEndpoint = async () => {
    setBusy("create");
    setError(null);
    try {
      const created = await createCustomProvider({
        name: newEndpoint.name.trim(),
        base_url: newEndpoint.base_url.trim(),
        model: newEndpoint.model.trim(),
        api_key: newEndpoint.api_key.trim() || null,
      });
      setNewEndpoint(EMPTY_ENDPOINT);
      flash(`Endpoint ${newEndpoint.name.trim()} added`);
      if (isProviderInfo(created)) {
        setData((current) => (current ? upsertProvider(current, created) : current));
        setSelectedId(created.id);
        void fetchModels(created, true);
      } else {
        await refresh();
      }
    } catch (err) {
      setError(message(err, "Could not add endpoint"));
    } finally {
      setBusy(null);
    }
  };

  const pickerOpen = picker && selected && picker.providerId === selected.id;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && setActiveModal("none")}>
      <SheetContent
        side="right"
        hideDefaultClose
        className="w-full sm:w-[820px] sm:max-w-full p-0 flex flex-col h-full bg-surface-container-low border-l border-outline-variant shadow-2xl text-on-surface select-text overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-space-4 pt-space-6 px-space-6 border-b border-outline-variant shrink-0">
          <div className="flex items-center gap-space-2 min-w-0">
            <Layers size={18} className="text-primary-container" aria-hidden />
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Model Providers
            </h2>
            <span
              aria-live="polite"
              className={`font-code-sm text-code-sm text-outline transition-opacity ${
                pending > 0 ? "opacity-100" : "opacity-0"
              }`}
            >
              Saving…
            </span>
          </div>
          <div className="flex items-center gap-space-2">
            <button
              type="button"
              onClick={async () => {
                setBusy("chain");
                setError(null);
                try {
                  setChainResults(await testChain());
                  setSelectedId(ROUTING);
                  flash("Chain tested");
                } catch (err) {
                  setError(message(err, "Chain test failed"));
                } finally {
                  setBusy(null);
                }
              }}
              disabled={busy === "chain" || loading}
              className={BTN}
              data-testid="test-chain-button"
            >
              {busy === "chain" ? "Testing…" : "Test chain"}
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
                className="bg-error/10 border border-error/40 text-error px-space-4 py-space-2 rounded font-code-sm text-code-sm flex items-start justify-between gap-space-2"
              >
                <span className="min-w-0 break-words">{error}</span>
                <button
                  type="button"
                  aria-label="Dismiss error"
                  onClick={() => setError(null)}
                  className="shrink-0 cursor-pointer hover:opacity-70 transition-opacity"
                >
                  <X size={14} aria-hidden />
                </button>
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
        <div className="flex-1 min-h-0 flex flex-col sm:flex-row overflow-hidden">
          {/* Provider rail */}
          <div className="shrink-0 sm:w-[248px] overflow-y-auto max-h-[42vh] sm:max-h-none sm:h-full border-b sm:border-b-0 sm:border-r border-outline-variant/60 p-space-4 space-y-space-2">
            <p className={SECTION_LABEL}>Global</p>
            <button
              type="button"
              onClick={() => setSelectedId(ROUTING)}
              aria-pressed={selectedId === ROUTING}
              className={`${RAIL_ITEM} ${selectedId === ROUTING ? RAIL_ON : RAIL_OFF}`}
            >
              <span className="flex items-center gap-space-2 min-w-0">
                <Layers size={16} className="text-on-surface" />
                <span className="font-body-sm text-body-sm text-on-surface font-medium truncate">
                  Provider Routing
                </span>
              </span>
            </button>
            <div className="pt-space-2">
              <p className={SECTION_LABEL}>Providers</p>
            </div>
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
                  className={`${RAIL_ITEM} ${active ? RAIL_ON : RAIL_OFF}`}
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
              onClick={() => setSelectedId((id) => (id === NEW_ENDPOINT ? ROUTING : NEW_ENDPOINT))}
              data-testid="toggle-add-endpoint"
              aria-pressed={selectedId === NEW_ENDPOINT}
              className={`${RAIL_ITEM} border-dashed ${
                selectedId === NEW_ENDPOINT
                  ? RAIL_ON
                  : "bg-transparent border-outline-variant hover:border-primary-container/60 hover:bg-surface-container-high/60"
              } group`}
            >
              <span className="flex items-center gap-space-2 min-w-0">
                <span className="p-1 rounded bg-primary-container/15 text-primary-container shrink-0 transition-transform group-hover:scale-105">
                  <Plus size={14} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block font-body-sm text-body-sm text-on-surface font-medium truncate">
                    Add endpoint
                  </span>
                  <span className="block font-code-sm text-code-sm text-outline truncate">
                    Any OpenAI-compatible URL
                  </span>
                </span>
              </span>
            </button>
          </div>

          {/* Detail pane */}
          <div className="flex-1 min-w-0 overflow-y-auto sm:h-full p-space-6 space-y-space-6 scrollbar-visible">
            {selectedId === NEW_ENDPOINT && (
              <div className="space-y-space-3 max-w-2xl mx-auto" data-testid="add-endpoint-form">
                <div className="flex items-start gap-space-3">
                  <span className="p-2 rounded-lg bg-surface-container-high border border-outline-variant/40 shrink-0">
                    <Plus size={20} className="text-primary-container" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                      Add endpoint
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Any gateway that speaks the OpenAI API - vLLM, LM Studio, OpenRouter,
                      LiteLLM. Its model list is fetched automatically after you add it.
                    </p>
                  </div>
                </div>
                <form
                  className={`${CARD} space-y-space-3`}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void createEndpoint();
                  }}
                >
                  <label className="block space-y-space-1">
                    <span className="font-code-sm text-code-sm text-on-surface-variant">Name</span>
                    <input
                      className={INPUT}
                      placeholder="e.g. vLLM box"
                      aria-label="Endpoint name"
                      value={newEndpoint.name}
                      onChange={(e) => setNewEndpoint({ ...newEndpoint, name: e.target.value })}
                    />
                  </label>
                  <label className="block space-y-space-1">
                    <span className="font-code-sm text-code-sm text-on-surface-variant">Base URL</span>
                    <input
                      className={INPUT}
                      placeholder="https://host/v1"
                      aria-label="Endpoint base URL"
                      inputMode="url"
                      value={newEndpoint.base_url}
                      onChange={(e) => setNewEndpoint({ ...newEndpoint, base_url: e.target.value })}
                    />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-3">
                    <label className="block space-y-space-1">
                      <span className="font-code-sm text-code-sm text-on-surface-variant">
                        API key <span className="text-outline">(optional)</span>
                      </span>
                      <input
                        className={INPUT}
                        type="password"
                        placeholder="sk-..."
                        aria-label="Endpoint API key"
                        autoComplete="off"
                        value={newEndpoint.api_key}
                        onChange={(e) => setNewEndpoint({ ...newEndpoint, api_key: e.target.value })}
                      />
                    </label>
                    <label className="block space-y-space-1">
                      <span className="font-code-sm text-code-sm text-on-surface-variant">
                        Primary model <span className="text-outline">(optional)</span>
                      </span>
                      <input
                        className={INPUT}
                        placeholder="blank = pick from fetched list"
                        aria-label="Endpoint model"
                        value={newEndpoint.model}
                        onChange={(e) => setNewEndpoint({ ...newEndpoint, model: e.target.value })}
                      />
                    </label>
                  </div>
                  <div className="flex items-center gap-space-2 pt-space-1">
                    <button
                      type="submit"
                      className={`${BTN_PRIMARY} flex items-center gap-1`}
                      disabled={
                        busy === "create" || !newEndpoint.name.trim() || !newEndpoint.base_url.trim()
                      }
                      data-testid="create-endpoint-button"
                    >
                      <Plus size={14} aria-hidden />
                      {busy === "create" ? "Adding…" : "Add endpoint"}
                    </button>
                    <button type="button" className={BTN} onClick={() => setSelectedId(ROUTING)}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {selectedId === ROUTING && data && (
              <div className="space-y-space-6 max-w-2xl mx-auto">
                <div className="space-y-space-3">
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    Global Provider Routing
                  </h3>
                  <div className={`${CARD} space-y-space-3`}>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      The primary provider runs first. Enabled providers below it are the fallback
                      order - if one fails, the next is tried. Each provider then walks its own
                      enabled models.
                    </p>
                    <div className="space-y-space-2">
                      {(() => {
                        const active = data.active;
                        const chain = chainOf(data);
                        const others = providers
                          .filter((p) => p.id !== active && !chain.includes(p.id))
                          .map((p) => p.id);
                        const rows = Array.from(new Set([active, ...chain, ...others]));

                        return rows.map((id) => {
                          const providerData = providers.find((p) => p.id === id);
                          if (!providerData) return null;
                          const isPrimary = id === active;
                          const order = chain.indexOf(id);
                          const enabled = isPrimary || order >= 0;
                          return (
                            <div
                              key={id}
                              data-testid={`routing-row-${id}`}
                              className={`flex items-center gap-space-3 rounded border px-space-3 py-2 transition-colors ${
                                isPrimary
                                  ? "bg-primary-container/15 border-primary-container/60"
                                  : "bg-surface-container-low border-outline-variant/50"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={enabled}
                                disabled={isPrimary}
                                aria-label={`Enable ${id}`}
                                onChange={() => (enabled ? removeFromChain(id) : addToChain(id))}
                                className="accent-primary-container cursor-pointer disabled:cursor-not-allowed"
                              />
                              <button
                                type="button"
                                onClick={() => setSelectedId(id)}
                                className="flex-1 min-w-0 flex items-center gap-2 text-left cursor-pointer group"
                                title={`Open ${providerData.label} settings`}
                              >
                                <ProviderIcon
                                  providerId={id}
                                  size={16}
                                  className={
                                    isPrimary
                                      ? "text-primary-container"
                                      : enabled
                                        ? "text-on-surface"
                                        : "text-outline"
                                  }
                                />
                                <span className="min-w-0">
                                  <span
                                    className={`block font-code-sm text-code-sm truncate group-hover:underline ${
                                      isPrimary
                                        ? "text-primary-container font-semibold"
                                        : enabled
                                          ? "text-on-surface"
                                          : "text-outline"
                                    }`}
                                  >
                                    {providerData.label}
                                  </span>
                                  <span className="block font-code-sm text-code-sm text-outline truncate">
                                    {providerData.model || "no model"}
                                    {providerData.enabled_models.length > 1 &&
                                      ` +${providerData.enabled_models.length - 1} fallback`}
                                    {!providerData.configured && (
                                      <span className="text-error"> · needs setup</span>
                                    )}
                                  </span>
                                </span>
                              </button>
                              <span className="font-label-mono text-label-mono uppercase tracking-wider text-outline shrink-0">
                                {isPrimary ? "PRIMARY" : enabled ? `FB ${order + 1}` : "OFF"}
                              </span>
                              <div className="flex flex-col gap-0.5 shrink-0 ml-1">
                                <button
                                  type="button"
                                  aria-label={`Move ${id} up`}
                                  disabled={!enabled || isPrimary}
                                  onClick={() =>
                                    order === 0 ? promote(id, providerData.label) : moveInChain(order, -1)
                                  }
                                  className={ICON_BTN}
                                >
                                  <ArrowUp size={14} aria-hidden />
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Move ${id} down`}
                                  disabled={!enabled || order === chain.length - 1}
                                  onClick={() => {
                                    if (isPrimary && chain.length > 0) {
                                      const next = providers.find((p) => p.id === chain[0]);
                                      promote(chain[0], next?.label || chain[0]);
                                    } else {
                                      moveInChain(order, 1);
                                    }
                                  }}
                                  className={ICON_BTN}
                                >
                                  <ArrowDown size={14} aria-hidden />
                                </button>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
                {chainResults && (
                  <div className={`${CARD} space-y-space-2`} data-testid="chain-results">
                    <p className="font-code-sm text-code-sm font-semibold">Chain Test Results</p>
                    {chainResults.length === 0 && (
                      <p className="font-code-sm text-code-sm text-outline">Chain is empty.</p>
                    )}
                    {chainResults.map((result, i) => (
                      <p
                        key={i}
                        className={`font-code-sm text-code-sm break-words ${
                          result.ok ? "text-verdict-survived" : "text-error"
                        }`}
                      >
                        {result.ok ? "OK" : "FAILED"} - {result.provider} ({result.model}){" "}
                        <span className="text-outline">{result.detail}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selected && (
              <>
                {/* Identity + primary actions */}
                <div className="space-y-space-3">
                  <div className="flex flex-wrap items-start justify-between gap-space-3">
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
                          data-testid="set-active-button"
                          onClick={() =>
                            void run(
                              () => setActiveProvider(selected.id, { model: selected.model || null }),
                              `${selected.label} is now the active provider`,
                              (d) => ({
                                ...d,
                                active: selected.id,
                                fallback_chain: d.fallback_chain.filter((p) => p !== selected.id),
                              })
                            )
                          }
                        >
                          Set active
                        </button>
                      )}
                      {selected.removable &&
                        (confirming === `endpoint:${selected.id}` ? (
                          <>
                            <button
                              type="button"
                              className={`${BTN_DANGER} bg-error/10 font-medium`}
                              data-testid="confirm-delete-endpoint-button"
                              onClick={() => {
                                setConfirming(null);
                                void run(() => deleteProvider(selected.id), `${selected.label} deleted`);
                              }}
                            >
                              Confirm delete
                            </button>
                            <button type="button" className={BTN} onClick={() => setConfirming(null)}>
                              Keep
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className={BTN_DANGER}
                            data-testid="delete-endpoint-button"
                            onClick={() => setConfirming(`endpoint:${selected.id}`)}
                          >
                            Delete
                          </button>
                        ))}
                    </div>
                  </div>
                  {selected.notes && (
                    <p className="font-body-sm text-body-sm text-on-surface-variant">{selected.notes}</p>
                  )}
                  {locked && (
                    <p
                      className="font-body-sm text-body-sm text-on-surface-variant border border-outline-variant/60 rounded px-space-3 py-2"
                      data-testid="locked-notice"
                    >
                      {selected.id === locked ? (
                        <>
                          <span className="text-primary-container font-semibold">PINNED</span> -
                          every run goes through this provider. Its enabled models below are the
                          whole fallback order.
                        </>
                      ) : (
                        <>
                          Runs are pinned to <span className="text-on-surface">{locked}</span> for
                          now. Keys and models saved here are kept, but not used yet.
                        </>
                      )}
                    </p>
                  )}
                </div>

                {/* Models */}
                <div className="space-y-space-3">
                  <div className="flex items-center justify-between gap-space-2">
                    <h4 className={SECTION_LABEL}>
                      Models{" "}
                      <span className="font-normal normal-case tracking-normal">
                        · {enabledModels.length} of {modelRows.length} enabled
                      </span>
                    </h4>
                    <button
                      type="button"
                      className={`${BTN} flex items-center gap-1`}
                      disabled={discovering !== null || !selected.base_url}
                      data-testid="discover-models-button"
                      title="Ask the endpoint for its model list"
                      onClick={() => void fetchModels(selected)}
                    >
                      <Download size={14} aria-hidden />
                      {discovering === selected.id ? "Fetching…" : "Fetch models"}
                    </button>
                  </div>

                  {pickerOpen && picker && (
                    <div
                      className={`${CARD} border-primary-container/60 space-y-space-3`}
                      data-testid="discovery-picker"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-space-2">
                        <p className="font-body-sm text-body-sm text-on-surface">
                          Found <span className="font-semibold">{picker.fresh.length}</span> new
                          model{picker.fresh.length === 1 ? "" : "s"}
                          {picker.alreadySaved > 0 && (
                            <span className="text-outline"> · {picker.alreadySaved} already saved</span>
                          )}
                        </p>
                        <div className="flex items-center gap-space-2">
                          <button
                            type="button"
                            className={BTN}
                            onClick={() =>
                              setPicker({
                                ...picker,
                                picked: picker.picked.length === picker.fresh.length ? [] : picker.fresh,
                              })
                            }
                          >
                            {picker.picked.length === picker.fresh.length ? "Select none" : "Select all"}
                          </button>
                        </div>
                      </div>
                      <div className="max-h-[240px] overflow-y-auto space-y-1 pr-1">
                        {picker.fresh.map((model) => (
                          <label
                            key={model}
                            className="flex items-center gap-space-2 rounded px-space-2 py-1 hover:bg-surface-container-high transition-colors cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={picker.picked.includes(model)}
                              onChange={() => togglePicked(model)}
                              aria-label={`Pick ${model}`}
                              className="accent-primary-container cursor-pointer"
                            />
                            <span className="font-code-sm text-code-sm text-on-surface truncate">
                              {model}
                            </span>
                          </label>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-space-2">
                        <button
                          type="button"
                          className={BTN_PRIMARY}
                          data-testid="save-all-models-button"
                          onClick={() => void savePicked(picker.fresh)}
                        >
                          Save all ({picker.fresh.length})
                        </button>
                        <button
                          type="button"
                          className={BTN}
                          disabled={picker.picked.length === 0 || picker.picked.length === picker.fresh.length}
                          data-testid="save-picked-models-button"
                          onClick={() => void savePicked(picker.picked)}
                        >
                          Save selected ({picker.picked.length})
                        </button>
                        <button type="button" className={BTN} onClick={() => setPicker(null)}>
                          Cancel
                        </button>
                      </div>
                      <p className="font-code-sm text-code-sm text-outline">
                        Saved models join the fallback order, after the ones already enabled.
                      </p>
                    </div>
                  )}

                  <div className={`${CARD} space-y-space-3`}>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      The primary model runs first. Enabled models below it are the fallback order -
                      a rate-limited or failing model retries on the next one.
                    </p>

                    {modelRows.length > FILTER_THRESHOLD && (
                      <input
                        className={INPUT}
                        aria-label="Filter models"
                        placeholder={`Filter ${modelRows.length} models`}
                        value={modelFilter}
                        onChange={(e) => setModelFilter(e.target.value)}
                      />
                    )}

                    <div
                      className={`space-y-space-2 ${
                        modelRows.length > FILTER_THRESHOLD ? "max-h-[420px] overflow-y-auto pr-1" : ""
                      }`}
                    >
                      {visibleRows.map((model) => {
                        const isPrimary = model === selected.model;
                        const order = enabledModels.indexOf(model);
                        const enabled = order >= 0;
                        return (
                          <div
                            key={model}
                            data-testid={`model-row-${model}`}
                            className={`flex items-center gap-space-3 rounded border px-space-3 py-2 transition-colors ${
                              isPrimary
                                ? "bg-primary-container/15 border-primary-container/60"
                                : "bg-surface-container-low border-outline-variant/50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={enabled}
                              disabled={isPrimary}
                              aria-label={`Enable ${model}`}
                              onChange={() => toggleModel(model, enabled)}
                              className="accent-primary-container cursor-pointer disabled:cursor-not-allowed"
                            />
                            <span
                              title={model}
                              className={`flex-1 min-w-0 font-code-sm text-code-sm truncate ${
                                isPrimary
                                  ? "text-primary-container font-semibold"
                                  : enabled
                                    ? "text-on-surface"
                                    : "text-outline"
                              }`}
                            >
                              {model}
                            </span>
                            <span className="font-label-mono text-label-mono uppercase tracking-wider text-outline shrink-0">
                              {isPrimary ? "PRIMARY" : enabled ? `FB ${order}` : "OFF"}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                data-testid={`model-chip-${model}`}
                                aria-label={`Make ${model} primary`}
                                title="Make primary"
                                disabled={isPrimary}
                                onClick={() => makePrimary(model)}
                                className={ICON_BTN}
                              >
                                <Star
                                  size={14}
                                  aria-hidden
                                  className={isPrimary ? "fill-current text-primary-container" : ""}
                                />
                              </button>
                              <button
                                type="button"
                                aria-label={`Move ${model} up`}
                                disabled={order < 2}
                                onClick={() => moveModel(order, -1)}
                                className={ICON_BTN}
                              >
                                <ArrowUp size={14} aria-hidden />
                              </button>
                              <button
                                type="button"
                                aria-label={`Move ${model} down`}
                                disabled={!enabled || isPrimary || order === enabledModels.length - 1}
                                onClick={() => moveModel(order, 1)}
                                className={ICON_BTN}
                              >
                                <ArrowDown size={14} aria-hidden />
                              </button>
                              <button
                                type="button"
                                aria-label={`Remove ${model}`}
                                title={isPrimary ? "Make another model primary first" : "Remove"}
                                disabled={isPrimary}
                                onClick={() => forgetModel(model)}
                                className={`${ICON_BTN} hover:text-error`}
                              >
                                <Trash2 size={14} aria-hidden />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {modelRows.length === 0 && (
                        <span className="font-code-sm text-code-sm text-outline">
                          No models yet - fetch them from the endpoint or add one below.
                        </span>
                      )}
                      {modelRows.length > 0 && visibleRows.length === 0 && (
                        <span className="font-code-sm text-code-sm text-outline">
                          No model matches "{modelFilter}".
                        </span>
                      )}
                    </div>

                    <form
                      className="flex items-center gap-space-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void addTypedModel();
                      }}
                    >
                      <input
                        className={INPUT}
                        aria-label="Model id"
                        placeholder="Add a model id"
                        value={newModelDraft}
                        onChange={(e) => setNewModelDraft(e.target.value)}
                      />
                      <button
                        type="submit"
                        className={`${BTN} flex items-center gap-1 shrink-0`}
                        disabled={!newModelDraft.trim()}
                        data-testid="save-model-button"
                      >
                        <Plus size={14} aria-hidden />
                        Add
                      </button>
                    </form>
                  </div>
                </div>

                {/* Endpoint config */}
                <div className="space-y-space-3">
                  <h4 className={SECTION_LABEL}>Endpoint &amp; Pacing</h4>
                  <div className={`${CARD} space-y-space-3`}>
                    <label className="block space-y-space-1">
                      <span className="font-code-sm text-code-sm text-on-surface-variant">Base URL</span>
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
                    <div className="flex flex-wrap items-center gap-space-2">
                      <button
                        type="button"
                        className={BTN_PRIMARY}
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
                        disabled={busy === "ping"}
                        data-testid="ping-provider-button"
                        onClick={async () => {
                          setBusy("ping");
                          setError(null);
                          try {
                            setPingResult(
                              await testProvider(selected.id, { model: selected.model || null })
                            );
                          } catch (err) {
                            setError(message(err, "Connection test failed"));
                          } finally {
                            setBusy(null);
                          }
                        }}
                      >
                        {busy === "ping" ? "Testing…" : "Test connection"}
                      </button>
                    </div>
                    {pingResult && (
                      <p
                        data-testid="ping-result"
                        className={`font-code-sm text-code-sm break-words ${
                          pingResult.ok ? "text-verdict-survived" : "text-error"
                        }`}
                      >
                        {pingResult.ok ? "OK" : "FAILED"} - {pingResult.detail}
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
                          <p className="font-code-sm text-code-sm text-on-surface truncate">{key.hint}</p>
                          {key.label && (
                            <p className="font-code-sm text-code-sm text-outline truncate">{key.label}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-space-2 shrink-0">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={key.enabled}
                            aria-label={`Toggle key ${key.hint}`}
                            onClick={() => {
                              setKeys((list) =>
                                list.map((k) => (k.id === key.id ? { ...k, enabled: !k.enabled } : k))
                              );
                              void runKey(
                                () => setKeyEnabled(key.id, !key.enabled),
                                key.enabled ? "Key disabled" : "Key enabled"
                              );
                            }}
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
                          {confirming === `key:${key.id}` ? (
                            <>
                              <button
                                type="button"
                                className={`${BTN_DANGER} bg-error/10 font-medium`}
                                aria-label={`Confirm delete key ${key.hint}`}
                                onClick={() => {
                                  setConfirming(null);
                                  setKeys((list) => list.filter((k) => k.id !== key.id));
                                  void runKey(() => deleteProviderKey(key.id), "Key deleted");
                                }}
                              >
                                Confirm
                              </button>
                              <button type="button" className={BTN} onClick={() => setConfirming(null)}>
                                Keep
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className={BTN_DANGER}
                              aria-label={`Delete key ${key.hint}`}
                              onClick={() => setConfirming(`key:${key.id}`)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    <form
                      className="flex flex-col sm:flex-row items-stretch sm:items-center gap-space-2 pt-space-1"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!keyDraft.trim()) return;
                        const ok = await runKey(
                          () => addProviderKey(selected.id, keyDraft.trim(), keyLabelDraft.trim()),
                          "Key added"
                        );
                        if (ok) {
                          setKeyDraft("");
                          setKeyLabelDraft("");
                        }
                      }}
                    >
                      <input
                        className={INPUT}
                        type="password"
                        aria-label="New API key"
                        placeholder="Paste API key"
                        autoComplete="off"
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
                        type="submit"
                        className={`${BTN_PRIMARY} shrink-0`}
                        disabled={!keyDraft.trim()}
                        data-testid="add-key-button"
                      >
                        Add key
                      </button>
                    </form>
                    <p className="font-code-sm text-code-sm text-outline">
                      Multiple keys are rotated across, so free-tier limits multiply.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
