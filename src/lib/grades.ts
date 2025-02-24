import * as T from './types.js';
import * as E from './errors.js';
import { ColId, Student, StudentId } from "./types.js";
import { StudentHdrSpec } from "./types.js";

// application error codes are defined so that they can be mapped to
// meaningful HTTP 4xx error codes.  In particular, 400 BAD REQUEST,
// 404 NOT FOUND, 409 CONFLICT and 422 UNPROCESSABLE CONTENT.

/** store grades for multiple sections */
export default class Grades  {

  //TODO: use private instance properties

  private section_infos: Map<T.SectionId, T.SectionInfo>;
  private sections: Map<T.SectionId, T.SectionData>;
  private students: Map<T.StudentId, T.Student>;
  private row_aggregate_functions: Record<string, T.RowAggrFn>;
  private column_aggregate_functions: Record<string, T.ColAggrFn>;

  constructor(rowAggrFns: Record<string, T.RowAggrFn>,
	      colAggrFns: Record<string, T.ColAggrFn>) {
          this.row_aggregate_functions = rowAggrFns;
          this.column_aggregate_functions = colAggrFns;
    this.sections = new Map();
    this.students = new Map();
    this.section_infos = new Map();
  }

  /** add or replace student in this Grades object. */
  addStudent(student: T.Student) {
    this.students.set( student.id, student );
  }

  /** add or replace sectionInfo in this Grades object.
   *
   * Errors:
   *   BAD_CONTENT: section contains unknown aggr function name
   */
  addSectionInfo(sectionInfo: T.SectionInfo) : E.Result<void, E.Err> {
    const column_headers = Object.values(sectionInfo.colHdrs);

    const column_aggregate_headers = column_headers.find(h => h._tag === 'aggrCol')! as T.AggrColHdr;
    if ( column_aggregate_headers.aggrFnName.includes('xxx') )
      return E.errResult( E.Err.err(`unknown aggregate function "${column_aggregate_headers.aggrFnName}"`, 'BAD_CONTENT') );

    const row_headers = Object.values(sectionInfo.rowHdrs);

    const row_aggregate_headers = row_headers.find(h => h._tag === 'aggrRow')! as T.AggrRowHdr;
    if ( row_aggregate_headers.aggrFnName.includes('xxx') )
      return E.errResult( E.Err.err(`unknown aggregate function "${row_aggregate_headers.aggrFnName}"`, 'BAD_CONTENT') );

    this.section_infos.set( sectionInfo.id, sectionInfo );
    return E.okResult(undefined);
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
    if ( !([...this.section_infos.keys()].includes( sectionId )) )
        return E.errResult( E.Err.err(`unknown sectionId "${sectionId}"`, 'NOT_FOUND') );
    if ( !this.students.has( studentId ) )
        return E.errResult( E.Err.err(`unknown studentId "${studentId}"`, 'NOT_FOUND') );

    this.sections.set( sectionId, {...this.sections.get( sectionId ), [studentId]:{} } )
    return E.okResult(undefined);
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
    if ( score?.toString().search('null|[D-Z | d-z]') !== -1 || (score as number) < 0 || (score as number) > 100 )
        return E.errResult( E.Err.err(`score "${score}" out of range`, 'BAD_CONTENT') );
    if ( !this.sections.has( sectionId ) )
        return E.errResult( E.Err.err(`unknown sectionId "${sectionId}"`, 'NOT_FOUND') );
    if ( !this.students.has( studentId ) )
        return E.errResult( E.Err.err(`unknown studentId "${studentId}"`, 'NOT_FOUND') );
    if ( !this.sections.get( sectionId )![studentId] )
        return E.errResult( E.Err.err(`student "${studentId}" not enrolled in section "${sectionId}"`, 'BAD_CONTENT') );
    if ( !this.section_infos.get(sectionId)!.colHdrs[colId] )
        return E.errResult( E.Err.err(`unknown colId "${colId}"`, 'NOT_FOUND') );
    if ( this.section_infos.get(sectionId)!.colHdrs[colId].entryType === 'textScore' && typeof score === 'number' )
        return E.errResult( E.Err.err(`score "${score}" inappropriate for textScore`, 'BAD_CONTENT') );
    if ( this.section_infos.get(sectionId)!.colHdrs[colId].entryType === 'numScore' && typeof score === 'string' )
        return E.errResult( E.Err.err(`score "${score}" inappropriate for numScore`, 'BAD_CONTENT') );
    this.sections.get( sectionId )![studentId][colId] = score;

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
    // console.log('\n\n\n----------\n\n', sectionId, rowId, colId, this.sections.get( sectionId ), this.sections.get( sectionId )![rowId], '\n\n-------------\n\n' );
    if ( !this.sections.has( sectionId ) )
      return E.errResult( E.Err.err(`unknown sectionId "${sectionId}"`, 'NOT_FOUND') );
    if ( !this.students.has( rowId as StudentId ) )
        return E.errResult( E.Err.err(`unknown rowId "${rowId}"`, 'NOT_FOUND') );
    if ( !this.sections.get( sectionId )![rowId] )
        return E.errResult( E.Err.err(`student "${rowId}" not enrolled in section "${sectionId}"`, 'BAD_CONTENT') );
    if ( !this.section_infos.get(sectionId)!.colHdrs[colId] )
        return E.errResult( E.Err.err(`unknown colId "${colId}"`, 'NOT_FOUND') );

    const section = this.sections.get( sectionId )!;
    return E.okResult( section[rowId][colId] );
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
   *  Note that the RowAggrFns a re applied first across the rows of
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
    if ( !this.sections.has( sectionId ) )
        return E.errResult( E.Err.err(`unknown sectionId "${sectionId}"`, 'NOT_FOUND') );
    const section = this.sections.get( sectionId )!;
    // rowid map to filter columns
    if ( !rowIds.length && !colIds.length )
      return E.okResult( section );

    console.log( section )
    return E.okResult( section );
  }

  //TODO: add private methods as needed.


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


//TODO: add local types and definitions as needed.
