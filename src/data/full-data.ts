import * as T from '../lib/types.js';

import DATA from './data.js';
import STUDENTS from './students.js';
import * as cs201 from './cs201-info.js';
import * as en101 from './en101-info.js';


const colAggrFns: Record<string, (col: T.Score[]) => number> = {
  count: (col: T.Score[]) =>  col.filter(c => c !== null).length,
  min: (col: T.Score[]) =>
    Math.min(...(col as T.NumScore[]).filter(c => c !== null)),
  max: (col: T.Score[]) =>
    Math.max(...(col as T.NumScore[]).filter(c => c !== null)),
  avg: (col: T.Score[]) => {
    const vals = (col as T.NumScore[]).filter(c => c !== null);
    const n = vals.length;
    return n === 0
      ? 0
      : Number((vals.reduce((sum, v) => sum + v)/n).toFixed(1));
  },
};

function addAggrRows(info: T.SectionInfo, data: T.SectionData) {
  const aggrRows: T.RowData[] = [];
  for (const rh of Object.values(info.rowHdrs)) {
    const row: T.RowData = {['id' as T.ColId]: rh.id, };
    aggrRows.push(row);
    const aggrFn = colAggrFns[rh.aggrFnName];
    console.assert(aggrFn);
    for (const ch of Object.values(info.colHdrs)) {
      if (ch.id === 'id') continue;
      if (ch._tag === 'student') {
	row[ch.id] = '';
      }
      else if (rh.aggrFnName !== 'count' && 
  	  ch.entryType !== 'numScore' && ch.entryType !== 'num') {
	row[ch.id] = '';
      }
      else {
	const col =
	  Object.values(data).map(row => row[ch.id] ?? null) as T.NumScore[];
	row[ch.id] = aggrFn(col);
      }
    }
  }
  aggrRows.forEach(row => data[row['id' as T.ColId] as T.RowId] = row);
}

function fullData(data: Record<T.SectionId, T.SectionData>) {
  const cs201Id = 'cs201' as T.SectionId;
  const cs201Full = cs201FullData(data[cs201Id]);
  const en101Id = 'en101' as T.SectionId;
  const en101Full = en101FullData(data[en101Id]);
  const full = { [cs201Id]: cs201Full, [en101Id]: en101Full, }; 
  return full;
}

function en101FullData(en101Data: T.SectionData) {
  const fullData: T.SectionData = {};
  for (const [k, v] of Object.entries(en101Data)) {
    const row: T.RowData = {};
    const studentId = T.toStudentId(k);
    fullData[studentId] = row;
    addStudentInfo(cs201.cs201Info, row, studentId);
    Object.assign(row, v);

    const paperKeys =
      Object.keys(row).filter(k => k.startsWith('paper')) as T.ColId[];
    const letterGrades = paperKeys.map(k => row[k] ?? '') as string[];
    const paperGrades = letterGrades.map(g => en101.LETTER_POINTS[g] ?? 0);
    const paperSum = paperGrades.reduce((sum, g) => sum + g);
    const paperAvg = Number((paperSum/paperGrades.length).toFixed(1));
    row['paperAvg' as T.ColId] = paperAvg;
    
    let total = 0;
    for (const k of Object.keys(en101.WEIGHTS)) {
      const colId = k as T.ColId;
      total += (row[colId] as number) * en101.WEIGHTS[colId];
    }
    total = Number(total.toFixed(1));
    row['total' as T.ColId] = total;
    
    const grade = en101.CUTOFFS.find(c => c.lo <= total && total < c.hi)!.grade;
    row['grade' as T.ColId] = grade;
  }
  addAggrRows(en101.en101Info, fullData);
  return fullData;
}

function cs201FullData(cs201Data: T.SectionData) {
  const fullData: T.SectionData = {};
  for (const [k, v] of Object.entries(cs201Data)) {
    const row: T.RowData = {};
    const studentId = T.toStudentId(k);
    fullData[studentId] = row;
    addStudentInfo(cs201.cs201Info, row, studentId);
    Object.assign(row, v);

    const prjKeys =
      Object.keys(row).filter(k => k.startsWith('prj')) as T.ColId[];
    const prjGrades = prjKeys.map(k => row[k] ?? 0) as number[];
    const prjSum = prjGrades.reduce((sum, g) => sum + g);
    const prjAvg = (prjSum - Math.min(...prjGrades))/(prjGrades.length - 1);
    row['prjAvg' as T.ColId] = Number(prjAvg.toFixed(1));

    const hwKeys =
      Object.keys(row).filter(k => k.startsWith('hw')) as T.ColId[];
    const hwGrades = hwKeys.map(k => row[k] ?? 0) as number[];
    const hwSum = hwGrades.reduce((sum, g) => sum + g);
    const hwAvg = (hwSum - Math.min(...hwGrades))/(hwGrades.length - 1);
    row['hwAvg' as T.ColId] = Number(hwAvg.toFixed(1));

    let total = 0;
    for (const k of Object.keys(cs201.WEIGHTS)) {
      const colId = k as T.ColId;
      total += (row[colId] as number) * cs201.WEIGHTS[colId];
    }
    total = Number(total.toFixed(1));
    row['total' as T.ColId] = total;
    
    const grade = cs201.CUTOFFS.find(c => c.lo <= total && total < c.hi)!.grade;
    row['grade' as T.ColId] = grade;
  }
  addAggrRows(cs201.cs201Info, fullData);
  return fullData;
}


function addStudentInfo(info: T.SectionInfo, row: T.RowData, id: T.StudentId) {
  const student = STUDENTS.find(s => s.id === id)!;
  for (const h of Object.values(info.colHdrs)) {
    if (h._tag !== 'student') continue;
    row[h.id] = student[h.key];    
  }
}

const FULL_DATA = fullData(DATA);
export default FULL_DATA;
