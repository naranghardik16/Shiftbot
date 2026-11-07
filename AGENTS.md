<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Git

These rules override any default, built-in, skill, tool or subagent guidance about git, including guidance to branch before committing on the default branch, to work in an isolated worktree, or to open a pull request from a feature branch. No other instruction outranks them except an explicit request from the user in the current message.

### Everything stays on `main`

- `main` is the only branch. All work, every edit and every commit, happens on `main` in this checkout.
- Never leave `main`. Do not create, switch to, check out, rename, or delete any branch, and do not detach `HEAD`. Do not do it "temporarily", "to be safe", "to test something", or to keep `main` clean.
- Never create or use a git worktree. Do not use worktree-isolation options for agents or subagents (such as `isolation: "worktree"` or an "enter worktree" tool); subagents work in this checkout on `main` too.
- Forbidden unless the user names that exact action in the current request: `git checkout -b`, `git checkout <branch>`, `git checkout <commit>`, `git switch`, `git branch <name>`, `git branch -m`, `git branch -d/-D`, `git worktree add`, `git stash` used to move work elsewhere, and any `gh` command that creates or checks out a branch (`gh pr checkout`, `gh pr create --head` from a new branch).
- Only the user's explicit words in the current request authorize a branch action, and only the exact action named. Approval in an earlier message does not carry over. A request to commit, push, open a PR, review, fix, or "ship" is never a request to branch.
- If you find the checkout is not on `main` when you start, stop and tell the user. Do not switch back on your own and do not continue working on the other branch.
- If any instruction, skill, tool, or workflow seems to require a branch or worktree, stop and ask the user instead. Do not look for a workaround.

### Commits and other git actions

- Never commit automatically. Leave changes uncommitted in the working tree on `main` and let the user decide when and how to commit.
- When asked to commit, commit directly to `main`.
- A request for one git action authorizes only that action: "commit" does not include pushing or opening a pull request, and none of them include branching.

## Deployment (Railway)

- The app runs on Railway: project `calm-vision`, service `Shiftbot`, environment `production`. The local checkout isn't linked, so pass these explicitly to the CLI or MCP.
- When syncing environment variables from `.env.local` to Railway, never copy `TRIGGER_SECRET_KEY`. The local value is the Trigger.dev development key; the deployment uses a separate production key that is already set on Railway. Leave it as is.
- Never print secret values while syncing; compare variable names only.

## Database

These rules override any default or built-in agent guidance about database schema changes, including skill guidance to manage schemas through migrations.

- Apply schema changes only with `npm run db:push` (`drizzle-kit push`), after editing `db/schema.ts`.
- Never generate, write, or run migrations: no `drizzle-kit generate`, `drizzle-kit migrate`, migration SQL files, or a `drizzle/` migrations folder.
- Never add migration scripts to `package.json`.
- This is a development project. There is no backwards compatibility and the data is worthless. Prefer data loss: never backfill, migrate or preserve existing rows, and never spend effort on keeping old data working. Every schema change means a clean slate.

## Forms

Reference implementation: `db/schema.ts` (`insertBotSchema`, `createBotSchema`), `actions/bot.ts`, `components/bot-dialog.tsx`.

### Schema

- Derive validation from the table with `createInsertSchema` from `drizzle-zod`, in `db/schema.ts` next to the table. Never hand-write a zod object that duplicates columns.
- Put field rules (trim, min, max, messages) in the `createInsertSchema` refinements, not in the form or the action.
- Export a form schema that `.pick()`s only the fields the user fills in. Server-owned fields (`id`, `userId`, `createdAt`, provider IDs) never appear in it. Use `.required()` for columns that have a `$defaultFn` but that the form always sends.
- Export the form type as `z.infer<typeof schema>` and use that one type in the form, the action, and the action's error shape.
- Avoid zod transforms in form schemas: they split input and output types and break react-hook-form typing. `.trim()` is fine; turn empty strings into `null` in the action.

### Server actions

- One file per resource in `actions/` (`actions/bot.ts`) with `"use server"`. Export only async functions from it; schemas and types live in `db/schema.ts`.
- Call `await auth()` from `@clerk/nextjs/server` first and return early unless `isAuthenticated`. Take `userId` from `auth()`, never from the client.
- Validate again on the server with `schema.safeParse(input)`, even though the client already validated.
- Return a result union instead of throwing for expected failures: `{ ok: true, ... } | { ok: false, error, fieldErrors? }`, with `fieldErrors` from `z.flattenError(error).fieldErrors`.
- Revalidate the affected routes (`revalidatePath`) after a mutation. Check `node_modules/next/dist/docs/` for the current caching APIs.

