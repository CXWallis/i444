import * as E from '../lib/errors.js';
import * as T from '../lib/types.js';

//Note: these aggr-fns blithely cast their way around the possibility
//that their T.Entry options may be E.Err.  This could result in NaN
//results for aggregates which operate on aggregates.


/*********************** Row Aggregate Functions ***********************/

/** args[0]:  CategoryId; the category of assignments being averaged.
 *  args[1]:  number; the # of assignments to be dropped.
 *   
 *  Return average for all [rowId][*categoryId] entries.
 */
function numCategoryAvg(sectionInfo: T.SectionInfo, data: T.SectionData,
			rowId: T.StudentId, args: unknown[])
  : E.Result<number|string, E.Err>
{
  const row = data[rowId];
  if (!row) {
    return E.errResult(E.Err.err(`unknown student "${rowId}"`, 'NOT_FOUND'));
  }
  const categoryId =  args[0] as T.CategoryId;
  const nDrop = (args[1] ?? 0) as number;
  const colIds : T.ColId[] = Object.values(sectionInfo.colHdrs)
    .filter(h => h._tag == 'numScore' && h.categoryId === categoryId)
    .map(h => h.id);
  const vals = colIds.map(c => (row[c] as T.NumScore) ?? 0);
  const sum = vals.toSorted((a, b) => a - b)
    .slice(nDrop)
    .reduce((acc, e) => acc + e);
  const avg = round(sum/(colIds.length - nDrop));
  return E.okResult(avg);
}

/** args[0]:  CategoryId; the category of assignments being averaged.
 *  args[1]:  number; the # of assignments to be dropped.
 *  args[2]:  Record<string, number>: mapping from letter-grade to number
 *   
 *  Return average for all [rowId][*categoryId] entries.
 */
function textCategoryAvg(sectionInfo: T.SectionInfo, data: T.SectionData,
			rowId: T.StudentId, args: unknown[])
  : E.Result<number|string, E.Err>
{
  const row = data[rowId];
  if (!row) {
    return E.errResult(E.Err.err(`unknown student "${rowId}"`, 'NOT_FOUND'));
  }
  const categoryId =  args[0] as T.CategoryId;
  const nDrop = (args[1] ?? 0) as number;
  const letterPoints = args[2] as Record<string, number>;
  const colIds : T.ColId[] = Object.values(sectionInfo.colHdrs)
    .filter(h => h._tag == 'textScore' && h.categoryId === categoryId)
    .map(h => h.id);
  const grades = colIds.map(c => (row[c] as T.TextScore));
  const vals = grades.map(g => g ? letterPoints[g] : 0);
  const sum = vals.toSorted((a, b) => a - b)
    .slice(nDrop)
    .reduce((acc, e) => acc + e);
  const avg = round(sum/(colIds.length - nDrop));
  return E.okResult(avg);
}

/** args[0]: Record<T.ColId, number>: map column to its weight in the total
 *
 *  Return +/(grades*weights)
 */
function weightedTotal(sectionInfo: T.SectionInfo, data: T.SectionData,
		       rowId: T.StudentId, args: unknown[])
  : E.Result<number|string, E.Err>
{
  const row = data[rowId];
  if (!row) {
    return E.errResult(E.Err.err(`unknown student "${rowId}"`, 'NOT_FOUND'));
  }
  const weights = args[0] as Record<T.ColId, number>;
  const total = Object.entries(weights)
    .reduce((acc, [k, w]) => acc + w*((row[k as T.ColId] ?? 0) as number), 0);
  return E.okResult(round(total));
}

/** a numeric value in [lo, hi) results in grade */
export type Cutoff = {
  lo: number,     //inclusive
  hi: number,     //exclusive
  grade: string,  //letter grade
};
/** args[0]: T.ColId; the column of value to be mapped to a letter grade
 *  args[1]: Cutoff[]: the cutoffs for each letter grade
 */
function getLetterGrade(sectionInfo: T.SectionInfo, data: T.SectionData,
			rowId: T.StudentId, args: unknown[])
  : E.Result<number|string, E.Err>
{
  const row = data[rowId];
  if (!row) {
    return E.errResult(E.Err.err(`unknown student "${rowId}"`, 'NOT_FOUND'));
  }
  const colId = args[0] as T.ColId;
  const cutoffs = args[1] as Cutoff[];
  const val = (row[colId] ?? 0) as number;
  const cutoff = cutoffs.find(c => c.lo <= val && val < c.hi);
  if (!cutoff) {
    const msg = `could not find cutoff for [${rowId}][${colId}] = ${val}`;
    return E.errResult(E.Err.err(msg, `INTERNAL_ERR`));
  }
  return E.okResult(cutoff.grade);
}

