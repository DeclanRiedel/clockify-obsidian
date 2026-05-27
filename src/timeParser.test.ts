import { describe, expect, it } from "vitest";
import { formatDuration, parseQuickEntry, startOfLocalWeek } from "./timeParser";

describe("parseQuickEntry", () => {
  const now = new Date(2026, 4, 27, 12, 0, 0);

  it("parses time range and metadata shorthands", () => {
    const draft = parseQuickEntry("9:30-11:00 Fix auth @Project A /Task B #urgent", { now });
    expect(draft.description).toBe("Fix auth");
    expect(draft.start.getHours()).toBe(9);
    expect(draft.start.getMinutes()).toBe(30);
    expect(draft.end?.getHours()).toBe(11);
    expect(draft.projectId).toBe("Project A");
    expect(draft.taskId).toBe("Task B");
    expect(draft.tagIds).toEqual(["urgent"]);
  });

  it("parses duration entries", () => {
    const draft = parseQuickEntry("1.5h Review notes", { now });
    expect(draft.description).toBe("Review notes");
    expect(draft.end?.getTime()).toBe(now.getTime());
    expect(draft.start.getHours()).toBe(10);
    expect(draft.start.getMinutes()).toBe(30);
  });

  it("formats duration", () => {
    expect(formatDuration(485)).toBe("8:05");
  });

  it("starts week on Monday", () => {
    expect(startOfLocalWeek(new Date(2026, 4, 31)).getDate()).toBe(25);
  });
});

