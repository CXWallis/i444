import Path from 'path';

import DATA from './full-data.js';
import * as T from '../lib/types.js';

import { toCsv, toTextTable } from '../lib/grade-utils.js';


const FMTS = [ 'csv', 'text' ];
const SECTION_IDS = Object.keys(DATA);

function go(sectionId: string, fmt: string) {
  const data = DATA[sectionId as T.SectionId];
  console.log(fmt === 'csv' ? toCsv(data) : toTextTable(data));
}

if (process.argv.length !== 4 ||
    !SECTION_IDS.includes(process.argv[2]) ||
    !FMTS.includes(process.argv[3]))  {
  const msg = `usage: ${Path.basename(process.argv[1])} `
    + SECTION_IDS.join('|') + ' ' + FMTS.join('|');
  console.error(msg);
  process.exit(1);
}
    
go(process.argv[2], process.argv[3]);
