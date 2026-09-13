# Generated types and namespace access branch

Generate projections in the independent host and use them to type-check business access. Read `$NOMICORE_ROOT/docs/integration/external-project-vfsl-codegen.md` before implementation; it is the authoritative external-project workflow.

## Process

1. Confirm host layout:

   ```text
   <host>/domains/<domain>/schema.vfsl
   <host>/domains/<domain>/generated.ts
   <host>/src/...
   ```

2. Install released packages from npm with the host package manager:

   ```bash
   cd /path/to/host
   pnpm add -D @nomicore/vfsl-codegen @nomicore/vfsl-protocol
   ```

   Add runtime packages required by the Cordis branch separately. Source links or local tarballs are only for explicitly unreleased Nomicore changes.
3. Generate from the host root. The CLI's `--domains` value is the directory that **contains** `domains/`:

   ```bash
   cd /path/to/host
   pnpm exec nomicore-generate --domains .
   ```

   If the host enforces semicolon-free generated TypeScript, opt in explicitly and use the same format flag for generation and freshness checks:

   ```bash
   pnpm exec nomicore-generate --domains . --semicolon-free
   pnpm exec nomicore-generate --domains . --check --semicolon-free
   ```

   Do not generate with `--semicolon-free` and check without it, or the reverse. The formats are intentionally byte-incompatible, so a mismatch fails closed as stale.

