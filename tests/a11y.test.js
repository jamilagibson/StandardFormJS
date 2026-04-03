import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Load the full index.html markup once
// ---------------------------------------------------------------------------
const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');

// Extract just the <body> content so jsdom doesn't re-parse <head> resources
function getBodyHTML() {
  const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return match ? match[1] : html;
}

describe('Accessibility — default state', () => {
  beforeEach(() => {
    document.body.innerHTML = getBodyHTML();
  });

  it('has no axe violations in default state', async () => {
    const results = await axe(document.body);
    expect(results).toHaveNoViolations();
  });

  it('has a tablist with two tabs', () => {
    const tabs = document.querySelectorAll('[role="tab"]');
    expect(tabs).toHaveLength(2);
  });

  it('first tab is selected by default', () => {
    const firstTab = document.querySelector('[role="tab"]');
    expect(firstTab.getAttribute('aria-selected')).toBe('true');
  });

  it('batch panel is hidden by default', () => {
    const batchPanel = document.getElementById('panel-batch');
    expect(batchPanel.hasAttribute('hidden')).toBe(true);
  });

  it('input has aria-describedby linking to hint and error spans', () => {
    const input = document.getElementById('standard-input');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toContain('input-hint');
    expect(describedBy).toContain('input-error');
  });

  it('status announcer has aria-live="polite"', () => {
    const announcer = document.getElementById('status-announcer');
    expect(announcer.getAttribute('aria-live')).toBe('polite');
  });
});

describe('Accessibility — error state', () => {
  beforeEach(() => {
    document.body.innerHTML = getBodyHTML();
    // Simulate error state
    const input = document.getElementById('standard-input');
    const errorEl = document.getElementById('input-error');
    input.setAttribute('aria-invalid', 'true');
    errorEl.textContent = 'The final segment must be a single letter.';
    errorEl.removeAttribute('hidden');
  });

  it('has no axe violations in error state', async () => {
    const results = await axe(document.body);
    expect(results).toHaveNoViolations();
  });

  it('error region is visible and has content', () => {
    const errorEl = document.getElementById('input-error');
    expect(errorEl.hasAttribute('hidden')).toBe(false);
    expect(errorEl.textContent).toBeTruthy();
  });
});

describe('Accessibility — batch panel visible', () => {
  beforeEach(() => {
    document.body.innerHTML = getBodyHTML();
    // Simulate batch tab active
    const batchPanel = document.getElementById('panel-batch');
    const singlePanel = document.getElementById('panel-single');
    batchPanel.removeAttribute('hidden');
    singlePanel.setAttribute('hidden', '');
  });

  it('has no axe violations with batch panel visible', async () => {
    const results = await axe(document.body);
    expect(results).toHaveNoViolations();
  });

  it('drop zone has an accessible label', () => {
    const dropZone = document.getElementById('drop-zone');
    expect(dropZone.getAttribute('aria-label')).toBeTruthy();
  });

  it('file input is present', () => {
    const fileInput = document.getElementById('file-input');
    expect(fileInput).not.toBeNull();
    expect(fileInput.getAttribute('accept')).toContain('.csv');
  });
});
