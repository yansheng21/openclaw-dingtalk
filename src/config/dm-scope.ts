import type { DmScope } from "./types.base.js";

export const DEFAULT_DM_SCOPE: DmScope = "per-channel-peer";

export function resolveDmScope(value: string | null | undefined): DmScope {
  return value === "main" ||
    value === "per-peer" ||
    value === "per-channel-peer" ||
    value === "per-account-channel-peer"
    ? value
    : DEFAULT_DM_SCOPE;
}
