export type ClockifyRegion = "global" | "euc1" | "use2" | "euw2" | "apse2" | "custom";

export interface ClockifySettings {
  apiKey: string;
  baseUrl: string;
  region: ClockifyRegion;
  workspaceId: string;
  userId: string;
  defaultProjectId: string;
  defaultTaskId: string;
  defaultTagIds: string[];
  overtimeEnabled: boolean;
  overtimeStartTime: string;
  overtimeTagId: string;
  overtimeCheckSeconds: number;
  promptBeforeOvertime: boolean;
  debugLogging: boolean;
}

export interface ClockifyUser {
  id: string;
  name: string;
  email?: string;
  activeWorkspace?: string;
  defaultWorkspace?: string;
  settings?: {
    timeZone?: string;
  };
}

export interface ClockifyWorkspace {
  id: string;
  name: string;
}

export interface ClockifyProject {
  id: string;
  name: string;
  clientName?: string;
  archived?: boolean;
}

export interface ClockifyTask {
  id: string;
  name: string;
  projectId?: string;
  status?: string;
}

export interface ClockifyTag {
  id: string;
  name: string;
}

export interface ClockifyTimeInterval {
  start: string;
  end?: string | null;
  duration?: string | null;
}

export interface ClockifyTimeEntry {
  id: string;
  description: string;
  projectId?: string | null;
  taskId?: string | null;
  tagIds?: string[];
  billable?: boolean;
  timeInterval: ClockifyTimeInterval;
  workspaceId?: string;
  userId?: string;
}

export interface TimeEntryDraft {
  description: string;
  start: Date;
  end?: Date;
  projectId?: string;
  taskId?: string;
  tagIds: string[];
  billable: boolean;
}

export interface MetadataCache {
  projects: ClockifyProject[];
  tasksByProject: Record<string, ClockifyTask[]>;
  tags: ClockifyTag[];
  fetchedAt?: string;
}
