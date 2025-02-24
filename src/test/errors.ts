import { errResult, okResult, Err } from '../lib/errors.js';

import { assert, expect } from 'chai';

//use assert(result.isOk === true) and assert(result.isOk === false)
//to ensure that typescript narrows result correctly


describe('errors', () => {

  it('should return an ok result for a simple value', () => {
    const val = 42;
    const result = okResult(val);
    assert(result.isOk === true);
    expect(result.val).to.equal(val);
  });

  it('should return an ok result for a complex value', () => {
    const val = { a: 33, b: 44 };
    const result = okResult(val);
    assert(result.isOk === true);
    expect(result.val).to.equal(val);
  });

  it('should return an err from string with a code', () => {
    const err = ERRORS[0];
    const result = errResult(Err.err(...err));
    assert(result.isOk === false);
    expect(result.err.message).to.equal(err[0]);
    expect(result.err.code).to.equal(err[1]);
  });

  it('should return an err from string with a code and widget', () => {
    const err = ERRORS[1];
    const result = errResult(Err.err(...err));
    assert(result.isOk === false);
    expect(result.err.message).to.equal(err[0]);
    expect(result.err.code).to.equal(err[1]);
    expect(result.err.options.widget).to.equal(err[2].widget);
  });

  it('should return an err from Error with a code and widget', () => {
    const err = ERRORS[2];
    const result = errResult(Err.err(...err));
    assert(result.isOk === false);
    expect(result.err.message).to.equal((err[0] as Error).message);
    expect(result.err.options).to.deep.equal(err[2]);    
  });
  
  it('should return an err from Object with a code', () => {
    const err = ERRORS[3];
    const result = errResult(Err.err(...err));
    assert(result.isOk === false);
    expect(result.err.message).to.equal(err[0].toString());
    expect(result.err.options).to.deep.equal(err[2]);    
  });
  

  it('should return an err from a non-Err object', () => {
    const err = { code: 'BAD_ARG', msg: 'arg must be > 22' };
    const result = errResult(err);
    assert(result.isOk === false);
    expect(result.err).to.equal(err);    
  });
  

  

});

const ERRORS: [Object, string, Record<string, string>][] = [
  [ 'here is an error', 'BAD_VALUE', {} ],
  [ 'yet another error', 'BAD_ARG', { widget: 'arg' }, ],
  [ new Error('some other error'),  'BAD_NAME', 
    {widget: 'name', info: 'some error details' }],
  [ { a:22, b: 33, toString() { return JSON.stringify(this); }, },
    'BAD_TYPE', {} ],
      
];

