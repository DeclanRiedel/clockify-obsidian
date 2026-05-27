import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./defaults";
import { decideOvertimeSwitch, isAtOrAfterOvertimeStart } from "./overtime";
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
  it("adds overtime tag after configured start time", () => {
    const decision = decideOvertimeSwitch({
      settings: {
        ...DEFAULT_SETTINGS,
        overtimeEnabled: true,
        overtimeStartTime: "17:00",
        overtimeTagId: "ot"
      },
      runningEntry: baseEntry,
      now: new Date(2026, 4, 27, 17, 1, 0)
    });
    expect(decision.shouldSwitch).toBe(true);
    expect(decision.reason).toBe("time");
    expect(decision.overtimeEntry.projectId).toBe("p1");
    expect(decision.overtimeEntry.taskId).toBe("t1");
    expect(decision.overtimeEntry.tagIds).toEqual(["ot"]);
  });

  it("does not switch before configured start time", () => {
    const decision = decideOvertimeSwitch({
      settings: {
        ...DEFAULT_SETTINGS,
        overtimeEnabled: true,
        overtimeStartTime: "17:00",
        overtimeTagId: "ot"
      },
      runningEntry: baseEntry,
      now: new Date(2026, 4, 27, 16, 59, 0)
    });
    expect(decision.shouldSwitch).toBe(false);
  });

  it("does not re-switch overtime entry", () => {
    const decision = decideOvertimeSwitch({
      settings: {
        ...DEFAULT_SETTINGS,
        overtimeEnabled: true,
        overtimeStartTime: "17:00",
        overtimeTagId: "ot"
      },
      runningEntry: { ...baseEntry, tagIds: ["ot"] },
      now: new Date(2026, 4, 27, 17, 30, 0)
    });
    expect(decision.shouldSwitch).toBe(false);
  });

  it("checks local wall-clock time", () => {
    expect(isAtOrAfterOvertimeStart("17:00", new Date(2026, 4, 27, 17, 0, 0))).toBe(true);
    expect(isAtOrAfterOvertimeStart("17:00", new Date(2026, 4, 27, 16, 59, 0))).toBe(false);
  });
});
