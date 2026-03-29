import { html, nothing, type TemplateResult } from "lit";
import { t } from "../../i18n/index.ts";

type JsonRecord = Record<string, unknown>;

type CatalogModel = {
  providerKey: string;
  providerApiKey?: string;
  providerBaseUrl?: string;
  providerApi?: string;
  id?: string;
  name?: string;
  reference?: string;
  index: number;
};

type CatalogProvider = {
  key: string;
  apiKey?: string;
  baseUrl?: string;
  api?: string;
  models: CatalogModel[];
};

type ModelRefResolution = {
  ref: string;
  kind: "exact" | "id" | "ambiguous" | "missing";
  matches: CatalogModel[];
};

type ModelOverride = {
  ref: string;
  reasoningEffort?: string;
  resolution: ModelRefResolution;
};

type ModelIssue = {
  scope: "primary" | "fallback" | "override" | "allowModel";
  resolution: ModelRefResolution;
};

type RenderConfigModelsOverviewProps = {
  config: Record<string, unknown> | null;
  disabled?: boolean;
  onPatch: (path: Array<string | number>, value: unknown) => void;
};

const REASONING_OPTIONS = ["", "off", "minimal", "low", "medium", "high", "xhigh", "adaptive"] as const;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    next.push(value);
  }
  return next;
}

function renderBadge(
  label: string,
  tone: "neutral" | "ok" | "warn" | "danger" = "neutral",
): TemplateResult {
  return html`<span class="config-models-badge config-models-badge--${tone}">${label}</span>`;
}

function resolutionTone(kind: ModelRefResolution["kind"]): "ok" | "warn" | "danger" {
  if (kind === "exact" || kind === "id") {
    return "ok";
  }
  return kind === "ambiguous" ? "warn" : "danger";
}

function resolutionLabel(kind: ModelRefResolution["kind"]): string {
  switch (kind) {
    case "exact":
      return t("configPage.modelsOverview.rows.exact");
    case "id":
      return t("configPage.modelsOverview.rows.inferred");
    case "ambiguous":
      return t("configPage.modelsOverview.rows.ambiguous");
    default:
      return t("configPage.modelsOverview.rows.missing");
  }
}

function formatResolutionText(resolution: ModelRefResolution): string {
  switch (resolution.kind) {
    case "exact":
      return t("configPage.modelsOverview.rows.resolvedTo", {
        ref: resolution.matches[0]?.reference ?? resolution.ref,
      });
    case "id":
      return t("configPage.modelsOverview.rows.resolvedById", {
        ref: resolution.matches[0]?.reference ?? resolution.ref,
      });
    case "ambiguous":
      return t("configPage.modelsOverview.rows.ambiguousMatch", {
        count: String(resolution.matches.length),
      });
    default:
      return t("configPage.modelsOverview.rows.unmatched");
  }
}

function collectCatalog(config: Record<string, unknown> | null) {
  const root = asRecord(config);
  const modelsSection = asRecord(root?.models);
  const providersRecord = asRecord(modelsSection?.providers) ?? {};
  const providers: CatalogProvider[] = [];
  const allModels: CatalogModel[] = [];
  const byReference = new Map<string, CatalogModel>();
  const byId = new Map<string, CatalogModel[]>();

  for (const [providerKey, providerValue] of Object.entries(providersRecord)) {
    const provider = asRecord(providerValue) ?? {};
    const items = Array.isArray(provider.models) ? provider.models : [];
    const models = items
      .map((entry, index) => {
        const model = asRecord(entry);
        if (!model) {
          return null;
        }
        const id = asString(model.id);
        return {
          providerKey,
          providerApiKey: asString(provider.apiKey),
          providerBaseUrl: asString(provider.baseUrl),
          providerApi: asString(provider.api),
          id,
          name: asString(model.name),
          reference: id ? `${providerKey}/${id}` : undefined,
          index,
        } as CatalogModel;
      })
      .filter((entry): entry is CatalogModel => entry != null);

    providers.push({
      key: providerKey,
      apiKey: asString(provider.apiKey),
      baseUrl: asString(provider.baseUrl),
      api: asString(provider.api),
      models,
    });

    for (const model of models) {
      allModels.push(model);
      if (model.reference) {
        byReference.set(model.reference, model);
      }
      if (model.id) {
        const siblings = byId.get(model.id) ?? [];
        siblings.push(model);
        byId.set(model.id, siblings);
      }
    }
  }

  return {
    providers,
    allModels,
    byReference,
    byId,
  };
}

function resolveModelRef(
  ref: string,
  catalogByReference: Map<string, CatalogModel>,
  catalogById: Map<string, CatalogModel[]>,
): ModelRefResolution {
  const exact = catalogByReference.get(ref);
  if (exact) {
    return { ref, kind: "exact", matches: [exact] };
  }
  if (!ref.includes("/")) {
    const matches = catalogById.get(ref) ?? [];
    if (matches.length === 1) {
      return { ref, kind: "id", matches };
    }
    if (matches.length > 1) {
      return { ref, kind: "ambiguous", matches };
    }
  }
  return { ref, kind: "missing", matches: [] };
}

function collectOverrides(
  agentsDefaults: JsonRecord | null,
  catalogByReference: Map<string, CatalogModel>,
  catalogById: Map<string, CatalogModel[]>,
): ModelOverride[] {
  const rawOverrides = asRecord(agentsDefaults?.models) ?? {};
  return Object.entries(rawOverrides).map(([ref, value]) => {
    const record = asRecord(value);
    const params = asRecord(record?.params);
    return {
      ref,
      reasoningEffort: asString(params?.reasoningEffort),
      resolution: resolveModelRef(ref, catalogByReference, catalogById),
    };
  });
}

