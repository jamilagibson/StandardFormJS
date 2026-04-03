import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleInputChange, announceStatus, init } from '../js/ui.js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// DOM scaffolds
// ---------------------------------------------------------------------------
function buildMinimalDOM() {
  document.body.innerHTML = `
    <input type="text" id="standard-input" aria-invalid="false" />
    <span id="input-error" hidden></span>
    <span id="output-value"></span>
    <button id="copy-btn" disabled></button>
    <button id="clear-btn"></button>
    <div id="status-announcer" aria-live="polite"></div>
  `;
}

function buildFullDOM() {
  const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
  const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  document.body.innerHTML = match ? match[1] : html;
}

// ---------------------------------------------------------------------------
// handleInputChange
// ---------------------------------------------------------------------------
describe('handleInputChange', () => {
  let output, errorEl, copyBtn;

  beforeEach(() => {
    buildMinimalDOM();
    output = document.getElementById('output-value');
    errorEl = document.getElementById('input-error');
    copyBtn = document.getElementById('copy-btn');
  });

  it('shows transformed result for valid input', () => {
    handleInputChange('2.RF.3.b', output, errorEl, copyBtn);
    expect(output.textContent).toBe('RF.2.3.b');
    expect(errorEl.hasAttribute('hidden')).toBe(true);
    expect(copyBtn.disabled).toBe(false);
  });

  it('sets aria-invalid="true" and shows error for invalid input', () => {
    handleInputChange('RF.3.b', output, errorEl, copyBtn);
    const input = document.getElementById('standard-input');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(errorEl.textContent).toBeTruthy();
    expect(errorEl.hasAttribute('hidden')).toBe(false);
    expect(output.textContent).toBe('');
    expect(copyBtn.disabled).toBe(true);
  });

  it('clears error and output for empty input', () => {
    handleInputChange('bad', output, errorEl, copyBtn);
    handleInputChange('', output, errorEl, copyBtn);
    expect(output.textContent).toBe('');
    expect(errorEl.hasAttribute('hidden')).toBe(true);
    expect(copyBtn.disabled).toBe(true);
  });

  it('sets aria-label on output to include result', () => {
    handleInputChange('2.RF.3.b', output, errorEl, copyBtn);
    expect(output.getAttribute('aria-label')).toBe('Result: RF.2.3.b');
  });

  it('resets aria-invalid to false for valid input', () => {
    handleInputChange('bad.input', output, errorEl, copyBtn);
    handleInputChange('2.RF.3.b', output, errorEl, copyBtn);
    const input = document.getElementById('standard-input');
    expect(input.getAttribute('aria-invalid')).toBe('false');
  });
});

// ---------------------------------------------------------------------------
// announceStatus
// ---------------------------------------------------------------------------
describe('announceStatus', () => {
  beforeEach(() => {
    buildMinimalDOM();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes message to status-announcer after 50ms delay', () => {
    const region = document.getElementById('status-announcer');
    announceStatus('File loaded.');
    expect(region.textContent).toBe('');
    vi.advanceTimersByTime(50);
    expect(region.textContent).toBe('File loaded.');
  });

  it('clears previous message before setting new one', () => {
    const region = document.getElementById('status-announcer');
    region.textContent = 'old message';
    announceStatus('New message.');
    expect(region.textContent).toBe('');
    vi.advanceTimersByTime(50);
    expect(region.textContent).toBe('New message.');
  });
});

