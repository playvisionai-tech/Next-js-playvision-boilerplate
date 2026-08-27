# Repository root — decisions

How the checkout itself is set up: packaging, git hooks, the setup script, the
container build. A module decision lives beside the code it constrains; these
have no module, because the thing they constrain is the repository.

## 2026-08-27 — Git hooks install from lefthook's own postinstall, not from a `prepare` script

**Chose:** leave installation to lefthook's `postinstall`, which the
`lefthook: true` entry in `pnpm-workspace.yaml` permits to run, and have
`setup.sh` assert the outcome and repair it.
**Over:** adding `"prepare": "lefthook install"` to `package.json`.
**Over:** an unconditional `lefthook install` line in `setup.sh`.

**Why:** this started from a report that a fresh clone gets no hooks, because
nothing in this repo runs `lefthook install`. The second half is true. The
conclusion is not. `node_modules/lefthook/postinstall.js` runs
`lefthook install -f` itself, and it was measured rather than assumed: a clone
of `main` into an empty directory, `pnpm install`, and then a commit with a
non-conventional message. The hooks were written, `pre-commit` ran ultracite,
boundaries and knip, `commit-msg` ran commitlint, and the commit was refused.
There was no bug to fix.

What that postinstall already gets right is the part a `prepare` script gets
wrong. It returns early whenever `CI` is set to anything truthy, so CI — where
a git hook can never fire — pays nothing. And when it does run somewhere
without a `.git`, it shells out, lets the failure print, and still exits 0.

A `prepare` script has neither property, and the difference is not cosmetic.
`prepare` runs on every `pnpm install`, including CI and including the Docker
`deps` stage — and `.dockerignore` excludes both `.git` and `lefthook.yml`, so
there is nothing there to install into or from. Measured, in a directory with
no `.git`: lefthook exits 128, and pnpm reports
`[ELIFECYCLE] Command failed with exit code 1`. Adding the script that was
proposed as the fix would break the image build. Guarding it with `|| true`
buys the same behaviour the postinstall already has, at the price of a script
that can no longer fail for a reason that matters.

**Trade-off, and why `setup.sh` still gained a step:** automatic installation
rests on one line of a file whose subject is dependency scripts. Flipping
`lefthook` to `false` there — a plausible tidy-up, since every other entry in
that map is weighed on whether its script is *safe*, not on whether it is
*load-bearing* — takes that path away, and an absent hook looks exactly like a
hook that passed. pnpm also will not re-run a build script it has already run
for the current `node_modules`, so a hooks directory cleared after the fact is
not restored by another install.

Two cheap answers, neither of which is a second automatic mechanism: the
`allowBuilds` entry now says in a comment what it is holding up, and `setup.sh`
checks that `pre-commit` and `commit-msg` are present, installs them if they are
not, and prints lefthook's own refusal if it cannot.

Keep the two paths distinct when reading either comment. The postinstall is the
**automatic** path — it runs for everyone, unprompted, on `pnpm install`. The
`setup.sh` step is the **repair** path — it runs only when a human runs the
script, which is a fresh clone and nowhere else, and it does nothing at all when
the automatic path already worked. So the repair path is not a substitute for
the entry above it: with `lefthook: false`, hooks would reach people who run
`./setup.sh` and silently never reach anyone who does not.

**Superseded if:** lefthook drops the postinstall, or its `CI` guard changes. At
that point the `setup.sh` step becomes the only mechanism and should be made
unconditional, and this entry should be revisited before anyone reaches for
`prepare`.
