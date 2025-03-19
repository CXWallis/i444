import { Grades, Types as T, Errors as E} from './prj1-sol/main.js';
import { database_error, GradesDao } from "./grades-dao.js";
import { Err } from "./prj1-sol/lib/errors.js";

//import { GradesDao, makeGradesDao } from './grades-dao.js';

//placeholder; remove once there are no TODO's
const TODO_ERR = E.Err.err('TODO', 'TODO');

export async function makeDbGrades(dbUrl: string,
				   rowAggrFns: Record<string, T.RowAggrFn>,
				   colAggrFns: Record<string, T.ColAggrFn>)
  : Promise<E.Result<DbGrades, E.Err>>
{
  //TODO: code to create a DAO which connects to the DB.
  //TODO: code to create a cache Grades object
  //TODO: initialize cache Grades object from DB.
  const daoResult = await GradesDao.make(dbUrl);
  if (!daoResult.isOk) return daoResult;

  const dao = daoResult.val;
  const grades = new Grades(rowAggrFns, colAggrFns);

  const studentsResult = await dao.get_students();
  if (!studentsResult.isOk) return studentsResult;
  studentsResult.val.forEach(student => grades.addStudent(student));

  const sectionsResult = await dao.get_sections();
  if (!sectionsResult.isOk) return sectionsResult;

  for (const section of sectionsResult.val) {
    const infoResult = grades.addSectionInfo(section.info);
    if (!infoResult.isOk) return infoResult;

    section.enrolledStudents.forEach(studentId => {
      grades.enrollStudentNoChk(section.info.id, studentId);
    });

    Object.entries(section.scores).forEach(([studentId, scores]) => {
      Object.entries(scores).forEach(([colId, score]) => {
        grades.addScoreNoChk(section.info.id, studentId as T.StudentId, colId as T.ColId, score);
      });
    });
  }

  return E.okResult(new DbGrades(dao, grades));
}


export class DbGrades {

  constructor( private dao: GradesDao, private cache: Grades ) {}

  async close() : Promise<E.Result<void, E.Err>> {
    try {
      await this.dao.close();
      return E.okResult(undefined);
    } catch ( error ) {
      return database_error('Close', error as Error );
    }
  }

  /** Clear out all data
   *      
   *  Errors: DB if db error
   */
  async clear() : Promise<E.Result<undefined, E.Err>> {
    const result = await this.dao.clear();
    if (result.isOk) this.cache.clear();
    return result;
  }

  /** add or replace student in this Grades object. */
  async addStudent(student: T.Student): Promise<E.Result<void, E.Err>> {
    const result = await this.dao.add_student(student);
    if (result.isOk) this.cache.addStudent(student);
    return result;
  }

  /** return info for student */
  async getStudent(studentId: T.StudentId)
    : Promise<E.Result<T.Student, E.Err>>
  {
    const response = await this.cache.getStudent(studentId);
    if ( response.isOk ) return response;
    const result = await this.dao.get_student(studentId);
    if (result.isOk) this.cache.addStudent( result.val );
    return result;
  }

  /** add or replace sectionInfo in this Grades object.
   *
   * Errors:
   *   BAD_CONTENT: section contains unknown aggr function name
   */
  async addSectionInfo(sectionInfo: T.SectionInfo)
    : Promise<E.Result<void, E.Err>> 
  {
    const chk = this.cache.chkSectionInfo(sectionInfo);
    if (!chk.isOk) return chk;
    const result = await this.dao.add_section_info(sectionInfo);
    if (result.isOk) this.cache.addSectionInfoNoChk(sectionInfo);
    return result;
  }

  /** return section-info for sectionId */
  async getSectionInfo(sectionId: T.SectionId)
    : Promise<E.Result<T.SectionInfo, E.Err>>
  {
    const response = this.cache.getSectionInfo(sectionId);
    if ( response.isOk ) return response;
    const result = await this.dao.get_section(sectionId);
    if (result.isOk) this.cache.addSectionInfo( result.val );
    return response;
  }

  /** enroll student specified by studentId in section sectionId.  It is
   *  not an error if the student is already enrolled.
   *
   * Errors:
   *   NOT_FOUND: unknown sectionId or studentId.
   */
  async enrollStudent(sectionId: T.SectionId, studentId: T.StudentId) 
    : Promise<E.Result<void, E.Err>>
  {
    const chk = this.cache.chkEnrollStudent(sectionId, studentId);
    if (!chk.isOk) return chk;
    const result = await this.dao.enroll_student(sectionId, studentId);
    if (result.isOk) this.cache.enrollStudentNoChk(sectionId, studentId);
    return chk;
  }
 
  /** Return id's of all students enrolled in sectionId */
  async getEnrolledStudentIds(sectionId: T.SectionId) :
    Promise<E.Result<T.StudentId[], E.Err>>
  {
    return this.cache.getEnrolledStudentIds(sectionId);
  }
   
  /** add or replace score for studentId for assignment given by colId
   *  in section sectionId.
   *
   * Errors:
   *   NOT_FOUND: unknown sectionId, studentId or colId.
   *   BAD_CONTENT: student not enrolled in section, or colId
   *   inappropriate for score.
   */
  async addScore(sectionId: T.SectionId, studentId: T.StudentId, colId: T.ColId,
	         score: T.Score) : Promise<E.Result<void, E.Err>> {
    const chk = this.cache.chkAddScore(sectionId, studentId, colId, score);
    if (!chk.isOk) return chk;
    const result = await this.dao.add_score(sectionId, studentId, colId, score);
    if (result.isOk) this.cache.addScoreNoChk(sectionId, studentId, colId, score);
    return chk;
  }

