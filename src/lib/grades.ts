import * as T from './types.js';
import * as E from './errors.js';
import { AggrRowId, CategoryId, ColId, RowData, RowId, Student, StudentId } from "./types.js";
import { StudentHdrSpec } from "./types.js";
import { assert } from "chai";

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

    for ( const row of row_headers.filter( row => row._tag === 'aggrRow' ) )
        this.sections.set( sectionInfo.id, { ...this.sections.get(sectionInfo.id) ?? {}, [row.id]:{ id: row.id, firstName: '', lastName: '' } } )

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
    const columns = Object.keys( this.section_infos.get( sectionId )!.colHdrs );

    const initial_data_values = Object.fromEntries(columns.filter(( value ) => !value.endsWith('Name') && !value.includes('id')).map(column => [column, null]));
    this.sections.set( sectionId, {...this.sections.get( sectionId ), [studentId]: {...this.students.get( studentId ), ...initial_data_values }   } )
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
    if ( !this.sections.has( sectionId ) )
        return E.errResult( E.Err.err(`unknown sectionId "${sectionId}"`, 'NOT_FOUND') );
    if ( !this.students.has( studentId ) )
        return E.errResult( E.Err.err(`unknown studentId "${studentId}"`, 'NOT_FOUND') );
    if ( !this.sections.get( sectionId )![studentId] )
        return E.errResult( E.Err.err(`student "${studentId}" not enrolled in section "${sectionId}"`, 'BAD_CONTENT') );
    if ( !this.section_infos.get(sectionId)!.colHdrs[colId] )
        return E.errResult( E.Err.err(`unknown colId "${colId}"`, 'NOT_FOUND') );
    const section_info = this.section_infos.get( sectionId )!;

    if ( score !== null && section_info.colHdrs[colId].entryType === 'numScore' && typeof score !== 'number' )
        return E.errResult( E.Err.err(`score "${score}" is not a number`, 'BAD_CONTENT') );

    if ( score !== null && section_info.colHdrs[colId].entryType === 'textScore' && typeof score !== 'string' )
        return E.errResult( E.Err.err(`score "${score}" is not a string`, 'BAD_CONTENT') );

    if ( typeof score === 'string' ) {
        const text_score_header = section_info.colHdrs[colId] as T.TextScoreHdrSpec;
        if ( !text_score_header.vals?.includes( score ) )
            return E.errResult( E.Err.err(`score "${score}" is not in the allowed values`, 'BAD_CONTENT') );
    }

    if ( typeof score === 'number' ) {
        const number_score_header = section_info.colHdrs[colId] as T.NumScoreHdrSpec;
        if ( score > number_score_header.max! || score < number_score_header.min! )
            return E.errResult( E.Err.err(`score "${score}" is not in the allowed range`, 'BAD_CONTENT') );
    }

    this.sections.get( sectionId )![studentId][colId] = score;
    this.compute_aggregates( sectionId );
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

    if ( rowId._brand == 'aggrRowId' ) {
        return E.okResult( this.sections.get(sectionId)![rowId][colId] ); // TODO: check if this is correct
    }

    return E.okResult( this.sections.get(sectionId)![rowId][colId] );
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
      this.compute_aggregates( sectionId );
    if ( !this.sections.has( sectionId ) )
        return E.errResult( E.Err.err(`unknown sectionId "${sectionId}"`, 'NOT_FOUND') );
    let section = this.sections.get( sectionId )!;

    if ( !rowIds.length && !colIds.length )
      return E.okResult( section );
    if ( rowIds.length ) {
        let result = {};
        for ( const student of rowIds )
            result = { ...result, [student]: section[student] };
        return E.okResult( result );
    }
    if ( colIds.length ) {
        let result = {};
        for ( const [ student, student_data ] of Object.entries( section ) )
            result = { ...result, [ student ] : { ...Object.entries(student_data).filter( ([ key, _]) => colIds.includes( key as ColId ) ) } };
        return E.okResult( result );
    }

    return E.okResult( Object.fromEntries( Object.entries( section ).filter( ([k, v]) => rowIds.includes(k as StudentId) && colIds.includes(k as ColId) ) ) );
  }

  //TODO: add private methods as needed.
  compute_aggregates( sectionId: T.SectionId ) {
      const section = this.sections.get( sectionId );
      assert( section );
      const section_info = this.section_infos.get( sectionId );
      assert( section_info );


      for ( const student of Object.keys( section ) as RowId[] ) {
            for ( const aggregate_data of Object.values(this.section_infos.get(sectionId)!.colHdrs).filter( column => column._tag === 'aggrCol')) {
                const method = this.row_aggregate_functions[aggregate_data.aggrFnName] as T.RowAggrFn;
                const result = method( section_info, section, student as StudentId, aggregate_data.args ?? [] );
                if ( !result.isOk ) return E.errResult( result.err );
                section[student][aggregate_data.id] = result.val;
            }
      }

      for ( const column of Object.values( section_info.colHdrs ).filter( column => column._tag !== 'student').map(column=>column.id) as ColId[] ) {
          for ( const column_aggregate_method of Object.values(section_info.rowHdrs).filter( header => header._tag === 'aggrRow')) {
              const method = this.column_aggregate_functions[ column_aggregate_method.aggrFnName ] as T.ColAggrFn;
              const result = method( section_info, section, column, column_aggregate_method.args );
              if ( !result.isOk ) return E.errResult( result.err );
              section[column_aggregate_method.id][column] = result.val;
          }
      }

      this.sections.set( sectionId, section );
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


//TODO: add local types and definitions as needed.
