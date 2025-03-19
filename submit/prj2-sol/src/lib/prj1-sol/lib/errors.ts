// Immutable API

/** throw exception with msg and args; use when impossible conditions occur */
export function panic(msg: string, ...args: any) : never {
  throw new Error(msg + args.map((a: any) => JSON.stringify(a)).join(', '));
}

/** An error consists of a message, a code and possible options */

/** Error options must have an error 'code'.  They may also have other
 *  optional properties like 'widget' specifying the ID of the widget
 *  causing the error.
 */
export type ErrOptions = Record<string, string>;

const DEFAULT_ERR_CODE = 'UNKNOWN';

export class Err extends Error {
  readonly code: string;
  readonly options: ErrOptions;
  private constructor(message: string, code: string, options: ErrOptions) {
    super(message); this.code = code; this.options = options;
  }
  toString() {
    const code = this.code === DEFAULT_ERR_CODE  ? '' : `${this.code}: `;
    return `${code}${this.message}`;
  }
  //factory method to create an Err
  static err(e: string|Error|Object, code: string = DEFAULT_ERR_CODE,
	     opts: ErrOptions = {}) {
    const msg = (e instanceof Error) ? e.message : e.toString();
    return new Err(msg, code, opts);
  }
};


class OkResult<T> {
  readonly isOk = true as const;
  val: T;
  constructor(val: T) { this.val = val; }
}

class ErrResult<E> {
  readonly isOk = false as const;
  err: E;
  constructor(err: E) { this.err = err; }
}

export type Result<T, E> = OkResult<T> | ErrResult<E>;

export function okResult<T, E>(val: T): Result<T, E> {
  return new OkResult(val);
}

export function errResult<T, E>(err: E): Result<T, E> {
  return new ErrResult(err);
}


