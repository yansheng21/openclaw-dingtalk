import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { productAreaLabelForTab, titleForTab, type Tab } from "../navigation.js";

@customElement("dashboard-header")
export class DashboardHeader extends LitElement {
  override createRenderRoot() {
    return this;
  }

  @property() tab: Tab = "overview";

  override render() {
    const label = titleForTab(this.tab);
    const showBreadcrumb = this.tab !== "channels";

    return html`
      <div class="dashboard-header">
        ${
          showBreadcrumb
            ? html`
                <div class="dashboard-header__breadcrumb">
                  <span
                    class="dashboard-header__breadcrumb-link"
                    @click=${() => this.dispatchEvent(new CustomEvent("navigate", { detail: "overview", bubbles: true, composed: true }))}
                  >
                    OpenClaw
                  </span>
                  <span class="dashboard-header__breadcrumb-sep">›</span>
                  <span class="dashboard-header__breadcrumb-current">${label}</span>
                </div>
              `
            : html`<div></div>`
        }
        <div class="dashboard-header__actions">
          ${showBreadcrumb ? html`<span class="dashboard-header__scope">${productAreaLabelForTab(this.tab)}</span>` : nothing}
          <slot></slot>
        </div>
      </div>
    `;
  }
}
