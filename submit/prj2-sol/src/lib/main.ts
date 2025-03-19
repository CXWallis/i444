import { GradesDao } from './grades-dao.js';
import * as D from './db-grades.js';
import { Types as T, Errors as E, AggrFns as F, Infos, Data, Students }
  from './prj1-sol/main.js';

import { readJson, scriptName, cwdPath } from './node-utils.js';


/************************* Top level routine ***************************/

const OUT_FMTS = [ 'text', 'js', 'json', 'json2' ]; 

export default async function main(args: string[]) {
  let outFmt = 'text';
  const m = args.length > 0 && args[0].match(/^--out=(\w+)$/);
  if (m) {
    if (OUT_FMTS.indexOf(m[1]) < 1) usage();
    args.shift();
    outFmt = m[1];
  }
  if (args.length === 0) usage();
  const dbUrl = args.shift()!;
  let dbGrades: D.DbGrades | null = null;
  try {
    const dbResult = await D.makeDbGrades(dbUrl, F.rowAggrFns, F.colAggrFns);
    if (!dbResult.isOk) {
      console.error(dbResult.err.message);
      process.exit(1);
    }
    else {
      dbGrades = dbResult.val;
      await doCmd(dbGrades!, outFmt, args);
    }
  }
  catch (err) {
    error(err);
  }
  finally {
    if (dbGrades) {
      const closeResult = await dbGrades.close();
      if (!closeResult.isOk) error(closeResult.err.message);
    }
  }
}

const CMD_USAGE = `
  command can be one of:
     aggrGrades SECTION_ID 
       Return grades (including aggrs and student details) for SECTION_ID.
     aggrRows SECTION_ID 
       Return aggr rows for SECTION_ID.
     clear
       Clear out all data
     help:
       Print this message.
     loadSection SECTION_ID
       Reload info and data for SECTION_ID
     loadStudents
       Load all students (independent of section)
     patch SECTION_ID [ ROW_ID COL_ID VALUE ]...
       Update SECTION_ID with VALUE for [ROW_ID][COL_ID]
     rawGrades SECTION_ID
       Return raw grades (no aggrs or students) for SECTION_ID.
     studentGrades SECTION_ID STUDENT_ID
       Return single row of grades for SECTION_ID STUDENT_ID
`;

function usage() : never {
  console.error(`${scriptName()} [--out=${OUT_FMTS.join('|')}] DB_URL CMD ...`);
  console.error(CMD_USAGE);		  
  process.exit(1);
}


/****************************** Commands *******************************/


type CmdFn = (dbGrades: D.DbGrades, outFmt: string, args: string[]) => void;

function getSectionId(str: string) {
  const sectionId = str as T.SectionId;
  if (!Infos[sectionId]) error(`no info for sectionId ${sectionId}`);
  if (!Data[sectionId]) error(`no data for sectionId ${sectionId}`);
  return sectionId;
}

async function rawGrades(dbGrades: D.DbGrades, outFmt: string, args: string[]) {
  if (args.length !== 1) {
    error('rawGrades SECTION_ID');
  }
  const sectionId = getSectionId(args[0]);
  const gradesResult = await dbGrades.getRawData(sectionId);
  if (gradesResult.isOk) {
    outData(gradesResult.val, outFmt);
  }
  else {
    outErr(gradesResult.err);
  }
}

async function aggrGrades(dbGrades: D.DbGrades, outFmt: string, args: string[]) {
  if (args.length !== 1) {
    error('aggrGrades SECTION_ID');
  }
  const sectionId = getSectionId(args[0]);
  const gradesResult = await dbGrades.getSectionData(sectionId);
  if (gradesResult.isOk) {
    outData(gradesResult.val, outFmt);
  }
  else {
    outErr(gradesResult.err);
  }
}

async function aggrRows(dbGrades: D.DbGrades, outFmt: string, args: string[]) {
  if (args.length !== 1) {
    error('aggrGrades SECTION_ID');
  }
  const sectionId = getSectionId(args[0]);
  const gradesResult = await dbGrades.getAggrRows(sectionId);
  if (gradesResult.isOk) {
    outData(gradesResult.val, outFmt);
  }
  else {
    outErr(gradesResult.err);
  }
}

async function studentGrades(dbGrades: D.DbGrades, outFmt: string,
			     args: string[]) {
  if (args.length !== 2) {
    error('studentGrades SECTION_ID STUDENT_ID');
  }
  const sectionId = getSectionId(args[0]);
  const studentId = T.toStudentId(args[1]);
  const gradesResult = await dbGrades.getStudentData(sectionId, studentId);
  if (gradesResult.isOk) {
    outData(gradesResult.val, outFmt);
  }
  else {
    outErr(gradesResult.err);
  }
}