export const rowAggrFns: Record<string, T.RowAggrFn> = {
    numCategoryAvg,
    textCategoryAvg,
    weightedTotal,
    getLetterGrade,
};

/*********************** Column Aggregate Functions *******************/


//these fns require that aggregate-rows in SectionData have their 'id'
// property set to the rowAggr ID before attempting to use them to
//fill out the col-aggr values in the rest of the row.

/** return all non-"empty" data in column colId which are not in aggr-rows */
function getColData(info: T.SectionInfo, data: T.SectionData,
		    colId: T.ColId) : string[]|number[]
{
  const aggrRowIds = new Set(Object.keys(info.rowHdrs));
  return (
    Object.values(data)
      .filter(row => !aggrRowIds.has(row['id' as T.ColId] as string))
      .map(row => row[colId])
      .filter(v => v !== null && v !== undefined && v !== '')
  ) as (number[]|string[]);
}


/** return count of all non-"empty" data in column colId which are not
 *  in aggr-rows.  Returns '' if a count does not make sense (as for
 *  student-info columns).
 */
function count(info: T.SectionInfo, data: T.SectionData,
	       colId: T.ColId, args: unknown[]): E.Result<number|string, E.Err>
{
  const colHdr = info.colHdrs[colId];
  if (!colHdr) {
    return E.errResult(E.Err.err(`unknown colId "${colId}"`, 'NOT_FOUND'));
  }
  switch (colHdr._tag) {
    case 'student':
      return E.okResult('');
    case 'numScore': case 'textScore': case 'aggrCol':
      return E.okResult(getColData(info, data, colId).length);
  }
}

/** return max of all non-"empty" data in column colId which are not
 *  in aggr-rows.  Returns '' if a count does not make sense (as for
 *  student-info columns).
 */
function max(info: T.SectionInfo, data: T.SectionData,
	     colId: T.ColId, args: unknown[]): E.Result<number|string, E.Err>
{
  const colHdr = info.colHdrs[colId];
  if (!colHdr) {
    return E.errResult(E.Err.err(`unknown colId "${colId}"`, 'NOT_FOUND'));
  }
  if (colHdr.entryType === 'num' || colHdr.entryType === 'numScore') {
    const vals = getColData(info, data, colId) as number[];
    return E.okResult(Math.max(...vals));
  }
  else {
    return E.okResult('');
  }
}

/** return min of all non-"empty" data in column colId which are not
 *  in aggr-rows.  Returns '' if a count does not make sense (as for
 *  student-info columns).
 */
function min(info: T.SectionInfo, data: T.SectionData,
	     colId: T.ColId, args: unknown[]): E.Result<number|string, E.Err>
{
  const colHdr = info.colHdrs[colId];
  if (!colHdr) {
    return E.errResult(E.Err.err(`unknown colId "${colId}"`, 'NOT_FOUND'));
  }
  if (colHdr.entryType === 'num' || colHdr.entryType === 'numScore') {
    const vals = getColData(info, data, colId) as number[];
    return E.okResult(Math.min(...vals));
  }
  else {
    return E.okResult('');
  }
}

/** return average of all non-"empty" data in column colId which are not
 *  in aggr-rows.  Returns '' if a count does not make sense (as for
 *  student-info columns).
 */
function avg(info: T.SectionInfo, data: T.SectionData,
	     colId: T.ColId, args: unknown[]): E.Result<number|string, E.Err>
{
  const colHdr = info.colHdrs[colId];
  if (!colHdr) {
    return E.errResult(E.Err.err(`unknown colId "${colId}"`, 'NOT_FOUND'));
  }
  if (colHdr.entryType === 'num' || colHdr.entryType === 'numScore') {
    const vals = getColData(info, data, colId) as number[];
    const n = vals.length;
    const avg = (n === 0)
      ? 0
      : vals.reduce((acc, v) => acc + v)/n;
    return E.okResult(round(avg));
  }
  else {
    return E.okResult('');
  }
}


export const colAggrFns: Record<string, T.ColAggrFn> = {
  count,
  max,
  min,
  avg,
};

function round(val: number, nDecimalDigits: number = 1) {
  return Number(val.toFixed(nDecimalDigits));
}
