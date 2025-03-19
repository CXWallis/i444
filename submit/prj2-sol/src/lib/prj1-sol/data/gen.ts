import * as T from '../lib/types.js';
import * as E from '../lib/errors.js';

import STUDENTS from './students.js';
import { cs201Info } from './cs201-info.js';
import { en101Info } from './en101-info.js';

import Path from 'path';

const SECTION_INFOS: Record<string, T.SectionInfo> = {
  cs201: cs201Info,
  en101: en101Info,
};

//From <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random>
/** Returns random int in [min, max) */
function randInt(min: number, max: number) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min; 
}


function randNatnum(max: number) { return randInt(0, max); }

function randNumber(min: number, max: number) {
  return (Math.random() * (max - min)) + min; 
}

function randChoice<T>(choices: T[]) {
  return choices[randNatnum(choices.length)];
}

/** Return n distinct random cartesian product of choiceSets as a list
 *  of lists; if choiceSets.length === 1, simply return a list.
 */
function randChoices<T>(n: number, choices: T[]) {
  console.assert(n <= choices.length);
  const selected = [];
  while (selected.length < n) {
    const selection = randChoice(choices);
    if (selected.indexOf(selection) < 0) selected.push(selection);
  }
  return selected;
};

const ABILITIES = [1, 2, 2, 3, 3, 3];

function abilityTextScore(ability: number, scores: string[]) {
  if (Math.random() < 0.05) return null;
  const relAbility = ability/(ABILITIES.at(-1) as number);
  const n = scores.length;
  const i = Math.trunc(relAbility*(n - 1));
  const index =
    (i === n - 1)
    ? i - randInt(0, 3)
    : (i === 0)
    ? i + randInt(0, 3)
    : i + randInt(-1, 2);
  return scores[index < 0 ? 0 : index >= n ? n - 1 : index];
}

function abilityNumScore(ability: number, min: number, max: number) {
  if (Math.random() < 0.05) return null;
  const range = max - min;
  const minScore = min + range/10;
  const diff = range/(ABILITIES.at(-1) as number - ABILITIES[0] + 2);
  let score = min + diff*ability + randNumber(-diff/2, +diff);
  if (score < minScore) score = minScore + randNumber(0, range/10);  
  return Number(score.toFixed(0));
}

function rowData(sectionInfo: T.SectionInfo, student: T.Student,
		 ability: number) {
  const row: T.RowData = { };
  for (const hdr of Object.values(sectionInfo.colHdrs)) {
    switch (hdr._tag) {
      case 'numScore':
	row[hdr.id] = abilityNumScore(ability, hdr.min, hdr.max);
	break;
      case 'textScore':
	row[hdr.id] = abilityTextScore(ability, hdr.vals);
	break;
      case 'student':
	//row[hdr.id] = student[hdr.key];
	break;
      case 'aggrCol':
	break;
      default:
	const _never: never = hdr;
	break;
    }
  }
  return row;
}

function go(courseIds: string[]) {
  const sectionInfos: T.SectionInfo[] =
    courseIds.map(courseId => {
      const info = SECTION_INFOS[courseId];
      if (!info) panic(`no sectionInfo for "${courseId}"`);
      return info;
    });
  const studentAbilities: Record<T.StudentId, number> =
    Object.fromEntries(STUDENTS.map(s => [s.id, randChoice(ABILITIES)]));
  const data: Record<string, T.SectionData> = {};
  for (const sectionInfo of sectionInfos) {
    const nStudents = randInt(20, STUDENTS.length);
    const students = randChoices(nStudents, STUDENTS);
    const sectionData: T.SectionData = {};
    for (const student of students) {
      const ability = studentAbilities[student.id];
      sectionData[student.id] = rowData(sectionInfo, student, ability);
    }
    data[sectionInfo.id] = sectionData;
  }
  console.log(JSON.stringify(data, null, 2));
}

function panic(msg: string, ...args: any) : never {
  console.error(msg, ...args);
  process.exit(1);
}

if (process.argv.length < 3) {
  panic(`usage: ${Path.basename(process.argv[1])} COURSE_ID...`);
}
go(process.argv.slice(2));