async function help(dbGrades: D.DbGrades, outFmt: string, args: string[]) {
  usage();
}

async function clear(dbGrades: D.DbGrades, outFmt: string, args: string[]) {
  outResult(await dbGrades.clear());
}

async function loadSection(dbGrades: D.DbGrades, outFmt: string,
			   args: string[]) {
  if (args.length !== 1) {
    error('loadSection SECTION_ID');
  }
  const sectionId = getSectionId(args[0]);
  const loadResult =
    await dbGrades.loadSection(Infos[sectionId], Data[sectionId]);
  outResult(loadResult);
}

async function loadStudents(dbGrades: D.DbGrades, outFmt: string,
			    args: string[]) {
  if (args.length !== 0) {
    error('loadStudents');
  }
  const addResult =  await dbGrades.addStudents(Students);
  outResult(addResult);
}

const NUM_RE = /^[-+]?\d+(\.\d*)?$/;

async function patch(dbGrades: D.DbGrades, outFmt: string, args: string[]) {
  if (args.length < 4 || args.length%3 !== 1) {
    error('patch SECTION_ID [ROW_ID COL_ID VAL]...');
  }
  const [ , ...args3] = args;
  const sectionId = getSectionId(args[0]);
  const triples : ([string, string, string])[] =
    Array.from({length: args3.length/3})
      .map((_, i) => [ args3[3*i], args3[3*i + 1], args3[3*i + 2] ]);
  let addResult: E.Result<void, E.Err> = E.okResult(undefined);
  for (const [ studentStr, assignStr, scoreStr ] of triples) {
    const studentId = T.toStudentId(studentStr);
    const assignId = assignStr as T.ColId;
    const score = (NUM_RE.test(scoreStr)) ? Number(scoreStr) : scoreStr;
    addResult = await dbGrades.addScore(sectionId, studentId, assignId, score);
    if (!addResult.isOk) break;
  }
  outResult(addResult);  
}

const DISPATCH_TABLE : { [cmd: string]: CmdFn } = {
  aggrGrades,
  aggrRows,
  clear,
  help,
  loadSection,
  loadStudents,
  patch,
  rawGrades,
  studentGrades,
};

async function doCmd(dbGrades: D.DbGrades, outFmt: string, args: string[]) {
  if (args.length < 1) usage();
  const cmd = args.shift()!;
  const cmdFn = DISPATCH_TABLE[cmd];
  if (!cmdFn) {
    error(`unknown command "${cmd}"`);
  }
  await cmdFn(dbGrades, outFmt, args);
}

/**************************** Output Routines **************************/

function outResult(result: E.Result<void, E.Err>) {
  if (result.isOk) {
    console.log('ok');
  }
  else {
    console.error(result.err.toString());
  }
}


/*
const MAX_DEC = 1;


function roundValues(table: Table) {
  const rounded = [];
  for (const row of table) {
    const roundedRow : {[colId: string]: number|string} = {};
    for (const [colId, val] of Object.entries(row)) {
      const rounded: number|string =
	Number(val) && /\./.test(val.toString())
	? Number((val as number).toFixed(MAX_DEC))
        : val;
      roundedRow[colId] = rounded;
    }
    rounded.push(roundedRow);
  }
  return rounded;
}
*/

function outData(data: T.SectionData, outFmt: string) {
  switch (outFmt) {
    case 'text':
      outTextTable(data);
      break;
    case 'js':
      console.log(data);
      break;
    case 'json':
      console.log(JSON.stringify(data));
      break;
    case 'json2':
      console.log(JSON.stringify(data, null, 2));
      break;
  }
}

function outTextTable(table: T.SectionData) {
  const out = (...args: any[]) => console.log(...args);
  const widths = colWidths(table);
  out(Object.keys(widths).map(k => k.padStart(widths[k])).join(' '));
  for (const row of Object.values(table)) {
    const items = [];
    for (const [k, w] of Object.entries(widths)) {
      const val = (row[k as T.ColId] ?? '').toString();
      items.push(NUM_RE.test(val) ? val.padStart(w) : val.padEnd(w));
    }
    out(items.join(' '));
  }
}
  
function colWidths(table: T.SectionData) : { [colId: string]: number } {
  const widths : { [colId: string]: number } = {};
  for (const row of Object.values(table)) {
    for (const [k, v] of (Object.entries(row))) {
      widths[k] ??= k.length;
      const vLen = (v ?? '').toString().length;
      if (widths[k] < vLen) widths[k] = vLen;
    }
  }
  return widths;
}


/******************************* Utilities *****************************/


function outErr(err: E.Err) : never {
  console.error(err.toString());
  process.exit(1);
}

function error(...args: any[]): never {
  console.error(...args);
  process.exit(1);
}
  
