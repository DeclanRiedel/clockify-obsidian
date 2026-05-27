import { ItemView, Menu, Notice, WorkspaceLeaf } from "obsidian";
import ClockifyObsidianPlugin from "./main";
import { ClockifyProject, ClockifyTag, ClockifyTask, ClockifyTimeEntry, TimeEntryDraft } from "./types";
import { formatDuration, minutesBetween, parseQuickEntry, startOfLocalDay, startOfLocalWeek } from "./timeParser";

export const VIEW_TYPE_CLOCKIFY_TRACKER = "clockify-tracker-view";

export class ClockifyTrackerView extends ItemView {
  private selectedEntryId: string | null = null;
  private todayEntries: ClockifyTimeEntry[] = [];
  private weekEntries: ClockifyTimeEntry[] = [];
  private liveInterval: number | null = null;
  private todayTotalEl: HTMLElement | null = null;
  private overtimeEl: HTMLElement | null = null;
  private weekTotalEl: HTMLElement | null = null;
  private runningElapsedEl: HTMLElement | null = null;
  private durationEls = new Map<string, HTMLElement[]>();

  constructor(leaf: WorkspaceLeaf, private readonly plugin: ClockifyObsidianPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_CLOCKIFY_TRACKER;
  }

  getDisplayText(): string {
    return "Clockify";
  }

  getIcon(): string {
    return "clock";
  }

  async onOpen(): Promise<void> {
    this.containerEl.addClass("clockify-tracker");
    await this.plugin.debugLog("view opened");
    this.renderShell();
    await this.refresh();
  }

  async onClose(): Promise<void> {
    this.stopLiveUpdates();
  }

