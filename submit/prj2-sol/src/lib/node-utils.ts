import fs from 'fs';
import Path from 'path';
import util from 'util';

const { promisify } = util;

import { Errors as E } from './prj1-sol/main.js';
type Result<T> = E.Result<T, E.Err>;

function errResult(msg: string) { return E.errResult(E.Err.err(msg)); }

export async function readJson(path: string) : Promise<Result<any>> {
  let text : string;
  try {
    text = await promisify(fs.readFile)(path, 'utf8');
  }
  catch (err) {
    const e = err as Error;
    return errResult(`unable to read ${path}: ${e.message}`);
  }
  try {
    if (path.endsWith('.jsonl')) {
      text = '[' + text.trim().replace(/\n/g, ',') + ']';
    }
    return E.okResult(JSON.parse(text));
  }
  catch (err) {
    const e = err as Error;
    return errResult(`unable to parse JSON from ${path}: ${e.message}`);
  }
}

export function cwdPath(path: string) : string {
  return (path.startsWith(Path.sep)) ? path : Path.join(process.cwd(), path);
}

export function scriptName() : string {
  return Path.basename(process.argv[1]);
}

export function abort(msg: string, ...args: any[]) : never {
  const text = msg + args.map(a => JSON.stringify(a)).join(' ');
  console.error(text);
  process.exit(1);
}
