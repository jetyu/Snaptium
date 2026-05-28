# Workbench Layout Spec

This document defines the layout contract for the workbench dashboard. The goal is to keep the dashboard visually stable, organized, and readable across desktop and narrow windows without treating the whole UI as a single scaled image.

## Principles

- Keep layout structure stable within each breakpoint.
- Use shared layout tokens for spacing, card radius, card heights, and page width.
- Change layout mode only at breakpoints; do not rewrite many component-level sizes inside a breakpoint.
- Align cards only within the same visual row.
- Prefer outer card stability with inner content scrolling on desktop.
- Let narrow layouts use natural height instead of fixed card heights.
- Cap the workbench content width on wide displays so the page does not stretch into sparse columns.

## Layout Modes

### Desktop: `min-width: 1121px`

- Use a two-column dashboard: main content plus side rail.
- Main and side columns use a stable `3fr / 1fr` relationship.
- The full workbench content is capped by `--workbench-layout-max-width`.
- Desktop placement is controlled by parent grid areas, not by two independent natural-height columns.
- `main` and `aside` remain semantic wrappers, while their direct cards participate in the desktop parent grid.
- The hero, overview metrics, recent panels, and smart recommendations stay in the main column.
- Today stats, growth, active tags, and topic heat stay in the side rail.
- Fixed card heights are allowed only for desktop row alignment.

Desktop grid areas:

```text
hero      stats
hero      growth
overview  growth
recent    tags
smart     topic
```

### Tablet: `max-width: 1120px`

- Collapse the workbench into one main column.
- Move the side rail below the main content.
- Side cards may use a two-column grid.
- Topic heat and active tags can span the full width when their content benefits from room.
- Fixed desktop row heights are disabled.

### Compact: `max-width: 900px`

- Use a single-column flow.
- Recent panels stack vertically.
- Smart recommendations stack internally.
- Side cards stack vertically.
- Cards use natural height.

### Small: `max-width: 620px`

- Metrics become single-column.
- Action buttons can become full width.
- Time labels can be hidden in dense feed rows.

## Row Alignment

Desktop row alignment is limited to these groups:

- Recent activity, recent questions, and active tags use `--workbench-feed-card-height`.
- Smart recommendations and topic heat use `--workbench-recommendation-card-height`.

Other cards keep natural height. This avoids unnecessary internal scrollbars and prevents unrelated modules from forcing each other into awkward dimensions.

## Token Ownership

Workbench layout tokens live on `.workbench-dashboard`:

- `--workbench-layout-max-width`
- `--workbench-page-padding`
- `--workbench-gap`
- `--workbench-card-radius`
- `--workbench-sidebar-min`
- `--workbench-hero-min-height`
- `--workbench-feed-card-height`
- `--workbench-recommendation-card-height`
- `--workbench-panel-header-padding`
- `--workbench-panel-body-padding`

Breakpoints should adjust these tokens first. Component-level overrides should be reserved for true layout-mode changes, such as switching from two columns to one column.
