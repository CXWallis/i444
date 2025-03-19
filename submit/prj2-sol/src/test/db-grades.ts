//will run the project DAO using an in-memory mongodb server
import { MemDbServer, startMemDbServer } from './mem-db-server.js';

import { DbGrades, makeDbGrades} from '../lib/db-grades.js';

import {
  Types as T,
  Errors as E,
  AggrFns as F,
  Infos as SECTION_INFOS,
  Data as DATA,
  FullData as FULL_DATA,
  Students as STUDENTS,
}  from '../lib/prj1-sol/main.js';

import { assert, expect } from 'chai';

const cs201Info = SECTION_INFOS.cs201;
const en101Info = SECTION_INFOS.en101;

//suffix used to make some data bad
const X = 'xxx';

describe('DB Grades', () => {

  //mocha will run beforeEach() before each test to set up these variables
  let memDbServer: MemDbServer;
  let G: DbGrades
  let sectionIds: T.SectionId[];
  
  beforeEach(async function () {
    sectionIds = Object.keys(DATA) as T.SectionId[];
    memDbServer = await startMemDbServer();
    const dbResult =
      await makeDbGrades(memDbServer.uri, F.rowAggrFns, F.colAggrFns);    
    assert(dbResult.isOk);
    G = dbResult.val;
  });

  //mocha runs this after each test; we use this to clean up the DAO.
  afterEach(async function () {
    const closeResult = await G.close();
    assert(closeResult.isOk);
    memDbServer.stop();
    
  });

  describe('global students', () => {

    it('must retrieve all added students but not retrieve bad students',
       async () => {
      for (const student of STUDENTS) {
	await G.addStudent(student);
      }
      for (const student of STUDENTS) {
	const result0 = await G.getStudent(student.id);
	assert(result0.isOk);
	expect(result0.val).to.deep.equal(student);
	const result1 = await G.getStudent(T.toStudentId(student.id + X));
	assert(!result1.isOk);
	expect(result1.err.code).equal('NOT_FOUND');
      }
    });

    it('must add and retrieve nully student', async () => {
      const studentId = T.toStudentId('null');
      const student = { id: studentId, firstName: 'null', lastName: 'null' };
      await G.addStudent(student);
      const result1 = await G.getStudent(studentId);
      assert(result1.isOk);
      const student1 = result1.val;
      expect(student1).to.deep.equal(student);
      for (const k of ['id', 'firstName', 'lastName'] as (keyof T.Student)[]) {
	expect(typeof student1[k]).to.equal('string');
      }
    });
    
  });

  describe('adding sectionInfo', () => {

    it('must add section-info\'s', async () => {
      for (const info of Object.values(SECTION_INFOS)) {
	const result = await G.addSectionInfo(info);
	assert(result.isOk);
      }
      for (const k of Object.keys(SECTION_INFOS)) {
	const sectionId = k as T.SectionId;
	const result = await G.getSectionInfo(sectionId);
	assert(result.isOk);
	expect(result.val).to.deep.equal(SECTION_INFOS[sectionId]);
      }
    });

    it('must fail to add section-info having a bad aggrCol fn', async () => {
      const cs201Copy = structuredClone(cs201Info);
      const colHdrs = Object.values(cs201Copy.colHdrs);
      const hdrInfo = colHdrs.find(h => h._tag === 'aggrCol')! as T.AggrColHdr;
      hdrInfo.aggrFnName += X;
      const cs201Result = await G.addSectionInfo(cs201Copy);
      assert(!cs201Result.isOk);
      expect(cs201Result.err.code).to.equal('BAD_CONTENT');
    });

    it('must fail to add section-info having a bad aggrRow fn', async () => {
      const cs201Copy = structuredClone(cs201Info);
      const rowHdrs = Object.values(cs201Copy.rowHdrs);
      const hdrInfo = rowHdrs.find(h => h._tag === 'aggrRow')! as T.AggrRowHdr;
      hdrInfo.aggrFnName += X;
      const cs201Result = await G.addSectionInfo(cs201Copy);
      assert(!cs201Result.isOk);
      expect(cs201Result.err.code).to.equal('BAD_CONTENT');
    });

    
  });

  describe('enrolling students', () => {

    const N_STUDENTS = 3;
    beforeEach(async () => {
      for (const info of Object.values(SECTION_INFOS)) {
	const result = await G.addSectionInfo(info);
	assert(result.isOk);
      }
      for (const student of STUDENTS.slice(0, N_STUDENTS)) {
	await G.addStudent(student);
      }
    });

    it('must enroll valid students', async () => {
      const students = STUDENTS.slice(0, N_STUDENTS);
      const studentIds0 = students.map(s => s.id).sort();
      for (const sectionId of sectionIds) {
	for (const student of students) {
	  const result = await G.enrollStudent(sectionId, student.id);
	  assert(result.isOk);
	}
	const result = await G.getEnrolledStudentIds(sectionId);
	assert(result.isOk);
	const studentIds1 = result.val.sort();
	expect(studentIds1).to.deep.equal(studentIds0);
      }
    });

    it('must fail to enroll invalid student', async () => {
      for (const sectionId of sectionIds) {
	for (const student of STUDENTS.slice(0, N_STUDENTS)) {
	  const studentId = (student.id + X) as T.StudentId;
	  const result = await G.enrollStudent(sectionId, studentId);
	  assert(!result.isOk);
	  expect(result.err.code).to.equal('NOT_FOUND');
	}
      }
    });

    it('must fail to enroll valid student in invalid section', async () => {
      for (const k of sectionIds) {
	const sectionId = (k + X) as T.SectionId;
	for (const student of STUDENTS.slice(0, N_STUDENTS)) {
	  const studentId = (student.id + X) as T.StudentId;
	  const result = await G.enrollStudent(sectionId, student.id);
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
    
    beforeEach(async () => {
      for (const info of Object.values(SECTION_INFOS)) {
	const result = await G.addSectionInfo(info);
	assert(result.isOk);
      } 
      for (const sectionId of sectionIds) {
	for (const student of STUDENTS.slice(0, N_STUDENTS)) {
	  await G.addStudent(student);
	  const result = await G.enrollStudent(sectionId, student.id);
	  assert(result.isOk);
	};
      }
      await G.addStudent(STUDENTS[N_STUDENTS]);
    });

    it('must add valid scores', async () => {
      for (const student of STUDENTS.slice(0, N_STUDENTS)) {
	for (const sectionId of sectionIds) {
	  const {goodScore: score, assignId } = SUITE_DATA[sectionId];
	  const result =
	    await G.addScore(sectionId, student.id, assignId, score);
	  assert(result.isOk);
	}
      }
    });


    it('must fail to add score for an unknown section', async () => {
      const sectionId = sectionIds[0];
      const student = STUDENTS[0];
      const {goodScore: score, assignId } = SUITE_DATA[sectionId];
      const sectionId1 = (sectionId + X) as T.SectionId;
      const result = await G.addScore(sectionId1, student.id, assignId, score);
      assert(!result.isOk);
      expect(result.err.code).to.equal('NOT_FOUND');
    });

    it('must fail to add score for an unknown student', async () => {
      const sectionId = sectionIds[0];
      const student = STUDENTS[0];
      const {goodScore: score, assignId } = SUITE_DATA[sectionId];
      const studentId1 = (student.id + X) as T.StudentId;
      const result = await G.addScore(sectionId, studentId1, assignId, score);
      assert(!result.isOk);
      expect(result.err.code).to.equal('NOT_FOUND');
    });

    it('must fail to add score for an unknown student', async () => {
      const sectionId = sectionIds[0];
      const student = STUDENTS[0];
      const {goodScore: score, assignId } = SUITE_DATA[sectionId];
      const assignId1 = (assignId + X) as T.ColId;
      const result = await G.addScore(sectionId, student.id, assignId1, score);
      assert(!result.isOk);
      expect(result.err.code).to.equal('NOT_FOUND');
    });

    it('must fail to add score for an unenrolled student', async () => {
      const sectionId = sectionIds[0];
      const student = STUDENTS[N_STUDENTS];
      const {goodScore: score, assignId } = SUITE_DATA[sectionId];
      const result = await G.addScore(sectionId, student.id, assignId, score);
      assert(!result.isOk);
      expect(result.err.code).to.equal('BAD_CONTENT');
    });

    it('must fail to add out-of-range scores', async () => {
      for (const student of STUDENTS.slice(0, N_STUDENTS)) {
	for (const sectionId of sectionIds) {
	  const {badScore: score, assignId } = SUITE_DATA[sectionId];
	  const result =
	    await G.addScore(sectionId, student.id, assignId, score);
	  assert(!result.isOk);
	  expect(result.err.code).to.equal('BAD_CONTENT');
	}
      }
    });
    
    it('must fail to add scores with the incorrect type', async () => {
      for (const student of STUDENTS.slice(0, N_STUDENTS)) {
	for (const sectionId of sectionIds) {
	  const {wrongTypeScore: score, assignId } = SUITE_DATA[sectionId];
	  const result =
	    await G.addScore(sectionId, student.id, assignId, score);
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
    
    beforeEach(async () => {
      for (const info of Object.values(SECTION_INFOS)) {
	const result = await G.addSectionInfo(info);
	assert(result.isOk);
      } 
      for (const sectionId of sectionIds) {
	for (const student of STUDENTS.slice(0, N_STUDENTS)) {
	  await G.addStudent(student);
	  const result = await G.enrollStudent(sectionId, student.id);
	  assert(result.isOk);
	};
      }
      await G.addStudent(STUDENTS[N_STUDENTS]);
    });

    it('must add and retrieve valid scores', async () => {
      for (const student of STUDENTS.slice(0, N_STUDENTS)) {
	for (const sectionId of sectionIds) {
	  const {goodScore: score, assignId } = SUITE_DATA[sectionId];
	  const result = await G.addScore(sectionId, student.id, assignId, score);
	  assert(result.isOk);
	  const entryResult = await G.getEntry(sectionId, student.id, assignId);	
	  assert(entryResult.isOk);
	  expect(entryResult.val).to.equal(score);
	}
      }
    });

    it('must fail for unknown sectionIds, studentIds or assignIds', async () => {
      const sectionId = sectionIds[0];
      const studentId = STUDENTS[0].id;
      const colId = SUITE_DATA[sectionId].assignId;
      const errData : [ T.SectionId, T.StudentId, T.ColId ][] = [
	[ (sectionId + X) as T.SectionId, studentId, colId ],
	[ sectionId, (studentId + X) as T.StudentId, colId ],
	[ sectionId, studentId, (colId + X) as T.ColId ],
      ];
      for (const [sectionId, studentId, assignId] of errData) {
	const result = await G.getEntry(sectionId, studentId, assignId);	
	assert(!result.isOk);
	expect(result.err.code).to.equal('NOT_FOUND');
      }
    });

    it('must fail for unenrolled student', async () => {
      const sectionId = sectionIds[0];
      const studentId = STUDENTS[N_STUDENTS].id;
      const assignId = SUITE_DATA[sectionId].assignId;
      const result = await G.getEntry(sectionId, studentId, assignId);	
      assert(!result.isOk);
      expect(result.err.code).to.equal('BAD_CONTENT');
    });
    
  });

  describe('get section data', () => {

    beforeEach(async () => {
      for (const student of STUDENTS) {
	await G.addStudent(student);
      }
      for (const info of Object.values(SECTION_INFOS)) {
	const data = DATA[info.id];
	const loadResult = await G.loadSection(info, data);
	assert(loadResult.isOk);
      }
    });

    it('must retrieve all data and aggregates', async () => {
      for (const sectionId of sectionIds) {
	const data0 = FULL_DATA[sectionId];
	const dataResult = await G.getSectionData(sectionId);
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

    it('must retrieve only aggregate rows', async () => {
      for (const sectionId of sectionIds) {
	const info = SECTION_INFOS[sectionId];
	const rowIds = Object.values(info.rowHdrs)
	  .filter(h => h._tag === 'aggrRow')
	  .map(h => h.id);
	const data0 = FULL_DATA[sectionId];
	const dataResult = await G.getSectionData(sectionId, rowIds);
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

    it('must retrieve only selected rows', async () => {
      const nRows = 3;
      for (const sectionId of sectionIds) {
	const data0 = FULL_DATA[sectionId];
	const selRowIds = (Object.keys(data0) as T.RowId[]).slice(0, nRows);
	const dataResult = await G.getSectionData(sectionId, selRowIds);
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

    it('must fail to get selected rows for unknown rowId', async () => {
      const nRows = 3;
      for (const sectionId of sectionIds) {
	const data0 = FULL_DATA[sectionId];
	const selRowIds = (Object.keys(data0) as T.RowId[]).slice(0, nRows);
	selRowIds[0] = (selRowIds[0] + X) as T.RowId;
	const dataResult = await G.getSectionData(sectionId, selRowIds);
	assert(!dataResult.isOk);
	expect(dataResult.err.code).to.equal('NOT_FOUND');
      }
    });
    
    it('must error on selected rows for known but unenrolled student',
       async () => {
	 const student: T.Student = {
	   id: T.toStudentId('zz'), firstName: 'z', lastName: 'z'
	 };
	 await G.addStudent(student);
	 const nRows = 3;
	 for (const sectionId of sectionIds) {
	   const data0 = FULL_DATA[sectionId];
	   const selRowIds = (Object.keys(data0) as T.RowId[]).slice(0, nRows);
	   selRowIds[0] = student.id;
	   const dataResult = await G.getSectionData(sectionId, selRowIds);
	   assert(!dataResult.isOk);
	   expect(dataResult.err.code).to.equal('BAD_CONTENT');
	 }
       });

    it('must retrieve only selected columns', async () => {
      const nCols = 6;
      for (const sectionId of sectionIds) {
	const info = SECTION_INFOS[sectionId];
	const selColIds = Object.values(info.colHdrs)
	  .map(h => h.id)
	  .slice(0, nCols);
	const data0 = FULL_DATA[sectionId];
	const dataResult = await G.getSectionData(sectionId, [], selColIds);
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
    
    it('must fail to get selected cols for unknown colId', async () => {
      const nCols = 6;
      for (const sectionId of sectionIds) {
	const info = SECTION_INFOS[sectionId];
	const selColIds = Object.values(info.colHdrs)
	  .map(h => h.id)
	  .slice(0, nCols);
	selColIds[selColIds.length - 1] = (selColIds.at(-1) + X) as T.ColId;
	const dataResult = await G.getSectionData(sectionId, [], selColIds);
	assert(!dataResult.isOk);
	expect(dataResult.err.code).to.equal('NOT_FOUND');
      }
    });

    it('must retrieve only selected rows and columns', async () => {
      const nRows = 3, nCols = 6;
      for (const sectionId of sectionIds) {
	const info = SECTION_INFOS[sectionId];
	const selColIds = Object.values(info.colHdrs)
	  .map(h => h.id)
	  .slice(0, nCols);
	const data0 = FULL_DATA[sectionId];
	const selRowIds = (Object.keys(data0) as T.RowId[]).slice(0, nRows);
	const dataResult = await G.getSectionData(sectionId, selRowIds, selColIds);
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

    beforeEach(async () => {
      for (const student of STUDENTS) {
	await G.addStudent(student);
      }
      for (const info of Object.values(SECTION_INFOS)) {
	const data = DATA[info.id];
	const loadResult = await G.loadSection(info, data);
	assert(loadResult.isOk);
      }
    });

    it('must obtain all entries for aggregate columns', async () => {
      for (const sectionId of sectionIds) {
	const info = SECTION_INFOS[sectionId];
	const aggrColIds = Object.values(info.colHdrs)
	  .filter(h => h._tag === 'aggrCol')
	  .map(h => h.id);
	const data0 = FULL_DATA[sectionId];
	for (const row0 of Object.values(data0)) {
	  const rowId = row0['id' as T.ColId] as T.RowId;
	  if (!T.isStudentId(rowId)) continue;
	  for (const colId of aggrColIds) {
	    const result = await G.getEntry(sectionId, rowId, colId);
	    assert(result.isOk);
	    const val0 = row0[colId];
	    const val1 = result.val;
	    const msg = `[${sectionId}][${rowId}][${colId}]:`;
	    expect(val1).to.equal(val0, msg);
	  }
	}
      }
    });

    it('must obtain all entries for aggregate rows', async () => {
      for (const sectionId of sectionIds) {
	const info = SECTION_INFOS[sectionId];
	const aggrRowIds = Object.values(info.rowHdrs)
	  .filter(h => h._tag === 'aggrRow')
	  .map(h => h.id);
	const colIds = Object.values(info.colHdrs)
	  .map(h => h.id);
	const data0 = FULL_DATA[sectionId];
	for (const rowId of aggrRowIds) {
	  const row0 = data0[rowId];
	  for (const colId of colIds) {
	    const result = await G.getEntry(sectionId, rowId, colId);
	    assert(result.isOk);
	    const val0 = row0[colId];
	    const val1 = result.val;
	    const msg = `[${sectionId}][${rowId}][${colId}]:`;
	    expect(val1).to.equal(val0, msg);
	  }
	}
      }
    });

    it('must obtain all raw and aggregate entries', async () => {
      for (const sectionId of sectionIds) {
	const info = SECTION_INFOS[sectionId];
	const data0 = FULL_DATA[sectionId];
	for (const row0 of Object.values(data0)) {
	  const rowId = row0['id' as T.ColId] as T.RowId;
	  for (const k of Object.keys(row0)) {
	    const colId = k as T.ColId;
	    const result = await G.getEntry(sectionId, rowId, colId);
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

  describe('get raw data', () => {

    beforeEach(async () => {
      for (const student of STUDENTS) {
	await G.addStudent(student);
      }
      for (const info of Object.values(SECTION_INFOS)) {
	const data = DATA[info.id];
	const loadResult = await G.loadSection(info, data);
	assert(loadResult.isOk);
      }
    });

    it('must retrieve all raw data', async () => {
      for (const sectionId of sectionIds) {
	const data0 = DATA[sectionId];
	const dataResult = await G.getRawData(sectionId);
	assert(dataResult.isOk);
	const data1 = dataResult.val;
	for (const [id, row0] of Object.entries(data0)) {
	  const rowId = id as T.RowId;
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

    it('must error on bad section-id for raw data', async () => {
      for (const sectionId of sectionIds) {
	const dataResult = await G.getRawData((sectionId + X) as T.SectionId);
	assert(!dataResult.isOk);
	expect(dataResult.err.code).to.equal('NOT_FOUND');
      }
    });
    
  });

  describe('get single student data', () => {

    beforeEach(async () => {
      for (const student of STUDENTS) {
	await G.addStudent(student);
      }
      for (const info of Object.values(SECTION_INFOS)) {
	const data = DATA[info.id];
	const loadResult = await G.loadSection(info, data);
	assert(loadResult.isOk);
      }
    });

    const N_STUDENTS = 3;

    it('must retrieve single student data', async () => {
      for (const sectionId of sectionIds) {
	const data0 = FULL_DATA[sectionId];
	for (const sId of Object.keys(DATA[sectionId]).slice(0, N_STUDENTS)) {
	  const studentId = sId as T.StudentId;
	  const dataResult =
	    await G.getStudentData(sectionId, studentId);
	  assert(dataResult.isOk);
	  const data1 = dataResult.val;
	  expect(Object.keys(data1)).to.have.length(1);
	  const row0 = data0[studentId];
	  const row1 = data1[studentId];
	  const colIds = Object.keys(row0) as T.ColId[];
	  for (const colId of colIds) {
	    const val0 = row0[colId];
	    const val1 = row1[colId];
	    const msg = `[${sectionId}][${studentId}][${colId}]: ` +
	      `expected "${val0}"; got "${val1}"`;
	    expect(val1).to.equal(val0, msg);
	  }
	}
      }
    });


    it('must error on bad section-id for student data', async () => {
      for (const sectionId of sectionIds) {
	const dataResult =await G.getStudentData((sectionId + X) as T.SectionId,
						 STUDENTS[0].id);
	assert(!dataResult.isOk);
	expect(dataResult.err.code).to.equal('NOT_FOUND');
      }
    });
    
  });

  describe('get aggr rows', () => {

    beforeEach(async () => {
      for (const student of STUDENTS) {
	await G.addStudent(student);
      }
      for (const info of Object.values(SECTION_INFOS)) {
	const data = DATA[info.id];
	const loadResult = await G.loadSection(info, data);
	assert(loadResult.isOk);
      }
    });

    it('must retrieve aggr rows', async () => {
      for (const sectionId of sectionIds) {
	const data0 = FULL_DATA[sectionId];
	const aggrRowIds = Object.values(SECTION_INFOS[sectionId].rowHdrs)
	  .filter(h => h._tag === 'aggrRow')
	  .map(h => h.id);
	const dataResult = await G.getAggrRows(sectionId);
	assert(dataResult.isOk);
	const data1 = dataResult.val;
	for (const id of aggrRowIds) {
	  const rowId = id as T.RowId;
	  const row0 = data0[rowId];
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

    it('must error on bad section-id for aggr rows', async () => {
      for (const sectionId of sectionIds) {
	const dataResult = await G.getAggrRows((sectionId + X) as T.SectionId);
	assert(!dataResult.isOk);
	expect(dataResult.err.code).to.equal('NOT_FOUND');
      }
    });
    
  });
  
});


describe('DB Grades persistence', () => {

  //mocha will run beforeEach() before each test to set up these variables
  let memDbServer : MemDbServer;
  let sectionIds: T.SectionId[];
  
  
  beforeEach(async function () {
    sectionIds = Object.keys(DATA) as T.SectionId[];
    memDbServer = await startMemDbServer();
  });

  //mocha runs this after each test; we use this to clean up the server.
  afterEach(async function () {
    await memDbServer.stop();
  });

  it('must persist students', async () => {
    const uri = memDbServer.uri;
    const dbResult0 = await makeDbGrades(uri, F.rowAggrFns, F.colAggrFns);
    assert(dbResult0.isOk, 'db0 failed');
    const db0 = dbResult0.val;
    for (const student of STUDENTS) {
      const addResult = await db0.addStudent(student);
      assert(addResult.isOk);
    }
    const closeResult0 = await db0.close();
    assert(closeResult0.isOk, 'close0 failed');
    
    const dbResult1 = await makeDbGrades(uri, F.rowAggrFns, F.colAggrFns);
    assert(dbResult1.isOk, 'db1 failed');
    const db1 = dbResult1.val;
    for (const student of STUDENTS) {
      const getResult = await db1.getStudent(student.id);
      assert(getResult.isOk);
      expect(getResult.val).to.deep.equal(student);
    }
    const closeResult1 = await db1.close();
    assert(closeResult1.isOk, 'close1 failed');
  });

  it('must persist nully student', async () => {
    const uri = memDbServer.uri;
    const dbResult0 = await makeDbGrades(uri, F.rowAggrFns, F.colAggrFns);
    assert(dbResult0.isOk, 'db0 failed');
    const db0 = dbResult0.val;
    const nullId = T.toStudentId('null');
    const student: T.Student = {
      id: nullId, firstName: 'null', lastName: 'null',
    };
    const addResult = await db0.addStudent(student);
    assert(addResult.isOk);
    const closeResult0 = await db0.close();
    assert(closeResult0.isOk, 'close0 failed');
    
    const dbResult1 = await makeDbGrades(uri, F.rowAggrFns, F.colAggrFns);
    assert(dbResult1.isOk, 'db1 failed');
    const db1 = dbResult1.val;
    const getResult = await db1.getStudent(nullId);
    assert(getResult.isOk);
    expect(getResult.val).to.deep.equal(student);
    for (const k of ['id', 'firstName', 'lastName' ] as (keyof T.Student)[]) {
      expect(typeof student[k]).to.equal('string');
    }
    const closeResult1 = await db1.close();
    assert(closeResult1.isOk, 'close1 failed');
  });

  
  it('must persist section-info', async () => {
    const uri = memDbServer.uri;
    const dbResult0 = await makeDbGrades(uri, F.rowAggrFns, F.colAggrFns);
    assert(dbResult0.isOk, 'db0 failed');
    const db0 = dbResult0.val;
    for (const info of Object.values(SECTION_INFOS)) {
      const addResult = await db0.addSectionInfo(info);
      assert(addResult.isOk);
    }
    const closeResult0 = await db0.close();
    assert(closeResult0.isOk, 'close0 failed');
    
    const dbResult1 = await makeDbGrades(uri, F.rowAggrFns, F.colAggrFns);
    assert(dbResult1.isOk, 'db1 failed');
    const db1 = dbResult1.val;
    for (const id of Object.keys(SECTION_INFOS)) {
      const sectionId = id as T.SectionId;
      const infoResult = await db1.getSectionInfo(sectionId);
      assert(infoResult.isOk);
      expect(infoResult.val).to.deep.equal(SECTION_INFOS[sectionId]);
    }
    const closeResult1 = await db1.close();
    assert(closeResult1.isOk, 'close1 failed');
  });

  it('must persist student, section-info and data', async () => {
    const uri = memDbServer.uri;
    const dbResult0 = await makeDbGrades(uri, F.rowAggrFns, F.colAggrFns);
    assert(dbResult0.isOk, 'db0 failed');
    const db0 = dbResult0.val;
    for (const student of STUDENTS) {
      const addResult = await db0.addStudent(student);
      assert(addResult.isOk);
    }
    for (const sectionId of sectionIds) {
      const loadResult =
	await db0.loadSection(SECTION_INFOS[sectionId], DATA[sectionId]);
      assert(loadResult.isOk);
    }
    const closeResult0 = await db0.close();
    assert(closeResult0.isOk, 'close0 failed');
    
    const dbResult1 = await makeDbGrades(uri, F.rowAggrFns, F.colAggrFns);
    assert(dbResult1.isOk, 'db1 failed');
    const db1 = dbResult1.val;
    for (const student of STUDENTS) {
      const getResult = await db1.getStudent(student.id);
      assert(getResult.isOk);
      expect(getResult.val).to.deep.equal(student);
    }
    for (const sectionId of sectionIds) {
      const infoResult = await db1.getSectionInfo(sectionId);
      assert(infoResult.isOk);
      expect(infoResult.val).to.deep.equal(SECTION_INFOS[sectionId]);
      const dataResult = await db1.getRawData(sectionId);
      assert(dataResult.isOk);
      //insert id into DATA
      const dataIdRows = Object.entries(DATA[sectionId])
        .map(([id, row]) => [id, {id, ...row}]);
      const data = Object.fromEntries(dataIdRows);
      expect(dataResult.val).to.deep.equal(data);
    }
    const closeResult1 = await db1.close();
    assert(closeResult1.isOk, 'close1 failed');
  });

  
});
    