function collectIssues(
  primaryResolution: ModelRefResolution | null,
  fallbackResolutions: ModelRefResolution[],
  overrides: ModelOverride[],
  allowModels: ModelRefResolution[],
): ModelIssue[] {
  const issues: ModelIssue[] = [];
  if (primaryResolution && (primaryResolution.kind === "ambiguous" || primaryResolution.kind === "missing")) {
    issues.push({ scope: "primary", resolution: primaryResolution });
  }
  for (const fallback of fallbackResolutions) {
    if (fallback.kind === "ambiguous" || fallback.kind === "missing") {
      issues.push({ scope: "fallback", resolution: fallback });
    }
  }
  for (const override of overrides) {
    if (override.resolution.kind === "ambiguous" || override.resolution.kind === "missing") {
      issues.push({ scope: "override", resolution: override.resolution });
    }
  }
  for (const allowModel of allowModels) {
    if (allowModel.kind === "ambiguous" || allowModel.kind === "missing") {
      issues.push({ scope: "allowModel", resolution: allowModel });
    }
  }
  return issues;
}

function issueScopeLabel(scope: ModelIssue["scope"]): string {
  switch (scope) {
    case "primary":
      return t("configPage.modelsOverview.issues.primary");
    case "fallback":
      return t("configPage.modelsOverview.issues.fallback");
    case "override":
      return t("configPage.modelsOverview.issues.override");
    default:
      return t("configPage.modelsOverview.issues.allowModel");
  }
}

function remapReference(ref: string, refMap: Map<string, string>, removedRefs: Set<string>): string | null {
  const next = refMap.get(ref) ?? ref;
  return removedRefs.has(next) ? null : next;
}

function patchReferenceGraph(params: {
  config: Record<string, unknown> | null;
  onPatch: (path: Array<string | number>, value: unknown) => void;
  refMap?: Map<string, string>;
  removedRefs?: Set<string>;
}) {
  const refMap = params.refMap ?? new Map<string, string>();
  const removedRefs = params.removedRefs ?? new Set<string>();
  const root = asRecord(params.config);
  const agentsDefaults = asRecord(asRecord(root?.agents)?.defaults);
  const routing = asRecord(agentsDefaults?.model);
  const rawFallbacks = asStringArray(routing?.fallbacks);
  let nextPrimary = asString(routing?.primary);
  if (nextPrimary) {
    nextPrimary = remapReference(nextPrimary, refMap, removedRefs) ?? undefined;
  }
  let nextFallbacks = uniqueStrings(
    rawFallbacks
      .map((entry) => remapReference(entry, refMap, removedRefs))
      .filter((entry): entry is string => Boolean(entry)),
  );
  if (!nextPrimary && nextFallbacks.length > 0) {
    nextPrimary = nextFallbacks[0];
    nextFallbacks = nextFallbacks.slice(1);
  }
  if (nextPrimary) {
    nextFallbacks = nextFallbacks.filter((entry) => entry !== nextPrimary);
  }
  params.onPatch(["agents", "defaults", "model", "primary"], nextPrimary);
  params.onPatch(["agents", "defaults", "model", "fallbacks"], nextFallbacks);

  const rawOverrides = asRecord(agentsDefaults?.models) ?? {};
  const nextOverrides: JsonRecord = {};
  for (const [key, value] of Object.entries(rawOverrides)) {
    const nextKey = remapReference(key, refMap, removedRefs);
    if (!nextKey) {
      continue;
    }
    nextOverrides[nextKey] = value;
  }
  params.onPatch(
    ["agents", "defaults", "models"],
    Object.keys(nextOverrides).length > 0 ? nextOverrides : undefined,
  );

  const toolsExec = asRecord(asRecord(root?.tools)?.exec);
  const applyPatch = asRecord(toolsExec?.applyPatch);
  const allowModels = asStringArray(applyPatch?.allowModels);
  const nextAllowModels = uniqueStrings(
    allowModels
      .map((entry) => remapReference(entry, refMap, removedRefs))
      .filter((entry): entry is string => Boolean(entry)),
  );
  params.onPatch(["tools", "exec", "applyPatch", "allowModels"], nextAllowModels);
}

function nextProviderKey(existing: string[]): string {
  let index = existing.length + 1;
  let candidate = `provider-${index}`;
  const used = new Set(existing);
  while (used.has(candidate)) {
    index += 1;
    candidate = `provider-${index}`;
  }
  return candidate;
}

function createDefaultModel() {
  return {
    id: "",
    name: "",
  };
}

function createModelEntry(params: { id: string; name?: string }) {
  return {
    id: params.id,
    ...(params.name ? { name: params.name } : {}),
  };
}

function showDialog(dialog: HTMLDialogElement) {
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
    return;
  }
  dialog.setAttribute("open", "");
}

function hideDialog(dialog: HTMLDialogElement) {
  if (typeof dialog.close === "function") {
    dialog.close();
    return;
  }
  dialog.removeAttribute("open");
}

function seedModelDialog(
  dialog: HTMLDialogElement,
  draft: {
    name?: string;
    apiKey?: string;
    baseUrl?: string;
    id?: string;
    reasoningEffort?: string;
  },
) {
  const nameInput = dialog.querySelector<HTMLInputElement>("[data-model-dialog-name]");
  const apiKeyInput = dialog.querySelector<HTMLInputElement>("[data-model-dialog-api-key]");
  const baseUrlInput = dialog.querySelector<HTMLInputElement>("[data-model-dialog-endpoint]");
  const idInput = dialog.querySelector<HTMLInputElement>("[data-model-dialog-id]");
  const reasoningSelect = dialog.querySelector<HTMLSelectElement>("[data-model-dialog-reasoning]");
  if (nameInput) {
    nameInput.value = draft.name ?? "";
  }
  if (apiKeyInput) {
    apiKeyInput.value = draft.apiKey ?? "";
  }
  if (baseUrlInput) {
    baseUrlInput.value = draft.baseUrl ?? "";
  }
  if (idInput) {
    idInput.value = draft.id ?? "";
    idInput.setCustomValidity("");
  }
  if (reasoningSelect) {
    reasoningSelect.value = draft.reasoningEffort ?? "";
  }
}