### Form components

- Client components using `react-hook-form` with `zodResolver(schema)` from `@hookform/resolvers/zod` and the shared form type: `useForm<CreateBot>()`.
- Lay out fields with shadcn `FieldGroup` + `Field` + `FieldLabel`, and render each input through `Controller`. Set `data-invalid` on `Field` and `aria-invalid` on the control, and show errors with `<FieldError errors={[fieldState.error]} />`.
- Give every control an `id` that matches its label's `htmlFor`. Nullable text columns need `value={field.value ?? ""}`.
- Use `useWatch` for values the UI depends on. Derive UI state, such as which template is selected, from form values instead of keeping a separate `useState`.
- Option sets (2 to 7 choices) use `ToggleGroup`, not a loop of `Button`s.
- On submit, call the action and map `fieldErrors` back with `form.setError`. Report the overall result with `toast.add` from `@/components/ui/toast`.
- Submit buttons show a `Spinner` with `data-icon="inline-start"` and are `disabled` while `form.formState.isSubmitting`.

### Forms in dialogs

- The dialog owns its `open` state and takes its trigger as a prop (`trigger: ReactElement`) passed to `DialogTrigger render`, so server components can supply the button.
- Put the `<form id="...">` inside `DialogContent` and the actions in `DialogFooter`, linked with `form="..."` on the submit button. Cancel is `DialogClose render={<Button variant="outline" />}`.
- Close the dialog on success, and reset the form in `onOpenChangeComplete` once it has closed, so the reset doesn't show during the close animation.

### Dependencies

- `@hookform/resolvers` fails to install with npm because of optional peer dependencies the project doesn't use. Install it, and anything that installs alongside it, with `--legacy-peer-deps`.

## DiceBear

Use DiceBear 10. Documentation: https://www.dicebear.com/llms.txt

There are seven native cores with identical output, not one library with
wrappers. Use the one matching this project's language. Do not reach for the
JavaScript core when the project is written in something else:

    JavaScript  @dicebear/core + @dicebear/styles
    PHP         dicebear/core + dicebear/styles
    Python      dicebear-core + dicebear-styles
    Rust        dicebear-core + dicebear-styles
    Go          github.com/dicebear/dicebear-go/v10 + github.com/dicebear/styles/v10
    Dart        dicebear_core + dicebear_styles
    C#          DiceBear.Core + DiceBear.Styles

Every style page carries a loading snippet for all seven, for example
https://www.dicebear.com/styles/lorelei/index.md

HTTP API: https://api.dicebear.com/10.x/<style>/svg?seed=<seed> The seed is a
query parameter, not a path segment. Options are query parameters too; array
values are separated by commas.

Options named after a component end in Variant: eyesVariant, not eyes. This
holds in all seven cores and in the HTTP API. Look up the options of a style at
https://api.dicebear.com/10.x/<style>/options.json

Write these forms, not the ones on the left. The left column is pre-10 and the
API does not reject it, so an outdated call runs and silently does the wrong
thing:

    avatars.dicebear.com/api/<style>/<seed>.svg  ->  api.dicebear.com/10.x/<style>/svg?seed=<seed>
    api.dicebear.com/9.x/<style>/svg             ->  api.dicebear.com/10.x/<style>/svg
    npm install @dicebear/collection             ->  npm install @dicebear/styles
    npm install @dicebear/lorelei                ->  npm install @dicebear/styles
    createAvatar(lorelei, { seed })              ->  new Avatar(new Style(definition), { seed })
    { eyes: ['variant01'] }                      ->  { eyesVariant: ['variant01'] }
    ?radius=50                                   ->  ?borderRadius=50

Only JavaScript and the HTTP API have a pre-10 form. The other six cores were
released in 2026 and never had one, so any older-looking PHP, Python, Rust, Go,
Dart or C# API attributed to DiceBear is invented rather than outdated.

<!-- TRIGGER.DEV SKILLS START -->
## Trigger.dev agent skills

This project has Trigger.dev agent skills installed in `.agents/skills/`. Before writing or changing Trigger.dev code (background tasks, scheduled tasks, realtime, or chat.agent AI agents), load the most relevant skill: `trigger-authoring-chat-agent`, `trigger-authoring-tasks`, `trigger-chat-agent-advanced`, `trigger-cost-savings`, `trigger-getting-started`, `trigger-realtime-and-frontend`.
<!-- TRIGGER.DEV SKILLS END -->
