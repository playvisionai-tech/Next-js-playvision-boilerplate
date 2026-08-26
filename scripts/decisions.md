# scripts — decisions

The checks in this directory enforce rules that prose alone cannot. Each one
buys a guarantee at the cost of false positives; these entries record where that
trade was drawn and, more usefully, where it was refused.

## 2026-08-26 — The docs checker validates links, and nothing else

**Chose:** `check-links.js` resolves markdown link targets only.
**Over:** a broader checker that also verified backticked file paths and
backticked package names against `package.json`.
**Why:** it was measured before it was built. A prototype scanning every tracked
`.md` flagged 58 non-resolving backticked paths and 105 package-shaped tokens.
Roughly four of the 58 were real. The rest were legitimate prose shorthand —
`server/`, `components/ui`, `features/a`, `lib/` — which the rules use precisely
because the absolute path would make them harder to read. Buying four fixes with
54 false positives means an ignore list longer than the checker, and an ignore
list that large stops being reviewed. Links carry no such ambiguity: a target
resolves or it does not.
**Trade-off:** the four bugs that prompted this work were **not** broken links,
and this checker would have caught none of them. `verify/SKILL.md` pointed at a
`.npmrc` that does not exist, `new-ui-primitive/SKILL.md` told readers to export
from a barrel three other documents forbid, and two rules named packages
(`nuqs`, TanStack Query) that are not installed. Those were fixed by rewriting
the documents so they no longer assert installable facts — a rule that names a
decision and the gate to propose it cannot go stale, where one that names a
package goes stale the day nobody installs it. That is the actual defence. The
link checker is a cheap ratchet beside it, not a substitute for it.

**If you are here to add path or package checking:** read the paragraph above
first. The measurement is the argument, and re-running it is cheap.
