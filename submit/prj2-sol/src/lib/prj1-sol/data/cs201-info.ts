import * as T from '../lib/types.js';
import * as F from './aggr-fns.js';

export const CUTOFFS: F.Cutoff[] = [
  { lo: 95, hi: 101, grade: 'A' },
  { lo: 90, hi: 95, grade: 'A-' },
  { lo: 85, hi: 90, grade: 'B+' },
  { lo: 75, hi: 85, grade: 'B' },
  { lo: 70, hi: 75, grade: 'B-' },
  { lo: 65, hi: 70, grade: 'C+' },
  { lo: 60, hi: 65, grade: 'C' },
  { lo: 55, hi: 60, grade: 'C-' },
  { lo: 45, hi: 55, grade: 'D' },
  { lo: 0, hi: 45, grade: 'F' },
  
];

export const WEIGHTS = {
  ['prjAvg' as T.ColId]: 0.3,
  ['hwAvg' as T.ColId]: 0.25,
  ['mid' as T.ColId]: 0.25,
  ['fin' as T.ColId]: 0.3,
};

const cs201InfoSpec : T.SectionInfoSpec = {
  id: 'cs201' as T.SectionId,
  name: 'Introduction to Programming 2',

  categories: [
    { id: 'prj' as T.CategoryId,
      name: 'Project',
      entryType: 'numScore',
    },
    { id: 'hw' as T.CategoryId,
      name: 'Homework',
      entryType: 'numScore',
    },
    { id: 'mid' as T.CategoryId,
      name: 'Midterm',
      entryType: 'numScore',
    },
    { id: 'fin' as T.CategoryId,
      name: 'Final',
      entryType: 'numScore',
    },
  ],
  
  colHdrs: [

    //student info
    { _tag: 'student',
      id: 'id' as T.ColId,
      name: 'Student ID',
      key: 'id',
    },
    { _tag: 'student',
      id: 'lastName' as T.ColId,
      name: 'Last Name',
      key: 'lastName',
    },
    { _tag: 'student',
      id: 'firstName' as T.ColId,
      name: 'First Name',
      key: 'firstName',
    },

    //projects
    { _tag: 'numScore',
      id: 'prj1' as T.ColId,
      categoryId: 'prj' as T.CategoryId,
      name: 'Project 1',
    },
    { _tag: 'numScore',
      id: 'prj2' as T.ColId,
      categoryId: 'prj' as T.CategoryId,
      name: 'Project 2',
    },
    
    { _tag: 'numScore',
      id: 'prj3' as T.ColId,
      categoryId: 'prj' as T.CategoryId,
      name: 'Project 3',
    },
    
    { _tag: 'numScore',
      id: 'hw1' as T.ColId,
      categoryId: 'hw' as T.CategoryId,
      name: 'Homework 1',
    },
    { _tag: 'numScore',
      id: 'hw2' as T.ColId,
      categoryId: 'hw' as T.CategoryId,
      name: 'Homework 2',
    },
    { _tag: 'numScore',
      id: 'hw3' as T.ColId,
      categoryId: 'hw' as T.CategoryId,
      name: 'Homework 3',
    },
    { _tag: 'numScore',
      id: 'hw4' as T.ColId,
      categoryId: 'hw' as T.CategoryId,
      name: 'Homework 4',
    },

    //exams
    { _tag: 'numScore',
      id: 'mid' as T.ColId,
      categoryId: 'mid' as T.CategoryId,
      name: 'Midterm',
    },
    { _tag: 'numScore',
      id: 'fin' as T.ColId,
      categoryId: 'fin' as T.CategoryId,
      name: 'Final',
    },

    //aggregates
    { _tag: 'aggrCol',
      id: 'prjAvg' as T.ColId,
      name: 'Project Average',
      args: ['prj', 1],
      aggrFnName: F.rowAggrFns.numCategoryAvg.name,
    },
    { _tag: 'aggrCol',
      id: 'hwAvg' as T.ColId,
      name: 'Homework Average',
      args: ['hw', 1],
      aggrFnName: F.rowAggrFns.numCategoryAvg.name,
    },
    { _tag: 'aggrCol',
      id: 'total' as T.ColId,
      name: 'Total Average',
      args: [ WEIGHTS, ],
      aggrFnName: F.rowAggrFns.weightedTotal.name,
    },
    { _tag: 'aggrCol',
      id: 'grade' as T.ColId,
      name: 'Letter Grade',
      entryType: 'text',
      args: ['total', CUTOFFS],
      aggrFnName: F.rowAggrFns.getLetterGrade.name,
    },

    
  ],

  rowHdrs: [
    { _tag: 'aggrRow',
      id: T.toAggrRowId('$count'),
      name: 'Count',
      aggrFnName: F.colAggrFns.count.name,
    },
    { _tag: 'aggrRow',
      id: T.toAggrRowId('$max'),
      name: 'Max',
      aggrFnName: F.colAggrFns.max.name,
    },
    { _tag: 'aggrRow',
      id: T.toAggrRowId('$min'),
      name: 'Min',
      aggrFnName: F.colAggrFns.min.name,
    },
    { _tag: 'aggrRow',
      id: T.toAggrRowId('$avg'),
      name: 'Average',
      aggrFnName: F.colAggrFns.avg.name,
    },
  ],
};

//fill in all optional values
export const cs201Info = T.specToSectionInfo(cs201InfoSpec);

