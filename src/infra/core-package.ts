export const PRIMARY_PACKAGE_NAME = "openclaw-dingtalk";
export const LEGACY_PACKAGE_NAME = "openclaw";
export const CORE_PACKAGE_NAME_ALIASES = [PRIMARY_PACKAGE_NAME, LEGACY_PACKAGE_NAME] as const;
export const CORE_PACKAGE_NAMES = new Set<string>(CORE_PACKAGE_NAME_ALIASES);
export const PRIMARY_REPOSITORY_URL = "https://github.com/yansheng21/openclaw-dingtalk.git";
export const PRIMARY_MAIN_PACKAGE_SPEC = "github:yansheng21/openclaw-dingtalk#main";
export const CORE_CLI_NAMES = ["openclaw", "dingclaw"] as const;