  async refresh(): Promise<void> {
    this.stopLiveUpdates();
    const content = this.contentEl.querySelector(".clockify-content");
    if (!(content instanceof HTMLElement)) return;
    content.empty();

    if (!this.plugin.settings.apiKey || !this.plugin.settings.workspaceId || !this.plugin.settings.userId) {
      this.renderSetup(content);
      return;
    }

    try {
      const now = new Date();
      this.todayEntries = await this.plugin.client.getEntries(startOfLocalDay(now), new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
      this.weekEntries = await this.plugin.client.getEntries(startOfLocalWeek(now), new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
      this.renderTracker(content);
      await this.plugin.debugLog(`entries refreshed: ${this.todayEntries.length} today, ${this.weekEntries.length} week`);
    } catch (error) {
      await this.plugin.debugLog(`entries failed: ${error instanceof Error ? error.message : "unknown error"}`);
      content.createDiv({ cls: "clockify-error", text: error instanceof Error ? error.message : "Failed to load Clockify entries." });
    }
  }

  private renderShell(): void {
    this.contentEl.empty();
    const header = this.contentEl.createDiv({ cls: "clockify-header" });
    header.createDiv({ cls: "clockify-title", text: "Clockify" });
    const actions = header.createDiv({ cls: "clockify-header-actions" });
    actions.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Refresh" }, text: "Refresh" })
      .addEventListener("click", () => this.refresh());
    actions.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Metadata" }, text: "Metadata" })
      .addEventListener("click", () => this.plugin.refreshMetadata(true));
    this.contentEl.createDiv({ cls: "clockify-content" });
  }

  private renderSetup(content: HTMLElement): void {
    const setup = content.createDiv({ cls: "clockify-setup" });
    setup.createEl("h3", { text: "Connect Clockify" });
    setup.createEl("p", { text: "Add an API key in settings, then auto configure workspace and user IDs." });
    setup.createEl("button", { text: "Open settings" }).addEventListener("click", () => {
      // Obsidian exposes this internal settings API in desktop/mobile apps.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.app as any).setting?.open();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.app as any).setting?.openTabById(this.plugin.manifest.id);
    });
  }

  private renderTracker(content: HTMLElement): void {
    const now = new Date();
    const running = this.todayEntries.find((entry) => !entry.timeInterval.end) ?? null;
    const todayTotal = sumEntries(this.todayEntries, now);
    const overtimeRemaining = Math.max(0, this.plugin.settings.dailyLimitMinutes - todayTotal);

    const summary = content.createDiv({ cls: "clockify-summary" });
    this.todayTotalEl = this.renderStat(summary, "Today", formatDuration(todayTotal));
    this.overtimeEl = this.renderStat(summary, "OT in", this.plugin.settings.overtimeEnabled ? formatDuration(overtimeRemaining) : "off");

    const timer = content.createDiv({ cls: running ? "clockify-running is-active" : "clockify-running" });
    timer.createDiv({ cls: "clockify-running-label", text: running ? "Running" : "No timer running" });
    const runningBody = timer.createDiv({ cls: "clockify-running-body" });
    if (running) {
      const runningDesc = runningBody.createEl("input", {
        cls: "clockify-running-desc",
        value: running.description || "",
        attr: { placeholder: "Description" }
      });
      const runningStart = runningBody.createEl("input", {
        cls: "clockify-running-time",
        value: toLocalTime(running.timeInterval.start),
        attr: { "aria-label": "Running start time" }
      });
      this.runningElapsedEl = runningBody.createDiv({
        cls: "clockify-running-elapsed",
        text: formatDuration(minutesBetween(running.timeInterval.start, now))
      });
      runningDesc.addEventListener("keydown", (event) => {
        if (event.key === "Enter") void this.saveEntry(running, { description: runningDesc.value, start: mergeDateTime(running.timeInterval.start, runningStart.value) });
      });
      runningStart.addEventListener("keydown", (event) => {
        if (event.key === "Enter") void this.saveEntry(running, { description: runningDesc.value, start: mergeDateTime(running.timeInterval.start, runningStart.value) });
      });
      runningDesc.addEventListener("blur", () => void this.saveEntry(running, { description: runningDesc.value, start: mergeDateTime(running.timeInterval.start, runningStart.value) }));
      runningStart.addEventListener("blur", () => void this.saveEntry(running, { description: runningDesc.value, start: mergeDateTime(running.timeInterval.start, runningStart.value) }));
    } else {
      runningBody.createDiv({ cls: "clockify-running-desc-text", text: "Start from quick add below." });
    }
    timer.createEl("button", { text: running ? "Stop" : "Start empty" }).addEventListener("click", async () => {
      if (running) {
        await this.plugin.stopTimer();
      } else {
        await this.plugin.startTimer(this.makeDraft({ description: "", start: new Date(), tagIds: [], billable: false }));
      }
    });

    this.renderQuickAdd(content);
    this.renderEntries(content, this.todayEntries, "clockify-today-list");
    const footer = content.createDiv({ cls: "clockify-footer-total" });
    this.weekTotalEl = this.renderStat(footer, "Week total", formatDuration(sumEntries(this.weekEntries, now)));
    this.renderWeeklyTimeline(content);
    this.startLiveUpdates();
  }

  private renderQuickAdd(content: HTMLElement): void {
    const form = content.createDiv({ cls: "clockify-quick-add" });
    const input = form.createEl("input", {
      attr: {
        placeholder: "9-11 Fix auth @project /task #tag, or Review notes to start timer"
      }
    });
    input.addEventListener("keydown", async (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const raw = input.value.trim();
      if (!raw) return;
      const parsed = parseQuickEntry(raw, {
        now: new Date(),
        defaultProjectId: this.plugin.settings.defaultProjectId,
        defaultTaskId: this.plugin.settings.defaultTaskId,
        defaultTagIds: this.plugin.settings.defaultTagIds
      });
      const resolved = this.resolveNames(parsed);
      try {
        if (resolved.end) await this.plugin.client.createEntry(resolved);
        else await this.plugin.client.startTimer(resolved);
        input.value = "";
        await this.refresh();
      } catch (error) {
        new Notice(error instanceof Error ? error.message : "Could not save Clockify entry.");
      }
    });
    form.createEl("button", { text: "Add" }).addEventListener("click", () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    });
  }

  private renderEntries(content: HTMLElement, entries: ClockifyTimeEntry[], extraClass?: string): void {
    const list = content.createDiv({ cls: extraClass ? `clockify-entry-list ${extraClass}` : "clockify-entry-list" });
    const sorted = [...entries].sort((a, b) => a.timeInterval.start.localeCompare(b.timeInterval.start));
    for (const entry of sorted) {
      const row = list.createDiv({ cls: "clockify-entry-row" });
      if (entry.id === this.selectedEntryId) row.addClass("is-selected");
      row.addEventListener("focusin", () => {
        this.selectedEntryId = entry.id;
        list.querySelectorAll(".is-selected").forEach((selected) => selected.classList.remove("is-selected"));
        row.addClass("is-selected");
      });
      row.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        this.openEntryMenu(event, entry);
      });

      const time = row.createDiv({ cls: "clockify-entry-time" });
      const startInput = time.createEl("input", { value: toLocalTime(entry.timeInterval.start) });
      const endInput = time.createEl("input", { value: entry.timeInterval.end ? toLocalTime(entry.timeInterval.end) : "" });

      const main = row.createDiv({ cls: "clockify-entry-main" });
      const description = main.createEl("input", { cls: "clockify-description", value: entry.description ?? "" });
      const meta = main.createDiv({ cls: "clockify-entry-meta" });
      const projectSelect = this.createProjectSelect(meta, entry.projectId ?? "");
      const taskSelect = this.createTaskSelect(meta, projectSelect.value, entry.taskId ?? "");
      projectSelect.addEventListener("change", async () => {
        taskSelect.empty();
        await this.fillTaskSelect(taskSelect, projectSelect.value, "");
      });
      const tagSelect = this.createTagSelect(meta, entry.tagIds ?? []);
      const billable = meta.createEl("label", { cls: "clockify-billable" });
      const billableInput = billable.createEl("input", { type: "checkbox" });
      billableInput.checked = entry.billable ?? false;
      billable.createSpan({ text: "Billable" });

      const duration = row.createDiv({
        cls: "clockify-entry-duration",
        text: formatDuration(minutesBetween(entry.timeInterval.start, entry.timeInterval.end ?? new Date()))
      });
      duration.setAttr("aria-label", "Duration");
      this.durationEls.set(entry.id, [...(this.durationEls.get(entry.id) ?? []), duration]);

      const actions = row.createDiv({ cls: "clockify-entry-actions" });
      actions.createEl("button", { text: "Save" }).addEventListener("click", async (event) => {
        event.stopPropagation();
        await this.saveEntry(entry, {
          description: description.value,
          start: mergeDateTime(entry.timeInterval.start, startInput.value),
          end: endInput.value ? mergeDateTime(entry.timeInterval.start, endInput.value) : undefined,
          projectId: projectSelect.value || undefined,
          taskId: taskSelect.value || undefined,
          tagIds: selectedOptions(tagSelect),
          billable: billableInput.checked
        });
      });
      actions.createEl("button", { text: "Del" }).addEventListener("click", async (event) => {
        event.stopPropagation();
        await this.deleteEntry(entry);
      });
    }
  }

  private renderWeeklyTimeline(content: HTMLElement): void {
    const timeline = content.createDiv({ cls: "clockify-week-timeline" });
    const weekStart = startOfLocalWeek(new Date());
    for (let index = 0; index < 7; index += 1) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + index);
      const nextDay = new Date(day);
      nextDay.setDate(day.getDate() + 1);
      const entries = this.weekEntries.filter((entry) => {
        const start = new Date(entry.timeInterval.start);
        return start >= day && start < nextDay;
      });
      const section = timeline.createDiv({ cls: "clockify-day-section" });
      const header = section.createDiv({ cls: "clockify-day-header" });
      header.createDiv({ cls: "clockify-day-name", text: formatDayLabel(day) });
      header.createDiv({ cls: "clockify-day-total", text: formatDuration(sumEntries(entries, new Date())) });
      if (entries.length === 0) {
        section.createDiv({ cls: "clockify-day-empty", text: "No entries" });
      } else {
        this.renderEntries(section, entries, "clockify-week-list");
      }
    }
  }

  private renderStat(parent: HTMLElement, label: string, value: string): HTMLElement {
    const stat = parent.createDiv({ cls: "clockify-stat" });
    stat.createDiv({ cls: "clockify-stat-label", text: label });
    return stat.createDiv({ cls: "clockify-stat-value", text: value });
  }

  private makeDraft(draft: Omit<TimeEntryDraft, "projectId" | "taskId"> & { projectId?: string; taskId?: string }): Omit<TimeEntryDraft, "end"> {
    return {
      ...draft,
      projectId: draft.projectId || this.plugin.settings.defaultProjectId || undefined,
      taskId: draft.taskId || this.plugin.settings.defaultTaskId || undefined
    };
  }

  private resolveNames(draft: TimeEntryDraft): TimeEntryDraft {
    const projectId = resolveProject(this.plugin.metadata.projects, draft.projectId);
    const taskId = projectId ? resolveTask(this.plugin.metadata.tasksByProject[projectId] ?? [], draft.taskId) : draft.taskId;
    const tagIds = draft.tagIds.map((tag) => resolveTag(this.plugin.metadata.tags, tag)).filter(Boolean);
    return { ...draft, projectId, taskId, tagIds };
  }

  private async saveEntry(entry: ClockifyTimeEntry, patch: Partial<TimeEntryDraft>): Promise<void> {
    try {
      const updated = await this.plugin.client.updateEntry(entry, patch);
      this.replaceEntry(updated);
      this.updateLiveStats();
      await this.plugin.debugLog(`entry saved without refresh: ${updated.id}`);
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "Could not update Clockify entry.");
    }
  }

  private replaceEntry(updated: ClockifyTimeEntry): void {
    this.todayEntries = replaceById(this.todayEntries, updated);
    this.weekEntries = replaceById(this.weekEntries, updated);
  }

  private async deleteEntry(entry: ClockifyTimeEntry): Promise<void> {
    if (!confirm(`Delete Clockify entry "${entry.description || "(no description)"}"?`)) return;
    try {
      await this.plugin.client.deleteEntry(entry.id);
      await this.refresh();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "Could not delete Clockify entry.");
    }
  }

  private openEntryMenu(event: MouseEvent, entry: ClockifyTimeEntry): void {
    const menu = new Menu();
    menu.addItem((item) => item
      .setTitle("Duplicate now")
      .setIcon("copy")
      .onClick(async () => {
        await this.plugin.client.createEntry({
          description: entry.description,
          start: new Date(),
          end: new Date(Date.now() + minutesBetween(entry.timeInterval.start, entry.timeInterval.end ?? new Date()) * 60_000),
          projectId: entry.projectId ?? undefined,
          taskId: entry.taskId ?? undefined,
          tagIds: entry.tagIds ?? [],
          billable: entry.billable ?? false
        });
        await this.refresh();
      }));
    menu.addItem((item) => item
      .setTitle("Delete")
      .setIcon("trash")
      .onClick(() => this.deleteEntry(entry)));
    menu.showAtMouseEvent(event);
  }

  private createProjectSelect(parent: HTMLElement, value: string): HTMLSelectElement {
    const select = parent.createEl("select", { cls: "clockify-project-select" });
    select.createEl("option", { value: "", text: "No project" });
    for (const project of this.plugin.metadata.projects) {
      select.createEl("option", {
        value: project.id,
        text: project.clientName ? `${project.clientName} / ${project.name}` : project.name
      });
    }
    select.value = value;
    return select;
  }

  private createTaskSelect(parent: HTMLElement, projectId: string, value: string): HTMLSelectElement {
    const select = parent.createEl("select", { cls: "clockify-task-select" });
    void this.fillTaskSelect(select, projectId, value);
    return select;
  }

  private async fillTaskSelect(select: HTMLSelectElement, projectId: string, value: string): Promise<void> {
    select.createEl("option", { value: "", text: "No task" });
    if (projectId && !this.plugin.metadata.tasksByProject[projectId]) {
      select.createEl("option", { value: "", text: "Loading tasks..." });
      try {
        this.plugin.metadata.tasksByProject[projectId] = await this.plugin.client.getTasks(projectId);
        await this.plugin.saveSettings();
      } catch (error) {
        await this.plugin.debugLog(`tasks failed: ${error instanceof Error ? error.message : "unknown error"}`);
      }
      select.empty();
      select.createEl("option", { value: "", text: "No task" });
    }
    for (const task of this.plugin.metadata.tasksByProject[projectId] ?? []) {
      select.createEl("option", { value: task.id, text: task.name });
    }
    select.value = value;
  }

  private createTagSelect(parent: HTMLElement, values: string[]): HTMLSelectElement {
    const select = parent.createEl("select", { cls: "clockify-tag-select", attr: { multiple: "true" } });
    for (const tag of this.plugin.metadata.tags) {
      const option = select.createEl("option", { value: tag.id, text: tag.name });
      option.selected = values.includes(tag.id);
    }
    return select;
  }

  private startLiveUpdates(): void {
    this.updateLiveStats();
    this.liveInterval = window.setInterval(() => this.updateLiveStats(), 1000);
  }

  private stopLiveUpdates(): void {
    if (this.liveInterval !== null) {
      window.clearInterval(this.liveInterval);
      this.liveInterval = null;
    }
    this.todayTotalEl = null;
    this.overtimeEl = null;
    this.weekTotalEl = null;
    this.runningElapsedEl = null;
    this.durationEls.clear();
  }

  private updateLiveStats(): void {
    const now = new Date();
    const todayTotal = sumEntries(this.todayEntries, now);
    const weekTotal = sumEntries(this.weekEntries, now);
    if (this.todayTotalEl) this.todayTotalEl.setText(formatDuration(todayTotal));
    if (this.weekTotalEl) this.weekTotalEl.setText(formatDuration(weekTotal));
    if (this.overtimeEl) {
      this.overtimeEl.setText(this.plugin.settings.overtimeEnabled
        ? formatDuration(Math.max(0, this.plugin.settings.dailyLimitMinutes - todayTotal))
        : "off");
    }
    const running = this.todayEntries.find((entry) => !entry.timeInterval.end) ?? null;
    if (this.runningElapsedEl && running) {
      this.runningElapsedEl.setText(formatDuration(minutesBetween(running.timeInterval.start, now)));
    }
    for (const entry of this.weekEntries) {
      const durationEls = this.durationEls.get(entry.id) ?? [];
      for (const durationEl of durationEls) {
        durationEl.setText(formatDuration(minutesBetween(entry.timeInterval.start, entry.timeInterval.end ?? now)));
      }
    }
  }
}

