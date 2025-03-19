import * as T from '../lib/types.js';
import * as F from './aggr-fns.js';

export const WEIGHTS: Record<T.ColId, number> = {
  ['paperAvg' as T.ColId]: 0.7,
  ['attendance' as T.ColId]: 1,
  ['fin' as T.ColId]: 0.3,
};

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
  { lo: -10, hi: 45, grade: 'F' },
];

export const LETTER_POINTS: Record<string, number> = {
  'A': 90,
  'B': 80,
  'C': 70,
  'D': 50,
  'F': 0,
};
  
const en101InfoSpec : T.SectionInfoSpec = {
  id: 'en101' as T.SectionId,
  name: 'Communications 1',

  categories: [
    { id: 'paper' as T.CategoryId,
      name: 'Paper',
      entryType: 'textScore',
      vals: Object.keys(LETTER_POINTS).sort((a, b) => b.localeCompare(a)),
    },
    { id: 'attendance' as T.CategoryId,
      name: 'Attendance',
      entryType: 'numScore',
      max: 0,
      min: -10,
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

    //papers
    { _tag: 'textScore',
      id: 'paper1' as T.ColId,
      categoryId: 'paper' as T.CategoryId,
      name: 'Paper 1',
    },
    { _tag: 'textScore',
      id: 'paper2' as T.ColId,
      categoryId: 'paper' as T.CategoryId,
      name: 'Paper 2',
    },
    { _tag: 'textScore',
      id: 'paper3' as T.ColId,
      categoryId: 'paper' as T.CategoryId,
      name: 'Paper 3',
    },
    { _tag: 'textScore',
      id: 'paper4' as T.ColId,
      categoryId: 'paper' as T.CategoryId,
      name: 'Paper 4',
    },
    { _tag: 'textScore',
      id: 'paper5' as T.ColId,
      categoryId: 'paper' as T.CategoryId,
      name: 'Paper 5',
    },

    //attendance
    { _tag: 'numScore',
      id: 'attendance' as T.ColId,
      categoryId: 'attendance' as T.CategoryId,
      name: 'Attendance',
    },

    //exams
    { _tag: 'numScore',
      id: 'fin' as T.ColId,
      categoryId: 'fin' as T.CategoryId,
      name: 'Final',
    },

    //aggregates
    { _tag: 'aggrCol',
      id: 'paperAvg' as T.ColId,
      name: 'Project Average',
      args: ['paper', 0, LETTER_POINTS],
      aggrFnName: F.rowAggrFns.textCategoryAvg.name,
    },
    { _tag: 'aggrCol',
      id: 'total' as T.ColId,
      name: 'Total Average',
      args: [WEIGHTS],
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
export const en101Info = T.specToSectionInfo(en101InfoSpec);


