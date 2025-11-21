# Loading & Skeleton Standards

This project ships with shared loading primitives that keep the UI responsive while data requests resolve. Use the following guidance when adding new screens or mutations.

## Global App Shell

- Use the `<Loader />` component for branded fallbacks. It renders the shared shadcn spinner, wires up aria attributes, and respects reduced-motion preferences.
- Wrap lazily loaded routes or Suspense boundaries with `<Suspense fallback={<Loader variant="fullscreen" />}>` to avoid blank flashes between route transitions.
- Adjust the footprint with `variant="page"` or `variant="inline"` when you need a smaller placeholder (e.g., cards or inline panels) while keeping the same semantics.

## Section Skeletons

- Import the generic `<Skeleton />` primitive from `@/components/ui/skeleton` for block-level placeholders. Combine widths and heights so they roughly match the final layout to minimize layout shift.
- Group skeletons inside a container that matches the final component structure (cards, tables, lists) and wrap that block with `role="status"` and `aria-live="polite"` if users should be notified audibly.
- Respect `prefers-reduced-motion`: the `Skeleton` component disables the pulse animation automatically when motion is reduced, so rely on it instead of hand-rolling CSS.

## Async Mutations

- Disable actionable buttons while `isSubmitting` or a mutation is in flight, and pair the button with a `Loader2` icon (shadcn/ui) when feedback is helpful.
- Announce long-running mutations with `aria-live="assertive"` messages if they block navigation or save operations.

## i18n

- All new status messages should go through `react-i18next`. Keys already exist for:
  - `loading.appShell` - full-screen loader copy.
  - `dashboard.loadingFeatures` - dashboard card skeleton text.

## Checklist Before Shipping

1. Does the route or component render a branded loader before data arrives?
2. Are skeletons visible for the primary interactive sections?
3. Do screen readers receive `aria-busy` and `aria-live` feedback while loading?
4. Have you verified the experience with `prefers-reduced-motion` enabled?
5. Are translation keys present for any new messaging?

Following these steps keeps the KLA platform feeling polished even when the network slows down.

## Reviewer Workflow Notes

- Reviewer pages (Device Loan + PC Lab Reservation) now emit queue refresh events whenever a status change succeeds. If you add new review surfaces, call `emitPCLabQueueRefresh` (or the device loan counterpart) once the mutation resolves so that list views stay in sync without manual refreshes.
- Pair approve/reject actions with `useToast` feedback so reviewers get immediate confirmation or failure messaging even if they stay inside the detail page.
- Long-running reviewer actions should also refresh any open list views/modals by reusing the existing `subscribeToPCLabQueueRefresh` helper rather than reimplementing polling.
