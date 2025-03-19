import * as T from './types.js';
import * as E from './errors.js';

// application error codes are defined so that they can be mapped to
// meaningful HTTP 4xx error codes.  In particular, 400 BAD REQUEST,
// 404 NOT FOUND, 409 CONFLICT and 422 UNPROCESSABLE CONTENT.

// note that mutable methods M() make two additional methods available:
//  chkM():   just validates parameters without doing any updates
//  MNoChk(): updates without any validation.

/** store grades for multiple sections */
export default class Grades  {

  private readonly rowAggrFns: Record<string, T.RowAggrFn>;
  private readonly colAggrFns: Record<string, T.ColAggrFn>;
  private readonly sections: Record<T.SectionId, Section>;
  private readonly students: Record<T.StudentId, T.Student>;

  constructor(rowAggrFns: Record<string, T.RowAggrFn>,
	      colAggrFns: Record<string, T.ColAggrFn>) {
    this.rowAggrFns = { ... rowAggrFns };
    this.colAggrFns = { ... colAggrFns };
    this.sections = {};
    this.students = {};
  }

  /** add or replace student in this Grades object. */
  addStudent(student: T.Student) {
    this.students[student.id] = structuredClone(student);
  }

  /** verify whether aggrFnNames in sectionInfo are valid.
   *      
   * Errors:
   *   BAD_CONTENT: section contains unknown aggr function name
   */
  chkSectionInfo(sectionInfo: T.SectionInfo) : E.Result<void, E.Err> {
    const badRowAggrFnNames =
      Object.values(sectionInfo.colHdrs)
	.filter(h => h._tag === 'aggrCol')
        .map(h => h.aggrFnName)
	.filter(fnName => !this.rowAggrFns[fnName]);
    const badColAggrFnNames =
      Object.values(sectionInfo.rowHdrs)
	.filter(h => h._tag === 'aggrRow')
        .map(h => h.aggrFnName)
	.filter(fnName => !this.colAggrFns[fnName]);
    if (badRowAggrFnNames.length === 0 && badColAggrFnNames.length === 0) {
      return E.okResult(undefined);
    }
    else {
      const badFnNames = badRowAggrFnNames.concat(badColAggrFnNames).join(', ');
      const msg = `unknown aggr-fn ${badFnNames}`;
      return E.errResult(E.Err.err(msg, 'BAD_CONTENT'));
    }
  }

  /** add or replace already validated sectionInfo in this Grades object. */
  addSectionInfoNoChk(sectionInfo: T.SectionInfo) {
    console.assert(this.chkSectionInfo(sectionInfo).isOk);
    const sectionInfo1 = structuredClone(sectionInfo);
    const colHdrsList: ColHdr[] = Object.values(sectionInfo1.colHdrs)
      .map(h => h._tag === 'aggrCol'
  	        ? { ...h, aggrFn: this.rowAggrFns[h.aggrFnName] }
	        : h);
    const colHdrs = Object.fromEntries(colHdrsList.map(h => [h.id, h]));
    const rowHdrsList: RowHdr[] = Object.values(sectionInfo1.rowHdrs)
      .map(h => ({ ...h, aggrFn: this.colAggrFns[h.aggrFnName] }));
    const rowHdrs = Object.fromEntries(rowHdrsList.map(h => [h.id, h]));
    const newSectionInfo: SectionInfo = { ...sectionInfo1, colHdrs, rowHdrs };
    const data = this.sections[sectionInfo.id]?.data ?? {};
    const studentIds = this.sections[sectionInfo.id]?.studentIds ??
      new Set<T.StudentId>();
    this.sections[sectionInfo.id] = {
      info0: structuredClone(sectionInfo),
      info: newSectionInfo,
      studentIds,
      data,
      hasAggregates: false,
    };
  }
  
  /** add or replace sectionInfo in this Grades object.
   *
   * Errors:
   *   BAD_CONTENT: section contains unknown aggr function name
   */
  addSectionInfo(sectionInfo: T.SectionInfo) : E.Result<void, E.Err> {
    const chkResult = this.chkSectionInfo(sectionInfo);
    if (!chkResult.isOk) return chkResult;
    this.addSectionInfoNoChk(sectionInfo);
    return E.okResult(undefined);
  }

