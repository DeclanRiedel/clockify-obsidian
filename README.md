# Clockify Tracker for Obsidian

Fast Clockify time tracking inside Obsidian.

## Features

- Start, stop, edit, duplicate, and delete Clockify entries.
- Today view plus Mon-Sun weekly timeline.
- Inline editing for time, description, project, task, tags, and billable state.
- Quick add: `9-11 Fix auth @Project /Task #tag`.
- Project/tag cache with lazy task loading.
- Overtime handoff at a set time, e.g. `17:00`, continuing the current timer with an overtime tag.
- Toggle panel from ribbon or `Ctrl/Cmd + Shift + C`.

## Install

```bash
npm install
npm run build
```

Copy these files into `VAULT/.obsidian/plugins/clockify-obsidian/`:

```text
main.js
manifest.json
styles.css
```

Enable **Clockify Tracker** in Obsidian.

## Configure

Add your Clockify API key in plugin settings, click **Auto configure**, then refresh metadata.

Secrets are stored only in local Obsidian plugin data and are ignored by this repo.

## Dev

```bash
npm run check
npm run build
```

With Nix:

```bash
nix develop
nix run .#test
```

