import * as Fns from './hw1-sol.js';
import { doSuitesTests, Suites }  from './test-utils.js';

// Add testAction: 'skip'|'only' for a suite (just before the tests property)
// to skip tests for a suite, or only run tests for that suite.

const SUITES: Suites  = {
  emphasize: {
    testAction: 'only',
    tests: [
      [ () => Fns.emphasize('hello', 1), '*hello*' ],
      [ () => Fns.emphasize('hello', 2), '**hello**' ],
      [ () => Fns.emphasize('hello', 0), 'hello' ],
      [ () => Fns.emphasize('', 2), '****' ],
      [ () => Fns.emphasize('', 0), '' ],
    ],
  },

  rmMid: {
    testAction: 'only',
    tests: [
      [ () => Fns.rmMid('hello world', 3), 'hellorld' ],
      [ () => Fns.rmMid('hello world', 0), 'hello world' ],
      [ () => Fns.rmMid('hello world', 5), 'hellod' ],
      [ () => Fns.rmMid('hello world', 10), 'hello' ],
      [ () => Fns.rmMid('', 10), '' ],
    ],
  },

  charsCount: {
    testAction: 'only',
    tests: [
      [ () => Fns.charsCount('aaabbb'), 2 ],
      [ () => Fns.charsCount('abababc'), 3 ],
      [ () => Fns.charsCount(''), 0 ],
    ],
  },

  wordsWithLenMultiple: {
    testAction: 'only',
    tests: [
      [ () => Fns.wordsWithLenMultiple('betty bought a bit of butter', 3),
	[ 'bought', 'bit', 'butter' ] ],
      [ () => Fns.wordsWithLenMultiple('betty bought a bit of butter', 2),
	[ 'bought', 'of', 'butter' ] ],
      [ () => Fns.wordsWithLenMultiple('betty bought a bit of butter', 4), [] ],
    ],
  }, 
  
  replaceIntsWithLengths: {
    testAction: 'only',
    tests: [
      [ () => Fns.replaceIntsWithLengths('hello324 wo4rld 994'),
	'hello3 wo1rld 3' ],
      [ () => Fns.replaceIntsWithLengths('hello world'), 'hello world' ],
      [ () => Fns.replaceIntsWithLengths('   '), '   ' ],
      [ () => Fns.replaceIntsWithLengths(''), '' ],
      [ () => Fns.replaceIntsWithLengths('   hello 999999  world  '),
	'   hello 6  world  ' ],
    ],
  }, 
  
  nPermutations: {
    testAction: 'only',
    tests: [
      [ () => Fns.nPermutations([]), 1 ],
      [ () => Fns.nPermutations([1, 2, 3]), 6 ],
      [ () => Fns.nPermutations([1, 2, 3, 3, 1, 1]), 720 ],
    ],
  }, 
  
  sumProducts: {
    testAction: 'only',
    tests: [
      [ () => Fns.sumProducts([1, 2, 3], 1), 6 ],
      [ () => Fns.sumProducts([1, 2, 3], 3), 18 ],
      [ () => Fns.sumProducts([], 3), 0 ],
    ],
  }, 

  reversedRange: {
    testAction: 'only',
    tests: [
      [ () => Fns.reversedRange(4), [ 3, 2, 1, 0 ] ],
      [ () => Fns.reversedRange(0), [] ],
    ],
  },
  
  range: {
    testAction: 'only',
    tests: [
      [ () => Fns.range(4), [ 0, 1, 2, 3 ] ],
      [ () => Fns.range(4, 3), [ 3, 4, 5, 6 ] ],
      [ () => Fns.range(4, 3, 3), [ 3, 6, 9, 12 ] ],
      [ () => Fns.range(6, -2, 9), [ -2, 7, 16, 25, 34, 43 ] ],
      [ () => Fns.range(4, -2, -5), [ -2, -7, -12, -17 ] ],
      [ () => Fns.range(0, 3, 3), [] ],
    ],
  }, 

  lineAt:  {
    testAction: 'only',
    tests: [
      [ () => Fns.lineAt('012\nabcd', 0), '012' ],
      [ () => Fns.lineAt('012\nabcd', 1), '012' ],
      [ () => Fns.lineAt('012\nabcd\n', 5), 'abcd' ],
      [ () => Fns.lineAt('012\nabcd', 5), 'abcd' ],
      [ () => Fns.lineAt('012\nabcd', 3), '' ],
    ],
  }, 

  fixedLengthLines: {
    testAction: 'only',
    tests: [
      [ () => Fns.fixedLengthLines('12345\n1\n12', 3), '123\n1  \n12 \n' ],
      [ () => Fns.fixedLengthLines('', 3), '   \n' ],
    ],
  }, 
  
  oddLengthLines: {
    testAction: 'only',
    tests: [
      [ () => Fns.oddLengthLines('1234\n123\n123\n1234\n'), '123\n123\n' ],
      [ () => Fns.oddLengthLines('1234\n123\n\n\n123\n1234\n'), '123\n123\n' ],
      [ () => Fns.oddLengthLines('1234\n1234\n1234\n1234\n'), '' ],
      [ () => Fns.oddLengthLines(''), '' ],
    ],
  },
  
  sumPartials: {
    testAction: 'only',
    tests: [
      [ () => Fns.sumPartials([1, 2, 3]), [1, 3, 6] ],
      [ () => Fns.sumPartials([22, 33, 44]), [22, 55, 99] ],
      [ () => Fns.sumPartials([22]), [22] ],
      [ () => Fns.sumPartials([]), [] ],
    ],
  }, 
  
};

doSuitesTests(SUITES, 'Fns.');
