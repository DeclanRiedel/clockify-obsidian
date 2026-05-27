# Clockify Tracker for Obsidian

Fast Clockify timer and time-entry editor inside Obsidian.

## Features

- Today tracker pane inside Obsidian.
- Start/stop Clockify timer.
- Inline edit description, start/end, project, task, tags, billable state.
- Quick add syntax:
  - `9-11 Fix auth @Project /Task #tag`
  - `1.5h Review notes @Project`
  - `Write report` starts a running timer.
- Metadata cache for projects, tasks, and tags.
- Overtime handoff: after configured daily/weekly limits, stop the running timer and continue it with an overtime tag, project, or task.

## Install Locally

Build once:

```bash
npm install
npm run build
```

Copy or symlink this directory into an Obsidian vault:

```text
VAULT/.obsidian/plugins/clockify-obsidian/
```

Required runtime files:

```text
main.js
manifest.json
styles.css
```

Enable **Clockify Tracker** in Obsidian community plugins.

## Configure

1. Open plugin settings.
2. Add Clockify API key.
3. Select region/base URL.
4. Click **Auto configure** to fill workspace/user.
5. Run **Refresh projects, tasks, and tags**.
6. Configure overtime mode and limits if needed.

## Development

```bash
npm install
npm run dev
npm run check
```

Or with Nix:

```bash
nix develop
nix run .#test
```

Build output is `main.js`, plus `manifest.json` and `styles.css`.
