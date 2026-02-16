# Safe Performance Pass — Summary

## Non-negotiables (unchanged)

- Save endpoints’ payload shapes and DB writes: **unchanged**
- No optimistic updates for critical data; save flow remains authoritative
- Required refetches (e.g. after save) still happen at the same trigger points
- No new `router.refresh()` calls
- Save/load behaviour is the same

---

## A) UI jank / flicker

- **Stable list keys**: Stream plan rows use `key={stream}` (category name). Forecast and SWMP tables use `key={item.id}` or `key={row.id}`. No list rows use array index where a stable id exists.
- **Responsibilities / additional responsibilities**: Still use `key={idx}`; these lists have no stored id and were not given synthetic ids to avoid state/persistence changes.
- **No new dynamic keys on parents**: No parent container keys were added that would force remount on state change.
- **Heavy sections**: `ForecastTable` and `ForecastSummary` are wrapped in `React.memo` so they only re-render when their props change.

---

## B) Fewer re-renders (memoization)

- **`updatePlan` (inputs page)**: Wrapped in `useCallback` with empty deps so the function reference is stable and children receiving it don’t re-render unnecessarily.
- **`ForecastTable`**: Exported as `React.memo(ForecastTableInner)` so the table doesn’t re-render when the parent re-renders with the same `items` and other props.
- **`ForecastSummary`**: Exported as `React.memo(ForecastSummaryInner)` so the summary doesn’t re-render when the parent re-renders with the same `items`.
- **Existing `useMemo`**: Left as-is for `partnerIdsInPlans`, `generationWarnings`, `diversionSummary`, `filteredItems`, `chartData`, `filteredRecommendations`, `appendixData`, etc.

---

## C) Network requests

- **No duplicate fetches in a single render cycle**: Confirmed. Layout fetches project + forecast count once per `projectId`. Inputs fetches partners once; facilities are loaded per partner when needed and guarded by `facilitiesByPartner` / `facilitiesLoadingByPartner`. Forecast’s `loadItems` runs once per `projectId`. SWMP runs one effect that triggers strategy, checklist, distances, and forecast fetches; no second trigger for the same resource in the same cycle.
- **Refetch-after-save**: Unchanged. Inputs still refetches project status and runs distance recompute after save. Forecast does not refetch items after save (unchanged). Strategy/Outputs refetch behaviour unchanged.

---

## D) Debounce

- **No change to save semantics**: Autosave (destination change) still uses the same 1.5s debounce. No new debouncing of the actual save call.
- **No new debouncing of typing**: No new debounce was added for text inputs; no change to existing behaviour.

---

## E) Loading states

- **Inputs**: “Saving…” appears next to the “Waste stream plans (detailed)” label when `saveLoading` is true; form stays visible.
- **Forecast**: “Saving…” appears above the filter row when `saveStatus === "saving"`; table stays visible.
- **SWMP**:  
  - **Strategy**: “Loading strategy…” card when `strategySectionLoading && !wasteStrategy`; once loaded, strategy content shows.  
  - **Appendix**: “Loading forecast items…” card when `forecastSectionLoading && forecastItems.length === 0`; once loaded, appendix content shows.  
  - **Distances**: “Updating…” on the “Update distances” button when `distancesRecomputing` was already present; left as-is.  
- All section loaders keep existing data visible where applicable (e.g. Strategy section shows content when `wasteStrategy` is set and only shows loading when there is no data yet).

---

## F) Dev-only instrumentation

- **Layout**: `console.time("[perf] project load")` / `console.timeEnd("[perf] project load")` around project + forecast count fetch (dev only).
- **Inputs**: `console.time("[perf] streams/partners fetch")` / `console.timeEnd("[perf] streams/partners fetch")` around partners fetch (dev only).
- **Forecast**: `console.time("[perf] forecast items fetch")` / `console.timeEnd("[perf] forecast items fetch")` around `loadItems` (dev only).
- **SWMP**: `console.time("[perf] strategy fetch")` / `console.timeEnd("[perf] strategy fetch")` inside `fetchWasteStrategy` (dev only).
- No secrets or sensitive data are logged.

---

## Files changed

| File | Changes |
|------|--------|
| `app/projects/[id]/inputs/page.tsx` | `useCallback` for `updatePlan`; “Saving…” next to stream plans label; dev timers for partners fetch. |
| `app/projects/[id]/forecast/page.tsx` | “Saving…” above filter row when saving; dev timers for forecast items fetch. |
| `app/projects/[id]/swmp/page.tsx` | `strategySectionLoading` / `forecastSectionLoading`; Strategy and Appendix show loading cards until data is ready; dev timers for strategy fetch. |
| `app/projects/[id]/layout.tsx` | Dev timers for project load. |
| `components/forecast/ForecastTable.tsx` | Renamed default export to `ForecastTableInner`, exported `ForecastTable = React.memo(ForecastTableInner)`. |
| `components/forecast/ForecastSummary.tsx` | Renamed default export to `ForecastSummaryInner`, exported `ForecastSummary = React.memo(ForecastSummaryInner)`. |

---

## Acceptance tests (manual in browser)

1. **Saving project details** — Save project details; confirm they persist and no regressions.
2. **Saving waste stream edits** — Edit stream plans (facility/custom, pathway, etc.), save; confirm all edits are saved and no missed saves.
3. **Forecast add/edit/delete** — Add, edit, delete forecast items; confirm changes save and list updates.
4. **Strategy/Outputs after refetch** — After the same refetch triggers as before (e.g. apply recommendation, update distances), confirm Strategy and Outputs reflect saved data.
5. **No extra UI flicker** — Confirm no new blink or full remount on autosave or when editing; section “Saving…” / “Loading…” appear without hiding existing content where intended.

---

## What reduced re-renders

- **`useCallback(updatePlan)`**: Callbacks passed into stream plan UI no longer get a new function reference every render, reducing child re-renders when only other state (e.g. `saveLoading`) changes.
- **`React.memo(ForecastTable)`**: Parent re-renders (e.g. filter change, save status) no longer force the whole table to re-render when `items` and other props are referentially unchanged.
- **`React.memo(ForecastSummary)`**: Same for the summary sidebar when `items` is unchanged.

## What de-duped requests

- No duplicate requests in a single render cycle were found; existing guards (e.g. facilities by partner, single effect per page for strategy/checklist/distances/forecast) were left as-is. No new de-dupe layer was added.
