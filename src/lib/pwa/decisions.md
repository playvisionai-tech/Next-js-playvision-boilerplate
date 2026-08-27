# lib/pwa — decisions

## 2026-08-27 — The manifest carries no translated copy

`src/app/manifest.ts` is a **single root route**. It is not under `[locale]`, it
has no `params`, and Next's file convention only recognises `manifest.*` at the
root of `app/`. So the one manifest that exists has to answer for every locale.
AGENTS.md says all user-facing strings live in `src/messages/`, which made this
a fork worth recording rather than a field to fill in.

**Rejected: the default locale's copy.** `getTranslations({ locale:
routing.defaultLocale, namespace: 'Manifest' })` typechecks, passes
`check:i18n`, and reads like the rule being followed. What it actually ships is
English `name`, `short_name` and `description` to a French user, written into
their home screen at the moment they install and not re-read afterwards. A
message catalog entry that only ever renders in one language is not a
translation; it is a hardcoded string with extra steps, and the next person to
add a locale gets no signal that this one is a lie.

**Rejected: a per-locale manifest.** `/fr/manifest.webmanifest` with a
`<link rel="manifest">` that varies by locale is the technically complete answer.
It needs a route handler, which AGENTS.md puts behind an ask-first gate, and it
buys less than it looks like: the OS reads the manifest once at install and
keeps what it read, so a per-locale manifest does not track the user's locale
either — it freezes whichever locale they happened to be browsing. It also
forks `start_url`, so an install from `/fr` would launch into French for a user
who has since switched. Worth revisiting only alongside header-based locale
detection, which `src/lib/i18n/spec.md` lists as out of scope.

**Chosen: no locale-dependent strings at all.** `name` and `short_name` are
`AppConfig.name` — the product's name, which is identity rather than prose and
is already used untranslated elsewhere, interpolated into the footer as
`{name}`. `description` and `lang` are omitted: `description` is the field that
most wants translating, it is optional, and an absent description is honest in a
way an English one served to French users is not. `lang` would declare a
language for strings that have none.

The cost is real and is not hidden: the install prompt shows no description, and
if the product name ever becomes something that should be translated, this
decision has to be reopened rather than quietly extended.

## 2026-08-27 — `start_url` is `/`, not `/en`

With `localePrefix: 'as-needed'` the default locale is served unprefixed, so
three paths were available and only one of them is not a decision about the
user's language.

**Rejected: `/en`.** It is a real, prerendered URL, and it is the one the build
output names. It also hardcodes English into the installed app's launcher entry
forever, and it takes the redirect on every cold start.

**Rejected: matching the installing page.** A single static manifest cannot;
that is the per-locale manifest rejected above.

**Chosen: `/`.** It is the only path where the app, not the manifest, decides
the locale — the same negotiation any other visit to the root gets.

What this does **not** fix, and should not be read as fixing: this app does not
detect locale from request headers, so `/` resolves to English unless a
`NEXT_LOCALE` cookie says otherwise, and on iOS a Home Screen web app has a
storage partition separate from Safari's, so the cookie set while browsing is
usually not there on first launch. A French user who installs the app will most
likely see English the first time they open it. The fix is header-based
detection at the root, not a different `start_url`.

## 2026-08-27 — 180x180 is the largest icon, and none is `maskable`

**SUPERSEDED on 2026-08-27 by "The manifest ships without install-capable icons"
below.** The paragraph beginning "Chromium's install criteria" is wrong: the
floor is not 144x144, and 180x180 does not make this app installable. Read the
superseding entry for what is actually true. The rejections recorded here — no
upscaling, no false `maskable` — still stand and were re-affirmed.

`public/` holds `apple-touch-icon.png` (180x180), `favicon-32x32.png`,
`favicon-16x16.png` and `favicon.ico`. No 192 and no 512.

Chromium's install criteria require an icon of at least 144x144, so 180x180
clears the bar and the app is installable with the art that exists. It does not
clear the 512x512 Android uses for a splash screen, and the ICO is left out of
the manifest because its declared sizes are 16 and 32 and it would add nothing
the PNGs do not already cover.

**Rejected: upscaling `apple-touch-icon.png` to 192 and 512.** Icons are the one
asset where a blurry file is worse than a missing one, and generating art was
out of scope for this change.

**Rejected: declaring `purpose: 'maskable'`.** Maskable is a promise that the
art survives being cropped to a circle or a squircle. None of these icons was
drawn with that safe zone, so the promise would be false and the visible result
is a clipped logo on every Android launcher.

The gap is recorded in `spec.md` under "Out of scope" rather than worked around.

## 2026-08-27 — `theme_color` and `background_color` are a hex literal

`src/components/ui/spec.md` says never to hardcode a hex value, and this is the
one place in the app that does.

A web app manifest is static JSON read by an OS installer. It cannot reference a
CSS custom property, and the installer is not a CSS parser — the `oklch()` the
theme is written in would be discarded by some consumers rather than converted.
So the light theme's `--background` (`oklch(1 0 0)`) is restated as `#ffffff` in
`manifest.ts`, in one named constant with a comment pointing back at the token
it mirrors.

**Rejected: omitting both fields.** Neither is required for installability, and
omitting them would have kept the rule intact. It also hands Android an
arbitrary splash background on every cold start of the installed app, which is
the first thing a user sees. A single duplicated colour, named and commented, is
the cheaper of the two.

## 2026-08-27 — The manifest ships without install-capable icons

An independent tester, working from the served manifest and never seeing the
diff, found that the app cannot be installed on Chrome, Edge or Android: those
browsers require the manifest to declare a **192x192** icon and a **512x512**
icon, both `purpose: 'any'`, before they will offer an install. The largest asset
in `public/` is `apple-touch-icon.png` at 180x180, and there is no SVG or larger
source anywhere in the repository.

The earlier entry above claimed a 144x144 floor and concluded the app was
installable on the art that exists. That was wrong, and it was wrong in the
direction that matters — it read as a pass.

**Rejected: upscaling 180x180 to 512x512.** A 2.8x resample of a raster icon is
visibly soft, and an app icon is the one asset a user sees at full size on their
home screen every day. A fuzzy icon is worse than no icon.

**Rejected: quietly shipping and letting the gap surface in an audit.** A
manifest that parses cleanly and links correctly is easy to mistake for one that
works, which is exactly what happened here.

**Chosen: ship the manifest, and say plainly that it does not produce an install
prompt.** Everything the manifest can be correct about, it is: it is served and
linked from every document, `display`/`id`/`start_url`/`scope` are right, and
every icon it names resolves at the size it claims. What it cannot do without art
that does not exist, it does not pretend to do. `spec.md` names the two files
that must be added, and `__tests__/manifest.test.ts` fails the moment either is
declared, so the documentation cannot quietly go stale behind the fix.

Adding the source art is not this change's call to make. Until it lands, iOS
"Add to Home Screen" works — it is a manual action with no criteria, takes the
180x180 `apple-touch-icon`, and never reads the manifest's icon sizes — and
Chrome, Edge and Android do not.
