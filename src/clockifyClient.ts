import {
  ClockifyProject,
  ClockifySettings,
  ClockifyTag,
  ClockifyTask,
  ClockifyTimeEntry,
  ClockifyUser,
  ClockifyWorkspace,
  TimeEntryDraft
} from "./types";

export class ClockifyClient {
  constructor(private readonly getSettings: () => ClockifySettings) {}

  async getCurrentUser(): Promise<ClockifyUser> {
    return this.request<ClockifyUser>("/user");
  }

  async getWorkspaces(): Promise<ClockifyWorkspace[]> {
    return this.request<ClockifyWorkspace[]>("/workspaces");
  }

  async getProjects(workspaceId = this.requireWorkspace()): Promise<ClockifyProject[]> {
    return this.request<ClockifyProject[]>(`/workspaces/${workspaceId}/projects?archived=false&page-size=500`);
  }

  async getTasks(projectId: string, workspaceId = this.requireWorkspace()): Promise<ClockifyTask[]> {
    return this.request<ClockifyTask[]>(`/workspaces/${workspaceId}/projects/${projectId}/tasks?page-size=500`);
  }

  async getTags(workspaceId = this.requireWorkspace()): Promise<ClockifyTag[]> {
    return this.request<ClockifyTag[]>(`/workspaces/${workspaceId}/tags?page-size=500`);
  }

  async getEntries(start: Date, end: Date, workspaceId = this.requireWorkspace(), userId = this.requireUser()): Promise<ClockifyTimeEntry[]> {
    const params = new URLSearchParams({
      start: start.toISOString(),
      end: end.toISOString(),
      page: "1",
      "page-size": "500",
      hydrated: "true"
    });
    return this.request<ClockifyTimeEntry[]>(`/workspaces/${workspaceId}/user/${userId}/time-entries?${params.toString()}`);
  }

  async createEntry(draft: TimeEntryDraft, workspaceId = this.requireWorkspace()): Promise<ClockifyTimeEntry> {
    return this.request<ClockifyTimeEntry>(`/workspaces/${workspaceId}/time-entries`, {
      method: "POST",
      body: JSON.stringify(toCreatePayload(draft))
    });
  }

  async startTimer(draft: Omit<TimeEntryDraft, "end">, workspaceId = this.requireWorkspace(), userId = this.requireUser()): Promise<ClockifyTimeEntry> {
    return this.request<ClockifyTimeEntry>(`/workspaces/${workspaceId}/user/${userId}/time-entries`, {
      method: "POST",
      body: JSON.stringify(toCreatePayload(draft))
    });
  }

  async stopTimer(workspaceId = this.requireWorkspace(), userId = this.requireUser()): Promise<ClockifyTimeEntry> {
    return this.request<ClockifyTimeEntry>(`/workspaces/${workspaceId}/user/${userId}/time-entries`, {
      method: "PATCH",
      body: JSON.stringify({ end: new Date().toISOString() })
    });
  }

  async updateEntry(existing: ClockifyTimeEntry, patch: Partial<TimeEntryDraft>, workspaceId = this.requireWorkspace()): Promise<ClockifyTimeEntry> {
    return this.request<ClockifyTimeEntry>(`/workspaces/${workspaceId}/time-entries/${existing.id}`, {
      method: "PUT",
      body: JSON.stringify(toUpdatePayload(existing, patch))
    });
  }

  async deleteEntry(entryId: string, workspaceId = this.requireWorkspace()): Promise<void> {
    await this.request<void>(`/workspaces/${workspaceId}/time-entries/${entryId}`, {
      method: "DELETE"
    });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const settings = this.getSettings();
    if (!settings.apiKey) throw new Error("Clockify API key is missing.");
    const response = await fetch(`${settings.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": settings.apiKey,
        ...(init.headers ?? {})
      }
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Clockify ${response.status}: ${text || response.statusText}`);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  private requireWorkspace(): string {
    const workspaceId = this.getSettings().workspaceId;
    if (!workspaceId) throw new Error("Clockify workspace ID is missing.");
    return workspaceId;
  }

  private requireUser(): string {
    const userId = this.getSettings().userId;
    if (!userId) throw new Error("Clockify user ID is missing.");
    return userId;
  }
}

function toCreatePayload(draft: Omit<TimeEntryDraft, "end"> & { end?: Date }): Record<string, unknown> {
  return {
    start: draft.start.toISOString(),
    end: draft.end?.toISOString(),
    description: draft.description,
    projectId: draft.projectId || undefined,
    taskId: draft.taskId || undefined,
    tagIds: draft.tagIds,
    billable: draft.billable
  };
}

function toUpdatePayload(existing: ClockifyTimeEntry, patch: Partial<TimeEntryDraft>): Record<string, unknown> {
  const start = patch.start ?? new Date(existing.timeInterval.start);
  const end = patch.end ?? (existing.timeInterval.end ? new Date(existing.timeInterval.end) : undefined);
  return {
    start: start.toISOString(),
    end: end?.toISOString(),
    description: patch.description ?? existing.description,
    projectId: patch.projectId ?? existing.projectId ?? undefined,
    taskId: patch.taskId ?? existing.taskId ?? undefined,
    tagIds: patch.tagIds ?? existing.tagIds ?? [],
    billable: patch.billable ?? existing.billable ?? false
  };
}

