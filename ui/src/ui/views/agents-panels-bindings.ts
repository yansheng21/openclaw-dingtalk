import { html, nothing, type TemplateResult } from "lit";
import { t } from "../../i18n/index.ts";
import type { ChannelsStatusSnapshot } from "../types.ts";
import type { AgentContext } from "./agents-utils.ts";
import { renderAgentContextCard } from "./agents-panels-status-files.ts";

export type AgentBindingDraft = {
  channel: string;
  accountId: string;
  comment?: string;
};

export type ExactAgentBinding = {
  index: number;
  agentId: string;
  channel: string;
  accountId: string;
  comment?: string;
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeLookup(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function isExactRouteBinding(binding: JsonRecord, match: JsonRecord): boolean {
  const type = asString(binding.type);
  if (type && type !== "route") {
    return false;
  }
  const keys = Object.keys(match);
  return keys.length > 0 && keys.every((key) => key === "channel" || key === "accountId");
}

function collectBindingDetails(configForm: Record<string, unknown> | null) {
  const rows = Array.isArray((configForm as { bindings?: unknown[] } | null)?.bindings)
    ? ((configForm as { bindings?: unknown[] }).bindings ?? [])
    : [];
  const exactBindings: ExactAgentBinding[] = [];
  let advancedCount = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const binding = asRecord(rows[index]);
    const match = asRecord(binding?.match);
    const agentId = asString(binding?.agentId);
    const channel = asString(match?.channel);
    const accountId = asString(match?.accountId);
    if (!binding || !match || !agentId || !channel) {
      continue;
    }
    if (accountId && isExactRouteBinding(binding, match)) {
      exactBindings.push({
        index,
        agentId,
        channel,
        accountId,
        comment: asString(binding.comment) ?? undefined,
      });
      continue;
    }
    advancedCount += 1;
  }
  return {
    exactBindings,
    advancedCount,
  };
}

export function countExactBindingsForAgent(
  configForm: Record<string, unknown> | null,
  agentId: string,
): number | null {
  if (!configForm) {
    return null;
  }
  const normalizedAgentId = normalizeLookup(agentId);
  return collectBindingDetails(configForm).exactBindings.filter(
    (binding) => normalizeLookup(binding.agentId) === normalizedAgentId,
  ).length;
}

function resolveChannelLabel(snapshot: ChannelsStatusSnapshot | null, channelId: string): string {
  const meta = snapshot?.channelMeta?.find((entry) => entry.id === channelId);
  if (meta?.label) {
    return meta.label;
  }
  return snapshot?.channelLabels?.[channelId] ?? channelId;
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

function setBindingDialogError(dialog: HTMLDialogElement, message: string | null) {
  const error = dialog.querySelector<HTMLElement>("[data-agent-binding-error]");
  if (!error) {
    return;
  }
  if (!message) {
    error.textContent = "";
    error.setAttribute("hidden", "");
    return;
  }
  error.textContent = message;
  error.removeAttribute("hidden");
}

function seedBindingDialog(
  dialog: HTMLDialogElement,
  mode: "create" | "edit",
  seed?: Partial<AgentBindingDraft> & { index?: number },
) {
  dialog.dataset.mode = mode;
  dialog.dataset.bindingIndex =
    typeof seed?.index === "number" && Number.isInteger(seed.index) ? String(seed.index) : "";
  const channelInput = dialog.querySelector<HTMLInputElement>("[data-agent-binding-channel]");
  const accountInput = dialog.querySelector<HTMLInputElement>("[data-agent-binding-account]");
  const commentInput = dialog.querySelector<HTMLInputElement>("[data-agent-binding-comment]");
  const title = dialog.querySelector<HTMLElement>("[data-agent-binding-title]");
  const subtitle = dialog.querySelector<HTMLElement>("[data-agent-binding-sub]");
  const submit = dialog.querySelector<HTMLButtonElement>("[data-agent-binding-submit]");
  if (channelInput) {
    channelInput.value = seed?.channel?.trim() ?? "";
  }
  if (accountInput) {
    accountInput.value = seed?.accountId?.trim() ?? "";
  }
  if (commentInput) {
    commentInput.value = seed?.comment?.trim() ?? "";
  }
  if (title) {
    title.textContent =
      mode === "edit" ? t("agentsPage.bindings.dialogEditTitle") : t("agentsPage.bindings.dialogAddTitle");
  }
  if (subtitle) {
    subtitle.textContent =
      mode === "edit"
        ? t("agentsPage.bindings.dialogEditSubtitle")
        : t("agentsPage.bindings.dialogAddSubtitle");
  }
  if (submit) {
    submit.textContent =
      mode === "edit" ? t("agentsPage.bindings.saveEdit") : t("agentsPage.bindings.createBinding");
  }
  setBindingDialogError(dialog, null);
}

function validateBindingDraft(params: {
  draft: AgentBindingDraft;
  currentIndex: number | null;
  exactBindings: ExactAgentBinding[];
}): { field: "channel" | "accountId"; message: string } | null {
  const channel = params.draft.channel.trim();
  const accountId = params.draft.accountId.trim();
  if (!channel) {
    return { field: "channel", message: t("agentsPage.bindings.requiredChannel") };
  }
  if (!accountId) {
    return { field: "accountId", message: t("agentsPage.bindings.requiredAccount") };
  }
  const duplicate = params.exactBindings.find((binding) => {
    if (params.currentIndex != null && binding.index === params.currentIndex) {
      return false;
    }
    return (
      normalizeLookup(binding.channel) === normalizeLookup(channel) &&
      normalizeLookup(binding.accountId) === normalizeLookup(accountId)
    );
  });
  if (duplicate) {
    return {
      field: "accountId",
      message: t("agentsPage.bindings.duplicateExact", {
        agentId: duplicate.agentId,
      }),
    };
  }
  return null;
}

function renderBindingRow(params: {
  binding: ExactAgentBinding;
  snapshot: ChannelsStatusSnapshot | null;
  onEdit: (event: Event, binding: ExactAgentBinding) => void;
  onRemove: (binding: ExactAgentBinding) => void;
}): TemplateResult {
  const { binding, snapshot, onEdit, onRemove } = params;
  return html`
    <div class="agent-bindings-table__row" data-binding-index=${String(binding.index)}>
      <div class="agent-bindings-table__cell">
        <div class="agent-bindings-table__primary">
          ${resolveChannelLabel(snapshot, binding.channel)}
        </div>
        <div class="agent-bindings-table__secondary mono">${binding.channel}</div>
      </div>
      <div class="agent-bindings-table__cell">
        <div class="agent-bindings-table__primary mono">${binding.accountId}</div>
      </div>
      <div class="agent-bindings-table__cell">
        ${
          binding.comment
            ? html`<div class="agent-bindings-table__primary">${binding.comment}</div>`
            : html`<div class="agent-bindings-table__secondary">${t("agentsPage.bindings.noComment")}</div>`
        }
      </div>
      <div class="agent-bindings-table__actions">
        <button class="btn btn--sm" type="button" @click=${(event: Event) => onEdit(event, binding)}>
          ${t("agentsPage.bindings.edit")}
        </button>
        <button class="btn btn--sm" type="button" @click=${() => onRemove(binding)}>
          ${t("agentsPage.bindings.remove")}
        </button>
      </div>
    </div>
  `;
}

export function renderAgentBindings(params: {
  agentId: string;
  context: AgentContext;
  configForm: Record<string, unknown> | null;
  configLoading: boolean;
  configSaving: boolean;
  configDirty: boolean;
  snapshot: ChannelsStatusSnapshot | null;
  onConfigReload: () => void;
  onConfigSave: () => void;
  onSaveBinding: (agentId: string, bindingIndex: number | null, draft: AgentBindingDraft) => void;
  onRemoveBinding: (bindingIndex: number) => void;
}) {
  const details = collectBindingDetails(params.configForm);
  const normalizedAgentId = normalizeLookup(params.agentId);
  const exactBindings = details.exactBindings.filter(
    (binding) => normalizeLookup(binding.agentId) === normalizedAgentId,
  );
  const otherExactCount = details.exactBindings.length - exactBindings.length;
  const channelOptions = Array.from(
    new Set(
      [
        ...(params.snapshot?.channelOrder ?? []),
        ...Object.keys(params.snapshot?.channelAccounts ?? {}),
        ...details.exactBindings.map((binding) => binding.channel),
      ].filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const accountOptions = Array.from(
    new Set(
      [
        ...Object.values(params.snapshot?.channelAccounts ?? {}).flatMap((entries) =>
          entries
            .map((entry) => (typeof entry.accountId === "string" ? entry.accountId.trim() : ""))
            .filter(Boolean),
        ),
        ...details.exactBindings.map((binding) => binding.accountId),
      ].filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const disabled = !params.configForm || params.configLoading || params.configSaving;

  const openDialog = (
    target: HTMLElement | null,
    mode: "create" | "edit",
    seed?: Partial<AgentBindingDraft> & { index?: number },
  ) => {
    const root = target?.closest(".agent-bindings-root");
    const dialog = root?.querySelector<HTMLDialogElement>("[data-agent-binding-dialog]");
    if (!(dialog instanceof HTMLDialogElement)) {
      return;
    }
    seedBindingDialog(dialog, mode, seed);
    showDialog(dialog);
    dialog.querySelector<HTMLInputElement>("[data-agent-binding-channel]")?.focus();
  };

  return html`
    <div class="agent-bindings-root">
      <section class="grid grid-cols-2">
        ${renderAgentContextCard(params.context, t("agentsPage.bindings.contextSubtitle"))}
        <section class="card">
          <div class="card-title">${t("agentsPage.bindings.summaryTitle")}</div>
          <div class="card-sub">${t("agentsPage.bindings.summarySubtitle")}</div>
          <div class="agent-bindings-summary">
            <div class="agent-bindings-stat">
              <div class="label">${t("agentsPage.bindings.exactCountLabel")}</div>
              <div class="agent-bindings-stat__value">${String(exactBindings.length)}</div>
            </div>
            <div class="agent-bindings-stat">
              <div class="label">${t("agentsPage.bindings.otherExactCountLabel")}</div>
              <div class="agent-bindings-stat__value">${String(otherExactCount)}</div>
            </div>
            <div class="agent-bindings-stat">
              <div class="label">${t("agentsPage.bindings.advancedCountLabel")}</div>
              <div class="agent-bindings-stat__value">${String(details.advancedCount)}</div>
            </div>
          </div>
        </section>
      </section>

      <section class="card">
        <div class="row" style="justify-content: space-between; gap: 12px; align-items: start;">
          <div>
            <div class="card-title">${t("agentsPage.bindings.title")}</div>
            <div class="card-sub">${t("agentsPage.bindings.subtitle")}</div>
          </div>
          <div class="agent-model-actions">
            <button
              type="button"
              class="btn btn--sm"
              ?disabled=${disabled}
              @click=${(event: Event) => openDialog(event.currentTarget as HTMLElement, "create")}
            >
              ${t("agentsPage.bindings.add")}
            </button>
            <button type="button" class="btn btn--sm" ?disabled=${params.configLoading} @click=${params.onConfigReload}>
              ${t("agentsPage.shared.reloadConfig")}
            </button>
            <button
              type="button"
              class="btn btn--sm primary"
              ?disabled=${params.configSaving || !params.configDirty}
              @click=${params.onConfigSave}
            >
              ${params.configSaving ? t("agentsPage.shared.saving") : t("agentsPage.shared.save")}
            </button>
          </div>
        </div>

        ${
          !params.configForm
            ? html`
                <div class="callout info" style="margin-top: 12px;">
                  ${t("agentsPage.bindings.loadConfigHint")}
                </div>
              `
            : nothing
        }
        ${
          params.configDirty
            ? html`
                <div class="callout warn" style="margin-top: 12px;">
                  ${t("agentsPage.bindings.unsavedChanges")}
                </div>
              `
            : nothing
        }
        ${
          details.advancedCount > 0
            ? html`
                <div class="callout info" style="margin-top: 12px;">
                  ${t("agentsPage.bindings.advancedHint", {
                    count: String(details.advancedCount),
                  })}
                </div>
              `
            : nothing
        }

        <div class="agent-bindings-table" style="margin-top: 16px;">
          <div class="agent-bindings-table__head">
            <div>${t("agentsPage.bindings.channelLabel")}</div>
            <div>${t("agentsPage.bindings.accountLabel")}</div>
            <div>${t("agentsPage.bindings.commentLabel")}</div>
            <div>${t("agentsPage.bindings.actionsLabel")}</div>
          </div>
          ${
            exactBindings.length > 0
              ? exactBindings.map((binding) =>
                  renderBindingRow({
                    binding,
                    snapshot: params.snapshot,
                    onEdit: (event, entry) => openDialog(event.currentTarget as HTMLElement, "edit", entry),
                    onRemove: (entry) => params.onRemoveBinding(entry.index),
                  }),
                )
              : html`
                  <div class="agent-bindings-table__empty">${t("agentsPage.bindings.empty")}</div>
                `
          }
        </div>
      </section>

      <dialog
        class="agent-create-dialog agent-binding-dialog"
        data-agent-binding-dialog
        @click=${(event: Event) => {
          const dialog = event.currentTarget as HTMLDialogElement;
          if (event.target === dialog) {
            hideDialog(dialog);
          }
        }}
      >
        <form
          class="agent-create-dialog__panel"
          method="dialog"
          @submit=${(event: Event) => {
            event.preventDefault();
            const form = event.currentTarget as HTMLFormElement;
            const dialog = form.closest("dialog");
            if (!(dialog instanceof HTMLDialogElement)) {
              return;
            }
            const channelInput = form.querySelector<HTMLInputElement>("[data-agent-binding-channel]");
            const accountInput = form.querySelector<HTMLInputElement>("[data-agent-binding-account]");
            const commentInput = form.querySelector<HTMLInputElement>("[data-agent-binding-comment]");
            const currentIndexValue = dialog.dataset.bindingIndex ?? "";
            const currentIndex =
              currentIndexValue && Number.isInteger(Number(currentIndexValue))
                ? Number(currentIndexValue)
                : null;
            const draft: AgentBindingDraft = {
              channel: channelInput?.value.trim() ?? "",
              accountId: accountInput?.value.trim() ?? "",
              comment: commentInput?.value.trim() || undefined,
            };
            const error = validateBindingDraft({
              draft,
              currentIndex,
              exactBindings: details.exactBindings,
            });
            if (error) {
              setBindingDialogError(dialog, error.message);
              if (error.field === "channel") {
                channelInput?.focus();
              } else {
                accountInput?.focus();
              }
              return;
            }
            params.onSaveBinding(params.agentId, currentIndex, draft);
            hideDialog(dialog);
            seedBindingDialog(dialog, "create");
          }}
        >
          <div class="agent-create-dialog__head">
            <div>
              <div class="agent-create-dialog__title" data-agent-binding-title>
                ${t("agentsPage.bindings.dialogAddTitle")}
              </div>
              <div class="agent-create-dialog__sub" data-agent-binding-sub>
                ${t("agentsPage.bindings.dialogAddSubtitle")}
              </div>
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
              ${t("agentsPage.shared.close")}
            </button>
          </div>
          <div class="agent-create-dialog__body">
            <label class="field">
              <span>${t("agentsPage.bindings.channelLabel")}</span>
              <input
                data-agent-binding-channel
                type="text"
                autocomplete="off"
                spellcheck="false"
                list="agent-binding-channels"
                placeholder="dingtalk-connector"
              />
              <small>${t("agentsPage.bindings.channelHelp")}</small>
            </label>
            <label class="field">
              <span>${t("agentsPage.bindings.accountLabel")}</span>
              <input
                data-agent-binding-account
                type="text"
                autocomplete="off"
                spellcheck="false"
                list="agent-binding-accounts"
                placeholder="xiaolong"
              />
              <small>${t("agentsPage.bindings.accountHelp")}</small>
            </label>
            <label class="field">
              <span>${t("agentsPage.bindings.commentLabel")}</span>
              <input
                data-agent-binding-comment
                type="text"
                autocomplete="off"
                spellcheck="false"
                placeholder=${t("agentsPage.bindings.commentPlaceholder")}
              />
              <small>${t("agentsPage.bindings.commentHelp")}</small>
            </label>
            <datalist id="agent-binding-channels">
              ${channelOptions.map((channel) => html`<option value=${channel}></option>`)}
            </datalist>
            <datalist id="agent-binding-accounts">
              ${accountOptions.map((account) => html`<option value=${account}></option>`)}
            </datalist>
            <div class="callout danger" hidden data-agent-binding-error></div>
          </div>
          <div class="agent-create-dialog__actions">
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
              ${t("agentsPage.bindings.cancel")}
            </button>
            <button type="submit" class="btn btn--sm primary" data-agent-binding-submit>
              ${t("agentsPage.bindings.createBinding")}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  `;
}
