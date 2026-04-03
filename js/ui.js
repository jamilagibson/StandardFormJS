/**
 * DOM orchestration for StandardForm.
 * Imports pure logic from transform.js and file I/O from fileHandler.js.
 */

import { transformStandard } from './transform.js';
import { parseFile, generateDownloadBlob } from './fileHandler.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function init() {
  setupTabs();
  setupSingleMode();
  setupBatchMode();
}

// ---------------------------------------------------------------------------
// Accessibility helpers
// ---------------------------------------------------------------------------

/**
 * Writes a message to the aria-live polite region after a short delay
 * so screen readers reliably announce it.
 * @param {string} message
 */
export function announceStatus(message) {
  const region = document.getElementById('status-announcer');
  if (!region) return;
  region.textContent = '';
  setTimeout(() => {
    region.textContent = message;
  }, 50);
}

// ---------------------------------------------------------------------------
// Tab switching
// ---------------------------------------------------------------------------

function setupTabs() {
  const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
  const panels = Array.from(document.querySelectorAll('[role="tabpanel"]'));

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => activateTab(tab, tabs, panels));
    tab.addEventListener('keydown', (e) => handleTabKeydown(e, tabs, panels));
  });
}

function activateTab(selectedTab, tabs, panels) {
  tabs.forEach((tab) => {
    const isSelected = tab === selectedTab;
    tab.setAttribute('aria-selected', String(isSelected));
    tab.setAttribute('tabindex', isSelected ? '0' : '-1');
  });

  panels.forEach((panel) => {
    const controlled = selectedTab.getAttribute('aria-controls');
    if (panel.id === controlled) {
      panel.removeAttribute('hidden');
    } else {
      panel.setAttribute('hidden', '');
    }
  });
}

function handleTabKeydown(e, tabs, panels) {
  const index = tabs.indexOf(e.currentTarget);
  let next;

  if (e.key === 'ArrowRight') {
    next = tabs[(index + 1) % tabs.length];
  } else if (e.key === 'ArrowLeft') {
    next = tabs[(index - 1 + tabs.length) % tabs.length];
  } else if (e.key === 'Home') {
    next = tabs[0];
  } else if (e.key === 'End') {
    next = tabs[tabs.length - 1];
  } else {
    return;
  }

  e.preventDefault();
  next.focus();
  activateTab(next, tabs, panels);
}

// ---------------------------------------------------------------------------
// Single mode
// ---------------------------------------------------------------------------

function setupSingleMode() {
  const input = document.getElementById('standard-input');
  const output = document.getElementById('output-value');
  const errorEl = document.getElementById('input-error');
  const copyBtn = document.getElementById('copy-btn');
  const clearBtn = document.getElementById('clear-btn');

  if (!input) return;

  input.addEventListener('input', () => {
    handleInputChange(input.value, output, errorEl, copyBtn);
  });

  copyBtn.addEventListener('click', () => handleCopy(copyBtn, output));
  clearBtn.addEventListener('click', () => handleClear(input, output, errorEl, copyBtn));
}

/**
 * Processes a raw input value and applies DOM mutations.
 * Kept as a named export so it can be called directly in tests.
 */
export function handleInputChange(value, output, errorEl, copyBtn) {
  const { result, error } = transformStandard(value);
  const input = document.getElementById('standard-input');

  if (error) {
    errorEl.textContent = error;
    errorEl.removeAttribute('hidden');
    if (input) input.setAttribute('aria-invalid', 'true');
    output.textContent = '';
    output.setAttribute('aria-label', 'Transformed standard code');
    if (copyBtn) copyBtn.disabled = true;
  } else {
    errorEl.textContent = '';
    errorEl.setAttribute('hidden', '');
    if (input) input.setAttribute('aria-invalid', 'false');
    output.textContent = result ?? '';
    output.setAttribute('aria-label', result ? `Result: ${result}` : 'Transformed standard code');
    if (copyBtn) copyBtn.disabled = !result;
  }
}

function handleCopy(copyBtn, output) {
  const text = output.textContent;
  if (!text) return;

  navigator.clipboard.writeText(text).then(() => {
    copyBtn.setAttribute('aria-label', 'Copied!');
    announceStatus('Copied to clipboard.');
    setTimeout(() => {
      copyBtn.setAttribute('aria-label', 'Copy result');
    }, 2000);
  });
}

