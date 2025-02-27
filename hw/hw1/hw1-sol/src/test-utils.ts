type TestAction = 'skip' | 'only';


type TestSpec =
  [ () => any,     //thunk invoking test function
    any,           //result
  ];

type SuiteInfo = { tests: TestSpec[], testAction?: TestAction };

//Suites is a mapping from SuiteName to info for that suite.
export type Suites = Record<string, SuiteInfo>;

function chkEqual(a: any, b: any) : boolean {
  if (typeof a === 'object') {
    if (typeof b !== 'object') return false;
    return Object.entries(a).every(([k, v]) => chkEqual(v, b[k]));
  }
  else {
    return a === b;
  }	   
}

export function doSuitesTests(suites: Suites, stripPrefix = '') {
  const p = console.log;
  const indent = ' '.repeat(2);
  const indent2 = indent.repeat(2);
  const onlyNames =
    Object.keys(suites).filter(k => suites[k].testAction === 'only');
  const names = (onlyNames.length > 0) ? onlyNames : Object.keys(suites);
  for (const name of names) {
    const info = suites[name];
    const action = info.testAction === 'skip' ? 'skipping' : 'testing';
    p(`${action} ${name}()`);
    if (info.testAction !== 'skip') {
      info.tests.forEach((t: TestSpec) => {
	const actual = t[0]();
	const expected = t[1];
	const isOk = chkEqual(actual, expected);
	const name = t[0].toString().replace(/^\W+/, '')
	  .slice(stripPrefix.length);
	if (isOk) {
	  p(`${indent}okay: ${name}\n${indent2}==> ${valToStr(actual)}`);
	}
	else {
	  p(`${indent}failed: ${name}\n${indent2}==> ${valToStr(actual)}` 
	    + `; expected ${valToStr(expected)}`);
	}
      });
    }
    p();
  }
}

function valToStr(val: any) : string {
  if (Array.isArray(val)) {
    return `[ ${val.map(valToStr).join(', ')} ]`;
  }
  else if (typeof val === 'string') {
    return `"${val}"`;
  }
  else {
    return val.toString();
  }
}