function renderIssues(issues: ModelIssue[]): TemplateResult | typeof nothing {
  if (issues.length === 0) {
    return nothing;
  }
  return html`
    <div class="config-models-inline-issues">
      ${issues.map(
        (issue) => html`
          <div class="config-models-inline-issue">
            ${renderBadge(issueScopeLabel(issue.scope), resolutionTone(issue.resolution.kind))}
            <span class="config-models-mono">${issue.resolution.ref}</span>
            <span>${formatResolutionText(issue.resolution)}</span>
          </div>
        `,
      )}
    </div>
  `;
}

function renderReferenceSelect(params: {
  value?: string;
  options: Array<{ ref: string; label: string }>;
  disabled?: boolean;
  placeholder: string;
  onChange: (value: string | undefined) => void;
  dataKey?: string;
}): TemplateResult {
  return html`
    <select
      class="config-models-select"
      .value=${params.value ?? ""}
      ?disabled=${params.disabled}
      data-key=${params.dataKey ?? ""}
      @change=${(event: Event) => {
        const raw = (event.target as HTMLSelectElement).value.trim();
        params.onChange(raw || undefined);
      }}
    >
      <option value="">${params.placeholder}</option>
      ${params.options.map(
        (option) => html`<option value=${option.ref}>${option.label}</option>`,
      )}
    </select>
  `;
}

function renderModelDialog(params: {
  mode: "add" | "edit";
  provider: CatalogProvider;
  model?: CatalogModel;
  disabled: boolean;
  onSubmit: (draft: {
    id: string;
    name?: string;
    reasoningEffort?: string;
    apiKey?: string;
    baseUrl?: string;
  }) => void;
}): TemplateResult {
  const title =
    params.mode === "add"
      ? t("configPage.modelsOverview.rows.addModelDialogTitle")
      : t("configPage.modelsOverview.rows.editModelDialogTitle");
  const description =
    params.mode === "add"
      ? t("configPage.modelsOverview.rows.addModelDialogDescription", {
          provider: params.provider.key,
        })
      : t("configPage.modelsOverview.rows.editModelDialogDescription", {
          ref: params.model?.reference ?? `${params.provider.key}/${params.model?.id ?? ""}`,
        });
  const confirmLabel =
    params.mode === "add"
      ? t("configPage.modelsOverview.rows.confirmAddModel")
      : t("configPage.modelsOverview.rows.confirmEditModel");
  const dialogKey =
    params.mode === "add"
      ? `add:${params.provider.key}`
      : `edit:${params.provider.key}:${params.model?.index ?? -1}`;
  return html`
    <dialog
      class="config-models-dialog"
      data-model-dialog=${dialogKey}
      @click=${(event: Event) => {
        const dialog = event.currentTarget as HTMLDialogElement;
        if (event.target === dialog) {
          hideDialog(dialog);
        }
      }}
    >
      <form
        class="config-models-dialog__panel"
        method="dialog"
        @submit=${(event: Event) => {
          event.preventDefault();
          const form = event.currentTarget as HTMLFormElement;
          if (!form.reportValidity()) {
            return;
          }
          const dialog = form.closest("dialog");
          if (!(dialog instanceof HTMLDialogElement)) {
            return;
          }
          const nameInput = form.querySelector<HTMLInputElement>("[data-model-dialog-name]");
          const apiKeyInput = form.querySelector<HTMLInputElement>("[data-model-dialog-api-key]");
          const baseUrlInput = form.querySelector<HTMLInputElement>("[data-model-dialog-endpoint]");
          const idInput = form.querySelector<HTMLInputElement>("[data-model-dialog-id]");
          const reasoningSelect = form.querySelector<HTMLSelectElement>("[data-model-dialog-reasoning]");
          const id = idInput?.value.trim() ?? "";
          const duplicateId = params.provider.models.some(
            (model) => model.id === id && model.index !== params.model?.index,
          );
          if (duplicateId && idInput) {
            idInput.setCustomValidity(t("configPage.modelsOverview.rows.modelIdDuplicate"));
            idInput.reportValidity();
            return;
          }
          if (idInput) {
            idInput.setCustomValidity("");
          }
          params.onSubmit({
            id,
            name: nameInput?.value.trim() || undefined,
            reasoningEffort: reasoningSelect?.value.trim() || undefined,
            apiKey: apiKeyInput?.value.trim() || undefined,
            baseUrl: baseUrlInput?.value.trim() || undefined,
          });
          form.reset();
          hideDialog(dialog);
        }}
      >
        <div class="config-models-dialog__head">
          <div>
            <div class="config-models-dialog__title">${title}</div>
            <div class="config-models-dialog__sub">${description}</div>
          </div>
          <button
            type="button"
            class="btn btn--sm"
            @click=${(event: Event) => {
              const dialog = (event.currentTarget as HTMLElement).closest("dialog");
              if (dialog instanceof HTMLDialogElement) {
                hideDialog(dialog);
              }
            }}
          >
            ${t("configPage.modelsOverview.rows.cancelDialog")}
          </button>
        </div>
        <div class="config-models-dialog__body">
          <label class="config-models-control">
            <span class="config-models-control__label">${t("configPage.modelsOverview.table.name")}</span>
            <input
              class="config-models-input"
              type="text"
              data-model-dialog-name
              placeholder=${t("configPage.modelsOverview.rows.displayNamePlaceholder")}
              ?disabled=${params.disabled}
            />
          </label>
          <label class="config-models-control">
            <span class="config-models-control__label">${t("configPage.modelsOverview.table.apiKey")}</span>
            <input
              class="config-models-input config-models-input--mono"
              type="text"
              data-model-dialog-api-key
              placeholder=${t("configPage.modelsOverview.rows.notConfigured")}
              ?disabled=${params.disabled}
            />
          </label>
          <label class="config-models-control">
            <span class="config-models-control__label">${t("configPage.modelsOverview.table.endpoint")}</span>
            <input
              class="config-models-input config-models-input--mono"
              type="text"
              data-model-dialog-endpoint
              placeholder="https://api.example.com/v1"
              ?disabled=${params.disabled}
            />
          </label>
          <label class="config-models-control">
            <span class="config-models-control__label">${t("configPage.modelsOverview.table.model")}</span>
            <input
              class="config-models-input config-models-input--mono"
              type="text"
              data-model-dialog-id
              required
              placeholder=${t("configPage.modelsOverview.rows.modelIdPlaceholder")}
              ?disabled=${params.disabled}
              @input=${(event: Event) => {
                (event.currentTarget as HTMLInputElement).setCustomValidity("");
              }}
            />
          </label>
          <label class="config-models-control">
            <span class="config-models-control__label">${t("configPage.modelsOverview.table.reasoning")}</span>
            <select
              class="config-models-select"
              data-model-dialog-reasoning
              ?disabled=${params.disabled}
            >
              <option value="">${t("configPage.modelsOverview.rows.reasoningInherit")}</option>
              ${REASONING_OPTIONS.slice(1).map(
                (option) => html`<option value=${option}>${option}</option>`,
              )}
            </select>
          </label>
        </div>
        <div class="config-models-dialog__actions">
          <button
            type="button"
            class="btn btn--sm"
            @click=${(event: Event) => {
              const dialog = (event.currentTarget as HTMLElement).closest("dialog");
              if (dialog instanceof HTMLDialogElement) {
                hideDialog(dialog);
              }
            }}
          >
            ${t("configPage.modelsOverview.rows.cancelDialog")}
          </button>
          <button
            type="submit"
            class="btn btn--sm primary"
            data-model-dialog-save
            ?disabled=${params.disabled}
          >
            ${confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  `;
}

