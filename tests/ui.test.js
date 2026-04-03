import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleInputChange, announceStatus } from '../js/ui.js';

// ---------------------------------------------------------------------------
// Minimal DOM scaffold matching index.html structure
// ---------------------------------------------------------------------------
function buildDOM() {
  document.body.innerHTML = `
    <input type="text" id="standard-input" aria-invalid="false" />
    <span id="input-error" hidden></span>
    <span id="output-value"></span>
    <button id="copy-btn" disabled></button>
    <button id="clear-btn"></button>
    <div id="status-announcer" aria-live="polite"></div>
  `;
}

describe('handleInputChange', () => {
  let output, errorEl, copyBtn;

  beforeEach(() => {
    buildDOM();
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
    // first put it in error state
    handleInputChange('bad', output, errorEl, copyBtn);
    // then clear
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

describe('announceStatus', () => {
  beforeEach(() => {
    buildDOM();
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
