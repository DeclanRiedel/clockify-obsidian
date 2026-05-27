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
  overtimeStartTime: "17:00",
  overtimeTagId: "",
  overtimeCheckSeconds: 60,
  promptBeforeOvertime: false
};