function sumEntries(entries: ClockifyTimeEntry[], now: Date): number {
  return entries.reduce((total, entry) => total + minutesBetween(entry.timeInterval.start, entry.timeInterval.end ?? now), 0);
}

function replaceById(entries: ClockifyTimeEntry[], updated: ClockifyTimeEntry): ClockifyTimeEntry[] {
  return entries.map((entry) => entry.id === updated.id ? updated : entry);
}

function toLocalTime(value: string): string {
  const date = new Date(value);
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function mergeDateTime(anchorIso: string, time: string): Date {
  const date = new Date(anchorIso);
  const [hour, minute = "0"] = time.split(":");
  date.setHours(Number(hour), Number(minute), 0, 0);
  return date;
}

function selectedOptions(select: HTMLSelectElement): string[] {
  return Array.from(select.selectedOptions).map((option) => option.value).filter(Boolean);
}

function resolveProject(projects: ClockifyProject[], value?: string): string | undefined {
  if (!value) return undefined;
  return projects.find((project) => project.id === value || project.name.toLowerCase() === value.toLowerCase())?.id ?? value;
}

function resolveTask(tasks: ClockifyTask[], value?: string): string | undefined {
  if (!value) return undefined;
  return tasks.find((task) => task.id === value || task.name.toLowerCase() === value.toLowerCase())?.id ?? value;
}

function resolveTag(tags: ClockifyTag[], value: string): string {
  return tags.find((tag) => tag.id === value || tag.name.toLowerCase() === value.toLowerCase())?.id ?? value;
}
