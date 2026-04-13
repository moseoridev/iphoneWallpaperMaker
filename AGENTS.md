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

### Git instructions

- Git is safety-critical. Read first, mutate second.
- Before making changes, check repo state with the smallest useful read-only command, usually `git status --short`.
- Never overwrite, discard, or clean changes you did not make.
- Do not modify, stage, or revert unrelated files.
- Do not create branches, commits, tags, or pull requests unless the user asks.
- Do not run destructive commands unless the user explicitly asks for that exact outcome.

Destructive commands include:

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

When asked to commit:

- Review the diff first.
- Stage only task-related files.
- Keep the commit scoped to one logical change.
- Follow Conventional Commits.

Commit message format:

- `<type>(<scope>): <summary>`
- scope is optional

Examples:

- `feat(auth): add magic link login`
- `fix(api): handle empty response`
- `docs(readme): clarify setup steps`
- `refactor(parser): simplify token flow`
- `test(cache): cover ttl expiry`
- `chore(ci): update pnpm version`

Allowed types:

- `feat`
- `fix`
- `docs`
- `refactor`
- `test`
- `chore`
- `build`
- `ci`
- `perf`
- `revert`

Commit message rules:

- Use imperative mood.
- Keep it concise and specific.
- Do not mix unrelated changes into one commit.

### MCP instructions

- Use this section to paste MCP-specific instructions verbatim.
- Keep each MCP in its own subsection.
- Add or remove subsections as MCPs change.
- Do not rewrite or summarize an MCP block unless explicitly asked.

```markdown
# Svelte MCP

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
```
