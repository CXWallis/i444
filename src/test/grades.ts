import Grades from '../lib/grades.js';
import * as T from '../lib/types.js';
import * as E from '../lib/errors.js';
import { loadSectionData } from '../lib/grade-utils.js';

import STUDENTS from '../data/students.js';
import * as F from '../data/aggr-fns.js';
import DATA from '../data/full-data.js';
import { cs201Info } from '../data/cs201-info.js';
import { en101Info } from '../data/en101-info.js';

import { assert, expect } from 'chai';

const SECTION_INFOS: Record<T.SectionId, T.SectionInfo> = {
  ['cs201' as T.SectionId] : cs201Info,
  ['en101' as T.SectionId] : en101Info,
};

//suffix used to make some data bad
const X = 'xxx';

describe('Grades', () => {

  let G: Grades;
  let sectionIds: T.SectionId[];
  
  beforeEach(() => {
    G = new Grades(F.rowAggrFns, F.colAggrFns);
    sectionIds = Object.keys(DATA) as T.SectionId[];
  });

  describe('adding sectionInfo', () => {

    it('must add section-info\'s', () => {
      for (const info of Object.values(SECTION_INFOS)) {
	const result = G.addSectionInfo(info);
	assert(result.isOk);
      }
    });

    it('must fail to add section-info having a bad aggrCol fn name', () => {
      const cs201Copy = structuredClone(cs201Info);
      const colHdrs = Object.values(cs201Copy.colHdrs);
      const hdrInfo = colHdrs.find(h => h._tag === 'aggrCol')! as T.AggrColHdr;
      hdrInfo.aggrFnName += X;
      const cs201Result = G.addSectionInfo(cs201Copy);
      assert(!cs201Result.isOk);
      expect(cs201Result.err.code).to.equal('BAD_CONTENT');
    });

    it('must fail to add section-info having a bad aggrRow fn name', () => {
      const cs201Copy = structuredClone(cs201Info);
      const rowHdrs = Object.values(cs201Copy.rowHdrs);
      const hdrInfo = rowHdrs.find(h => h._tag === 'aggrRow')! as T.AggrRowHdr;
      hdrInfo.aggrFnName += X;
      const cs201Result = G.addSectionInfo(cs201Copy);
      assert(!cs201Result.isOk);
      expect(cs201Result.err.code).to.equal('BAD_CONTENT');
    });

    
  });

  describe('enrolling students', () => {

    const N_STUDENTS = 3;
    beforeEach(() => {
      for (const info of Object.values(SECTION_INFOS)) {
	const result = G.addSectionInfo(info);
	assert(result.isOk);
      }
      for (const student of STUDENTS.slice(0, N_STUDENTS)) {
	G.addStudent(student);
      }
    });

    it('must enroll valid student', () => {
      for (const sectionId of sectionIds) {
	for (const student of STUDENTS.slice(0, N_STUDENTS)) {
	  const result = G.enrollStudent(sectionId, student.id);
	  assert(result.isOk);
	}
      }
    });

    it('must fail to enroll invalid student', () => {
      for (const sectionId of sectionIds) {
	for (const student of STUDENTS.slice(0, N_STUDENTS)) {
	  const studentId = (student.id + X) as T.StudentId;
	  const result = G.enrollStudent(sectionId, studentId);
	  assert(!result.isOk);
	  expect(result.err.code).to.equal('NOT_FOUND');
	}
      }
    });

    it('must fail to enroll valid student in invalid section', () => {
      for (const k of sectionIds) {
	const sectionId = (k + X) as T.SectionId;
	for (const student of STUDENTS.slice(0, N_STUDENTS)) {
	  const studentId = (student.id + X) as T.StudentId;
	  const result = G.enrollStudent(sectionId, student.id);
	  assert(!result.isOk);
	  expect(result.err.code).to.equal('NOT_FOUND');
	}
      }
    });

  });


  describe('add score', () => {
    
    const N_STUDENTS = 3;

    const SUITE_DATA = {
      [cs201Info.id]: {
	assignId: 'prj1' as T.ColId,
	goodScore: 85 as T.Score,
	badScore: 101 as T.Score,
	wrongTypeScore: 'A' as T.Score,
      },
      [en101Info.id]: {
	assignId: 'paper1' as T.ColId,
	goodScore: 'C' as T.Score,
	badScore: 'E' as T.Score,
	wrongTypeScore: 88 as T.Score,
      }
    };
    
    beforeEach(() => {
      for (const info of Object.values(SECTION_INFOS)) {
	const result = G.addSectionInfo(info);
	assert(result.isOk);
      } 
      for (const sectionId of sectionIds) {
	for (const student of STUDENTS.slice(0, N_STUDENTS)) {
	  G.addStudent(student);
	  const result = G.enrollStudent(sectionId, student.id);
	  assert(result.isOk);
	};
      }
      G.addStudent(STUDENTS[N_STUDENTS]);
    });

    it('must add valid scores', () => {
      for (const student of STUDENTS.slice(0, N_STUDENTS)) {
	for (const sectionId of sectionIds) {
	  const {goodScore: score, assignId } = SUITE_DATA[sectionId];
	  const result = G.addScore(sectionId, student.id, assignId, score);
	  assert(result.isOk);
	}
      }
    });

    it('must fail to add score for an unknown section', () => {
      const sectionId = sectionIds[0];
      const student = STUDENTS[0];
      const {goodScore: score, assignId } = SUITE_DATA[sectionId];
      const sectionId1 = (sectionId + X) as T.SectionId;
      const result = G.addScore(sectionId1, student.id, assignId, score);
      assert(!result.isOk);
      expect(result.err.code).to.equal('NOT_FOUND');
    });

    it('must fail to add score for an unknown student', () => {
      const sectionId = sectionIds[0];
      const student = STUDENTS[0];
      const {goodScore: score, assignId } = SUITE_DATA[sectionId];
      const studentId1 = (student.id + X) as T.StudentId;
      const result = G.addScore(sectionId, studentId1, assignId, score);
      assert(!result.isOk);
      expect(result.err.code).to.equal('NOT_FOUND');
    });

    it('must fail to add score for an unknown student', () => {
      const sectionId = sectionIds[0];
      const student = STUDENTS[0];
      const {goodScore: score, assignId } = SUITE_DATA[sectionId];
      const assignId1 = (assignId + X) as T.ColId;
      const result = G.addScore(sectionId, student.id, assignId1, score);
      assert(!result.isOk);
      expect(result.err.code).to.equal('NOT_FOUND');
    });

    it('must fail to add score for an unenrolled student', () => {
      const sectionId = sectionIds[0];
      const student = STUDENTS[N_STUDENTS];
      const {goodScore: score, assignId } = SUITE_DATA[sectionId];
      const result = G.addScore(sectionId, student.id, assignId, score);
      assert(!result.isOk);
      expect(result.err.code).to.equal('BAD_CONTENT');
    });

    it('must fail to add out-of-range scores', () => {
      for (const student of STUDENTS.slice(0, N_STUDENTS)) {
	for (const sectionId of sectionIds) {
	  const {badScore: score, assignId } = SUITE_DATA[sectionId];
	  const result = G.addScore(sectionId, student.id, assignId, score);
	  assert(!result.isOk);
	  expect(result.err.code).to.equal('BAD_CONTENT');
	}
      }
    });
    
    it('must fail to add scores with the incorrect type', () => {
      for (const student of STUDENTS.slice(0, N_STUDENTS)) {
	for (const sectionId of sectionIds) {
	  const {wrongTypeScore: score, assignId } = SUITE_DATA[sectionId];
	  const result = G.addScore(sectionId, student.id, assignId, score);
	  assert(!result.isOk);
	  expect(result.err.code).to.equal('BAD_CONTENT');
	}
      }
    });
    
  });

  describe('get Entry', () => {
    
    const N_STUDENTS = 3;

    const SUITE_DATA = {
      [cs201Info.id]: {
	assignId: 'prj1' as T.ColId,
	goodScore: 85 as T.Score,
      },
      [en101Info.id]: {
	assignId: 'paper1' as T.ColId,
	goodScore: 'C' as T.Score,
      }
    };
    
    beforeEach(() => {
      for (const info of Object.values(SECTION_INFOS)) {
	const result = G.addSectionInfo(info);
	assert(result.isOk);
      } 
      for (const sectionId of sectionIds) {
	for (const student of STUDENTS.slice(0, N_STUDENTS)) {
	  G.addStudent(student);
	  const result = G.enrollStudent(sectionId, student.id);
	  assert(result.isOk);
	};
      }
      G.addStudent(STUDENTS[N_STUDENTS]);
    });

    it('must add and retrieve valid scores', () => {
      for (const student of STUDENTS.slice(0, N_STUDENTS)) {
	for (const sectionId of sectionIds) {
	  const {goodScore: score, assignId } = SUITE_DATA[sectionId];
	  const result = G.addScore(sectionId, student.id, assignId, score);
	  assert(result.isOk);
	  const entryResult = G.getEntry(sectionId, student.id, assignId);	
	  assert(entryResult.isOk);
	  expect(entryResult.val).to.equal(score);
	}
      }
    });

    it('must fail for unknown sectionIds, studentIds or assignIds', () => {
      const sectionId = sectionIds[0];
      const studentId = STUDENTS[0].id;
      const colId = SUITE_DATA[sectionId].assignId;
      const errData : [ T.SectionId, T.StudentId, T.ColId ][] = [
	[ (sectionId + X) as T.SectionId, studentId, colId ],
	[ sectionId, (studentId + X) as T.StudentId, colId ],
	[ sectionId, studentId, (colId + X) as T.ColId ],
      ];
      for (const [sectionId, studentId, assignId] of errData) {
	const result = G.getEntry(sectionId, studentId, assignId);	
	assert(!result.isOk);
	expect(result.err.code).to.equal('NOT_FOUND');
      }
    });

    it('must fail for unenrolled student', () => {
      const sectionId = sectionIds[0];
      const studentId = STUDENTS[N_STUDENTS].id;
      const assignId = SUITE_DATA[sectionId].assignId;
      const result = G.getEntry(sectionId, studentId, assignId);	
      assert(!result.isOk);
      expect(result.err.code).to.equal('BAD_CONTENT');
    });
    
  });

  describe('get section data', () => {

    beforeEach(() => {
      for (const student of STUDENTS) {
	G.addStudent(student);
      }
      for (const info of Object.values(SECTION_INFOS)) {
	const data = DATA[info.id];
	const loadResult = loadSectionData(info, data, G);
	assert(loadResult.isOk);
      }
    });

    it('must retrieve all data and aggregates', () => {
      for (const sectionId of sectionIds) {
	const data0 = DATA[sectionId];
	const dataResult = G.getSectionData(sectionId);
	assert(dataResult.isOk);
	const data1 = dataResult.val;
	for (const row0 of Object.values(data0)) {
	  const rowId = row0['id' as T.ColId] as T.RowId;
	  const row1 = data1[rowId];
	  const colIds = Object.keys(row0) as T.ColId[];
	  for (const colId of colIds) {
	    const val0 = row0[colId];
	    const val1 = row1[colId];
	    const msg = `[${sectionId}][${rowId}][${colId}]: ` +
	      `expected "${val0}"; got "${val1}"`;
	    expect(val1).to.equal(val0, msg);
	  }
	}
      }
    });

    it('must retrieve only aggregate rows', () => {
      for (const sectionId of sectionIds) {
	const info = SECTION_INFOS[sectionId];
	const rowIds = Object.values(info.rowHdrs)
	  .filter(h => h._tag === 'aggrRow')
	  .map(h => h.id);
	const data0 = DATA[sectionId];
	const dataResult = G.getSectionData(sectionId, rowIds);
	assert(dataResult.isOk);
	const data1 = dataResult.val;
	expect(Object.keys(data1)).to.have.length(rowIds.length);
	for (const row0 of Object.values(data0)) {
	  const rowId = row0['id' as T.ColId] as T.RowId;
	  if (!rowIds.includes(rowId)) continue;
	  const row1 = data1[rowId];
	  const colIds = Object.keys(row0) as T.ColId[];
	  for (const colId of colIds) {
	    const val0 = row0[colId];
	    const val1 = row1[colId];
	    const msg = `[${sectionId}][${rowId}][${colId}]: ` +
	      `expected "${val0}"; got "${val1}"`;
	    expect(val1).to.equal(val0, msg);
	  }
	}
      }
    });

    it('must retrieve only selected rows', () => {
      const nRows = 3;
      for (const sectionId of sectionIds) {
	const data0 = DATA[sectionId];
	const selRowIds = (Object.keys(data0) as T.RowId[]).slice(0, nRows);
	const dataResult = G.getSectionData(sectionId, selRowIds);
	assert(dataResult.isOk);
	const data1 = dataResult.val;
	expect(Object.keys(data1)).to.have.length(selRowIds.length);
	for (const row0 of Object.values(data0)) {
	  const rowId = row0['id' as T.ColId] as T.RowId;
	  if (!selRowIds.includes(rowId)) continue;
	  const row1 = data1[rowId];
	  const colIds = Object.keys(row0) as T.ColId[];
	  for (const colId of colIds) {
	    const val0 = row0[colId];
	    const val1 = row1[colId];
	    const msg = `[${sectionId}][${rowId}][${colId}]: ` +
	      `expected "${val0}"; got "${val1}"`;
	    expect(val1).to.equal(val0, msg);
	  }
	}
      }
    });

    it('must fail to get selected rows for unknown rowId', () => {
      const nRows = 3;
      for (const sectionId of sectionIds) {
	const data0 = DATA[sectionId];
	const selRowIds = (Object.keys(data0) as T.RowId[]).slice(0, nRows);
	selRowIds[0] = (selRowIds[0] + X) as T.RowId;
	const dataResult = G.getSectionData(sectionId, selRowIds);
	assert(!dataResult.isOk);
	expect(dataResult.err.code).to.equal('NOT_FOUND');
      }
    });
    
    it('must error on selected rows for known but unenrolled student', () => {
      const student: T.Student = {
	id: T.toStudentId('zz'), firstName: 'z', lastName: 'z'
      };
      G.addStudent(student);
      const nRows = 3;
      for (const sectionId of sectionIds) {
	const data0 = DATA[sectionId];
	const selRowIds = (Object.keys(data0) as T.RowId[]).slice(0, nRows);
	selRowIds[0] = student.id;
	const dataResult = G.getSectionData(sectionId, selRowIds);
	assert(!dataResult.isOk);
	expect(dataResult.err.code).to.equal('BAD_CONTENT');
      }
    });

    it('must retrieve only selected columns', () => {
      const nCols = 6;
      for (const sectionId of sectionIds) {
	const info = SECTION_INFOS[sectionId];
	const selColIds = Object.values(info.colHdrs)
	  .map(h => h.id)
	  .slice(0, nCols);
	const data0 = DATA[sectionId];
	const dataResult = G.getSectionData(sectionId, [], selColIds);
	assert(dataResult.isOk);
	const data1 = dataResult.val;
	Object.values(data1).forEach(row =>
	  expect(Object.keys(row)).to.have.length(selColIds.length));
	for (const row0 of Object.values(data0)) {
	  const rowId = row0['id' as T.ColId] as T.RowId;
	  const row1 = data1[rowId];
	  const colIds = Object.keys(row0) as T.ColId[];
	  for (const colId of colIds) {
	    if (!selColIds.includes(colId)) continue;
	    const val0 = row0[colId];
	    const val1 = row1[colId];
	    const msg = `[${sectionId}][${rowId}][${colId}]: ` +
	      `expected "${val0}"; got "${val1}"`;
	    expect(val1).to.equal(val0, msg);
	  }
	}
      }
    });
    
    it('must fail to get selected cols for unknown colId', () => {
      const nCols = 6;
      for (const sectionId of sectionIds) {
	const info = SECTION_INFOS[sectionId];
	const selColIds = Object.values(info.colHdrs)
	  .map(h => h.id)
	  .slice(0, nCols);
	selColIds[selColIds.length - 1] = (selColIds.at(-1) + X) as T.ColId;
	const dataResult = G.getSectionData(sectionId, [], selColIds);
	assert(!dataResult.isOk);
	expect(dataResult.err.code).to.equal('NOT_FOUND');
      }
    });

    it('must retrieve only selected rows and columns', () => {
      const nRows = 3, nCols = 6;
      for (const sectionId of sectionIds) {
	const info = SECTION_INFOS[sectionId];
	const selColIds = Object.values(info.colHdrs)
	  .map(h => h.id)
	  .slice(0, nCols);
	const data0 = DATA[sectionId];
	const selRowIds = (Object.keys(data0) as T.RowId[]).slice(0, nRows);
	const dataResult = G.getSectionData(sectionId, selRowIds, selColIds);
	assert(dataResult.isOk);
	const data1 = dataResult.val;
	expect(Object.keys(data1)).to.have.length(selRowIds.length);
	Object.values(data1).forEach(row =>
	  expect(Object.keys(row)).to.have.length(selColIds.length));
	for (const row0 of Object.values(data0)) {
	  const rowId = row0['id' as T.ColId] as T.RowId;
	  if (!selRowIds.includes(rowId)) continue;
	  const row1 = data1[rowId];
	  const colIds = Object.keys(row0) as T.ColId[];
	  for (const colId of colIds) {
	    if (!selColIds.includes(colId)) continue;
	    const val0 = row0[colId];
	    const val1 = row1[colId];
	    const msg = `[${sectionId}][${rowId}][${colId}]: ` +
	      `expected "${val0}"; got "${val1}"`;
	    expect(val1).to.equal(val0, msg);
	  }
	}
      }
    });

  });
    
  describe('get Entry for all kinds of data', () => {

    beforeEach(() => {
      for (const student of STUDENTS) {
	G.addStudent(student);
      }
      for (const info of Object.values(SECTION_INFOS)) {
	const data = DATA[info.id];
	const loadResult = loadSectionData(info, data, G);
	assert(loadResult.isOk);
      }
    });

    it('must obtain all entries for aggregate columns', () => {
      for (const sectionId of sectionIds) {
	const info = SECTION_INFOS[sectionId];
	const aggrColIds = Object.values(info.colHdrs)
	  .filter(h => h._tag === 'aggrCol')
	  .map(h => h.id);
	const data0 = DATA[sectionId];
	for (const row0 of Object.values(data0)) {
	  const rowId = row0['id' as T.ColId] as T.RowId;
	  if (!T.isStudentId(rowId)) continue;
	  for (const colId of aggrColIds) {
	    const result = G.getEntry(sectionId, rowId, colId);
	    assert(result.isOk);
	    const val0 = row0[colId];
	    const val1 = result.val;
	    const msg = `[${sectionId}][${rowId}][${colId}]:`;
	    expect(val1).to.equal(val0, msg);
	  }
	}
      }
    });

    it('must obtain all entries for aggregate rows', () => {
      for (const sectionId of sectionIds) {
	const info = SECTION_INFOS[sectionId];
	const aggrRowIds = Object.values(info.rowHdrs)
	  .filter(h => h._tag === 'aggrRow')
	  .map(h => h.id);
	const colIds = Object.values(info.colHdrs)
	  .map(h => h.id);
	const data0 = DATA[sectionId];
	for (const rowId of aggrRowIds) {
	  const row0 = data0[rowId];
	  for (const colId of colIds) {
	    const result = G.getEntry(sectionId, rowId, colId);
	    assert(result.isOk);
	    const val0 = row0[colId];
	    const val1 = result.val;
	    const msg = `[${sectionId}][${rowId}][${colId}]:`;
	    expect(val1).to.equal(val0, msg);
	  }
	}
      }
    });

    it('must obtain all raw and aggregate entries', () => {
      for (const sectionId of sectionIds) {
	const info = SECTION_INFOS[sectionId];
	const data0 = DATA[sectionId];
	for (const row0 of Object.values(data0)) {
	  const rowId = row0['id' as T.ColId] as T.RowId;
	  for (const k of Object.keys(row0)) {
	    const colId = k as T.ColId;
	    const result = G.getEntry(sectionId, rowId, colId);
	    assert(result.isOk);
	    const val0 = row0[colId];
	    const val1 = result.val;
	    const msg = `[${sectionId}][${rowId}][${colId}]:`;
	    expect(val1).to.equal(val0, msg);
	  }
	}
      }
    });
    
    
  });
  
});



