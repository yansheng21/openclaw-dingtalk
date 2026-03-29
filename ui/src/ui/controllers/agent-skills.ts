import type { GatewayBrowserClient } from "../gateway.ts";
import type { SkillStatusReport } from "../types.ts";

export type AgentSkillsState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  agentSkillsLoading: boolean;
  agentSkillsLoadingAgentId?: string | null;
  agentSkillsError: string | null;
  agentSkillsReport: SkillStatusReport | null;
  agentSkillsAgentId: string | null;
};

export async function loadAgentSkills(state: AgentSkillsState, agentId: string) {
  const resolvedAgentId = agentId.trim();
  if (!state.client || !state.connected || !resolvedAgentId) {
    return;
  }
  if (state.agentSkillsLoading && state.agentSkillsLoadingAgentId === resolvedAgentId) {
    return;
  }
  state.agentSkillsLoading = true;
  state.agentSkillsLoadingAgentId = resolvedAgentId;
  state.agentSkillsError = null;
  try {
    const res = await state.client.request("skills.status", { agentId: resolvedAgentId });
    if (state.agentSkillsLoadingAgentId !== resolvedAgentId) {
      return;
    }
    if (res) {
      state.agentSkillsReport = res as SkillStatusReport;
      state.agentSkillsAgentId = resolvedAgentId;
    }
  } catch (err) {
    if (state.agentSkillsLoadingAgentId !== resolvedAgentId) {
      return;
    }
    state.agentSkillsError = String(err);
  } finally {
    if (state.agentSkillsLoadingAgentId === resolvedAgentId) {
      state.agentSkillsLoadingAgentId = null;
      state.agentSkillsLoading = false;
    }
  }
}