4. Prove that each consuming package's TypeScript **Program** contains its generated projection. `generated.ts` augments `@nomicore/vfsl-protocol`; merely generating or committing it does nothing when it is outside the Program. Follow [Program wiring](#program-wiring) and choose the narrowest compliant branch.
5. Review generated diffs. Modify `schema.vfsl` or the generator contract—not `generated.ts`—when output is wrong. Numeric constraint leaves (`number & Int`, `number & Int<min, max>`, `number & Range<min, max>`) intentionally project as plain `number` (ADR 0020 decision 7): the domain is enforced by runtime validate and carried by the readData schema projection text (`Int<min, max>` / `Range<min, max>`, [ADR 0027](../../../docs/adr/0027-readdata-projection-text.md)), not by generated types—such a diff is expected, not a generator bug.
6. Keep runtime validation and static typing distinct:
   - business code uses generated `VfslPathMap`, `PathAt`, `PathValue`, `PathPatchValue`, and `PathElementValue` through a host-owned adapter;
   - the adapter calls public `NamespaceLease.readData()` (a successful read returns exactly four keys `{ ok, value, schema, truncated }` — `schema` is the projection text, `string | null`; see [Read result: value plus semantic schema projection](#read-result-value-plus-semantic-schema-projection)) and `mutateData()`;
   - one narrow assertion may bridge a successful runtime result to its projected type;
   - application call sites contain no `any`, source-deep imports, or live `Y.Doc` access.
7. Preserve literal paths (`as const` for reused tuples). Verify negative cases: unknown paths, wrong values, and array operations on non-array nodes must fail host typecheck.
8. Add host scripts equivalent to generation, freshness check, typecheck, and tests. Invoke the published CLI through the host package manager (`pnpm exec nomicore-generate …`); a Nomicore checkout is not needed for generation or freshness checks.

## Program wiring

First inspect the consuming package's `tsconfig` chain, build/typecheck scripts, `rootDir`, `include`/`files`, project references, declaration/emit mode, and repository package-boundary guards. Use `tsc -p <consumer-tsconfig> --listFilesOnly` as evidence; editor hover or a successful unrelated build is not evidence.

Choose exactly one branch:

### A. One Program may include the domain projection

Add the generated file to the consuming Program through `include`, or add a package-owned type entry such as `src/nomicore-schema.d.ts`:

```ts
import type {} from '../../../../domains/<domain>/generated.js'
```

The relative path is from the type entry. Ensure that `.d.ts` itself is included. This creates no runtime import, but it does pull `generated.ts` into the TypeScript Program.

### B. Build may not cross `rootDir`, but no-emit typecheck may

Keep the ordinary build Program package-local. Create a separate `tsconfig.typecheck.json` and a `typecheck/nomicore-schema.d.ts` type entry. The typecheck Program uses `noEmit: true`, includes package source plus the type entry, and either omits `rootDir` or sets it high enough to cover the repository-level domain projection. Run this Program in package and repository CI.

### C. Every Program is forbidden from reading outside the package

Generate the projection into the package's permitted source/type directory with the supported single-domain mode:

```bash
pnpm exec nomicore-generate --domains /path/to/host --domain <domain> \
  --out packages/<consumer>/src/generated/nomicore-schema.ts
pnpm exec nomicore-generate --domains /path/to/host --domain <domain> \
  --out packages/<consumer>/src/generated/nomicore-schema.ts --check
```

Relative `--out` resolves from `--domains`. Keep `schema.vfsl` as the sole editable source and exactly one active projection per TypeScript Program; delete the old default projection when moving it package-local. The output remains generated and CI must run `--check`. Do not maintain a copied projection by hand. When the host selects semicolon-free output, append `--semicolon-free` to both package-local commands; generation and `--check` must use identical format flags.

Do not add all repository `domains/**/*.ts` to every package: module augmentations merge globally inside a Program, unrelated schemas can pollute path tables, and incompatible top-level fields can collide. Wire only the projection(s) consumed by that package.

### Activation guards

Add a package-local `.test-d.ts` or equivalent compile fixture that fails if the augmentation disappears:

```ts
import type { PathAt, PathPatchValue, VfslPathMap } from '@nomicore/vfsl-protocol'

type Quantity = PathPatchValue<
  PathAt<VfslPathMap, ['items', string, 'quantity']>
>

const valid: Quantity = 12
// @ts-expect-error schema says quantity is numeric
const invalid: Quantity = 'twelve'

type Missing = PathPatchValue<
  PathAt<VfslPathMap, ['items', string, 'missing']>
>
// @ts-expect-error unknown path must fail closed to never
const missing: Missing = 'x'
```

Use paths and values from the actual schema. A guard is complete only when both a known path resolves to its exact value type and an unknown path fails closed. Also inspect `--listFilesOnly` output for the exact generated file.

## Read result: value plus semantic schema projection

Every successful `readData(path)` returns **exactly four own keys** `{ ok: true, value, schema, truncated }` (恒四键; [ADR 0016](../../../docs/adr/0016-readdata-semantic-schema-projection.md), shape revised by [ADR 0024](../../../docs/adr/0024-readdata-shape-budget.md), delivery form revised by [ADR 0027](../../../docs/adr/0027-readdata-projection-text.md); see the 投影文本 entry in `CONTEXT.md`): besides the plain logical value, the `schema` projection is the path's **projection text**（投影文本）— the semantics an agent consumer needs to interpret the value (value domains, literal unions, constraints) and to prepare a follow-up write. `schema` is a `string` (the projection text) or strict `null` (never an empty string, never `undefined`); `truncated` is the boolean machine signal（布尔机器信号）— `true` iff this read truncated the value channel (depth fold / width trim) — and the `✂ 截断事实：` section at the end of the text is the sole carrier of truncation facts (path / cause / omitted count).

The projection text is a deterministic VFSL-style rendering of the schema slice at the path, produced in-process by the `@nomicore/vfsl` renderer on every read ([ADR 0027](../../../docs/adr/0027-readdata-projection-text.md)):

- head line `# readData [<dot-joined path>]`, with a budget suffix `{depth:N[,maxChildrenPerNode:K]}` when the read carried a shape budget (omitted without one) — a factual anchor for the actual call path and budget;
- body: field lines `name?: type // first-line doc` (`?` optional, `T[]` arrays, refs written by alias name); scalar domains copied from the VFSL source grammar (`Int<1, 100>` / `Range<0.5, 1.5>` / `Pattern<"…">` / enum `"a" | "b"`); Record / union shapes printed like the source (`Record<string, T>` with a trailing keyPattern comment; `| { … }` union bodies, no discriminator special case); alias blocks in closure-discovery order; comments in first-line form, so annotation text never breaks the grammar;
- folded type slots carry the `‡` depth-fold marker, with one footer line explaining the marker;
- a closing `✂ 截断事实：` section lists every truncation fact (path / cause / omitted count) — it is the sole truncation-fact carrier; no structured truncation-list key is delivered.

Interpret every read as a triad—value + formal schema + 数据口径. Before acting on a value, read the projection text for the path's own slot and its rendered descendants: field lines carry units and lifecycle, union/enum member lines state each literal's domain meaning (whether `'archived'` is terminal and read-only), and alias blocks state the alias-level contract. These rendered comments are the authoritative 数据口径 the schema author wrote for you; prefer them over inference from value shape or key names, and treat a point the text stays silent on as unspecified rather than guessing.

`schema` is `null` when there is no active schema, the path strays outside the schema, or the path is hostile/ill-formed (static resolution fails; single-meaning `null`, never an empty string). A null schema is not a read failure: `ok` stays true. Treat a null projection as "no semantics available for this path", not as an error. Every successful read re-renders the text from the live derived schema in-process: a `string` is a primitive, so it is naturally isolated — do not cache text or projection objects across reads, and a later `replaceSchema` is reflected by the next read.

### Shape-budget reads

`readData(path, { depth, maxChildrenPerNode })` ([ADR 0024](../../../docs/adr/0024-readdata-shape-budget.md)) bounds how much a single read materializes: `depth` limits how many container levels below the target are expanded, `maxChildrenPerNode` keeps at most the first K children of each expanded node (map order is not a pagination promise). Omitting options renders the full projection text; invalid options (unknown keys, negative or non-integer values, non-object) fail loudly with the stable `READ_OPTIONS_INVALID` result — never silently degrade to `schema: null`. The projection text is always-on: there is no `schema` opt-in switch, and the closed options shape accepts only the two budget keys.

Typed budget discipline (ADR 0024 decision 7): reads that need static completeness must not pass a budget; budget reads access every field optionally (`DeepOptional<PathAt<…>>` from `@nomicore/vfsl-protocol` — all fields optional, present scalars keep exact types); and a budget read is not a pre-write complete snapshot.

The in-value truncation form depends on the cause ([ADR 0024 #359 amendment](../../../docs/adr/0024-readdata-shape-budget.md)): when `depth` runs out, cut **container** children fold to same-shaped empty containers with the key present (`{}` / `[]`) plus one `✂ 段` entry each (`omitted` = the folded container's direct child count; a genuinely empty container folds with no entry); terminal children (scalars, semantic strings) ride through untouched. When `width` overruns, keys beyond the kept prefix are omitted from `value` (never `{}` placeholders or `undefined`-valued keys) with one entry at the parent path. Disambiguation — the `✂ 段` is the sole carrier of truncation facts: a folded shell **listed** in the `✂ 段` was cut ("not fetched this time"); an empty shell with no `✂ 段` entry is genuinely empty data; a key absent from the value and not listed in the `✂ 段` is truly absent. When `schema` is `null` — no active schema, a path outside the schema, or a hostile path — while a budget read did truncate, key-level disambiguation is unavailable: only the `truncated === true` boolean remains ([ADR 0027](../../../docs/adr/0027-readdata-projection-text.md) known limitation, mirrored in the 截断省略 entry of `CONTEXT.md`). The projection text is truncated at the same depth, with `‡` markers on folded type slots (the footer line explains the marker) so the next drill-down path can still be constructed; rendered comments follow visibility — comments for slots of rendered hosts (fields, `<item>`, `<member N>`, `<key>`) ride along, while comments inside a cut subtree's closure stay omitted — interpreting a delivered enum value exactly still needs one shallower read. The value + schema + 数据口径 triad applies within what the budget returned. A width trim shows up in the `✂ 段` but never adds a `‡` mark: `maxChildrenPerNode` does not affect the projection body.

When constructing a write after a budget read, construct the mutation explicitly against the schema — never implicitly inherit fields from a truncated value (a truncated sub-object is not "the whole object": fields omitted by the budget are not absent from the namespace, and a `depth: 0` skeleton is an empty same-shape container, not empty data).

When a read is followed by a write, use the `schema` projection (projection text) returned with the value to interpret the value's domain and construct a legal `mutateData()` mutation (minimal, mergeable, semantic — next section). Static `PathAt` / `PathPatchValue` types remain the compile-time authority; the runtime projection text serves dynamically read values and agent-style consumers that must interpret data without generated types.

## Mutation policy: minimal, mergeable, semantic

Design every business write against three simultaneous criteria:

1. **Minimal** — generate the smallest mutation that changes only the intended schema node.
2. **Mergeable** — preserve unrelated Yjs nodes so concurrent edits to other fields, records, and array positions can merge with the smallest conflict surface.
3. **Semantic** — choose an operation whose path and verb state the domain change directly (`set quantity`, `delete optional note`, `insert tag`) rather than encoding it as replacement of an incidental snapshot.

Business updates therefore target the **narrowest independently writable schema path**. For a scalar field, call `set` on that leaf path:

```ts
await lease.mutateData({
  op: 'set',
  path: ['items', itemId, 'quantity'],
  value: nextQuantity,
})
```

For collections, use their structural operations at the collection path: `array-insert` / `array-delete`; use `set` only for a `plain`, `leaf`, or XML terminal that is intentionally replaced as one value. When a typed path descends through an array element, its index segment is a `number` (`0`, `index`), never a numeric-looking string (`'0'`); string segments address object/Record keys, while number segments address array positions. Add or remove a Record entry at that entry path. Preserve every unaffected Yjs container and sibling.

Before implementing a write, name the domain change in one sentence and map it to one mutation:

| Domain change | Mutation shape |
| --- | --- |
| Change one field | `set` at that field's terminal path |
| Add/replace one Record entry | `set` at the entry path |
| Remove one Record entry or optional field | `delete` at that path |
| Insert ordered elements | `array-insert` at the array path with an explicit index |
| Remove ordered elements | `array-delete` at the array path with explicit index/count |
| Replace an intentionally opaque value | `set` at its `plain`/leaf/XML terminal |

A read-modify-write of the complete ROOT (read `[]`, construct a new object, then `set` `[]`) is a correctness anti-pattern for ordinary business updates. Although the low-level runtime accepts `set([])` as an explicit whole-ROOT replacement operation, it invalidates old Yjs subtype identities, overwrites concurrent changes represented by the reconstructed snapshot, expands the conflict/write surface, and discards the schema's chosen synchronization granularity. Reserve it for an explicit administrative replacement/migration flow with dedicated concurrency and lifecycle handling—not normal application writes.

The same rule applies below ROOT: replacing an entire map/object after changing one child is broader than the intended mutation. Descend to the last independently writable terminal described by the generated path projection.

Current validated operations are `set`, `delete`, `array-insert`, and `array-delete`. `array-insert` takes `values: readonly unknown[]`. There is no atomic `array-append` operation; a read-length-then-insert helper has concurrency semantics that the host must judge explicitly.

When one business command changes several independent nodes, use the batched envelope (ADR 0026) so they commit atomically — all-or-nothing in one write-sequencer slot and one Yjs transaction. Do not split a multi-value command into sequential single mutations (partial states leak between slots), and do not hide it inside whole-parent replacement merely to obtain a single call (that trades atomicity for carrier degradation).

### Batched mutations (ADR 0026)

The mutation envelope has two mutually exclusive shapes: the single-operation object shown above, and a batch envelope `{ ops: [...] }`:

```ts
await lease.mutateData({
  ops: [
    { op: 'set', path: ['tasks', taskId, 'status'], value: 'reviewing' },
    { op: 'set', path: ['tasks', taskId, 'reviewedAt'], value: ts },
    { op: 'set', path: ['tasks', taskId, 'reviewer'], value: uid },
  ],
})
```

Every operation is prepared inside the slot (navigate, build detached, validate); any failure rejects the whole batch with zero write and aggregates the failing operations' issues; only when all succeed does one transaction commit them in order. `ops` must be non-empty, at most 16, each element a complete single-operation envelope, and **element paths must not nest** (no ancestor–descendant or identical paths — envelope error). Each operation stays a minimal edit — atomicity never trades carrier granularity for whole-parent replacement. One slot is one change attempt with a single diagnostic update record.

### Guarded mutations (ADR 0025)

Every operation may carry an optional `guard` precondition — a single condition object evaluated inside the write-sequencer slot against the committed current logical value, before the mutation pipeline runs:

```ts
await lease.mutateData({
  op: 'set',
  path: ['tasks', taskId, 'status'],
  value: 'reviewing',
  guard: { path: ['tasks', taskId, 'status'], equals: 'draft' },
})
```

- `{ path, equals }` — the path's current projected logical value must be structurally equal (undefined-key-filtered) to `equals`. A missing key, an unreadable path (`PATH_NOT_ALLOWED`), and an absorbed `undefined` all count as *not equal*.
- `{ path, absent: true }` — the path must currently hold no value (missing key or unreadable path both satisfy); use for create-if-absent.

A failed guard is a zero-write rejection carrying the stable code `MUTATION_GUARD_MISMATCH` — a retryable CAS contention. A malformed guard shape (wrong keys, missing path, `absent` not literal `true`, guard path `[]`, non-finite numbers in `equals`) is an uncoded envelope error — a caller bug, not retryable. Atomicity comes from the per-namespace write sequencer: the check and the commit share one FIFO slot; it does not come from a Yjs transaction. Guards constrain only ordinary controlled writes on this instance — replicated applies and cross-instance merges are not intercepted (ADR 0025 boundaries).

Express dynamic domain rules (state-machine transitions, monotonic version bumps, no-rollback timestamps) as read current value → `guard` `equals` old value → write new value, with the retry loop in the host adapter. The transition table stays in adapter code; the engine only asserts values. Guard path segments follow the same discipline as mutation paths (`string` keys, `number` array indices); a guard path may not be `[]`.

A guard may also sit at the top level of a batch envelope (`{ ops: [...], guard }`, ADR 0026): it is evaluated once before any operation prepares, and batch elements must never carry their own `guard` — a per-operation condition should be a separate change attempt.

Array element paths use numeric segments. Keep `['assignments', 0, 'headSha']` or `['assignments', index, 'headSha']` with `index: number`; reject `['assignments', '0', 'headSha']`, `String(index)`, and template-string indices. A string segment means an object/Record key. Add a negative type fixture for every typed adapter that writes through an array, proving the numeric-looking string form fails compilation.

The runtime SCHEMA passed to Registry creation or an existing namespace's `replaceSchema()` must come from the same `schema.vfsl`. Generated types do not replace that text. For an existing namespace, complete the Hub/Peer rollout in [schema-evolution.md](schema-evolution.md) before publishing writers that use changed paths.

## Completion gate

Complete when generation succeeds, `--check` reports fresh output using the same format flags as generation (including `--semicolon-free` when selected), generated files are tracked by the host, `tsc --listFilesOnly` proves the consuming Program contains the exact projection, and activation guards prove a known path's exact type plus an unknown path's fail-closed behavior. Positive access code type-checks, intentional invalid examples are rejected, and every business write is demonstrably minimal, mergeable, and semantic: its verb/path describe the intended change, it preserves unrelated Yjs nodes, and it does not reconstruct ROOT or a parent container. Budget reads, when used, keep `DeepOptional` optional access and never feed a mutation as a complete snapshot. Runtime failures remain handled as structured results, concurrency tests cover independent edits where relevant, and both the package-local build Program and the projection-aware typecheck Program pass their required CI gates.