  /** return entry at [sectionId][rowId][colId].
   *
   *  Errors:
   *    NOT_FOUND: unknown sectionId, rowId or colId.
   *    BAD_CONTENT: rowId is a studentId who is not enrolled in sectionId.
   */
  async getEntry(sectionId: T.SectionId, rowId: T.RowId, colId: T.ColId)
    : Promise<E.Result<T.Entry, E.Err>>
  {
    return this.cache.getEntry(sectionId, rowId, colId);
  }

  /** return full data (including aggregate data) for sectionId.  If
   *  rowIds is non-empty, then only the rows having those rowId's are
   *  returned.  If colIds is non-empty, then only the columns having
   *  those colId's are returned.
   *
   *  If no rowIds are specified, then the rows should be sorted by rowId,
   *  otherwise they should be in the order specified by rowIds.  If no
   *  colIds are specified, then they should be in the order specified by
   *  the sectionInfo, otherwise they should be in the order specified by
   *  colIds (ordering is possible, because JS objects preserve insertion
   *  order).
   *
   *  Note that the RowAggrFns are applied first across the rows of
   *  the table; then the ColAggrFns are applied to the columns
   *  (including AggrCols of the table.  It follows that ColAggrsFns
   *  can be applied to the result of a RowAggrFn, but RowAggrFns can
   *  never be applied to the result of a ColAggrFn.
   *
   * Errors:
   *   NOT_FOUND: unknown sectionId, rowId or colId.
   *   BAD_CONTENT: row specifies a studentId of a known but unenrolled student
   */
  async getSectionData(sectionId: T.SectionId, rowIds: T.RowId[] = [],
	  colIds: T.ColId[] = []) : Promise<E.Result<T.SectionData, E.Err>>
  {
    return this.cache.getSectionData(sectionId, rowIds, colIds);
  }


  /** Clear section sectionId; remove all grade data, enrolled students, and
   *  section-info
   *      
   *  Errors: DB: db error
   *          NOT_FOUND: unknown section-id
   */
  async rmSection(sectionId: T.SectionId) : Promise<E.Result<void, E.Err>>
  {
    const result = await this.dao.remove_section(sectionId);
    if (result.isOk) this.cache.rmSection(sectionId);
    return result;
  }

  // convenience methods

  /** method to load multiple students */
  async addStudents(students: T.Student[])
    : Promise<E.Result<undefined, E.Err>>
  {
    for (const student of students) {
      const addResult = await this.addStudent(student);
      if (!addResult.isOk) return addResult;
    }
    return E.okResult(undefined);
  }

  /** return all independent data (non-aggregate, non-student) for sectionId */
  async getRawData(sectionId: T.SectionId)
    : Promise<E.Result<T.SectionData, E.Err>>
  {
    const infoResult = await this.getSectionInfo(sectionId);
    if (!infoResult.isOk) return infoResult as E.Result<T.SectionData, E.Err>;
    const info = infoResult.val;
    const isRawColHdr = (h: T.ColHdr) =>
      (h.id === 'id') || (h._tag !== 'aggrCol' && h._tag !== 'student');
    const colIds = Object.values(info.colHdrs)
      .filter(isRawColHdr)
      .map(h => h.id);
    const studentIdsResult = await this.getEnrolledStudentIds(sectionId);
    if (!studentIdsResult.isOk) return studentIdsResult;
    const studentIds = studentIdsResult.val;
    const rowIds = [ ... studentIds ];
    return await this.getSectionData(sectionId, rowIds, colIds);
  }

  /** return a single row (including aggregates) for student studentId.
   */
  async getStudentData(sectionId: T.SectionId, studentId: T.StudentId)
    : Promise<E.Result<T.SectionData, E.Err>>
  {
    return await this.getSectionData(sectionId, [ studentId ]);
  }

  /** return all aggregate rows for sectionId */
  async getAggrRows(sectionId: T.SectionId)
    : Promise<E.Result<T.SectionData, E.Err>>
  {
    const infoResult = await this.getSectionInfo(sectionId);
    if (!infoResult.isOk) return infoResult as E.Result<T.SectionData, E.Err>;
    const info = infoResult.val;
    const rowIds = Object.values(info.rowHdrs)
      .filter(h => h._tag === 'aggrRow')
      .map(h => h.id);
    return await this.getSectionData(sectionId, rowIds);
  }


  /** Create/replace sectionInfo and sectionData.  Will enroll all
   *  students from sectionData (assumes those students already exist
   *  outside of the section).
   *
   *  Errors: NOT_FOUND, BAD_CONTENT, DB as appropriate
   */
  async loadSection(sectionInfo: T.SectionInfo, data: T.SectionData) 
    : Promise<E.Result<undefined, E.Err>> 
  {
    const sectionId = sectionInfo.id;
    const rmResult = await this.rmSection(sectionId);
    if (!rmResult.isOk && rmResult.err.code !== 'NOT_FOUND') return rmResult;
    const infoResult = await this.addSectionInfo(sectionInfo);
    if (!infoResult.isOk) return infoResult;
    for (const k of Object.keys(data)) {
      const enrollResult =
	await this.enrollStudent(sectionId, k as T.StudentId);
      if (!enrollResult.isOk) return enrollResult;
    }
    for (const k of Object.keys(data)) {
      const studentId = k as T.StudentId;
      const row = data[studentId];
      for (const c of Object.keys(row)) {
	const assignId = c as T.ColId;
	const score = row[assignId] as T.Score;
	const scoreResult =
	  await this.addScore(sectionId, studentId, assignId, score);
	if (!scoreResult.isOk) return scoreResult;
      }
    }
    return E.okResult(undefined);
  }
  
}

//TODO: add local functions, types or data
