# AGENTS.md

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## Project-specific instructions

You are on macOS and zsh.
You should always use pnpm instead of npm.

### Design and quality gates

- Strictly follow `DESIGN.md` for all UI and styling changes.
- Before changing UI or styles, read `DESIGN.md` and state how the change will satisfy it.
- Treat Lighthouse desktop and mobile scores of 100 as required success criteria for UI-facing changes.
- Do not consider UI-facing work complete until Lighthouse desktop and mobile both pass at 100, or until you clearly report why that verification could not be completed.

### Git instructions

- Use git actively, but safely.
- Start by understanding the repo state before making changes.
- Prefer small, reviewable, logically grouped commits.
- Preserve user work. Never overwrite or discard changes you did not make.

#### Repo awareness

Before changing files, inspect the current state with the smallest useful commands, usually:

- `git status --short`
- `git branch --show-current`
- `git diff --stat` when needed

If the worktree already contains unrelated changes:

- do not reset, discard, or silently absorb them
- avoid touching those files
- isolate your work as much as possible

#### Branch strategy

Use judgment instead of a one-size-fits-all rule.

Stay on the current branch when:

- the task is small
- the user is clearly working on the current branch
- the user asked for a direct edit

Create a new branch when it helps isolate work, especially when:

- the task is non-trivial
- the change is risky or experimental
- multiple files or steps are involved
- the user asked for a commit-ready implementation
- you should avoid committing directly to `main`, `master`, or another protected/default branch

Branch naming:

- use short, descriptive names
- prefer prefixes like `feat/`, `fix/`, `refactor/`, `docs/`, `test/`, `chore/`

Examples:

- `fix/login-race-condition`
- `feat/add-bulk-export`
- `docs/update-local-setup`

Do not create extra branches for trivial one-file edits unless isolation clearly helps.

#### Commit strategy

Commit intentionally, not mechanically.

Create a commit when:

- the requested change is complete
- the relevant checks have passed, or you clearly state what was not verified
- the diff forms one logical unit

Split into multiple commits when that improves reviewability, such as:

- refactor first, behavior change second
- production code and tests as separate logical steps when helpful
- unrelated fixes separated cleanly

Avoid commits that mix:

- requested work and drive-by cleanup
- formatting-only noise and real behavior changes
- dependency churn and feature work unless necessary

Do not commit broken intermediate state unless the user explicitly wants a WIP snapshot.

#### Staging rules

- Stage only files related to the task.
- Review the staged diff before committing.
- Do not stage unrelated modifications.
- Do not update lockfiles unless dependency changes were actually required.
- Do not commit secrets, local config, editor noise, or accidental generated artifacts.

Useful checks before commit:

- `git diff --staged`
- `git diff --stat`
- relevant tests, linters, or type checks for the scope of the change

#### Commit message convention

Follow Conventional Commits.

Format:

- `<type>(<scope>): <description>`
- scope is optional

Rules:

- use lowercase type
- use imperative mood
- keep the description concise and specific
- describe what changed, not why in vague terms
- one commit should map to one logical change

Common types:

- `feat`
- `fix`
- `refactor`
- `docs`
- `test`
- `chore`
- `build`
- `ci`
- `perf`
- `revert`

Examples:

- `feat(auth): add magic link login`
- `fix(api): handle empty response body`
- `refactor(parser): simplify token flow`
- `docs(readme): clarify pnpm setup`
- `test(cache): cover ttl expiry`
- `chore(ci): update pnpm cache config`

#### Safety rules

Never run destructive git commands unless the user explicitly asked for that exact outcome.

This includes:

- `git reset --hard`
- `git checkout -- <path>`
- `git restore --source ... --worktree --staged`
- `git clean -fd`
- `git clean -fdx`
- `git stash drop`
- `git stash clear`
- `git commit --amend`
- `git rebase`
- force-push or any history rewrite

Do not push unless the user asked for it.

#### Pull request mindset

Even when no PR is being opened, work as if someone else will review the diff.

That means:

- keep changes minimal
- keep commits readable
- verify the important paths
- leave a clean history
- make each commit easy to understand in isolation

### MCP instructions

- Use this section to paste MCP-specific instructions verbatim.
- Keep each MCP in its own subsection.
- Add or remove subsections as MCPs change.
- Do not rewrite or summarize an MCP block unless explicitly asked.

#### MCP template

```md
#### <MCP name>

<paste MCP instructions here verbatim>
```

#### Svelte MCP

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available Svelte MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.
