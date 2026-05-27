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
      .addText((text) => text
        .setPlaceholder("X-Api-Key")
        .setValue(this.plugin.settings.apiKey)
        .onChange(async (value) => {
          this.plugin.settings.apiKey = value.trim();
          await this.plugin.saveSettings();
        }));

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
      .setDesc("Use auto configure after adding an API key.")
      .addText((text) => text
        .setValue(this.plugin.settings.workspaceId)
        .onChange(async (value) => {
          this.plugin.settings.workspaceId = value.trim();
          await this.plugin.saveSettings();
        }))
      .addButton((button) => button
        .setButtonText("Auto configure")
        .onClick(() => this.plugin.autoConfigure()));

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
      .setName("Default project ID")
      .addText((text) => text
        .setValue(this.plugin.settings.defaultProjectId)
        .onChange(async (value) => {
          this.plugin.settings.defaultProjectId = value.trim();
          await this.plugin.saveSettings();
        }));

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
      .setDesc("When threshold is reached, stop current timer and start an overtime-coded timer.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.overtimeEnabled)
        .onChange(async (value) => {
          this.plugin.settings.overtimeEnabled = value;
          await this.plugin.saveSettings();
          this.plugin.restartOvertimeWatcher();
        }));

    new Setting(containerEl)
      .setName("Daily limit")
      .setDesc("Minutes before overtime starts.")
      .addText((text) => text
        .setValue(String(this.plugin.settings.dailyLimitMinutes))
        .onChange(async (value) => {
          this.plugin.settings.dailyLimitMinutes = Math.max(1, Number.parseInt(value, 10) || 480);
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Weekly limit")
      .setDesc("Minutes before overtime starts.")
      .addText((text) => text
        .setValue(String(this.plugin.settings.weeklyLimitMinutes))
        .onChange(async (value) => {
          this.plugin.settings.weeklyLimitMinutes = Math.max(1, Number.parseInt(value, 10) || 2400);
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Overtime mode")
      .addDropdown((dropdown) => dropdown
        .addOption("tag", "Add tag")
        .addOption("project", "Switch project")
        .addOption("task", "Switch task")
        .setValue(this.plugin.settings.overtimeMode)
        .onChange(async (value) => {
          this.plugin.settings.overtimeMode = value as ClockifySettings["overtimeMode"];
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Prompt before switching")
      .setDesc("When off, the plugin automatically stops the normal timer and starts the overtime timer.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.promptBeforeOvertime)
        .onChange(async (value) => {
          this.plugin.settings.promptBeforeOvertime = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Overtime tag ID")
      .addText((text) => text
        .setValue(this.plugin.settings.overtimeTagId)
        .onChange(async (value) => {
          this.plugin.settings.overtimeTagId = value.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Overtime project ID")
      .addText((text) => text
        .setValue(this.plugin.settings.overtimeProjectId)
        .onChange(async (value) => {
          this.plugin.settings.overtimeProjectId = value.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Overtime task ID")
      .addText((text) => text
        .setValue(this.plugin.settings.overtimeTaskId)
        .onChange(async (value) => {
          this.plugin.settings.overtimeTaskId = value.trim();
          await this.plugin.saveSettings();
        }));
  }
}
