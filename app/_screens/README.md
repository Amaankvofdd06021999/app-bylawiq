# Screens

Each file here is one page of the app, written once against the `DataSource` contract (`data/source.ts`).
The route files under `app/(app)/` (real app) and `app/demo/` (interactive demo) are one-line wrappers that
pass their data source in:

| Screen | Real route | Demo route |
| --- | --- | --- |
| `workspace.tsx` | `/workspace` | `/demo/workspace` |
| `building-section.tsx` | `/b/[buildingId]/[section]` | `/demo/b/[buildingId]/[section]` |
| `chat.tsx` | `/b/[buildingId]/chat/[chatId]` | `/demo/b/[buildingId]/chat/[chatId]` |
| `platform-admin.tsx` | `/admin` | `/demo/admin` |

Screens decide *which* view to show and fetch its data; the views themselves are presentational components in
`features/*/components/` that never fetch. Screens must not import `mock/` (enforced by
`tests/mock/boundary.test.ts`).