  /** validate sectionId and studentId.  Not an error if
   *  already enrolled.
   *
   * Errors:
   *   NOT_FOUND: unknown sectionId or studentId.
   */
  chkEnrollStudent(sectionId: T.SectionId, studentId: T.StudentId) 
    : E.Result<void, E.Err> 
  {
    return this.chkIds(sectionId, studentId);
  }

  /** enroll student specified by studentId in section sectionId.
   *  Assume already validated. 
   */
  enrollStudentNoChk(sectionId: T.SectionId, studentId: T.StudentId) {
    console.assert(this.chkEnrollStudent(sectionId, studentId).isOk);
    const section = this.sections[sectionId]!;
    const student = this.students[studentId]!;
    section.studentIds.add(studentId);
    const row = section.data[studentId] ??= {['id' as T.ColId]: studentId};
    Object.values(this.sections[sectionId].info.colHdrs)
      .filter(h => h._tag === 'student')
      .forEach(h => row[h.id] = student[h.key]);
    section.hasAggregates = false;
  }

  /** enroll student specified by studentId in section sectionId.  It is
   *  not an error if the student is already enrolled.
   *
   * Errors:
   *   NOT_FOUND: unknown sectionId or studentId.
   */
  enrollStudent(sectionId: T.SectionId, studentId: T.StudentId) 
    : E.Result<void, E.Err> 
  {
    const chkResult = this.chkEnrollStudent(sectionId, studentId);
    if (!chkResult.isOk) return chkResult;
    this.enrollStudentNoChk(sectionId, studentId);
    return E.okResult(undefined);
  }

  /** Check score for studentId for assignment given by colId in
   *  section sectionId.
   *
   * Errors:
   *   NOT_FOUND: unknown sectionId, studentId or colId.
   *   BAD_CONTENT: student not enrolled in section, or colId
   *   inappropriate for score.
   */
  chkAddScore(sectionId: T.SectionId, studentId: T.StudentId, colId: T.ColId,
	      score: T.Score) : E.Result<void, E.Err> {
    const chkResult = this.chkIds(sectionId, studentId, colId);
    if (!chkResult.isOk) return chkResult;
    const section = this.sections[sectionId]!;
    if (studentId && !section.studentIds.has(studentId)) {
      const msg = `student "${studentId}" not enrolled in "${sectionId}"`;
      return E.errResult(E.Err.err(msg, 'BAD_CONTENT'));
    }
    const colHdr = section.info.colHdrs[colId]!;
    const colTag = colHdr._tag;
    const isErr =
      (colTag === 'numScore') ? score !== null && typeof score !== 'number'
    : (colTag === 'textScore') ? score !== null && typeof score !== 'string'
    : true;
    if (isErr) {
      const msg = `column "${colId}" inappropriate for score "${score}"`;
      return E.errResult(E.Err.err(msg, 'BAD_CONTENT'));
    }
    if (score !== null) {
      if (colTag === 'numScore') {
	const val = score as number;
	if (val < colHdr.min || val > colHdr.max) {
	  const msg = `bad score "${score}";`
	    + `must be between ${colHdr.min} and ${colHdr.max}`;
	  return E.errResult(E.Err.err(msg, 'BAD_CONTENT'));
	}
      }
      if (colTag === 'textScore') {
	const val = score as string;
	if (!colHdr.vals.includes(val)) {
	  const msg = `bad score "${score}";`
	    + `must be one of ${colHdr.vals.join(', ')}`;
	  return E.errResult(E.Err.err(msg, 'BAD_CONTENT'));
	}
      }
    }
    return E.okResult(undefined);
  }


  /** add already validated score for student studentId and assignment
   * colId to section sectionId.
   */
  addScoreNoChk(sectionId: T.SectionId, studentId: T.StudentId, colId: T.ColId,
		score: T.Score)
  {
    console.assert(this.chkAddScore(sectionId, studentId, colId, score).isOk);
    const section = this.sections[sectionId];
    section.data[studentId][colId] = score;
    section.hasAggregates = false;
  }
  
