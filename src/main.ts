import { Plugin } from "obsidian";

export default class ClockifyObsidianPlugin extends Plugin {
  async onload(): Promise<void> {
    console.log("Clockify Tracker loaded");
  }

  onunload(): void {
    console.log("Clockify Tracker unloaded");
  }
}