function handleClear(input, output, errorEl, copyBtn) {
  input.value = '';
  output.textContent = '';
  errorEl.textContent = '';
  errorEl.setAttribute('hidden', '');
  input.setAttribute('aria-invalid', 'false');
  if (copyBtn) copyBtn.disabled = true;
  input.focus();
}

// ---------------------------------------------------------------------------
// Batch mode
// ---------------------------------------------------------------------------

let parsedFile = null;

function setupBatchMode() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const colSelect = document.getElementById('column-select');
  const downloadBtn = document.getElementById('download-btn');
  const fileError = document.getElementById('file-error');

  if (!dropZone) return;

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
    dropZone.setAttribute('aria-busy', 'true');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
    dropZone.removeAttribute('aria-busy');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    dropZone.removeAttribute('aria-busy');
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file, fileError, colSelect, downloadBtn);
  });

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) loadFile(file, fileError, colSelect, downloadBtn);
  });

  colSelect.addEventListener('change', () => {
    const idx = parseInt(colSelect.value, 10);
    if (!isNaN(idx) && parsedFile) {
      renderPreview(parsedFile.headers, parsedFile.rows, idx);
      downloadBtn.disabled = false;
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (!parsedFile) return;
    const idx = parseInt(colSelect.value, 10);
    const ext = document.getElementById('file-ext-label')?.dataset.ext ?? 'csv';
    handleDownload(parsedFile.headers, parsedFile.rows, idx, ext);
  });
}

function loadFile(file, fileError, colSelect, downloadBtn) {
  fileError.textContent = '';
  fileError.setAttribute('hidden', '');
  downloadBtn.disabled = true;

  const spinner = document.getElementById('loading-spinner');
  if (spinner) {
    spinner.removeAttribute('hidden');
    spinner.setAttribute('aria-busy', 'true');
  }

  parseFile(file)
    .then(({ headers, rows }) => {
      parsedFile = { headers, rows };

      const ext = file.name.split('.').pop().toLowerCase();
      const extLabel = document.getElementById('file-ext-label');
      if (extLabel) extLabel.dataset.ext = ext;

      populateColumnSelect(headers, colSelect);
      announceStatus(`File loaded: ${file.name}. Select a column to transform.`);
    })
    .catch((err) => {
      fileError.textContent = err.message;
      fileError.removeAttribute('hidden');
      parsedFile = null;
    })
    .finally(() => {
      if (spinner) {
        spinner.setAttribute('hidden', '');
        spinner.removeAttribute('aria-busy');
      }
    });
}

function populateColumnSelect(headers, colSelect) {
  const selectorSection = document.getElementById('column-selector');
  colSelect.innerHTML = '';

  headers.forEach((header, i) => {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = header || `Column ${i + 1}`;
    colSelect.appendChild(option);
  });

  if (selectorSection) selectorSection.removeAttribute('hidden');
}

function renderPreview(headers, rows, colIndex) {
  const container = document.getElementById('preview-container');
  const table = document.getElementById('preview-table');
  if (!table) return;

  const previewRows = rows.slice(0, 10);
  const { result: sampleResult } = transformStandard(
    previewRows[0]?.[colIndex] ?? ''
  );

  const outHeaders = [...headers, 'Normalized Standard'];
  const outRows = previewRows.map((row) => {
    const { result } = transformStandard(row[colIndex] ?? '');
    return [...row, result ?? ''];
  });

  let html = '<thead><tr>';
  outHeaders.forEach((h) => {
    html += `<th scope="col">${escapeHTML(h)}</th>`;
  });
  html += '</tr></thead><tbody>';
  outRows.forEach((row) => {
    html += '<tr>';
    row.forEach((cell) => {
      html += `<td>${escapeHTML(String(cell))}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody>';

  table.innerHTML = html;
  if (container) container.removeAttribute('hidden');
}

function handleDownload(headers, rows, colIndex, ext) {
  const outRows = rows.map((row) => {
    const { result } = transformStandard(row[colIndex] ?? '');
    return [...row, result ?? ''];
  });

  const blob = generateDownloadBlob(headers, outRows, colIndex, 'Normalized Standard', ext);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `normalized-standards.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
  announceStatus('Download started.');
}

function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', init);
