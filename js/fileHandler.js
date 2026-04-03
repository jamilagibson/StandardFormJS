/**
 * File I/O helpers for batch mode.
 * CSV parsing is handled natively; XLSX parsing relies on the global
 * XLSX object loaded from CDN in index.html.
 */

/**
 * Parses a .csv or .xlsx File object.
 * @param {File} file
 * @returns {Promise<{ headers: string[], rows: string[][] }>}
 */
export function parseFile(file) {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const lines = e.target.result
          .split(/\r?\n/)
          .filter((line) => line.trim() !== '');
        if (lines.length === 0) {
          return resolve({ headers: [], rows: [] });
        }
        const headers = parseCSVLine(lines[0]);
        const rows = lines.slice(1).map(parseCSVLine);
        resolve({ headers, rows });
      };
      reader.onerror = () => reject(new Error('Failed to read CSV file.'));
      reader.readAsText(file);
    } else if (ext === 'xlsx') {
      if (typeof XLSX === 'undefined') {
        return reject(new Error('XLSX library is not loaded.'));
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
          if (data.length === 0) {
            return resolve({ headers: [], rows: [] });
          }
          const headers = data[0].map(String);
          const rows = data.slice(1).map((row) => row.map(String));
          resolve({ headers, rows });
        } catch (err) {
          reject(new Error('Failed to parse XLSX file.'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read XLSX file.'));
      reader.readAsArrayBuffer(file);
    } else {
      reject(new Error(`Unsupported file type: .${ext}. Please upload a .csv or .xlsx file.`));
    }
  });
}

/**
 * Parses a single CSV line, respecting double-quoted fields.
 * @param {string} line
 * @returns {string[]}
 */
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Generates a downloadable Blob with the transformed column appended.
 * @param {string[]} headers
 * @param {string[][]} rows
 * @param {number} colIndex - index of the column to transform
 * @param {string} convertedColName - header name for the new column
 * @param {'csv'|'xlsx'} fileExt
 * @returns {Blob}
 */
export function generateDownloadBlob(headers, rows, colIndex, convertedColName, fileExt) {
  const outHeaders = [...headers, convertedColName];
  const outRows = rows.map((row) => [...row]);

  if (fileExt === 'csv') {
    const lines = [outHeaders, ...outRows].map((row) =>
      row.map(escapeCSVField).join(',')
    );
    return new Blob([lines.join('\r\n')], { type: 'text/csv' });
  }

  if (fileExt === 'xlsx') {
    if (typeof XLSX === 'undefined') {
      throw new Error('XLSX library is not loaded.');
    }
    const aoa = [outHeaders, ...outRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }

  throw new Error(`Unsupported file extension: ${fileExt}`);
}

/**
 * Escapes a single field for CSV output.
 * @param {string} field
 * @returns {string}
 */
function escapeCSVField(field) {
  const str = String(field);
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