// ---------------------------------------------------------------------------
// init — tab switching
// ---------------------------------------------------------------------------
describe('Tab switching', () => {
  beforeEach(() => {
    buildFullDOM();
    init();
  });

  it('clicking batch tab hides single panel and shows batch panel', () => {
    const batchTab = document.getElementById('tab-batch');
    batchTab.click();
    expect(document.getElementById('panel-batch').hasAttribute('hidden')).toBe(false);
    expect(document.getElementById('panel-single').hasAttribute('hidden')).toBe(true);
  });

  it('clicking batch tab sets aria-selected correctly', () => {
    const batchTab = document.getElementById('tab-batch');
    batchTab.click();
    expect(batchTab.getAttribute('aria-selected')).toBe('true');
    expect(document.getElementById('tab-single').getAttribute('aria-selected')).toBe('false');
  });

  it('ArrowRight key moves focus to next tab', () => {
    const singleTab = document.getElementById('tab-single');
    const batchTab = document.getElementById('tab-batch');
    singleTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(batchTab.getAttribute('aria-selected')).toBe('true');
  });

  it('ArrowLeft key wraps to last tab', () => {
    const singleTab = document.getElementById('tab-single');
    const batchTab = document.getElementById('tab-batch');
    singleTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(batchTab.getAttribute('aria-selected')).toBe('true');
  });

  it('Home key activates first tab', () => {
    const batchTab = document.getElementById('tab-batch');
    batchTab.click();
    batchTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(document.getElementById('tab-single').getAttribute('aria-selected')).toBe('true');
  });

  it('End key activates last tab', () => {
    const singleTab = document.getElementById('tab-single');
    singleTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.getElementById('tab-batch').getAttribute('aria-selected')).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// init — clear button
// ---------------------------------------------------------------------------
describe('Clear button', () => {
  beforeEach(() => {
    buildFullDOM();
    init();
  });

  it('clears input, output, and error on click', () => {
    const input = document.getElementById('standard-input');
    const output = document.getElementById('output-value');
    const errorEl = document.getElementById('input-error');
    const copyBtn = document.getElementById('copy-btn');

    // Put into a valid state first
    handleInputChange('2.RF.3.b', output, errorEl, copyBtn);
    input.value = '2.RF.3.b';

    document.getElementById('clear-btn').click();

    expect(input.value).toBe('');
    expect(output.textContent).toBe('');
    expect(errorEl.textContent).toBe('');
    expect(errorEl.hasAttribute('hidden')).toBe(true);
    expect(copyBtn.disabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// init — copy button
// ---------------------------------------------------------------------------
describe('Copy button', () => {
  let clipboardMock;

  beforeEach(() => {
    buildFullDOM();
    // Synchronous .then() so the callback fires immediately — no async timing issues
    clipboardMock = vi.fn().mockImplementation(() => ({
      then(cb) { cb(); return { catch() {} }; },
    }));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: clipboardMock },
      writable: true,
      configurable: true,
    });
    init();
  });

  it('calls clipboard.writeText with the current result', () => {
    const output = document.getElementById('output-value');
    const errorEl = document.getElementById('input-error');
    const copyBtn = document.getElementById('copy-btn');

    handleInputChange('2.RF.3.b', output, errorEl, copyBtn);
    copyBtn.click();

    expect(clipboardMock).toHaveBeenCalledWith('RF.2.3.b');
  });

  it('changes aria-label to "Copied!" immediately after clipboard write', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    const output = document.getElementById('output-value');
    const errorEl = document.getElementById('input-error');
    const copyBtn = document.getElementById('copy-btn');

    handleInputChange('2.RF.3.b', output, errorEl, copyBtn);
    copyBtn.click();

    expect(copyBtn.getAttribute('aria-label')).toBe('Copied!');

    vi.useRealTimers();
  });

  it('reverts aria-label to "Copy result" after 2s', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    const output = document.getElementById('output-value');
    const errorEl = document.getElementById('input-error');
    const copyBtn = document.getElementById('copy-btn');

    handleInputChange('2.RF.3.b', output, errorEl, copyBtn);
    copyBtn.click();

    expect(copyBtn.getAttribute('aria-label')).toBe('Copied!');
    vi.advanceTimersByTime(2000);
    expect(copyBtn.getAttribute('aria-label')).toBe('Copy result');

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// init — live input in single mode
// ---------------------------------------------------------------------------
describe('Single mode live input', () => {
  beforeEach(() => {
    buildFullDOM();
    init();
  });

  it('updates output on input event', () => {
    const input = document.getElementById('standard-input');
    input.value = '2.RF.3.b';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.getElementById('output-value').textContent).toBe('RF.2.3.b');
  });
});
