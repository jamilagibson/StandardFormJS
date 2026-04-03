import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseFile, generateDownloadBlob } from '../js/fileHandler.js';

// jsdom's Blob doesn't support .text() — read via FileReader instead
function blobToText(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(blob);
  });
}

// ---------------------------------------------------------------------------
// generateDownloadBlob — CSV
// ---------------------------------------------------------------------------
describe('generateDownloadBlob — CSV', () => {
  const headers = ['Standard', 'Grade'];
  const rows = [['2.RF.3.b', '2'], ['3.RL.4.a', '3']];

  it('returns a Blob with text/csv type', () => {
    const blob = generateDownloadBlob(headers, rows, 0, 'Normalized', 'csv');
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('text/csv');
  });

  it('CSV contains header row with appended column name', async () => {
    const blob = generateDownloadBlob(headers, rows, 0, 'Normalized', 'csv');
    const text = await blobToText(blob);
    expect(text).toContain('Standard,Grade,Normalized');
  });

  it('CSV contains data rows', async () => {
    const blob = generateDownloadBlob(headers, rows, 0, 'Normalized', 'csv');
    const text = await blobToText(blob);
    expect(text).toContain('2.RF.3.b');
    expect(text).toContain('3.RL.4.a');
  });

  it('escapes fields containing commas with double quotes', async () => {
    const blob = generateDownloadBlob(['Name'], [['Smith, John']], 0, 'Result', 'csv');
    const text = await blobToText(blob);
    expect(text).toContain('"Smith, John"');
  });

  it('escapes fields containing double quotes', async () => {
    const blob = generateDownloadBlob(['Note'], [['say "hello"']], 0, 'Result', 'csv');
    const text = await blobToText(blob);
    expect(text).toContain('"say ""hello"""');
  });
});

// ---------------------------------------------------------------------------
// generateDownloadBlob — error cases
// ---------------------------------------------------------------------------
describe('generateDownloadBlob — error cases', () => {
  it('throws for unsupported file extension', () => {
    expect(() => generateDownloadBlob([], [], 0, 'Result', 'pdf')).toThrow();
  });

  it('throws for xlsx when XLSX global is not loaded', () => {
    expect(() => generateDownloadBlob([], [], 0, 'Result', 'xlsx')).toThrow('XLSX library is not loaded.');
  });
});

// ---------------------------------------------------------------------------
// parseFile — rejection cases
// ---------------------------------------------------------------------------
describe('parseFile — rejection cases', () => {
  it('rejects unsupported file type with descriptive error', async () => {
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    await expect(parseFile(file)).rejects.toThrow('Unsupported file type');
  });

  it('rejects xlsx when XLSX global is not loaded', async () => {
    const file = new File(
      [''],
      'test.xlsx',
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    );
    await expect(parseFile(file)).rejects.toThrow('XLSX library is not loaded.');
  });
});

// ---------------------------------------------------------------------------
// parseFile — CSV parsing
// ---------------------------------------------------------------------------
describe('parseFile — CSV', () => {
  it('parses headers and rows from a simple CSV', async () => {
    const content = 'Standard,Grade\n2.RF.3.b,2\n3.RL.4.a,3';
    const file = new File([content], 'test.csv', { type: 'text/csv' });
    const { headers, rows } = await parseFile(file);
    expect(headers).toEqual(['Standard', 'Grade']);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(['2.RF.3.b', '2']);
    expect(rows[1]).toEqual(['3.RL.4.a', '3']);
  });

  it('returns empty headers and rows for an empty CSV', async () => {
    const file = new File([''], 'empty.csv', { type: 'text/csv' });
    const { headers, rows } = await parseFile(file);
    expect(headers).toEqual([]);
    expect(rows).toEqual([]);
  });

  it('handles quoted fields containing commas', async () => {
    const content = 'Standard,Description\n2.RF.3.b,"Read, fluently"';
    const file = new File([content], 'test.csv', { type: 'text/csv' });
    const { rows } = await parseFile(file);
    expect(rows[0][1]).toBe('Read, fluently');
  });

  it('handles escaped double quotes inside quoted fields', async () => {
    const content = 'Note\n"say ""hello"""';
    const file = new File([content], 'test.csv', { type: 'text/csv' });
    const { rows } = await parseFile(file);
    expect(rows[0][0]).toBe('say "hello"');
  });

  it('ignores blank lines', async () => {
    const content = 'Standard,Grade\n2.RF.3.b,2\n\n3.RL.4.a,3\n';
    const file = new File([content], 'test.csv', { type: 'text/csv' });
    const { rows } = await parseFile(file);
    expect(rows).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// parseFile — XLSX (mocked XLSX global)
// ---------------------------------------------------------------------------
describe('parseFile — XLSX (mocked global)', () => {
  beforeEach(() => {
    globalThis.XLSX = {
      read: vi.fn().mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      }),
      utils: {
        sheet_to_json: vi.fn().mockReturnValue([
          ['Standard', 'Grade'],
          ['2.RF.3.b', '2'],
          ['3.RL.4.a', '3'],
        ]),
      },
    };
  });

  afterEach(() => {
    delete globalThis.XLSX;
  });

  it('parses headers and rows from an XLSX file', async () => {
    const file = new File([''], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const { headers, rows } = await parseFile(file);
    expect(headers).toEqual(['Standard', 'Grade']);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(['2.RF.3.b', '2']);
  });

  it('returns empty headers and rows for an empty XLSX sheet', async () => {
    globalThis.XLSX.utils.sheet_to_json.mockReturnValue([]);
    const file = new File([''], 'empty.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const { headers, rows } = await parseFile(file);
    expect(headers).toEqual([]);
    expect(rows).toEqual([]);
  });

  it('rejects when XLSX.read throws', async () => {
    globalThis.XLSX.read.mockImplementation(() => { throw new Error('corrupt'); });
    const file = new File([''], 'bad.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    await expect(parseFile(file)).rejects.toThrow('Failed to parse XLSX file.');
  });
});

// ---------------------------------------------------------------------------
// generateDownloadBlob — XLSX (mocked XLSX global)
// ---------------------------------------------------------------------------
describe('generateDownloadBlob — XLSX (mocked global)', () => {
  beforeEach(() => {
    globalThis.XLSX = {
      utils: {
        aoa_to_sheet: vi.fn().mockReturnValue({}),
        book_new: vi.fn().mockReturnValue({}),
        book_append_sheet: vi.fn(),
      },
      write: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
    };
  });

  afterEach(() => {
    delete globalThis.XLSX;
  });

  it('returns a Blob with xlsx MIME type', () => {
    const blob = generateDownloadBlob(['Standard'], [['2.RF.3.b']], 0, 'Normalized', 'xlsx');
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toContain('spreadsheetml');
  });
});
