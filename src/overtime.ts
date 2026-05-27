import { ClockifySettings, ClockifyTimeEntry } from "./types";
import { minutesBetween } from "./timeParser";

export interface OvertimeDecision {
  shouldSwitch: boolean;
  reason: "daily" | "weekly" | "none";
  overtimeEntry: Partial<ClockifyTimeEntry>;
}

export function totalMinutesForEntries(entries: ClockifyTimeEntry[], now: Date): number {
  return entries.reduce((total, entry) => {
    const start = entry.timeInterval.start;
    const end = entry.timeInterval.end ?? now.toISOString();
    return total + minutesBetween(start, end);
  }, 0);
}

export function decideOvertimeSwitch(args: {
  settings: ClockifySettings;
  runningEntry: ClockifyTimeEntry | null;
  dayEntries: ClockifyTimeEntry[];
  weekEntries: ClockifyTimeEntry[];
  now: Date;
}): OvertimeDecision {
  const { settings, runningEntry, dayEntries, weekEntries, now } = args;
  if (!settings.overtimeEnabled || !runningEntry) {
    return { shouldSwitch: false, reason: "none", overtimeEntry: {} };
  }
  if (isAlreadyOvertime(runningEntry, settings)) {
    return { shouldSwitch: false, reason: "none", overtimeEntry: {} };
  }

  const dayTotal = totalMinutesForEntries(dayEntries, now);
  const weekTotal = totalMinutesForEntries(weekEntries, now);
  const reason = dayTotal >= settings.dailyLimitMinutes
    ? "daily"
    : weekTotal >= settings.weeklyLimitMinutes
      ? "weekly"
      : "none";

  if (reason === "none") {
    return { shouldSwitch: false, reason, overtimeEntry: {} };
  }

  return {
    shouldSwitch: true,
    reason,
    overtimeEntry: applyOvertimeMarker(runningEntry, settings)
  };
}

export function applyOvertimeMarker(entry: ClockifyTimeEntry, settings: ClockifySettings): Partial<ClockifyTimeEntry> {
  if (settings.overtimeMode === "project" && settings.overtimeProjectId) {
    return {
      ...entry,
      projectId: settings.overtimeProjectId,
      taskId: settings.overtimeTaskId || null
    };
  }
  if (settings.overtimeMode === "task" && settings.overtimeTaskId) {
    return {
      ...entry,
      taskId: settings.overtimeTaskId
    };
  }
  if (settings.overtimeTagId) {
    return {
      ...entry,
      tagIds: Array.from(new Set([...(entry.tagIds ?? []), settings.overtimeTagId]))
    };
  }
  return entry;
}

function isAlreadyOvertime(entry: ClockifyTimeEntry, settings: ClockifySettings): boolean {
  if (settings.overtimeMode === "project") return entry.projectId === settings.overtimeProjectId;
  if (settings.overtimeMode === "task") return entry.taskId === settings.overtimeTaskId;
  return Boolean(settings.overtimeTagId && entry.tagIds?.includes(settings.overtimeTagId));
}

