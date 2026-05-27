import { ClockifySettings, ClockifyTimeEntry } from "./types";

export interface OvertimeDecision {
  shouldSwitch: boolean;
  reason: "time" | "none";
  overtimeEntry: Partial<ClockifyTimeEntry>;
}

export function decideOvertimeSwitch(args: {
  settings: ClockifySettings;
  runningEntry: ClockifyTimeEntry | null;
  now: Date;
}): OvertimeDecision {
  const { settings, runningEntry, now } = args;
  if (!settings.overtimeEnabled || !runningEntry || !settings.overtimeTagId) {
    return { shouldSwitch: false, reason: "none", overtimeEntry: {} };
  }
  if (isAlreadyOvertime(runningEntry, settings)) {
    return { shouldSwitch: false, reason: "none", overtimeEntry: {} };
  }
  if (!isAtOrAfterOvertimeStart(settings.overtimeStartTime, now)) {
    return { shouldSwitch: false, reason: "none", overtimeEntry: {} };
  }

  return {
    shouldSwitch: true,
    reason: "time",
    overtimeEntry: applyOvertimeMarker(runningEntry, settings)
  };
}

export function applyOvertimeMarker(entry: ClockifyTimeEntry, settings: ClockifySettings): Partial<ClockifyTimeEntry> {
  return {
    ...entry,
    projectId: entry.projectId,
    taskId: entry.taskId,
    tagIds: settings.overtimeTagId
      ? Array.from(new Set([...(entry.tagIds ?? []), settings.overtimeTagId]))
      : entry.tagIds ?? []
  };
}

export function isAtOrAfterOvertimeStart(startTime: string, now: Date): boolean {
  const [hourText, minuteText = "0"] = startTime.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;
  const start = new Date(now);
  start.setHours(hour, minute, 0, 0);
  return now >= start;
}

function isAlreadyOvertime(entry: ClockifyTimeEntry, settings: ClockifySettings): boolean {
  return Boolean(settings.overtimeTagId && entry.tagIds?.includes(settings.overtimeTagId));
}

