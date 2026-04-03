# StandardForm

A single-page web tool that transforms educational standard codes (e.g. `2.RF.3.b`) into a normalized format (`RF.2.3.b`). Built for non-engineers — no installation, no build step, runs directly from `index.html`.

---

## Purpose

Educational standard codes are written inconsistently across districts, curricula, and tools. StandardForm normalizes them to a predictable `DOMAIN.GRADE.STANDARD.letter` format by always parsing the last four dot-separated segments — ignoring any leading prefix segments.

**Examples:**
| Input | Output |
|---|---|
| `2.RF.3.b` | `RF.2.3.b` |
| `BBEE.FTH-Literacy.2.RF.3.b` | `RF.2.3.b` |
| `2.rf.3.B` | `RF.2.3.b` |

Two modes are supported:
- **Single** — type or paste a code and see the result instantly
- **Batch** — upload a `.csv` or `.xlsx`, pick the column, preview the output, download

---

## Quick Start

No installation required.

1. Clone or download the repo
2. Open a terminal in the project root and run:
   ```bash
   npx serve .
   ```
3. Open `http://localhost:3000` in your browser

> **Why a server?** Browsers block ES module imports on the `file://` protocol. `npx serve .` takes care of this with no installation needed.

---

## Running Tests

Install dev dependencies (one time):

```bash
npm install
```

Run the full test suite:

```bash
npm test
```

Run with coverage report:

```bash
npm run test:coverage
```

Coverage thresholds (enforced): 90% lines, functions, and branches across `js/**`.

---

## Accessibility Decisions Log

### `<output>` instead of `<span>` or `<div>` for the result display

**Decision:** The element that displays the transformed standard code uses `<output>` rather than a generic `<span>` or `<div>`.

**Rationale:** `<output>` is the semantically correct HTML5 element for displaying the result of a user-driven computation (spec: [whatwg.org](https://html.spec.whatwg.org/multipage/form-elements.html#the-output-element)). It carries an implicit ARIA `role="status"`, which means:

- `aria-label` is a valid attribute on it — no extra `role` attribute needed
- Assistive technologies understand it as a live computation result, not generic text
- The `for` attribute links it to `#standard-input`, expressing the relationship semantically

Using `<span aria-label="...">` without a role fails the `aria-allowed-attr` axe rule (WCAG 4.1.2) because `aria-label` is not permitted on elements with no valid ARIA role. Adding `role="status"` manually to a `<span>` would work but is less expressive than the native element.

### Synchronous clipboard mock in tests

**Decision:** The copy button test uses a synchronous `.then()` implementation rather than `mockResolvedValue()`.

**Rationale:** `mockResolvedValue()` returns a true Promise, meaning the `.then()` callback is queued as a microtask. In vitest's jsdom environment, the interaction between fake timers and microtask scheduling made it impossible to reliably assert the `aria-label = "Copied!"` state between the clipboard write and the 2-second revert timeout. A synchronous mock — `{ then(cb) { cb(); return { catch() {} }; } }` — calls the callback immediately, making the test deterministic without any async coordination.

### `aria-live="assertive"` on error regions, `"polite"` on output and status announcer

**Decision:** Error spans use `aria-live="assertive"`; the output region and `#status-announcer` use `aria-live="polite"`.

**Rationale:** Errors require immediate interruption — the user typed something invalid and needs to know now. Output updates and status messages (file loaded, copied to clipboard) are informational and should not interrupt an in-progress screen reader announcement. WCAG 4.1.3 requires that status messages be programmatically determinable; `aria-live="polite"` satisfies this without being disruptive.

---

## Known Limitations

- **XLSX support requires CDN access.** The SheetJS library is loaded from `cdn.sheetjs.com`. If the CDN is unavailable the batch upload will not work for `.xlsx` files; `.csv` files are unaffected.
- **Single-sheet XLSX only.** Only the first sheet of a workbook is parsed.
- **No persistent state.** Refreshing the page clears all input and uploaded files.
- **No IE/legacy browser support.** The app uses ES modules (`type="module"`) and the Clipboard API, both of which require a modern browser.
