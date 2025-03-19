import * as T from './types.js';
import * as E from './errors.js';

import Grades from './grades.js';

// Utilities which might be useful for testing, I/O.

/** Add info and data to grades.  Assumes all students in data have
 *  been added to grades, but not enrolled
 */
export function loadSectionData(info: T.SectionInfo, data: T.SectionData,
				grades: Grades): E.Result<void, E.Err>
{
  const infoResult = grades.addSectionInfo(info);
  if (!infoResult.isOk) return infoResult;
  const sectionId = info.id;
  const studentIds = Object.keys(data).filter(rowId => T.isStudentId(rowId));
  for (const studentId of studentIds) {
    const enrollResult = grades.enrollStudent(sectionId, studentId);
    if (!enrollResult.isOk) return enrollResult;
  }
  for (const studentId of studentIds) {
    const row = data[studentId];
    for (const h of Object.values(info.colHdrs)) {
      if (h._tag !== 'numScore' && h._tag !== 'textScore') continue;
      const scoreResult =
	grades.addScore(sectionId, studentId, h.id, row[h.id] as T.Score);
      if (!scoreResult.isOk) return scoreResult;
    }
  }
  return E.okResult(undefined);
}

/** return a csv string representing data.
 *  does not attempt to handle data containing ',' since CSV "standard"
 *  is a bit of a mess.
 */
export function toCsv(data: T.SectionData) {
  let csv = '';
  const rowIds = Object.keys(data) as T.RowId[];
  const colIds = Object.keys(data[rowIds[0]]) as T.ColId[];
  csv += colIds.join(',') + '\n';
  for (const row of Object.values(data)) {
    const vals = colIds.map(c => row[c] ?? '');
    csv += vals.join(',') + '\n';
  }
  return csv;
}

/** return data formatted as a text table */
export function toTextTable(data: T.SectionData) {
  const widths = colWidths(data);
  let text =
    Object.keys(widths).map(k => k.padStart(widths[k])).join(' ') + "\n";
  for (const row of Object.values(data)) {
    const items = [];
    for (const [k, w] of Object.entries(widths)) {
      const val = (row[k as T.ColId] ?? '').toString();
      items.push(/\d+(\.\d*)/.test(val) ? val.padStart(w) : val.padEnd(w));
    }
    text += items.join(' ') + '\n';
  }
  return text;
}
  
function colWidths(data: T.SectionData) : Record<string, number> {
  const widths : Record<string, number> = {};
  for (const row of Object.values(data)) {
    for (const [k, v] of Object.entries(row)) {
      widths[k] ??= k.length;
      const vLen = (v ?? '').toString().length;
      if (widths[k] < vLen) widths[k] = vLen;
    }
  }
  return widths;
}