export function renderConfigModelsOverview(props: RenderConfigModelsOverviewProps) {
  const root = asRecord(props.config);
  const disabled = props.disabled ?? false;
  const agentsDefaults = asRecord(asRecord(root?.agents)?.defaults);
  const toolsRoot = asRecord(root?.tools);
  const toolsExec = asRecord(toolsRoot?.exec);
  const applyPatch = asRecord(toolsExec?.applyPatch);
  const modelRouting = asRecord(agentsDefaults?.model);
  const primaryRef = asString(modelRouting?.primary);
  const fallbackRefs = asStringArray(modelRouting?.fallbacks);
  const thinkingDefault = asString(agentsDefaults?.thinkingDefault);
  const toolsProfile = asString(toolsRoot?.profile);
  const execSecurity = asString(toolsExec?.security);
  const execAsk = asString(toolsExec?.ask);
  const applyPatchEnabled = asBoolean(applyPatch?.enabled);
  const applyPatchWorkspaceOnly = asBoolean(applyPatch?.workspaceOnly);
  const applyPatchAllowModels = asStringArray(applyPatch?.allowModels);

  const catalog = collectCatalog(props.config);
  const routeOptions = uniqueStrings(
    catalog.allModels.map((model) => model.reference).filter((entry): entry is string => Boolean(entry)),
  )
    .sort((a, b) => a.localeCompare(b))
    .map((ref) => {
      const match = catalog.byReference.get(ref);
      const label = match?.name
        ? `${match.name} · ${ref}`
        : ref;
      return { ref, label };
    });
  const primaryResolution = primaryRef ? resolveModelRef(primaryRef, catalog.byReference, catalog.byId) : null;
  const fallbackResolutions = fallbackRefs.map((ref) => resolveModelRef(ref, catalog.byReference, catalog.byId));
  const overrides = collectOverrides(agentsDefaults, catalog.byReference, catalog.byId);
  const allowModelRefs = applyPatchAllowModels.map((ref) => resolveModelRef(ref, catalog.byReference, catalog.byId));
  const issues = collectIssues(primaryResolution, fallbackResolutions, overrides, allowModelRefs);
  const overrideByRef = new Map(overrides.map((override) => [override.ref, override]));

  const primaryResolvedRefs = new Set(
    primaryResolution?.matches.map((entry) => entry.reference).filter((entry): entry is string => Boolean(entry)) ?? [],
  );
  const fallbackResolvedRefs = new Set(
    fallbackResolutions.flatMap((entry) => entry.matches.map((match) => match.reference).filter(Boolean)),
  );
  const allowResolvedRefs = new Set(
    allowModelRefs.flatMap((entry) => entry.matches.map((match) => match.reference).filter(Boolean)),
  );
  const routeChain = [primaryRef, ...fallbackRefs].filter((entry): entry is string => Boolean(entry));

  const fullPermission =
    execSecurity === "full" &&
    execAsk === "off" &&
    applyPatchEnabled === true &&
    applyPatchWorkspaceOnly !== true;
  const permissionLimits: string[] = [];
  if (execSecurity !== "full") {
    permissionLimits.push(t("configPage.modelsOverview.rows.permissionExecLimited"));
  }
  if (execAsk !== "off") {
    permissionLimits.push(t("configPage.modelsOverview.rows.permissionApprovalLimited"));
  }
  if (applyPatchEnabled !== true) {
    permissionLimits.push(t("configPage.modelsOverview.rows.permissionPatchDisabled"));
  }
  if (applyPatchWorkspaceOnly === true) {
    permissionLimits.push(t("configPage.modelsOverview.rows.permissionWorkspaceOnly"));
  }

  const providersRecord = asRecord(asRecord(root?.models)?.providers) ?? {};

  const addProvider = () => {
    const providerKey = nextProviderKey(Object.keys(providersRecord));
    props.onPatch(["models", "providers", providerKey], {
      api: "openai-completions",
      apiKey: "",
      baseUrl: "",
      models: [createDefaultModel()],
    });
  };

  const renameProvider = (provider: CatalogProvider, rawNextKey: string) => {
    const nextKey = rawNextKey.trim();
    if (!nextKey || nextKey === provider.key || nextKey in providersRecord) {
      return;
    }
    const nextProviders = cloneValue(providersRecord);
    nextProviders[nextKey] = nextProviders[provider.key];
    delete nextProviders[provider.key];
    props.onPatch(["models", "providers"], nextProviders);
    const refMap = new Map<string, string>();
    for (const model of provider.models) {
      if (!model.id || !model.reference) {
        continue;
      }
      refMap.set(model.reference, `${nextKey}/${model.id}`);
    }
    patchReferenceGraph({ config: props.config, onPatch: props.onPatch, refMap });
  };

  const removeProvider = (provider: CatalogProvider) => {
    const nextProviders = cloneValue(providersRecord);
    delete nextProviders[provider.key];
    props.onPatch(["models", "providers"], nextProviders);
    const removedRefs = new Set(
      provider.models.map((model) => model.reference).filter((entry): entry is string => Boolean(entry)),
    );
    patchReferenceGraph({ config: props.config, onPatch: props.onPatch, removedRefs });
  };

  const addModel = (
    provider: CatalogProvider,
    draft: {
      id?: string;
      name?: string;
        reasoningEffort?: string;
        apiKey?: string;
        baseUrl?: string;
      } = {},
  ) => {
    const providerRecord = asRecord(providersRecord[provider.key]);
    const currentModels = Array.isArray(providerRecord?.models) ? cloneValue(providerRecord.models) : [];
    const nextModel =
      draft.id && draft.id.trim().length > 0
        ? createModelEntry({
            id: draft.id.trim(),
            name: draft.name?.trim(),
          })
        : createDefaultModel();
    const nextModels = [...currentModels, nextModel];
    if ((draft.apiKey ?? "") !== (provider.apiKey ?? "")) {
      props.onPatch(
        ["models", "providers", provider.key, "apiKey"],
        draft.apiKey && draft.apiKey.trim().length > 0 ? draft.apiKey.trim() : undefined,
      );
    }
    if ((draft.baseUrl ?? "") !== (provider.baseUrl ?? "")) {
      props.onPatch(
        ["models", "providers", provider.key, "baseUrl"],
        draft.baseUrl && draft.baseUrl.trim().length > 0 ? draft.baseUrl.trim() : undefined,
      );
    }
    props.onPatch(["models", "providers", provider.key, "models"], nextModels);
    if (!draft.id) {
      return;
    }
    const ref = `${provider.key}/${draft.id.trim()}`;
    setReasoningForRef(ref, draft.reasoningEffort);
  };

  const setReasoningForRef = (ref: string, rawValue: string | undefined) => {
    const nextOverrides = cloneValue(asRecord(agentsDefaults?.models) ?? {});
    if (!rawValue) {
      delete nextOverrides[ref];
      props.onPatch(
        ["agents", "defaults", "models"],
        Object.keys(nextOverrides).length > 0 ? nextOverrides : undefined,
      );
      return;
    }
    const current = asRecord(nextOverrides[ref]) ?? {};
    const paramsRecord = asRecord(current.params) ?? {};
    nextOverrides[ref] = {
      ...current,
      params: {
        ...paramsRecord,
        reasoningEffort: rawValue,
      },
    };
    props.onPatch(["agents", "defaults", "models"], nextOverrides);
  };

  const editModel = (
    provider: CatalogProvider,
    model: CatalogModel,
    draft: {
      id: string;
      name?: string;
      reasoningEffort?: string;
      apiKey?: string;
      baseUrl?: string;
    },
  ) => {
    const nextName = draft.name?.trim() || undefined;
    const nextId = draft.id.trim();
    if ((draft.apiKey ?? "") !== (provider.apiKey ?? "")) {
      props.onPatch(
        ["models", "providers", provider.key, "apiKey"],
        draft.apiKey && draft.apiKey.trim().length > 0 ? draft.apiKey.trim() : undefined,
      );
    }
    if ((draft.baseUrl ?? "") !== (provider.baseUrl ?? "")) {
      props.onPatch(
        ["models", "providers", provider.key, "baseUrl"],
        draft.baseUrl && draft.baseUrl.trim().length > 0 ? draft.baseUrl.trim() : undefined,
      );
    }
    if ((nextName ?? "") !== (model.name ?? "")) {
      props.onPatch(
        ["models", "providers", provider.key, "models", model.index, "name"],
        nextName,
      );
    }
    if (nextId !== (model.id ?? "")) {
      updateModelField(provider, model, "id", nextId);
    }
    const targetRef = `${provider.key}/${nextId}`;
    setReasoningForRef(targetRef, draft.reasoningEffort);
  };

  const updateProviderField = (provider: CatalogProvider, field: "apiKey" | "baseUrl" | "api", rawValue: string) => {
    const nextValue = rawValue.trim();
    props.onPatch(
      ["models", "providers", provider.key, field],
      nextValue.length > 0 ? nextValue : undefined,
    );
  };

  const updateModelField = (provider: CatalogProvider, model: CatalogModel, field: "name" | "id", rawValue: string) => {
    const nextValue = rawValue.trim();
    props.onPatch(
      ["models", "providers", provider.key, "models", model.index, field],
      nextValue.length > 0 ? nextValue : undefined,
    );
    if (field !== "id" || !model.reference) {
      return;
    }
    if (!nextValue) {
      patchReferenceGraph({
        config: props.config,
        onPatch: props.onPatch,
        removedRefs: new Set([model.reference]),
      });
      return;
    }
    const nextRef = `${provider.key}/${nextValue}`;
    if (nextRef === model.reference) {
      return;
    }
    patchReferenceGraph({
      config: props.config,
      onPatch: props.onPatch,
      refMap: new Map([[model.reference, nextRef]]),
    });
  };

  const removeModel = (provider: CatalogProvider, model: CatalogModel) => {
    const providerRecord = asRecord(providersRecord[provider.key]);
    const currentModels = Array.isArray(providerRecord?.models) ? cloneValue(providerRecord.models) : [];
    const nextModels = currentModels.filter((_, index) => index !== model.index);
    props.onPatch(["models", "providers", provider.key, "models"], nextModels);
    if (model.reference) {
      patchReferenceGraph({
        config: props.config,
        onPatch: props.onPatch,
        removedRefs: new Set([model.reference]),
      });
    }
  };

  const addFallback = () => {
    const available = routeOptions.find((option) => !fallbackRefs.includes(option.ref) && option.ref !== primaryRef);
    props.onPatch(
      ["agents", "defaults", "model", "fallbacks"],
      [...fallbackRefs, available?.ref ?? ""],
    );
  };

  const updateFallback = (index: number, value: string | undefined) => {
    const nextFallbacks = [...fallbackRefs];
    nextFallbacks[index] = value ?? "";
    props.onPatch(
      ["agents", "defaults", "model", "fallbacks"],
      nextFallbacks.filter((entry) => entry.length > 0),
    );
  };

  const removeFallback = (index: number) => {
    const nextFallbacks = [...fallbackRefs];
    nextFallbacks.splice(index, 1);
    props.onPatch(["agents", "defaults", "model", "fallbacks"], nextFallbacks);
  };

  const addAllowModel = () => {
    const allowModels = applyPatchAllowModels;
    const available = routeOptions.find((option) => !allowModels.includes(option.ref));
    props.onPatch(
      ["tools", "exec", "applyPatch", "allowModels"],
      [...allowModels, available?.ref ?? ""],
    );
  };

  const updateAllowModel = (index: number, value: string | undefined) => {
    const allowModels = applyPatchAllowModels;
    const nextAllowModels = [...allowModels];
    nextAllowModels[index] = value ?? "";
    props.onPatch(
      ["tools", "exec", "applyPatch", "allowModels"],
      nextAllowModels.filter((entry) => entry.length > 0),
    );
  };

  const removeAllowModel = (index: number) => {
    const allowModels = applyPatchAllowModels;
    const nextAllowModels = [...allowModels];
    nextAllowModels.splice(index, 1);
    props.onPatch(["tools", "exec", "applyPatch", "allowModels"], nextAllowModels);
  };

  return html`
    <section class="config-models-workspace">
      <details class="config-models-editor-card config-models-editor-card--collapsible">
        <summary class="config-models-editor-card__summary">
          <div class="config-models-editor-card__summary-copy">
            <h3 class="config-models-editor-card__title">${t("configPage.modelsOverview.cards.routing")}</h3>
            <p class="config-models-editor-card__description">
              ${primaryRef ?? t("configPage.modelsOverview.rows.none")}
            </p>
          </div>
          <div class="config-models-editor-card__meta">
            ${renderBadge(
              fullPermission
                ? t("configPage.modelsOverview.rows.permissionFull")
                : t("configPage.modelsOverview.rows.permissionLimited"),
              fullPermission ? "ok" : "warn",
            )}
            ${fallbackRefs.length > 0
              ? renderBadge(`${t("configPage.modelsOverview.stats.fallbacks")} ${String(fallbackRefs.length)}`)
              : nothing}
          </div>
        </summary>
        <div class="config-models-route-grid">
          <label class="config-models-control">
            <span class="config-models-control__label">${t("configPage.modelsOverview.rows.primaryModel")}</span>
            ${renderReferenceSelect({
              value: primaryRef,
              options: routeOptions,
              disabled,
              placeholder: t("configPage.modelsOverview.rows.noRouteOptions"),
              dataKey: "primary",
              onChange: (value) => props.onPatch(["agents", "defaults", "model", "primary"], value),
            })}
          </label>

          <label class="config-models-control">
            <span class="config-models-control__label">${t("configPage.modelsOverview.rows.thinkingDefault")}</span>
            <select
              class="config-models-select"
              .value=${thinkingDefault ?? ""}
              ?disabled=${disabled}
              @change=${(event: Event) => {
                const raw = (event.target as HTMLSelectElement).value.trim();
                props.onPatch(["agents", "defaults", "thinkingDefault"], raw || undefined);
              }}
            >
              <option value="">${t("configPage.modelsOverview.rows.reasoningInherit")}</option>
              ${REASONING_OPTIONS.slice(1).map(
                (option) => html`<option value=${option}>${option}</option>`,
              )}
            </select>
          </label>

          <div class="config-models-control config-models-control--full">
            <span class="config-models-control__label">${t("configPage.modelsOverview.rows.routeChain")}</span>
            <div class="config-models-summary-strip">
              <span class="config-models-mono">
                ${routeChain.length > 0 ? routeChain.join(" -> ") : t("configPage.modelsOverview.rows.none")}
              </span>
            </div>
          </div>

          <div class="config-models-control config-models-control--full">
            <span class="config-models-control__label">${t("configPage.modelsOverview.rows.fallbackModels")}</span>
            <div class="config-models-stack">
              ${fallbackRefs.length > 0
                ? fallbackRefs.map(
                    (entry, index) => html`
                      <div class="config-models-inline-row">
                        ${renderReferenceSelect({
                          value: entry,
                          options: routeOptions.filter((option) => option.ref !== primaryRef),
                          disabled,
                          placeholder: t("configPage.modelsOverview.rows.noRouteOptions"),
                          dataKey: `fallback-${index}`,
                          onChange: (value) => updateFallback(index, value),
                        })}
                        <button
                          type="button"
                          class="btn btn--sm"
                          ?disabled=${disabled}
                          @click=${() => removeFallback(index)}
                        >
                          ${t("configPage.modelsOverview.rows.removeFallback")}
                        </button>
                      </div>
                    `,
                  )
                : html`<div class="config-models-empty-inline">${t("configPage.modelsOverview.rows.noFallbacks")}</div>`}
              <div class="config-models-inline-actions">
                <button
                  type="button"
                  class="btn btn--sm"
                  ?disabled=${disabled || routeOptions.length === 0}
                  @click=${addFallback}
                >
                  ${t("configPage.modelsOverview.rows.addFallback")}
                </button>
              </div>
            </div>
          </div>

          <div class="config-models-control config-models-control--full">
            <span class="config-models-control__label">${t("configPage.modelsOverview.rows.allowModels")}</span>
            <div class="config-models-stack">
              ${applyPatchAllowModels.length > 0
                ? applyPatchAllowModels.map(
                    (entry, index) => html`
                      <div class="config-models-inline-row">
                        ${renderReferenceSelect({
                          value: entry,
                          options: routeOptions,
                          disabled,
                          placeholder: t("configPage.modelsOverview.rows.noRouteOptions"),
                          dataKey: `allow-${index}`,
                          onChange: (value) => updateAllowModel(index, value),
                        })}
                        <button
                          type="button"
                          class="btn btn--sm"
                          ?disabled=${disabled}
                          @click=${() => removeAllowModel(index)}
                        >
                          ${t("configPage.modelsOverview.rows.removeAllowModel")}
                        </button>
                      </div>
                    `,
                  )
                : html`<div class="config-models-empty-inline">${t("configPage.modelsOverview.rows.noRestrictions")}</div>`}
              <div class="config-models-inline-actions">
                <button
                  type="button"
                  class="btn btn--sm"
                  ?disabled=${disabled || routeOptions.length === 0}
                  @click=${addAllowModel}
                >
                  ${t("configPage.modelsOverview.rows.addAllowModel")}
                </button>
              </div>
            </div>
          </div>

          <div class="config-models-control config-models-control--full">
            <span class="config-models-control__label">${t("configPage.modelsOverview.rows.permissionStatus")}</span>
            <div class="config-models-permission-note">
              <span>${fullPermission ? t("configPage.modelsOverview.rows.permissionFullHint") : permissionLimits.join("，") || t("configPage.modelsOverview.rows.permissionLimitedHint")}</span>
              <div class="config-models-permission-note__badges">
                ${applyPatchEnabled === true
                  ? renderBadge(t("configPage.modelsOverview.rows.patchEnabledBadge"), "ok")
                  : renderBadge(t("configPage.modelsOverview.rows.patchDisabledBadge"), "warn")}
                ${applyPatchWorkspaceOnly === true
                  ? renderBadge(t("configPage.modelsOverview.rows.patchScopeWorkspace"), "warn")
                  : renderBadge(t("configPage.modelsOverview.rows.patchScopeAll"), "ok")}
              </div>
            </div>
          </div>
        </div>
      </details>

      ${renderIssues(issues)}

      <section class="config-models-editor-card">
        <div class="config-models-editor-card__header">
          <div>
            <h3 class="config-models-editor-card__title">${t("configPage.modelsOverview.cards.models")}</h3>
            <p class="config-models-editor-card__description">${t("configPage.modelsOverview.cards.modelsDescription")}</p>
          </div>
          <button
            type="button"
            class="btn btn--sm"
            data-models-add-provider
            ?disabled=${disabled}
            @click=${addProvider}
          >
            ${t("configPage.modelsOverview.rows.addProvider")}
          </button>
        </div>

        ${
          catalog.providers.length > 0
            ? html`
                <div class="config-models-provider-list">
                  ${catalog.providers.map((provider) => {
                    const modelCount = provider.models.length;
                    const sharedRowSpan = Math.max(modelCount, 1);
                    return html`
                      <section class="config-models-provider" data-provider-key=${provider.key}>
                        <div class="config-models-provider__header">
                          <div class="config-models-provider__meta">
                            <div>
                              <h4 class="config-models-provider__title">${provider.key}</h4>
                              <p class="config-models-provider__subtitle">
                                ${t("configPage.modelsOverview.rows.providerModelCount", {
                                  count: String(modelCount),
                                })}
                              </p>
                            </div>
                            ${renderBadge(
                              t("configPage.modelsOverview.rows.providerModelCount", {
                                count: String(modelCount),
                              }),
                            )}
                          </div>
                          <div class="config-models-provider__actions">
                            <button
                              type="button"
                              class="btn btn--sm"
                              data-add-model=${provider.key}
                              ?disabled=${disabled}
                              @click=${(event: Event) => {
                                const dialog = (event.currentTarget as HTMLElement)
                                  .closest(".config-models-provider")
                                  ?.querySelector<HTMLDialogElement>(`[data-model-dialog="add:${provider.key}"]`);
                                if (!dialog) {
                                  return;
                                }
                                seedModelDialog(dialog, {
                                  name: "",
                                  apiKey: provider.apiKey,
                                  baseUrl: provider.baseUrl,
                                  id: "",
                                  reasoningEffort: "",
                                });
                                showDialog(dialog);
                                dialog.querySelector<HTMLInputElement>("[data-model-dialog-id]")?.focus();
                              }}
                            >
                              ${t("configPage.modelsOverview.rows.addModel")}
                            </button>
                            <button
                              type="button"
                              class="btn btn--sm"
                              ?disabled=${disabled}
                              @click=${() => removeProvider(provider)}
                            >
                              ${t("configPage.modelsOverview.rows.removeProvider")}
                            </button>
                          </div>
                        </div>
                        ${renderModelDialog({
                          mode: "add",
                          provider,
                          disabled,
                          onSubmit: (draft) => addModel(provider, draft),
                        })}

                        <details class="config-models-provider__settings">
                          <summary class="config-models-provider__settings-summary">
                            ${t("configPage.modelsOverview.rows.providerSettings")}
                          </summary>
                          <div class="config-models-provider__form">
                            <label class="config-models-control">
                              <span class="config-models-control__label">${t("configPage.modelsOverview.rows.providerKey")}</span>
                              <input
                                class="config-models-input"
                                type="text"
                                data-provider-key=${provider.key}
                                .value=${provider.key}
                                ?disabled=${disabled}
                                @change=${(event: Event) =>
                                  renameProvider(provider, (event.target as HTMLInputElement).value)}
                              />
                            </label>
                            <label class="config-models-control">
                              <span class="config-models-control__label">${t("configPage.modelsOverview.rows.apiProtocol")}</span>
                              <input
                                class="config-models-input"
                                type="text"
                                .value=${provider.api ?? ""}
                                ?disabled=${disabled}
                                @input=${(event: Event) =>
                                  updateProviderField(provider, "api", (event.target as HTMLInputElement).value)}
                              />
                            </label>
                          </div>
                        </details>

                        <div class="config-models-editor-table-wrap">
                          <table class="config-models-editor-table">
                            <thead>
                              <tr>
                                <th>${t("configPage.modelsOverview.table.name")}</th>
                                <th>${t("configPage.modelsOverview.table.apiKey")}</th>
                                <th>${t("configPage.modelsOverview.table.endpoint")}</th>
                                <th>${t("configPage.modelsOverview.table.model")}</th>
                                <th>${t("configPage.modelsOverview.table.reasoning")}</th>
                                <th>${t("configPage.modelsOverview.table.actions")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${
                                modelCount > 0
                                  ? provider.models.map((model, modelIndex) => {
                                      const reasoning = model.reference
                                        ? overrideByRef.get(model.reference)?.reasoningEffort ?? ""
                                        : "";
                                      const modelResolution = model.reference
                                        ? resolveModelRef(model.reference, catalog.byReference, catalog.byId)
                                        : null;
                                      const displayName =
                                        model.name ?? model.id ?? t("configPage.modelsOverview.rows.none");
                                      const badges = [
                                        model.reference && primaryResolvedRefs.has(model.reference)
                                          ? renderBadge(t("configPage.modelsOverview.rows.primaryBadge"), "ok")
                                          : nothing,
                                        model.reference && fallbackResolvedRefs.has(model.reference)
                                          ? renderBadge(t("configPage.modelsOverview.rows.fallbackBadge"), "warn")
                                          : nothing,
                                        model.reference && allowResolvedRefs.has(model.reference)
                                          ? renderBadge(t("configPage.modelsOverview.rows.applyPatchBadge"))
                                          : nothing,
                                        modelResolution
                                          ? renderBadge(
                                              resolutionLabel(modelResolution.kind),
                                              resolutionTone(modelResolution.kind),
                                            )
                                          : nothing,
                                      ];
                                      return html`
                                        <tr data-model-ref=${model.reference ?? `${provider.key}:${model.index}`}>
                                          <td>
                                            <div class="config-models-cell">
                                              <span class="config-models-text">${displayName}</span>
                                              <div class="config-models-row-meta">
                                                ${badges}
                                              </div>
                                            </div>
                                          </td>
                                          ${
                                            modelIndex === 0
                                              ? html`
                                                  <td rowspan=${sharedRowSpan} class="config-models-editor-table__shared">
                                                    <span class="config-models-mono">
                                                      ${provider.apiKey ?? t("configPage.modelsOverview.rows.notConfigured")}
                                                    </span>
                                                  </td>
                                                  <td rowspan=${sharedRowSpan} class="config-models-editor-table__shared">
                                                    <span class="config-models-mono">
                                                      ${provider.baseUrl ?? t("configPage.modelsOverview.rows.notConfigured")}
                                                    </span>
                                                  </td>
                                                `
                                              : nothing
                                          }
                                          <td>
                                            <span class="config-models-mono">
                                              ${model.id ?? t("configPage.modelsOverview.rows.notConfigured")}
                                            </span>
                                          </td>
                                          <td>
                                            <span class="config-models-mono">
                                              ${reasoning || t("configPage.modelsOverview.rows.reasoningInherit")}
                                            </span>
                                          </td>
                                          <td class="config-models-editor-table__actions">
                                            <div class="config-models-table-actions">
                                              <button
                                                type="button"
                                                class="btn btn--sm"
                                                data-edit-model=${`${provider.key}:${model.index}`}
                                                ?disabled=${disabled}
                                                @click=${(event: Event) => {
                                                  const dialog = (event.currentTarget as HTMLElement)
                                                    .closest(".config-models-provider")
                                                    ?.querySelector<HTMLDialogElement>(
                                                      `[data-model-dialog="edit:${provider.key}:${model.index}"]`,
                                                    );
                                                  if (!dialog) {
                                                    return;
                                                  }
                                                  seedModelDialog(dialog, {
                                                    name: model.name,
                                                    apiKey: provider.apiKey,
                                                    baseUrl: provider.baseUrl,
                                                    id: model.id,
                                                    reasoningEffort: reasoning,
                                                  });
                                                  showDialog(dialog);
                                                  dialog.querySelector<HTMLInputElement>("[data-model-dialog-name]")?.focus();
                                                }}
                                              >
                                                ${t("configPage.modelsOverview.rows.editModel")}
                                              </button>
                                              ${renderModelDialog({
                                                mode: "edit",
                                                provider,
                                                model,
                                                disabled,
                                                onSubmit: (draft) => editModel(provider, model, draft),
                                              })}
                                            <button
                                              type="button"
                                              class="btn btn--sm"
                                              ?disabled=${disabled}
                                              @click=${() => removeModel(provider, model)}
                                            >
                                              ${t("configPage.modelsOverview.rows.removeModel")}
                                            </button>
                                            </div>
                                          </td>
                                        </tr>
                                      `;
                                    })
                                  : html`
                                      <tr>
                                        <td class="config-models-editor-table__empty">${t("configPage.modelsOverview.rows.noModels")}</td>
                                        <td class="config-models-editor-table__shared">
                                          <span class="config-models-mono">
                                            ${provider.apiKey ?? t("configPage.modelsOverview.rows.notConfigured")}
                                          </span>
                                        </td>
                                        <td class="config-models-editor-table__shared">
                                          <span class="config-models-mono">
                                            ${provider.baseUrl ?? t("configPage.modelsOverview.rows.notConfigured")}
                                          </span>
                                        </td>
                                        <td colspan="3" class="config-models-editor-table__empty">
                                          ${t("configPage.modelsOverview.rows.noModels")}
                                        </td>
                                      </tr>
                                    `
                              }
                            </tbody>
                          </table>
                        </div>
                      </section>
                    `;
                  })}
                </div>
              `
            : html`
                <div class="config-models-empty-panel">
                  <p>${t("configPage.modelsOverview.rows.noProviders")}</p>
                  <button
                    type="button"
                    class="btn btn--sm"
                    ?disabled=${disabled}
                    @click=${addProvider}
                  >
                    ${t("configPage.modelsOverview.rows.addProvider")}
                  </button>
                </div>
              `
        }
      </section>
    </section>
  `;
}
