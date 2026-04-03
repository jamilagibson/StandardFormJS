A dual-implementation tool for normalizing educational standard codes — built in Python and JavaScript.

---

## Accessibility Decisions Log

### `<output>` instead of `<span>` or `<div>` for the result display

**Decision:** The element that displays the transformed standard code uses `<output>` rather than a generic `<span>` or `<div>`.

**Rationale:** `<output>` is the semantically correct HTML5 element for displaying the result of a user-driven computation (spec: [whatwg.org](https://html.spec.whatwg.org/multipage/form-elements.html#the-output-element)). It carries an implicit ARIA `role="status"`, which means:

- `aria-label` is a valid attribute on it — no extra `role` attribute needed
- Assistive technologies understand it as a live computation result, not generic text
- The `for` attribute links it to `#standard-input`, expressing the relationship semantically

Using `<span aria-label="...">` without a role would fail the `aria-allowed-attr` axe rule (WCAG 4.1.2) because `aria-label` is not permitted on elements with no valid ARIA role. Adding `role="status"` manually to a `<span>` would work but is less expressive than the native element.
