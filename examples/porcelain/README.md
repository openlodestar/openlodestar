# Porcelain example ledger

A tiny, fully offline ledger used by `npm run demo` and the test suite. It shows
the whole verification path without any model or network call:

```
claims.jsonl + evidence.jsonl + snapshots/
        │  retally (deterministic vote counting)
        ▼
verdicts (supported / refuted / conflicting / not_found)
        │  record-level co-occurrence gate
        ▼
records (strong / weak / rejected)  ──►  anchors (strong or weak)
```

## What the three records demonstrate

| record | what happens | expected gate |
| --- | --- | --- |
| `rec-example-2014-cguardian` | all three key fields are supported by the **same page** (plus a second independent source) | `strong` → readable anchor |
| `rec-example-2016-poly` | every key field is supported, but no page mentions all three together | `weak` → stored, not read by default |
| `rec-example-2019-sothebys` | the session name is refuted by the organiser's own page | `rejected` → no anchor |

A standalone claim (`cl-example-2016-poly-november`) has one supporting and one
refuting authoritative source, so it becomes `conflicting`. It has no record
container, which is how externally submitted claims look.

## Files

- `claims.jsonl` — atomic claims, one proposition per line. Record fields use
  deterministic ids (`cl-<recordId>-<fieldKey>`) so the gate can re-claim them.
- `evidence.jsonl` — one row per claim × source, always with a verbatim quote, a
  snapshot reference and `fetchedBy: "lodestar"`.
- `snapshots/` — the raw pages the quotes were copied from. The demo verifies
  every quote against its own snapshot.
- `query.txt` — the enumeration query that produced the records.

All pages and events here are **synthetic** and exist only to exercise the
contract; they do not describe real auctions.

Run it:

```bash
npm run demo          # recompute + verify, writes to .openlodestar-demo/
npm run verify-quotes # hard guard over the ledger
npm run audit         # reference / snapshot / anchor integrity
```
