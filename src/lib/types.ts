import * as E from './errors.js';

/******************************** ID Types *****************************/

//IDs are merely strings; so brand IDs so that TS warns about ID confusion.
//see <https://www.learningtypescript.com/articles/branded-types>
export type StudentId = string & { _brand: 'student' };
export type SectionId = string & { _brand: 'sectionId' };
export type CategoryId = string & { _brand: 'categoryId' };
export type ColId = string & { _brand: 'colId' };
export type AggrRowId = string & { _brand: 'aggrRowId' };

export type RowId = StudentId | AggrRowId;

export type Student = {
  id: StudentId,
  lastName: string,
  firstName: string,
};

/****************************** Basic Types ****************************/

//a null score means not submitted (silently converts to 0 in arith contexts)
export type NumScore = number | null; 
export type TextScore = string | null;
export type Score = NumScore | TextScore;

//we use Entry to represent a Score as well as other info like a student name
// the E.Err is to account for the fact that aggr-fns could fail
export type Entry = number | string | null | E.Err;

//these are the possibilities for an entry
export type EntryType =
  'numScore' |      //number or null
  'textScore' |     //string or null
  'num' |           //only a number (for some aggregates)
  'text';           //only a string (for info like student name)

//most specs have id and name properties; the id is used internally,
//the name is used externally.
type IdName<IdBrand> = {
  id: IdBrand;
  name: string;
};

/************************** Specs for Columns **************************/

//If a type ends with "Spec", then it can have optional properties.

//a category for assigments having numeric scores
export type NumScoreCategorySpec = IdName<CategoryId> &
  { entryType: 'numScore', 
    min?: number,      //default 0
    max?: number,      //default 100
  };

//a category for assigments having text scores
export type TextScoreCategorySpec = IdName<CategoryId> &
  { entryType: 'textScore',
    vals: string[],  //possible text-scores like 'C', 'B', 'A',
                     //must be in ascending order of merit
  };

//so an assignment category has to be one of these
export type AssignCategorySpec = NumScoreCategorySpec | TextScoreCategorySpec;

//a header for a column involving student info like name
export type StudentHdrSpec = IdName<ColId> & {
  _tag: 'student',
  key: keyof Student,
  entryType?: EntryType,  //defaults to 'text'
};

//a header for an assignment having a numeric score
export type NumScoreHdrSpec = IdName<ColId> & {
  _tag: 'numScore',
  categoryId: CategoryId,
  entryType?: EntryType,  //defaults to category.entryType
  min?: number,           //defaults to category.entryType
  max?: number,           //defaults to category.entryType
};

//a header for an assignment having a text score like 'A', 'B', 'C'.
export type TextScoreHdrSpec = IdName<ColId> & {
  _tag: 'textScore',
  categoryId: CategoryId,
  entryType?: EntryType,  //defaults to category.entryType
  vals?: string[],        //defaults to category.vals
};
  
//An aggrCol is a column whose entries are aggregates of a row or portion of
//a row; OTOH, a colAggr is an aggregate of a column.


//produces an aggregate of a row, or portion of a row
export type RowAggrFn =
  (sectionInfo: SectionInfo, data: SectionData, rowId: StudentId,
   args: unknown[]) => E.Result<number|string, E.Err>

//header for an aggregate column, where the aggregate is applied
//over selected colIds for all student rows.
export type AggrColHdrSpec = IdName<ColId> & {
  _tag: 'aggrCol',
  entryType?: EntryType,  //defaults to 'num'
  args?: any[],           //additional arguments to aggrFn (default [])
  aggrFnName: string,     //name of RowAggrFn used to compute aggregate
                          //function not stored so as to allow serialization
};

//a column header must be one of these
export type ColHdrSpec =
  StudentHdrSpec | NumScoreHdrSpec | TextScoreHdrSpec  | AggrColHdrSpec;


/**************************** Specs for Rows ***************************/

//We will always have implicit row for each student; in addition, we
//will have aggregate rows.

//produces an aggregate of a column
export type ColAggrFn =
  (sectionInfo: SectionInfo, data: SectionData, colId: ColId, args: unknown[])
  => E.Result<number|string, E.Err>


export type AggrRowHdrSpec = IdName<RowId> & {
  _tag: 'aggrRow',
  args?: any[],       //additional arguments to aggrFn (default [])
  aggrFnName: string, //name of ColAggrFn used to compute aggregate
                      //function not stored so as to allow serialization
};

export type RowHdrSpec = AggrRowHdrSpec;

/************************** Section Info Spec **************************/

//type used for specifying section information externally
export type SectionInfoSpec = {
  id: SectionId,
  name: string,
  categories: AssignCategorySpec[],
  colHdrs: ColHdrSpec[],
  rowHdrs: RowHdrSpec[],
};

