# CLAUDE.md — StandardForm

Developer notes for working with this codebase using Claude Code.

---

## Architecture Overview

StandardForm is a zero-build, single-page web app. All logic runs in the browser via ES modules loaded directly from `index.html`.

```
index.html          Entry point — semantic HTML, ARIA wiring, CDN script tags
css/styles.css      All styles — WCAG 2.2 AA palette, focus styles, responsive layout
js/
  transform.js      Pure function: string in → { result, error } out. No DOM, no imports.
  fileHandler.js    File I/O: parseFile() and generateDownloadBlob(). Browser APIs only.
  ui.js             DOM orchestration. Imports transform.js and fileHandler.js.
tests/
  setup.js          Vitest global setup — extends expect with jest-axe matchers
  transform.test.js Unit tests for transform logic
  fileHandler.test.js Unit tests for CSV/XLSX parsing and blob generation
  ui.test.js        DOM interaction tests (single mode, tabs, copy, clear)
  ui.batch.test.js  Batch mode tests using vi.mock for fileHandler
  a11y.test.js      Axe accessibility tests for three DOM states
```

### Data flow

```
User types → ui.js input event
           → transformStandard(value)      [transform.js]
           → { result, error }
           → update #output-value, #input-error, aria attributes

User uploads file → ui.js drop/change event
                  → parseFile(file)        [fileHandler.js]
                  → { headers, rows }
                  → populate column <select>
                  → column selected → renderPreview()
                  → download clicked → generateDownloadBlob() [fileHandler.js]
                  → trigger browser download via <a> click
```

---

## Key Decisions

**No build step.** The app uses native ES modules (`type="module"`). This means it must be served over HTTP (not opened via `file://`). Use `npx serve .` for local development.

**transform.js has zero side effects.** It never touches the DOM and has no imports. This makes it trivially testable and safe to reuse in any context (Node scripts, other frameworks, etc.).

**fileHandler.js depends on two browser globals.** `FileReader` (built-in) and `XLSX` (loaded from CDN in `index.html`). Tests mock `globalThis.XLSX` directly rather than trying to load the CDN library.

**ui.js exports only what needs to be tested.** `init()`, `handleInputChange()`, and `announceStatus()` are named exports. All other functions (tab switching, batch mode handlers) are private and tested indirectly via DOM events in the test suite.

**WCAG 2.2 AA is a hard constraint.** All color values were chosen for ≥4.5:1 contrast ratio. Focus indicators use `outline: 3px solid` and are never suppressed. Touch targets are minimum 44×44px. The axe test suite enforces this automatically on every CI run.

**`<output>` for the result display.** The element that shows the transformed code is `<output for="standard-input">`, not a `<span>`. `<output>` has implicit `role="status"` making `aria-label` valid and communicating computation semantics to assistive technology. See README Accessibility Decisions Log for full rationale.

---

## How to Add a New Input Pattern

The transform algorithm parses the **last 4 dot-separated segments** from the right. If a new standard format follows the same positional rules (grade · domain · standard · letter) but has a different number of prefix segments, it will already work — no code changes needed.

If a new format uses a **different positional structure** (e.g. letter comes before the standard number), follow these steps:

1. **Update `js/transform.js`**
   - Add a detection heuristic to identify the new format (e.g. check segment count or a known prefix)
   - Add a new validation + transformation branch
   - Return the same `{ result, error }` shape — `ui.js` and tests depend on this contract

2. **Add test cases to `tests/transform.test.js`**
   - Cover the happy path, case normalization, and all new validation failure modes
   - Run `npm run test:coverage` and confirm the new branch paths are covered

3. **Update `README.md`**
   - Add the new format to the examples table in the Purpose section
   - Add an entry to the Accessibility Decisions Log if any UI changes were needed

4. **No changes needed** to `ui.js`, `fileHandler.js`, `index.html`, or `css/styles.css` — the UI is format-agnostic and delegates entirely to `transformStandard()`.
