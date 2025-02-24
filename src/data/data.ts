import * as T from '../lib/types.js';

import DATA from './data.json' with { type: 'json' };

const TYPED_DATA = typeData(DATA);
export default TYPED_DATA;

function typeData(d: Record<string, any>) {
  const sectionsData : Record<T.SectionId, T.SectionData> = {};
  for (const k1 of Object.keys(d)) {
    const sectionData: T.SectionData = {};
    const sectionId = k1 as T.SectionId;
    sectionsData[sectionId] = sectionData;
    for (const k2 of Object.keys(d[k1])) {
      const studentId = T.toStudentId(k2);
      const row: T.RowData = {};
      sectionData[studentId] = row;
      for (const k3 of Object.keys(d[k1][k2])) {
	const colId = k3 as T.ColId;
	const val = d[k1][k2][k3];
	row[colId] = val as T.Entry;
      }
    }      
  }
  return sectionsData;
}
