import { normalizePath, Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { ClockifyClient } from "./clockifyClient";
import { DEFAULT_SETTINGS } from "./defaults";
import { applyOvertimeMarker, decideOvertimeSwitch } from "./overtime";
import { ClockifySettingTab } from "./settings";
import { ClockifyTrackerView, VIEW_TYPE_CLOCKIFY_TRACKER } from "./view";
import { ClockifySettings, MetadataCache, TimeEntryDraft } from "./types";
import { startOfLocalDay, startOfLocalWeek } from "./timeParser";

interface PluginData {
  settings: ClockifySettings;
  metadata: MetadataCache;
}

export default class ClockifyObsidianPlugin extends Plugin {
  settings: ClockifySettings = DEFAULT_SETTINGS;
  metadata: MetadataCache = { projects: [], tasksByProject: {}, tags: [] };
  client = new ClockifyClient(() => this.settings);
  private overtimeInterval: number | null = null;

  async onload(): Promise<void> {
    console.log("Clockify Tracker loading");
    await this.loadSettings();
    await this.debugLog("loading");
    this.addSettingTab(new ClockifySettingTab(this.app, this));

    this.registerView(
      VIEW_TYPE_CLOCKIFY_TRACKER,
      (leaf) => new ClockifyTrackerView(leaf, this)
    );

    this.addRibbonIcon("clock", "Clockify Tracker", () => this.activateView());

    this.addCommand({
      id: "open-clockify-tracker",
      name: "Open tracker",
      callback: () => this.activateView()
    });

    this.addCommand({
      id: "start-clockify-timer",
      name: "Start timer",
      callback: () => this.startTimerFromPrompt()
    });

    this.addCommand({
      id: "stop-clockify-timer",
      name: "Stop timer",
      callback: () => this.stopTimer()
    });

    this.addCommand({
      id: "refresh-clockify-metadata",
      name: "Refresh projects, tasks, and tags",
      callback: () => this.refreshMetadata(true)
    });

    this.addCommand({
      id: "switch-clockify-timer-to-overtime",
      name: "Switch current timer to overtime",
      callback: () => this.switchCurrentTimerToOvertime()
    });

    this.restartOvertimeWatcher();
    console.log("Clockify Tracker loaded");
    await this.debugLog("loaded");
  }

  onunload(): void {
    if (this.overtimeInterval !== null) window.clearInterval(this.overtimeInterval);
    console.log("Clockify Tracker unloaded");
    void this.debugLog("unloaded");
  }

  async loadSettings(): Promise<void> {
    const data = (await this.loadData()) as Partial<PluginData> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(data?.settings ?? {}) };
    this.metadata = data?.metadata ?? { projects: [], tasksByProject: {}, tags: [] };
  }

  async saveSettings(): Promise<void> {
    await this.saveData({ settings: this.settings, metadata: this.metadata });
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(VIEW_TYPE_CLOCKIFY_TRACKER)[0] ?? null;
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      await leaf?.setViewState({ type: VIEW_TYPE_CLOCKIFY_TRACKER, active: true });
    }
    if (leaf) workspace.revealLeaf(leaf);
    await this.debugLog("view activated");
  }

  async autoConfigure(): Promise<void> {
    try {
      const user = await this.client.getCurrentUser();
      const workspaces = await this.client.getWorkspaces();
      this.settings.userId = user.id;
      this.settings.workspaceId = user.activeWorkspace ?? user.defaultWorkspace ?? workspaces[0]?.id ?? "";
      await this.saveSettings();
      await this.refreshMetadata(false);
      new Notice("Clockify configured.");
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "Clockify auto configure failed.");
    }
  }

  async refreshMetadata(showNotice: boolean): Promise<void> {
    try {
      const projects = await this.client.getProjects();
      const tags = await this.client.getTags();
      const tasksByProject: MetadataCache["tasksByProject"] = {};
      await Promise.all(projects.slice(0, 200).map(async (project) => {
        tasksByProject[project.id] = await this.client.getTasks(project.id);
      }));
      this.metadata = { projects, tags, tasksByProject, fetchedAt: new Date().toISOString() };
      await this.saveSettings();
      this.refreshOpenViews();
      if (showNotice) new Notice("Clockify metadata refreshed.");
      await this.debugLog(`metadata refreshed: ${projects.length} projects, ${tags.length} tags`);
    } catch (error) {
      await this.debugLog(`metadata failed: ${error instanceof Error ? error.message : "unknown error"}`);
      new Notice(error instanceof Error ? error.message : "Clockify metadata refresh failed.");
    }
  }

  async startTimer(draft: Omit<TimeEntryDraft, "end">): Promise<void> {
    await this.client.startTimer(draft);
    this.refreshOpenViews();
  }

  async stopTimer(): Promise<void> {
    try {
      await this.client.stopTimer();
      this.refreshOpenViews();
      new Notice("Clockify timer stopped.");
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "Could not stop Clockify timer.");
    }
  }

  async switchCurrentTimerToOvertime(): Promise<void> {
    if (!this.settings.workspaceId || !this.settings.userId) {
      new Notice("Clockify workspace/user is not configured.");
      return;
    }
    try {
      const now = new Date();
      const entries = await this.client.getEntries(startOfLocalDay(now), now);
      const runningEntry = entries.find((entry) => !entry.timeInterval.end);
      if (!runningEntry) {
        new Notice("No Clockify timer is running.");
        return;
      }
      const overtimeEntry = applyOvertimeMarker(runningEntry, this.settings);
      await this.client.stopTimer();
      await this.client.startTimer({
        description: overtimeEntry.description ?? runningEntry.description,
        start: new Date(),
        projectId: overtimeEntry.projectId ?? runningEntry.projectId ?? undefined,
        taskId: overtimeEntry.taskId ?? runningEntry.taskId ?? undefined,
        tagIds: overtimeEntry.tagIds ?? runningEntry.tagIds ?? [],
        billable: overtimeEntry.billable ?? runningEntry.billable ?? false
      });
      this.refreshOpenViews();
      new Notice("Clockify switched current timer to overtime.");
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "Could not switch Clockify timer to overtime.");
    }
  }

  restartOvertimeWatcher(): void {
    if (this.overtimeInterval !== null) window.clearInterval(this.overtimeInterval);
    this.overtimeInterval = null;
    if (!this.settings.overtimeEnabled) return;
    const interval = Math.max(15, this.settings.overtimeCheckSeconds) * 1000;
    this.overtimeInterval = window.setInterval(() => {
      void this.checkOvertimeHandoff();
    }, interval);
    this.registerInterval(this.overtimeInterval);
  }

  private async checkOvertimeHandoff(): Promise<void> {
    if (!this.settings.overtimeEnabled || !this.settings.workspaceId || !this.settings.userId) return;
    try {
      const now = new Date();
      const dayEntries = await this.client.getEntries(startOfLocalDay(now), now);
      const weekEntries = await this.client.getEntries(startOfLocalWeek(now), now);
      const runningEntry = dayEntries.find((entry) => !entry.timeInterval.end) ?? null;
      const decision = decideOvertimeSwitch({
        settings: this.settings,
        runningEntry,
        dayEntries,
        weekEntries,
        now
      });
      if (!decision.shouldSwitch || !runningEntry) return;
      if (this.settings.promptBeforeOvertime) {
        new Notice(`Clockify overtime threshold reached (${decision.reason}). Use command if manual switch preferred.`);
        return;
      }
      await this.client.stopTimer();
      await this.client.startTimer({
        description: decision.overtimeEntry.description ?? runningEntry.description,
        start: new Date(),
        projectId: decision.overtimeEntry.projectId ?? runningEntry.projectId ?? undefined,
        taskId: decision.overtimeEntry.taskId ?? runningEntry.taskId ?? undefined,
        tagIds: decision.overtimeEntry.tagIds ?? runningEntry.tagIds ?? [],
        billable: decision.overtimeEntry.billable ?? runningEntry.billable ?? false
      });
      this.refreshOpenViews();
      new Notice(`Clockify switched to overtime (${decision.reason}).`);
    } catch (error) {
      console.error("Clockify overtime handoff failed", error);
    }
  }

  private async startTimerFromPrompt(): Promise<void> {
    await this.activateView();
    new Notice("Use the Clockify quick-add row to start a timer.");
  }

  private refreshOpenViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_CLOCKIFY_TRACKER)) {
      const view = leaf.view;
      if (view instanceof ClockifyTrackerView) void view.refresh();
    }
  }

  async debugLog(message: string): Promise<void> {
    const path = normalizePath(`${this.manifest.dir ?? ".obsidian/plugins/clockify-obsidian"}/debug.log`);
    const line = `${new Date().toISOString()} ${message}\n`;
    try {
      const existing = await this.app.vault.adapter.exists(path)
        ? await this.app.vault.adapter.read(path)
        : "";
      await this.app.vault.adapter.write(path, existing + line);
    } catch (error) {
      console.error("Clockify debug log failed", error);
    }
  }
}
