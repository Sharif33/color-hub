# Release Notes

## 1.0.1 (2026-02-09)
Updates to popup picking flow and picker UX.

Highlights:
- Consolidated popup picker actions into a single `Pick Color` option
- Removed the separate active-page picker code path
- Kept a lightweight temporary popup state while EyeDropper is active
- Suppressed warning logs for expected user-cancelled EyeDropper actions

## 1.0.0 (2026-02-08)
Color Hub public release.

Highlights:
- Pick colors from any page via the popup and context menu
- Save and organize palettes in browser storage
- Fast, minimal UI focused on everyday design workflows

Permissions used:
- `activeTab`, `storage`, `unlimitedStorage`, `scripting`, `contextMenus`
- `host_permissions`: `<all_urls>`
