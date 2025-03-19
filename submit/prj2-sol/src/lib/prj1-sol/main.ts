export * as Errors from './lib/errors.js';
export * as Types  from './lib/types.js';
export { default as Grades } from './lib/grades.js';

export { default as Data } from './data/data.js';
export { default as FullData } from './data/full-data.js';
export { default as Students } from './data/students.js';

export * as AggrFns from './data/aggr-fns.js';

import { cs201Info } from './data/cs201-info.js';
import { en101Info } from './data/en101-info.js';

export const Infos = {
  [cs201Info.id]: cs201Info,
  [en101Info.id]: en101Info,
};
