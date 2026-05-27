import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./defaults";
import { decideOvertimeSwitch } from "./overtime";
import { ClockifyTimeEntry } from "./types";

const baseEntry: ClockifyTimeEntry = {
  id: "entry",
  description: "Work",
  projectId: "p1",
  taskId: "t1",
  tagIds: [],
  billable: false,
  timeInterval: {
    start: "2026-05-27T08:00:00.000Z",
    end: null
  }
};

describe("decideOvertimeSwitch", () => {
  it("adds overtime tag after daily limit", () => {
    const decision = decideOvertimeSwitch({
      settings: {
        ...DEFAULT_SETTINGS,
        overtimeEnabled: true,
        dailyLimitMinutes: 60,
        weeklyLimitMinutes: 2400,
        overtimeTagId: "ot"
      },
      runningEntry: baseEntry,
      dayEntries: [baseEntry],
      weekEntries: [baseEntry],
      now: new Date("2026-05-27T09:01:00.000Z")
    });
    expect(decision.shouldSwitch).toBe(true);
    expect(decision.reason).toBe("daily");
    expect(decision.overtimeEntry.tagIds).toEqual(["ot"]);
  });

  it("does not re-switch overtime entry", () => {
    const decision = decideOvertimeSwitch({
      settings: {
        ...DEFAULT_SETTINGS,
        overtimeEnabled: true,
        dailyLimitMinutes: 60,
        overtimeTagId: "ot"
      },
      runningEntry: { ...baseEntry, tagIds: ["ot"] },
      dayEntries: [{ ...baseEntry, tagIds: ["ot"] }],
      weekEntries: [{ ...baseEntry, tagIds: ["ot"] }],
      now: new Date("2026-05-27T09:30:00.000Z")
    });
    expect(decision.shouldSwitch).toBe(false);
  });
});
