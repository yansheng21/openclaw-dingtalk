import { i18n, t } from "../i18n/index.ts";
import { formatDurationHuman as baseFormatDurationHuman } from "../../../src/infra/format-time/format-duration.ts";
import { formatRelativeTimestamp as baseFormatRelativeTimestamp } from "../../../src/infra/format-time/format-relative.ts";
import { stripAssistantInternalScaffolding } from "../../../src/shared/text/assistant-visible-text.js";

function getUiLocale() {
  return i18n.getLocale();
}

function isChineseLocale(locale: string) {
  return locale.startsWith("zh");
}

export function formatRelativeTimestamp(
  timestampMs: number | null | undefined,
  options?: { dateFallback?: boolean; timezone?: string; fallback?: string },
): string {
  const locale = getUiLocale();
  const fallback = options?.fallback ?? t("common.na");
  if (!isChineseLocale(locale)) {
    return baseFormatRelativeTimestamp(timestampMs, { ...options, fallback });
  }
  if (timestampMs == null || !Number.isFinite(timestampMs)) {
    return fallback;
  }

  const diff = Date.now() - timestampMs;
  const absDiff = Math.abs(diff);
  const isPast = diff >= 0;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "always" });

  const sec = Math.round(absDiff / 1000);
  if (sec < 60) {
    return isPast ? t("common.justNow") : t("common.inLessThanMinute");
  }

  const min = Math.round(sec / 60);
  if (min < 60) {
    return rtf.format(isPast ? -min : min, "minute");
  }

  const hr = Math.round(min / 60);
  if (hr < 48) {
    return rtf.format(isPast ? -hr : hr, "hour");
  }

  const day = Math.round(hr / 24);
  if (!options?.dateFallback || day <= 7) {
    return rtf.format(isPast ? -day : day, "day");
  }

  try {
    return new Intl.DateTimeFormat(locale, {
      month: locale === "zh-TW" ? "short" : "numeric",
      day: "numeric",
      ...(options.timezone ? { timeZone: options.timezone } : {}),
    }).format(new Date(timestampMs));
  } catch {
    return rtf.format(isPast ? -day : day, "day");
  }
}

export function formatDurationHuman(ms?: number | null, fallback = t("common.na")): string {
  const locale = getUiLocale();
  if (!isChineseLocale(locale)) {
    return baseFormatDurationHuman(ms, fallback);
  }
  if (ms == null || !Number.isFinite(ms) || ms < 0) {
    return fallback;
  }
  if (ms < 1000) {
    return `${Math.round(ms)}毫秒`;
  }
  const sec = Math.round(ms / 1000);
  if (sec < 60) {
    return `${sec}秒`;
  }
  const min = Math.round(sec / 60);
  if (min < 60) {
    return `${min}分钟`;
  }
  const hr = Math.round(min / 60);
  if (hr < 24) {
    return `${hr}小时`;
  }
  const day = Math.round(hr / 24);
  return `${day}天`;
}

export function formatMs(ms?: number | null): string {
  if (!ms && ms !== 0) {
    return t("common.na");
  }
  return new Date(ms).toLocaleString(getUiLocale());
}

export function formatList(values?: Array<string | null | undefined>): string {
  if (!values || values.length === 0) {
    return t("common.none");
  }
  return values.filter((v): v is string => Boolean(v && v.trim())).join(", ");
}

export function clampText(value: string, max = 120): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}

export function truncateText(
  value: string,
  max: number,
): {
  text: string;
  truncated: boolean;
  total: number;
} {
  if (value.length <= max) {
    return { text: value, truncated: false, total: value.length };
  }
  return {
    text: value.slice(0, Math.max(0, max)),
    truncated: true,
    total: value.length,
  };
}

export function toNumber(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function parseList(input: string): string[] {
  return input
    .split(/[,\n]/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

export function stripThinkingTags(value: string): string {
  return stripAssistantInternalScaffolding(value);
}

export function formatCost(cost: number | null | undefined, fallback = "$0.00"): string {
  if (cost == null || !Number.isFinite(cost)) {
    return fallback;
  }
  if (cost === 0) {
    return "$0.00";
  }
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  if (cost < 1) {
    return `$${cost.toFixed(3)}`;
  }
  return `$${cost.toFixed(2)}`;
}

export function formatTokens(tokens: number | null | undefined, fallback = "0"): string {
  if (tokens == null || !Number.isFinite(tokens)) {
    return fallback;
  }
  if (tokens < 1000) {
    return String(Math.round(tokens));
  }
  if (tokens < 1_000_000) {
    const k = tokens / 1000;
    return k < 10 ? `${k.toFixed(1)}k` : `${Math.round(k)}k`;
  }
  const m = tokens / 1_000_000;
  return m < 10 ? `${m.toFixed(1)}M` : `${Math.round(m)}M`;
}

export function formatPercent(value: number | null | undefined, fallback = "—"): string {
  if (value == null || !Number.isFinite(value)) {
    return fallback;
  }
  return `${(value * 100).toFixed(1)}%`;
}
