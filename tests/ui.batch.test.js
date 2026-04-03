/**
 * Batch mode tests for ui.js.
 * Uses vi.mock to replace fileHandler.js so no real file I/O occurs.
 * Covers: loadFile, populateColumnSelect, renderPreview, handleDownload, escapeHTML.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

vi.mock('../js/fileHandler.js', () => ({
  parseFile: vi.fn().mockResolvedValue({
    headers: ['Standard', 'Grade'],
    rows: [
      ['2.RF.3.b', '2'],
      ['3.RL.4.a', '3'],
      ['<script>xss</script>', '4'],
    ],
  }),
  generateDownloadBlob: vi.fn().mockReturnValue(
    new Blob(['csv content'], { type: 'text/csv' })
  ),
}));

import { init } from '../js/ui.js';
import { generateDownloadBlob } from '../js/fileHandler.js';

function buildFullDOM() {
  const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
  const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  document.body.innerHTML = match ? match[1] : html;
  // Show batch panel for all batch tests
  document.getElementById('panel-batch').removeAttribute('hidden');
  document.getElementById('panel-single').setAttribute('hidden', '');
}

async function loadFileAndWait() {
  const fileInput = document.getElementById('file-input');
  const file = new File(['Standard,Grade\n2.RF.3.b,2'], 'test.csv', { type: 'text/csv' });
  Object.defineProperty(fileInput, 'files', { value: [file], writable: false, configurable: true });
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  // Yield to microtask queue so the mocked parseFile promise resolves
  await Promise.resolve();
  await Promise.resolve();
}

describe('Batch mode — file loading', () => {
  beforeEach(() => {
    buildFullDOM();
    init();
  });

  it('populates column select after file is loaded', async () => {
    await loadFileAndWait();
    const colSelect = document.getElementById('column-select');
    expect(colSelect.options.length).toBe(2);
    expect(colSelect.options[0].textContent).toBe('Standard');
    expect(colSelect.options[1].textContent).toBe('Grade');
  });

  it('shows column selector section after file is loaded', async () => {
    await loadFileAndWait();
    expect(document.getElementById('column-selector').hasAttribute('hidden')).toBe(false);
  });

  it('announces status after file is loaded', async () => {
    await loadFileAndWait();
    const announcer = document.getElementById('status-announcer');
    // announceStatus uses a 50ms delay — check after that
    await new Promise((r) => setTimeout(r, 60));
    expect(announcer.textContent).toContain('test.csv');
  });
});

describe('Batch mode — column selection and preview', () => {
  beforeEach(async () => {
    buildFullDOM();
    init();
    await loadFileAndWait();
  });

  it('renders preview table when a column is selected', () => {
    const colSelect = document.getElementById('column-select');
    colSelect.dispatchEvent(new Event('change', { bubbles: true }));
    const table = document.getElementById('preview-table');
    expect(table.innerHTML).toContain('Standard');
    expect(table.innerHTML).toContain('Grade');
    expect(table.innerHTML).toContain('Normalized Standard');
  });

  it('shows preview container after column is selected', () => {
    const colSelect = document.getElementById('column-select');
    colSelect.dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.getElementById('preview-container').hasAttribute('hidden')).toBe(false);
  });

  it('enables download button after column is selected', () => {
    const colSelect = document.getElementById('column-select');
    colSelect.dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.getElementById('download-btn').disabled).toBe(false);
  });

  it('escapes HTML special characters in preview table', () => {
    const colSelect = document.getElementById('column-select');
    colSelect.dispatchEvent(new Event('change', { bubbles: true }));
    const table = document.getElementById('preview-table');
    expect(table.innerHTML).not.toContain('<script>');
    expect(table.innerHTML).toContain('&lt;script&gt;');
  });
});

describe('Batch mode — edge cases', () => {
  beforeEach(async () => {
    buildFullDOM();
    init();
  });

  it('does nothing on drop event with no file', () => {
    const dropZone = document.getElementById('drop-zone');
    const dropEvent = new Event('drop', { bubbles: true });
    dropEvent.dataTransfer = { files: [] };
    dropZone.dispatchEvent(dropEvent);
    // Column selector should remain hidden — no file loaded
    expect(document.getElementById('column-selector').hasAttribute('hidden')).toBe(true);
  });

  it('ignores non-Enter/Space keydown on drop zone', () => {
    const dropZone = document.getElementById('drop-zone');
    dropZone.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    // No error, no file picker opened — just a no-op
    expect(document.getElementById('column-selector').hasAttribute('hidden')).toBe(true);
  });

  it('adds dragover class on dragover event', () => {
    const dropZone = document.getElementById('drop-zone');
    const dragoverEvent = new Event('dragover', { bubbles: true });
    dragoverEvent.preventDefault = vi.fn();
    dropZone.dispatchEvent(dragoverEvent);
    expect(dropZone.classList.contains('dragover')).toBe(true);
    expect(dropZone.getAttribute('aria-busy')).toBe('true');
  });

  it('removes dragover class on dragleave event', () => {
    const dropZone = document.getElementById('drop-zone');
    dropZone.classList.add('dragover');
    dropZone.setAttribute('aria-busy', 'true');
    dropZone.dispatchEvent(new Event('dragleave', { bubbles: true }));
    expect(dropZone.classList.contains('dragover')).toBe(false);
    expect(dropZone.hasAttribute('aria-busy')).toBe(false);
  });

  it('Enter key on drop zone triggers file input click', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const clickSpy = vi.spyOn(fileInput, 'click');
    dropZone.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(clickSpy).toHaveBeenCalled();
  });

  it('shows file error when parseFile rejects', async () => {
    const { parseFile } = await import('../js/fileHandler.js');
    parseFile.mockRejectedValueOnce(new Error('Unsupported file type: .pdf'));

    const fileInput = document.getElementById('file-input');
    const file = new File([''], 'test.pdf', { type: 'application/pdf' });
    Object.defineProperty(fileInput, 'files', { value: [file], writable: false, configurable: true });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    // Yield past the full .then → .catch → .finally microtask chain
    await new Promise((resolve) => setTimeout(resolve, 0));

    const fileError = document.getElementById('file-error');
    expect(fileError.textContent).toContain('Unsupported file type');
    expect(fileError.hasAttribute('hidden')).toBe(false);
  });
});

describe('Batch mode — download', () => {
  beforeEach(async () => {
    buildFullDOM();
    // Mock URL methods required by handleDownload
    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn().mockReturnValue('blob:mock'),
      writable: true,
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: vi.fn(),
      writable: true,
      configurable: true,
    });
    init();
    await loadFileAndWait();
    // Select column to enable download button
    document.getElementById('column-select').dispatchEvent(new Event('change', { bubbles: true }));
  });

  it('calls generateDownloadBlob when download button is clicked', () => {
    document.getElementById('download-btn').click();
    expect(generateDownloadBlob).toHaveBeenCalled();
  });

  it('calls URL.createObjectURL with the blob', () => {
    document.getElementById('download-btn').click();
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('calls URL.revokeObjectURL to clean up', () => {
    document.getElementById('download-btn').click();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });
});
