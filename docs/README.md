# wayLoc documentation

All project documentation lives here. Only `README.md` stays at the repository
root.

## Start here

| Document | What it is |
|---|---|
| [`plan/IMPLEMENTATION_PHASES.md`](plan/IMPLEMENTATION_PHASES.md) | **The current plan, and the status table.** What is built, what is left, and every decision taken along the way. Start here. |
| [`architecture/ARCHITECTURE.md`](architecture/ARCHITECTURE.md) | The pattern we follow (ports and adapters), the layering rules, and the rules for new work. |
| [`architecture/ARCHITECTURE_DEBT.md`](architecture/ARCHITECTURE_DEBT.md) | Audited debt with reproduction commands. Phase 0 cleared it; kept as the record of what was wrong and why. |
| [`architecture/DEPENDENCIES.md`](architecture/DEPENDENCIES.md) | The gate a third-party library must clear, and decisions on record. |

## Feature specifications

Authored specs. Treated as source of truth for *what* to build; the architecture
docs govern *how*.

| Document | Status |
|---|---|
| [`features/option15-ui-spec.md`](features/option15-ui-spec.md) | Partly built — `AI1`–`AI4`, `AI6` done; `AI5` partial; `AI7`–`AI12` to build |
| [`features/network-location-spec.md`](features/network-location-spec.md) | To build — Phase 6 |
| [`features/journey-flow-spec.md`](features/journey-flow-spec.md) | Built — screens 01–10 |
| [`features/design-handoff.md`](features/design-handoff.md) | Superseded by Option 15 (**G1**, resolved 2 Oct). Kept for the palette's history only. |

> **Mockups live with their images, not here.**
> Option 15 boards: `assets/imgs/*.png` — `home`, `search in sheet`, `route`,
> `ontheway`, `feelinguneasy`, `arrived`, `soshold`, `fakecall`, `settings`,
> `familyandcircle`, `addsome`, `consentandfind`, `samresult`, `flow`.
> Journey-flow boards: `assets/screens/*.png` (01–10).

## Reference

Background on decisions already made. Useful context, not active plans.

| Document | Covers |
|---|---|
| [`reference/IMPLEMENTATION_PLAN.md`](reference/IMPLEMENTATION_PLAN.md) | Original build tracker |
| [`reference/NATIVE_ARCHITECTURE_REVIEW.md`](reference/NATIVE_ARCHITECTURE_REVIEW.md) | Native/Expo config review and P0 items |
| [`reference/SECURITY_REVIEW.md`](reference/SECURITY_REVIEW.md) | Auth boundary, Firestore invariants, local storage |
| [`reference/DATA_RETENTION.md`](reference/DATA_RETENTION.md) | Retention per data category and enforcement |
| [`reference/FIREBASE_SERVICES.md`](reference/FIREBASE_SERVICES.md) | Firebase services in use |
| [`reference/APP_CHECK.md`](reference/APP_CHECK.md) | App Check setup |
| [`reference/RUNNING.md`](reference/RUNNING.md) | Running on device, and switching mock → real |

## Conventions

- New documentation goes in `docs/`, not the repository root.
- Code comments that cite a document use the full path, e.g.
  `docs/reference/DATA_RETENTION.md`, so the reference survives a move.
- A spec is never edited to match the implementation. If the implementation
  diverges deliberately, record it in the plan with the reason.