/***************************** Section Info ****************************/

//the above types used for specifying section-info allow optional
//properties.  To avoid clumsy code, declare types with the optional
//properties always filled in with defaults values for use internally.

export type NumScoreCategory = Required<NumScoreCategorySpec>;
export type TextScoreCategory = Required<TextScoreCategorySpec>;
export type AssignCategory = NumScoreCategory | TextScoreCategory;

export type StudentHdr = Required<StudentHdrSpec>;
export type NumScoreHdr = Required<NumScoreHdrSpec>;
export type TextScoreHdr = Required<TextScoreHdrSpec>;
export type AggrColHdr = Required<AggrColHdrSpec>;
export type ColHdr =
  StudentHdr | NumScoreHdr | TextScoreHdr  | AggrColHdr;

export type AggrRowHdr = Required<AggrRowHdrSpec>;
export type RowHdr = AggrRowHdr;



//similar to SectionInfoSpec, but no properties are optional and
//all lists are replaced by maps for convenient access.
export type SectionInfo = {
  id: SectionId,
  name: string,
  categories: Record<CategoryId, AssignCategory>,
  colHdrs: Record<ColId, ColHdr>,
  rowHdrs: Record<AggrRowId, RowHdr>,
};


/************************** Section Grade Data *************************/

//and finally the data stored for a section

export type RowData = Record<ColId, Entry>;

//the data for a complete section is a map from rowIds to a row.
export type SectionData = Record<RowId, RowData>;


/******************** Utility Functions for Types **********************/

/** Convert external spec having optional properties and lists to
 *  value used internally with no optional properties and maps
 *  instead of lists.
 */
export function specToSectionInfo(spec: SectionInfoSpec) : SectionInfo {
  const rCategs: Required<AssignCategory>[] =
    spec.categories.map(c =>
      c.entryType === 'textScore' ? c :  { min: 0, max: 100, ...c, } );
  const categories =
    Object.fromEntries(rCategs.map(c => [c.id, c]));
  const rColHdrs: Required<ColHdr>[] =
    spec.colHdrs.map(h => {
      switch (h._tag) {
	case 'student':
	  return { entryType: 'text', ...h };
	case 'aggrCol':
	  return { args: [], entryType: 'num', ...h };
	case 'numScore': {
	  const category = categories[h.categoryId]! as
	    Required<NumScoreCategory>;
	  return { min: category.min, max: category.max,
		   entryType: category.entryType, ...h };
	}
	case 'textScore': {
	  const category = categories[h.categoryId]! as
	    Required<TextScoreCategory>;
	  return { vals: category.vals, entryType: category.entryType, ...h };
	}
      }
    });
  const rRowHdrs: Required<RowHdr>[] =
    spec.rowHdrs.map(h => {
      switch (h._tag) {
	case 'aggrRow':
	  return { args: [], ...h };
      }
    });
  const colHdrs = Object.fromEntries(rColHdrs.map(h => [h.id, h]));
  const rowHdrs = Object.fromEntries(rRowHdrs.map(h => [h.id, h]));
  return { id: spec.id, name: spec.name, categories, colHdrs, rowHdrs };
}

/************************** Branding Checks ****************************/

const NON_STUDENT_BRAND = '$';

//since both StudentId's and AggrRowId's can be RowId's, ensure that
//the branded ids are disjoint.

//this is a type predicate: when TS sees it returning true,
//it infers that str has type StudentId
export function isStudentId(str: string): str is StudentId {
  return !str.startsWith(NON_STUDENT_BRAND);
}


//this function is meant for use in literal data as it throws.
export function toStudentId(str: string): StudentId {
  if (!str.startsWith(NON_STUDENT_BRAND)) {
    return str as StudentId;
  }
  else {
    throw new Error(`"${str}" is not a valid StudentId as it starts with "$"`);
  }
}

//this function is meant for use in code as it does not throw
export function chkStudentId(str: string) : E.Result<StudentId, Error> {
  try {
    return E.okResult(toStudentId(str));
  }
  catch (e: unknown) {
    return E.errResult(e as Error);
  }
}

//this function is meant for use in literal data as it throws.
export function toAggrRowId(str: string): AggrRowId {
  if (str.startsWith(NON_STUDENT_BRAND)) {
    return str as AggrRowId;
  }
  else {
    const msg =
      `"${str}" is not a valid AggrRowId as it does not start with "$"`;
    throw new Error(msg);
  }
}

//this function is meant for use in code as it does not throw
export function chkAggrRowId(str: string) : E.Result<AggrRowId, Error> {
  try {
    return E.okResult(toAggrRowId(str));
  }
  catch (e: unknown) {
    return E.errResult(e as Error);
  }
}
  
