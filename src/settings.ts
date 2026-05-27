import { App, PluginSettingTab, Setting } from "obsidian";
import ClockifyObsidianPlugin from "./main";
import { ClockifySettings } from "./types";

const REGION_BASE_URLS: Record<string, string> = {
  global: "https://api.clockify.me/api/v1",
  euc1: "https://euc1.clockify.me/api/v1",
  use2: "https://use2.clockify.me/api/v1",
  euw2: "https://euw2.clockify.me/api/v1",
  apse2: "https://apse2.clockify.me/api/v1"
};

export function baseUrlForRegion(region: ClockifySettings["region"], current: string): string {
  if (region === "custom") return current;
  return REGION_BASE_URLS[region] ?? REGION_BASE_URLS.global;
}

export class ClockifySettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: ClockifyObsidianPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Clockify Tracker" });

    new Setting(containerEl)
      .setName("API key")
      .setDesc("Clockify API key from profile settings.")
      .addText((text) => {
        text.inputEl.type = "password";
        text
          .setPlaceholder("X-Api-Key")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Region")
      .setDesc("Clockify API region.")
      .addDropdown((dropdown) => dropdown
        .addOption("global", "Global")
        .addOption("euc1", "EU Germany")
        .addOption("use2", "USA")
        .addOption("euw2", "UK")
        .addOption("apse2", "AU")
        .addOption("custom", "Custom")
        .setValue(this.plugin.settings.region)
        .onChange(async (value) => {
          this.plugin.settings.region = value as ClockifySettings["region"];
          this.plugin.settings.baseUrl = baseUrlForRegion(this.plugin.settings.region, this.plugin.settings.baseUrl);
          await this.plugin.saveSettings();
          this.display();
        }));

    new Setting(containerEl)
      .setName("Base URL")
      .setDesc("Only edit directly for subdomain/custom deployments.")
      .addText((text) => text
        .setValue(this.plugin.settings.baseUrl)
        .onChange(async (value) => {
          this.plugin.settings.baseUrl = value.trim().replace(/\/$/, "");
          this.plugin.settings.region = "custom";
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Workspace ID")
      .setDesc("Use sync after adding an API key.")
      .addText((text) => text
        .setValue(this.plugin.settings.workspaceId)
        .onChange(async (value) => {
          this.plugin.settings.workspaceId = value.trim();
          await this.plugin.saveSettings();
        }))
      .addButton((button) => button
        .setButtonText("Connect / refresh")
        .onClick(async () => {
          await this.plugin.autoConfigure();
          this.display();
        }));

    new Setting(containerEl)
      .setName("User ID")
      .addText((text) => text
        .setValue(this.plugin.settings.userId)
        .onChange(async (value) => {
          this.plugin.settings.userId = value.trim();
          await this.plugin.saveSettings();
        }));

    containerEl.createEl("h3", { text: "Defaults" });

    new Setting(containerEl)
      .setName("Default project")
      .addDropdown((dropdown) => {
        dropdown.addOption("", "No default");
        for (const project of this.plugin.metadata.projects) {
          dropdown.addOption(project.id, project.clientName ? `${project.clientName} / ${project.name}` : project.name);
        }
        dropdown.setValue(this.plugin.settings.defaultProjectId)
        .onChange(async (value) => {
          this.plugin.settings.defaultProjectId = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Default task ID")
      .addText((text) => text
        .setValue(this.plugin.settings.defaultTaskId)
        .onChange(async (value) => {
          this.plugin.settings.defaultTaskId = value.trim();
          await this.plugin.saveSettings();
        }));

    containerEl.createEl("h3", { text: "Overtime handoff" });

    new Setting(containerEl)
      .setName("Enable overtime handoff")
      .setDesc("At the configured time, stop current timer and continue it with the overtime tag.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.overtimeEnabled)
        .onChange(async (value) => {
          this.plugin.settings.overtimeEnabled = value;
          await this.plugin.saveSettings();
          this.plugin.restartOvertimeWatcher();
        }));

    new Setting(containerEl)
      .setName("Overtime start time")
      .setDesc("Local time when overtime starts, e.g. 17:00.")
      .addText((text) => text
        .setPlaceholder("17:00")
        .setValue(this.plugin.settings.overtimeStartTime)
        .onChange(async (value) => {
          this.plugin.settings.overtimeStartTime = normalizeTimeInput(value, this.plugin.settings.overtimeStartTime);
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Overtime tag")
      .setDesc("Tag added to the continued timer. Project/task stay the same.")
      .addDropdown((dropdown) => {
        dropdown.addOption("", "No tag");
        for (const tag of this.plugin.metadata.tags) {
          dropdown.addOption(tag.id, tag.name);
        }
        dropdown.setValue(this.plugin.settings.overtimeTagId)
        .onChange(async (value) => {
          this.plugin.settings.overtimeTagId = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Prompt before switching")
      .setDesc("When off, the plugin automatically stops the normal timer and starts the overtime timer.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.promptBeforeOvertime)
        .onChange(async (value) => {
          this.plugin.settings.promptBeforeOvertime = value;
          await this.plugin.saveSettings();
        }));
  }
}

function normalizeTimeInput(value: string, fallback: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return fallback;
  const hour = Math.min(23, Number(match[1]));
  const minute = Math.min(59, Number(match[2] ?? "0"));
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}
