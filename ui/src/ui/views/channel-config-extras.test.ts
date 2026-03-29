import { beforeEach, describe, expect, it } from "vitest";
import { i18n } from "../../i18n/index.ts";
import {
  formatChannelExtraLabel,
  formatChannelExtraValue,
  resolveChannelConfigLocation,
  resolveChannelConfigValue,
  resolveChannelExtras,
} from "./channel-config-extras.ts";

describe("channel config extras", () => {
  beforeEach(async () => {
    await i18n.setLocale("zh-CN");
  });

  it("resolves plugin-backed connector config from plugins.entries", () => {
    const config = {
      plugins: {
        entries: {
          "dingtalk-enterprise": {
            config: {
              clientId: "ding-app",
              clientSecret: "secret-ref",
            },
          },
        },
      },
    };

    expect(resolveChannelConfigValue(config, "dingtalk-enterprise")).toEqual({
      clientId: "ding-app",
      clientSecret: "secret-ref",
    });
    expect(resolveChannelConfigLocation(config, "dingtalk-enterprise")?.path).toEqual([
      "plugins",
      "entries",
      "dingtalk-enterprise",
      "config",
    ]);
  });

  it("localizes policy labels and values for channel summaries", () => {
    expect(formatChannelExtraLabel("groupPolicy")).toBe("群聊接入策略");
    expect(formatChannelExtraLabel("dmPolicy")).toBe("私信接入策略");
    expect(formatChannelExtraValue("allowlist", "groupPolicy")).toBe("白名单");
    expect(formatChannelExtraValue("pairing", "dmPolicy")).toBe("配对后允许");
  });

  it("resolves localized extra labels from channel config", () => {
    const extras = resolveChannelExtras({
      configForm: {
        channels: {
          telegram: {
            groupPolicy: "allowlist",
            dmPolicy: "pairing",
          },
        },
      },
      channelId: "telegram",
      fields: ["groupPolicy", "dmPolicy"],
    });

    expect(extras).toEqual([
      { label: "群聊接入策略", value: "白名单" },
      { label: "私信接入策略", value: "配对后允许" },
    ]);
  });
});
