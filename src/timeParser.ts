import { TimeEntryDraft } from "./types";

const TIME_RANGE = /(?:^|\s)(?<start>\d{1,2}(?::\d{2})?)\s*-\s*(?<end>\d{1,2}(?::\d{2})?)(?:\s|$)/;
const DURATION = /(?:^|\s)(?<amount>\d+(?:\.\d+)?)\s*(?<unit>h|hr|hrs|m|min|mins)(?:\s|$)/i;

export interface ParseContext {
  now: Date;
  defaultProjectId?: string;
  defaultTaskId?: string;
  defaultTagIds?: string[];
}

export function parseQuickEntry(input: string, context: ParseContext): TimeEntryDraft {
  const trimmed = input.trim();
  const date = inferDate(trimmed, context.now);
  const projectMatch = trimmed.match(/@([\w .:-]+)/);
  const taskMatch = trimmed.match(/\/([\w .:-]+)/);
  const tagMatches = [...trimmed.matchAll(/#([\w-]+)/g)].map((match) => match[1]);
  const rangeMatch = trimmed.match(TIME_RANGE);
  const durationMatch = trimmed.match(DURATION);

  let start = new Date(context.now);
  let end: Date | undefined;

  if (rangeMatch?.groups) {
    start = withTime(date, rangeMatch.groups.start);
    end = withTime(date, rangeMatch.groups.end);
    if (end <= start) end.setDate(end.getDate() + 1);
  } else if (durationMatch?.groups) {
    const minutes = durationToMinutes(durationMatch.groups.amount, durationMatch.groups.unit);
    end = new Date(context.now);
    start = new Date(end.getTime() - minutes * 60_000);
  } else {
    start = new Date(context.now);
  }

  const description = trimmed
    .replace(TIME_RANGE, " ")
    .replace(DURATION, " ")
    .replace(/\b(today|yesterday|tomorrow)\b/gi, " ")
    .replace(/@[\w .:-]+/, " ")
    .replace(/\/[\w .:-]+/, " ")
    .replace(/#[\w-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    description,
    start,
    end,
    projectId: projectMatch?.[1]?.trim() || context.defaultProjectId || undefined,
    taskId: taskMatch?.[1]?.trim() || context.defaultTaskId || undefined,
    tagIds: [...(context.defaultTagIds ?? []), ...tagMatches],
    billable: false
  };
}

export function minutesBetween(start: string | Date, end: string | Date): number {
  const startDate = typeof start === "string" ? new Date(start) : start;
  const endDate = typeof end === "string" ? new Date(end) : end;
  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60_000));
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfLocalWeek(date: Date): Date {
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = startOfLocalDay(date);
  start.setDate(start.getDate() + mondayOffset);
  return start;
}

export function formatDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}:${remainder.toString().padStart(2, "0")}`;
}

function inferDate(input: string, now: Date): Date {
  const date = startOfLocalDay(now);
  if (/\byesterday\b/i.test(input)) date.setDate(date.getDate() - 1);
  if (/\btomorrow\b/i.test(input)) date.setDate(date.getDate() + 1);
  return date;
}

function withTime(date: Date, value: string): Date {
  const [hour, minute = "0"] = value.split(":");
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), Number(hour), Number(minute), 0, 0);
}

function durationToMinutes(amount: string, unit: string): number {
  const parsed = Number.parseFloat(amount);
  return /h/i.test(unit) ? Math.round(parsed * 60) : Math.round(parsed);
}

