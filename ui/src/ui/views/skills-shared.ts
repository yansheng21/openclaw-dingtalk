import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import type { SkillStatusEntry } from "../types.ts";

export function skillSourceLabel(source: string) {
  switch (source) {
    case "openclaw-workspace":
      return t("skillsPage.sources.workspace");
    case "openclaw-bundled":
      return t("skillsPage.sources.bundled");
    case "openclaw-managed":
      return t("skillsPage.sources.managed");
    case "openclaw-extra":
      return t("skillsPage.sources.extra");
    default:
      return source || t("skillsPage.sources.other");
  }
}

export function computeSkillMissing(skill: SkillStatusEntry): string[] {
  return [
    ...skill.missing.bins.map((b) => `${t("skillsPage.missingKinds.bin")}:${b}`),
    ...skill.missing.env.map((e) => `${t("skillsPage.missingKinds.env")}:${e}`),
    ...skill.missing.config.map((c) => `${t("skillsPage.missingKinds.config")}:${c}`),
    ...skill.missing.os.map((o) => `${t("skillsPage.missingKinds.os")}:${o}`),
  ];
}

export function computeSkillReasons(skill: SkillStatusEntry): string[] {
  const reasons: string[] = [];
  if (skill.disabled) {
    reasons.push(t("skillsPage.status.disabled"));
  }
  if (skill.blockedByAllowlist) {
    reasons.push(t("skillsPage.status.blockedByAllowlist"));
  }
  return reasons;
}

export function resolveSkillStatus(skill: SkillStatusEntry): {
  label: string;
  tone: "" | "chip-ok" | "chip-warn" | "chip-danger";
} {
  if (skill.disabled) {
    return { label: t("skillsPage.status.disabled"), tone: "" };
  }
  if (skill.blockedByAllowlist) {
    return { label: t("skillsPage.status.blockedByAllowlist"), tone: "chip-danger" };
  }
  if (skill.eligible) {
    return { label: t("skillsPage.status.eligible"), tone: "chip-ok" };
  }
  return { label: t("skillsPage.status.notReady"), tone: "chip-warn" };
}

export function renderSkillStatusChips(params: {
  skill: SkillStatusEntry;
  showBundledBadge?: boolean;
}) {
  const skill = params.skill;
  const showBundledBadge = Boolean(params.showBundledBadge);
  const status = resolveSkillStatus(skill);
  return html`
    <div class="chip-row" style="margin-top: 6px;">
      <span class="chip">${skillSourceLabel(skill.source)}</span>
      ${
        showBundledBadge
          ? html`
              <span class="chip">${t("skillsPage.status.bundled")}</span>
            `
          : nothing
      }
      <span class="chip ${status.tone}">
        ${status.label}
      </span>
    </div>
  `;
}
