import { ClockifySettings } from "./types";

export const DEFAULT_SETTINGS: ClockifySettings = {
  apiKey: "",
  baseUrl: "https://api.clockify.me/api/v1",
  region: "global",
  workspaceId: "",
  userId: "",
  defaultProjectId: "",
  defaultTaskId: "",
  defaultTagIds: [],
  overtimeEnabled: false,
  overtimeMode: "tag",
  overtimeTagId: "",
  overtimeProjectId: "",
  overtimeTaskId: "",
  dailyLimitMinutes: 480,
  weeklyLimitMinutes: 2400,
  overtimeCheckSeconds: 60,
  promptBeforeOvertime: true
};

