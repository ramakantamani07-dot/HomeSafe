# Languages — Hindi first

**Status (19 Oct 2026):** planned, not started. India launch item 5
(`docs/plan/IMPLEMENTATION_PHASES.md`). Only the Siri phrases exist in Hindi
today (`targets/sos-intent/AppShortcuts.xcstrings`).

Parents and grandparents are a large part of who a safety app reaches in
India, and many read Hindi more easily than English. The same foundation then
carries regional languages (Tamil, Telugu, Bengali, Marathi, Kannada…) as
translation work, not code.

## What exists

| | Count (19 Oct) |
|---|---|
| Screens | 42 |
| Components | 62 |
| Text on screen (single-line `<Text>` alone) | ~160, plus multi-line text |
| Labels, titles, placeholders, accessibility labels | ~360 |
| Alerts | ~60 (title + body each) |
| Wording built in `models/` (rides, safety checks, status lines) | ~20 functions |
| Server texts and pushes (`functions/src`) | ~25 templates |
| Dates and times formatted in place | 15 |
| Translation library | none |

Roughly **1,000 strings** in all.

**Fonts:** Instrument Sans and Bricolage Grotesque have **no Devanagari**
(checked). Hindi would fall back to the system font: a different look, and
Devanagari's taller letters can clip in lines sized for Latin.

## Decisions to take

| # | Question | Recommendation |
|---|---|---|
| L1 | How is the language chosen? | Follow the phone, **plus** Settings → Language. Many Indian phones run in English while their owners read Hindi more comfortably |
| L2 | What kind of Hindi? | **Everyday Hindi**, keeping words people already use: SOS, auto, location, OK. Formal Hindi (स्थान for location) is harder to read at a glance, and a safety app is read in a hurry |
| L3 | Who reviews? | A **native speaker** reviews everything; SOS, safety-check and emergency text twice. Mistranslating "nobody has responded" is a safety bug |
| L4 | What language do texts to contacts use? | **Push:** the recipient's app language. **SMS** (contacts without the app): the traveller's language. Each Hindi SMS needs its own DLT template, and Hindi SMS are Unicode — 70 characters a part instead of 160, so about twice the cost |

## Phases

| # | Work | Size | Needs |
|---|---|---|---|
| H1 | **Foundation.** `src/i18n/`: `en.ts` as the source, `hi.ts` typed to the same keys (a missing translation fails `tsc`), `t(key, params)` and plurals (Hindi: one for 0 and 1, other otherwise); a `LanguageContext` (memoised) with `useT()`; the choice saved on the phone and on `users/{uid}.language` for the server. `expo-localization` (Expo-maintained, SDK-pinned `~17.0.9`, one rebuild) for the phone's language. **Noto Sans Devanagari** (OFL) loaded with `expo-font`, used whenever the language is Hindi. One date-and-time formatter replacing the 15 in-place ones. A `check:i18n` guard, like `check:tokens`: no bare English in `app/` and `src/components/`. A pseudo-language for finding clipped text | 2–3 days | Decisions L1, L2 |
| H2 | **Move the text** into `en.ts`, most important first: SOS and emergency → safety check → journey and rides → sign-in → family → settings → the rest. Wording functions in `models/` take the translator rather than returning English | 4–6 days | H1 |
| H3 | **Hindi text.** A first draft from me, with a glossary (SOS, Safe Journey, check-in, trusted contact, auto, pickup), then the native speaker's review | 2–3 days + review | L3 |
| H4 | **System text.** iOS permission prompts (location, Face ID, contacts) and the app name through Expo's `locales`; Android's equivalents; the "I'm on it" notification action; store listings | 1 day | Rebuild |
| H5 | **Server messages.** Pushes in the recipient's language, SMS in the traveller's (L4); Hindi DLT templates added to the registry (`DLT_TEMPLATE_*_HI`) | 2 days | DLT registration |
| H6 | **On the phone.** Hindi on the iPhone and a cheap Android phone: clipping, large text, VoiceOver and TalkBack in Hindi, the SOS path end to end | 1–2 days | Android phone |

About **2½ weeks** of building, plus review and DLT time running alongside.

## Why no translation library

`i18next` was considered: well maintained and MIT, but most of it (backends,
namespaces, detection plugins) is not needed here. A typed `t()` and a plural
rule are about fifty lines, and the type check — every Hindi key must exist —
is the part that matters most. Hermes may not provide `Intl.PluralRules`
(check on a device in H1), which is another reason to keep the rule our own.
`expo-localization` is the only new dependency, and it goes through the gate
in `docs/architecture/DEPENDENCIES.md`.

## What stays English

Brand words (WayLoc, SOS), ride-app names, addresses and place names as the
map returns them, and anything a person typed. Logs and metrics.
