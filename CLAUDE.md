# wayLoc

A personal-safety app: you tell it where you're going, chosen people can see
you get there, and there are ways to get help that don't require declaring an
emergency. Expo SDK 54 · React Native 0.81 · TypeScript · Firebase.

## Read before writing code

| Read | For |
|---|---|
| [`docs/plan/IMPLEMENTATION_PHASES.md`](docs/plan/IMPLEMENTATION_PHASES.md) | **Start here.** Status table (what is built), known gaps, and every decision taken with its reasoning. |
| [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md) | Ports and adapters. The layering rules are enforced by a script, not by convention. |
| [`docs/features/option15-ui-spec.md`](docs/features/option15-ui-spec.md) | The UI being built. Boards are `AI1`–`AI12` in `assets/imgs/`. |
| [`docs/architecture/DEPENDENCIES.md`](docs/architecture/DEPENDENCIES.md) | The gate a third-party library must clear before it is added. |
| [`docs/reference/RUNNING.md`](docs/reference/RUNNING.md) | Running on a device, and the build failures that have actually happened. |

A spec is never edited to match the implementation. If the build diverges
deliberately, record it as a decision in the plan with the reason — see D1–D6
there for the form.

## How work is done here

- **Follow the existing architecture.** `models/` → `providers/` (ports) →
  `implementations/` (adapters) → `services/` → `context/` → `hooks/` → `app/`.
  Add an abstraction only when it earns its place; never build a parallel one
  alongside something that already exists.
- **Check what exists before adding.** Most "missing" capability is already
  there under another name — search first.
- **No hard-coded values.** Colours come from `src/config/theme/palette.ts`,
  which is the one file to edit to change the app's colour, app chrome
  included. Config comes from `app.config.ts` or env.
- **Fix causes, not symptoms.** If something is wrong underneath, fix it there
  rather than working around it at the call site.
- **Clean up after yourself.** Timers, listeners, subscriptions, location
  watchers and async work must be torn down when a screen unmounts. Use
  `useInterval` / `useTimeout` rather than raw timers.
- **Battery is a feature.** This app runs location in the background. Avoid
  needless polling, re-renders and wake-ups.
- **Keep files small.** Extract components as screens grow. `home.tsx` went
  881 → 394 that way.
- **Native where it earns it.** Swift and Kotlin are welcome when the platform
  does the job better than JS. Prefer an OS capability over a paid API: the map,
  the geocoder and POI search are all free on iOS, and each was found that way.
- **Say only what is true.** Option 15 §1 principle 4 — never show the user a
  claim the app cannot stand behind. It has decided real design questions; see
  decision D3 in the plan.

## Before saying it is done

```bash
npm run check        # tests + architecture + design-token guards
npx tsc --noEmit
```

`npm run check:arch` and `check:tokens` enforce the layering and colour rules
above. They have caught real mistakes; when one fails, it is usually right.

Device builds: `docs/reference/RUNNING.md`. `expo run:ios` does not work on this
machine — build with `xcodebuild` and install with `devicectl`, as documented
there.
