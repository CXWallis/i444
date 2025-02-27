#!/usr/bin/env ts-node


/** *** IMPORTANT NOTE ***

ALL FUNCTIONS BELOW MUST BE IMPLEMENTED WITHOUT USING RECURSION OR **ANY**
DESTRUCTIVE OPERATIONS.

Some consequences:

  + *NO LOOPS* of any kind.

  + Only const declarations.

  + Use Array methods like .map() and .reduce() and Array.from({length:n}) 
    (to create an empty n-element array).

  + No destructive Array methods like .push() (use .concat() instead).

  + You may use not destructive methods like .reverse(), but can use the
    newer non-destructive .toReversed().

  + Use String methods like split().

  + Use RegExp methods.

More details are in the .<restrictions.html> document linked from the
main assignment.

When fully implemented, running this file should result in the LOG
linked from the main assignment.

*/


type TODO = any; //to mark TODO return values

// #1: 4-points

// Given string `text` and non-negative integer `n`, return
// `text` preceded and followed by `n` '*'s.
export function emphasize(text: string, n: number) : string {
  return `${'*'.repeat(n)}${text}${'*'.repeat(n)}`;
}

// #2: 4-points

// Given a string `str` and non-negative integer `n`, return string
// `str` with the `n` characters starting at index str.length/2 removed.
export function rmMid(str: string, n: number) : string {
  return str.slice(0, str.length/2) + str.slice(str.length/2 + n);
}


// #3: 4-points

// Return a count of the number of distinct characters in text.
export function charsCount(text: string) : number {
  return new Set( [ ...text ] ).size;
}


// #4: 4-points

// Given a string `text`, and positive integer `n`, return a list of
// all words in `text` which have a length divisible by `n`. Note that
// a word is a maximal sequence of characters which are not
// whitespace.
export function wordsWithLenMultiple(text: string, n: number) : string[] {
  return text.split(' ').filter( text => text.length % n === 0 );
}

// #5: 4-points

// Return `text` with all digit sequences replaced with the length of
// that digit sequence.
export function replaceIntsWithLengths(text: string) : string {
  return text.replace(/\d+/gm, match => match.length.toString() )
}


// #6: 5-points

// given an array `arr` of arbitrary JavaScript objects, return
// the number of permutations of that array.
// Note that all array elements in `arr` are always regarded as distinct.
export function nPermutations(arr: any[]) : number {
  return arr.map( ( _, index ) => index + 1).reduce( ( product, current ) => product * current, 1)
}

// #7: 5-points

// Given a list `coeffs` of numbers and a number `x` return the
// sum of multiplying `x` by each element of `coeff`.
export function sumProducts(coeffs: number[], x: number) : number {
  return coeffs.map( value => value * x ).reduce( ( prev, current ) => prev + current, 0 );
}

// #8: 5-points

// Given a non-negative integer `n`, return an `n`-element array
// `[(n-1), (n-2), ..., 1, 0]`.
// Your solution may not use Array toReversed().
export function reversedRange(n: number) : number[] {
  return Array.from( { length: n }, ( _, i ) => i + 1 ).map( value => n - value );
}


// #9: 5-points

// Given a non-negative integer `n`, and integers `init` and `inc`
// returns an `n`-element array `[ init, init + inc, init + 2*inc,
// ..., init + (n-1)*inc]`.
export function range(n: number, init = 0, inc = 1) : number[] {
  return Array.from( { length: n }, ( _, index ) => init + index * inc );
}

// #10: 5-points

// Given a string `text` and index `offset`, returns the line at index
// `offset` in string `text`.  A line is defined to be a maximal
// sequence of characters which does not contain a `'\n'` newline
// character.
export function lineAt(text: string, offset: number) : string {
  const target_character: string = text.charAt( offset );
  if ( target_character === '\n' ) return '';
  // mother of all maps
  const line_lengths: number[] = text.split('\n').map( (text, index, array) => text.length + ( index >= 1 ? array[ index - 1 ].length + 1 : 0 ) - 1 );
  const line_index: number = line_lengths.findIndex( value => value > offset );
  return text.split('\n')[ line_index ];
}

// #11: 5-points

// Given a string `text`, return `text` with all lines within text
// with length set to `len`.  When a line is shorter than `len` it is
// padded on the right with the requisite number of spaces; when it's
// length is greater than `len`, the requisite number of suffix
// characters are removed.  Note that a line is a maximal sequence of
// characters not containing a newline character `'\n'`.
//
// All lines in the return value must always be followed by a `'\n'`
// character irrespective of whether that is the case for the
// corresponding line in `text`.
export function fixedLengthLines(text: string, len: number) : string {
  return text.split('\n').map( line => line.length > len ? line.slice(0, len ) : line.length < len ? line.padEnd( len ) : line ).join('\n').concat('\n');
}

// #12: 10-points

// Given a string `text`, return `text` with all lines which have
// even length (not counting the `'\n'`) removed.  Note that a line
// is a maximal sequence of characters not containing a newline
// character `'\n'`.
//
// All lines in the return va lue must always be followed by a `'\n'`
// character irrespective of whether that is the case for the
// corresponding line in `text`.
export function oddLengthLines(text: string) : string {
  return text.split('\n').filter( line => line.length % 2 !== 0 ).map(line => line + '\n').join('');
}

// #13

// Given a list `nums` of numbers, return the list containing the
// sums of the prefixes of `nums`.
//
// The performance *must* be *linear* in the size of `nums`.
export function sumPartials(nums: number[]) : number[] {
  return nums.map( ( _, index ) => nums.slice( 0, index + 1 ).reduce( ( prev, current ) => prev + current, 0 ) );
}