  /** add or replace score for studentId for assignment given by colId
   *  in section sectionId.
   *
   * Errors:
   *   NOT_FOUND: unknown sectionId, studentId or colId.
   *   BAD_CONTENT: student not enrolled in section, or colId
   *   inappropriate for score.
   */
  addScore(sectionId: T.SectionId, studentId: T.StudentId, colId: T.ColId,
	   score: T.Score) : E.Result<void, E.Err> {
    const chkResult = this.chkAddScore(sectionId, studentId, colId, score);
    if (!chkResult.isOk) return chkResult;
    this.addScoreNoChk(sectionId, studentId, colId, score);
    return E.okResult(undefined);
  }

  /** return entry at [sectionId][rowId][colId].
   *
   *  Errors:
   *    NOT_FOUND: unknown sectionId, rowId or colId.
   *    BAD_CONTENT: rowId is a studentId who is not enrolled in sectionId.
   */
  getEntry(sectionId: T.SectionId, rowId: T.RowId, colId: T.ColId)
    : E.Result<T.Entry, E.Err> 
  {
    const isStudentId = T.isStudentId(rowId);
    const studentIdParam = isStudentId ? rowId as T.StudentId : undefined;
    const chkResult = this.chkIds(sectionId, studentIdParam, colId);
    if (!chkResult.isOk) return chkResult;
    const section = this.sections[sectionId]!;
    if (isStudentId) {
      if(!section.studentIds.has(rowId as T.StudentId)) {
	const msg = `student "${rowId}" not enrolled in "${sectionId}"`;
	return E.errResult(E.Err.err(msg, 'BAD_CONTENT'));
      }
    }
    else {
      if (!section.info.rowHdrs[rowId as T.AggrRowId]) {
	const msg = `unknown rowId "${rowId}"`;
	return E.errResult(E.Err.err(msg, 'NOT_FOUND'));
      }
    }
    if (!section.hasAggregates) this.addAggregates(section);
    return E.okResult(this.getEntryLo(sectionId, rowId, colId));
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
  getSectionData(sectionId: T.SectionId, rowIds: T.RowId[] = [],
	  colIds: T.ColId[] = []) : E.Result<T.SectionData, E.Err>
  {
    const chkResult = this.chkDataSpec(sectionId, rowIds, colIds);
    if (!chkResult.isOk) return chkResult;
    const section = chkResult.val;
    if (rowIds.length === 0) {
      const studentIds = [ ...section!.studentIds].sort();
      const aggrRowIds = Object.values(section.info.rowHdrs)
	.filter(h => h._tag === 'aggrRow')
	.map(h => h.id);
      rowIds = [ ...studentIds, ...aggrRowIds ];
    }
    if (colIds.length === 0) {
      colIds = (Object.keys(section.info.colHdrs) as T.ColId[]);
    }
    if (!section.hasAggregates) this.addAggregates(section);
    return E.okResult(this.readData(sectionId, rowIds, colIds));
  }

  //additional methods beyond those required for project 1

  /** return info for student */
  async getStudent(studentId: T.StudentId)
    : Promise<E.Result<T.Student, E.Err>>
  {
    const student = this.students[studentId];
    return student
      ? E.okResult(student)
      : E.errResult(E.Err.err(`no student with id ${studentId}`, 'NOT_FOUND'));
  }

  /** return original section-info for sectionId */
  getSectionInfo(sectionId: T.SectionId)
    : E.Result<T.SectionInfo, E.Err> 
  {
    const section = this.sections[sectionId];
    if (!section) {
      const msg = `unknown section-id \"${sectionId}\"`;
      return E.errResult(E.Err.err(msg, 'NOT_FOUND'));
    }
    return E.okResult(section.info0);
  }

  /** Return id's of all students enrolled in sectionId */
  getEnrolledStudentIds(sectionId: T.SectionId) : E.Result<T.StudentId[], E.Err>
  {
    const section = this.sections[sectionId];
    if (!section) {
      const msg = `unknown section-id \"${sectionId}\"`;
      return E.errResult(E.Err.err(msg, 'NOT_FOUND'));
    }
    return E.okResult([...section.studentIds]);
  }

  chkSectionId(sectionId: T.SectionId) : E.Result<undefined, E.Err> {
    return (this.sections[sectionId])
      ? E.okResult(undefined)
      : E.errResult(E.Err.err(`unknown section ${sectionId}`, 'NOT_FOUND'));
  }
  
  /** return all independent data (non-aggregate, non-student) for sectionId */
  getRawData(sectionId: T.SectionId) : E.Result<T.SectionData, E.Err> {
    const chkResult = this.chkSectionId(sectionId);
    if (!chkResult.isOk) return chkResult as E.Result<T.SectionData, E.Err>;
    const info = this.sections[sectionId].info;
    const isRawColHdr = (h: T.ColHdr) =>
      (h.id === 'id') || (h._tag !== 'aggrCol' && h._tag !== 'student');
    const colIds = Object.values(info.colHdrs)
      .filter(isRawColHdr)
      .map(h => h.id);
    const studentIdsResult = this.getEnrolledStudentIds(sectionId);
    if (!studentIdsResult.isOk) return studentIdsResult;
    const studentIds = studentIdsResult.val;
    const rowIds = [ ... studentIds ];
    return this.getSectionData(sectionId, rowIds, colIds);
  }

  /** return a single row (including aggregates) for student studentId.
   */
  getStudentData(sectionId: T.SectionId, studentId: T.StudentId)
    : E.Result<T.SectionData, E.Err>
  {
    return this.getSectionData(sectionId, [ studentId ]);
  }

  /** return all aggregate rows for sectionId */
  getAggrRows(sectionId: T.SectionId) : E.Result<T.SectionData, E.Err> {
    const chkResult = this.chkSectionId(sectionId);
    if (!chkResult.isOk) return chkResult as E.Result<T.SectionData, E.Err>;
    const info = this.sections[sectionId].info;
    const rowIds = Object.values(info.rowHdrs)
      .filter(h => h._tag === 'aggrRow')
      .map(h => h.id);
    return this.getSectionData(sectionId, rowIds);
  }

  /** remove all information for section sectionId.
   *
   * Errors:
   *   NOT_FOUND: unknown sectionId, rowId or colId.
   */
  rmSection(sectionId: T.SectionId) {
    const chkResult = this.chkSectionId(sectionId);
    if (!chkResult.isOk) return chkResult;
    delete this.sections[sectionId];
  }

  /** Clear out all section data, including enrolled students, and
   *  section-info
   *
   * Errors:
   *   NOT_FOUND: unknown sectionId, rowId or colId.
   */
  rmSectionData(sectionId: T.SectionId) {
    const chkResult = this.chkSectionId(sectionId);
    if (!chkResult.isOk) return chkResult;
    this.sections[sectionId].data = {};
    this.sections[sectionId].studentIds = new Set();
  }

  /** clear out all data. */
  clear() {
    for (const k of Object.keys(this.sections)) {
      delete this.sections[k as T.SectionId];
    }
    for (const k of Object.keys(this.students)) {
      delete this.students[k as T.StudentId];
    }
  }    

  private readData(sectionId: T.SectionId, rowIds: T.RowId[],
		   colIds: T.ColId[]) : T.SectionData
  {
    //all param ids ok
    const data: T.SectionData = {};
    for (const rowId of rowIds) {
      const row: T.RowData = {};
      data[rowId] = row;
      for (const colId of colIds) {
	row[colId] = this.getEntryLo(sectionId, rowId, colId);
      }
    }
    return data;
  }


    
  private addAggregates(section: Section) {
    const info: T.SectionInfo = {
      ...section.info,
      colHdrs: section.info.colHdrs as Record<T.ColId, Required<T.ColHdr>>,
      rowHdrs: section.info.rowHdrs as Record<T.RowId, Required<T.RowHdr>>,
    };
    for (const studentId of section.studentIds) {
      for (const h of Object.values(section.info.colHdrs)) {
	if (h._tag !== 'aggrCol') continue;
	const aggrResult =
	  h.aggrFn(info, section.data, studentId, h.args);
	section.data[studentId][h.id] =
	  aggrResult.isOk ? aggrResult.val : aggrResult.err;
	//console.error(section.info.id, studentId, h.id, aggrResult);
      }
    }
    for (const rowHdr of Object.values(section.info.rowHdrs)) {
      if (rowHdr._tag !== 'aggrRow') continue;
      let row = section.data[rowHdr.id];
      if (!row) {
	section.data[rowHdr.id] = row =
	  { ['id' as T.ColId]: rowHdr.id as T.Entry};
      }
      for (const h of Object.values(section.info.colHdrs)) {
	if (h.id === 'id') continue;
	const aggrResult =
	  rowHdr.aggrFn(info, section.data, h.id, rowHdr.args);
	row[h.id] = aggrResult.isOk ? aggrResult.val : aggrResult.err;
	//console.error(section.info.id, rowHdr.id, h.id, aggrResult);
      }
    }
    section.hasAggregates = true;
  }

  private chkDataSpec(sectionId: T.SectionId, rowIds: T.RowId[],
		      colIds: T.ColId[]) : E.Result<Section, E.Err>
  {
    const section = this.sections[sectionId];
    if (!section) {
      const msg = `unknown section "${sectionId}"`;
      return E.errResult(E.Err.err(msg, 'NOT_FOUND'));
    }
    const unknownColId = colIds.find(c => !section.info.colHdrs[c]);
    if (unknownColId) {
      const msg = `unknown column "${unknownColId}" for section "${sectionId}"`;
      return E.errResult(E.Err.err(msg, 'NOT_FOUND'));
    }
    const studentIds = rowIds.filter(id => T.isStudentId(id));
    const unknownStudentId = studentIds.find(id => !this.students[id]);
    if (unknownStudentId) {
      const msg = `unknown student "${unknownStudentId}" specified as rowId`;
      return E.errResult(E.Err.err(msg, 'NOT_FOUND'));
    }
    const unenrolledStudentId =
      studentIds.find(id => !section.studentIds.has(id));
    if (unenrolledStudentId) {
      const msg = `unenrolled student "${unknownStudentId}" specified as rowId`;
      return E.errResult(E.Err.err(msg, 'BAD_CONTENT'));
    }
    const nonStudentIds = rowIds.filter(id => !T.isStudentId(id));
    const badRowId =
      nonStudentIds.find(id => !Object.keys(section.info.rowHdrs));
    if (badRowId) {
      const msg = `unknown rowId "${badRowId}" specified to select row`;
      return E.errResult(E.Err.err(msg, 'NOT_FOUND'));
    }
    return E.okResult(section);
  }

  private getEntryLo(sectionId: T.SectionId, rowId: T.RowId, colId: T.ColId)
    : T.Entry 
  {
    //sectionId, rowId and colId are valid.
    //data is full if this is an aggregate request
    return this.sections[sectionId]!.data[rowId]![colId];
  }
	     
	     
  private chkIds(sectionId: T.SectionId, studentId?: T.StudentId,
		 colId?: T.ColId) : E.Result<void, E.Err>
  {
    const section = this.sections[sectionId];
    if (!section) {
      const msg = `unknown section "${sectionId}"`;
      return E.errResult(E.Err.err(msg, 'NOT_FOUND'));
    }
    if (studentId && !this.students[studentId]) {
      const msg = `unknown student "${studentId}"`;
      return E.errResult(E.Err.err(msg, 'NOT_FOUND'));
    }
    if (colId && !section.info!.colHdrs[colId]) {
      const msg = `unknown column "${colId}" for section "${sectionId}"`;
      return E.errResult(E.Err.err(msg, 'NOT_FOUND'));
    }
    return E.okResult(undefined);
  }
  
};


//T.* types for aggregate headers only provide the names for aggregate
//function using an aggrFnName property.  Enhance those types with an
//additional aggrFn property which has the actual definition.

//Note that we provide local definitions which use the same name as
//the types in T.*.  So T.ColHdr are column headers which only contain
//the aggregate function name, whereas the local name ColHdr (local to
//this file) contains both the aggregate function name *and
//definition*.

type AggrColHdr = T.AggrColHdr &  { aggrFn: T.RowAggrFn, };
type ColHdr = Exclude<T.ColHdr, T.AggrColHdr> | AggrColHdr;

type AggrRowHdr = T.AggrRowHdr &  { aggrFn: T.ColAggrFn, };
type RowHdr = Exclude<T.RowHdr, T.AggrRowHdr> | AggrRowHdr;

type SectionInfo = Omit<T.SectionInfo, 'colHdrs' | 'rowHdrs'> &
  { colHdrs: Record<T.ColId, ColHdr>,
    rowHdrs: Record<T.RowId, RowHdr>,
  };


type Section = {
  info0: T.SectionInfo,
  info: SectionInfo,
  studentIds: Set<T.StudentId>,
  data: T.SectionData,
  hasAggregates: boolean;  //true if aggregates for data are up-to-date
};

