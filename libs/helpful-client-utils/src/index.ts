'use client';
import type * as z from 'zod';

export * from './useErrorTranslationMessage/useErrorTranslationMessage';

declare type IsAny<T> = [any extends T ? 'true' : 'false'] extends ['true']
  ? true
  : false;
declare type Equals<X, Y> = [X] extends [Y]
  ? [Y] extends [X]
    ? true
    : false
  : false;

type MakeNullish<T> = z.ZodOptional<
  z.ZodNullable<ToZod<Exclude<T, null | undefined>>>
>;

type IsNullish<T> = null extends T
  ? undefined extends T
    ? true
    : false
  : false;

export declare type ToZod<T> = IsAny<T> extends true
  ? never
  : [T] extends [boolean]
  ? z.ZodBoolean
  : IsNullish<T> extends true
  ? MakeNullish<T>
  : [undefined] extends [T]
  ? T extends undefined
    ? never
    : z.ZodOptional<ToZod<T>>
  : [null] extends [T]
  ? T extends null
    ? never
    : z.ZodNullable<ToZod<T>>
  : T extends Array<infer U>
  ? z.ZodArray<ToZod<U>>
  : T extends Promise<infer U>
  ? z.ZodPromise<ToZod<U>>
  : Equals<T, string> extends true
  ? z.ZodString
  : Equals<T, bigint> extends true
  ? z.ZodBigInt
  : Equals<T, number> extends true
  ? z.ZodNumber
  : Equals<T, Date> extends true
  ? z.ZodDate
  : T extends Record<string, any>
  ? z.ZodObject<
      {
        [k in keyof T]-?: ToZod<T[k]>;
      },
      'strip',
      z.ZodTypeAny,
      T,
      T
    >
  : never;

export * from './getTextareaCaretPosition/getTextareaCaretPosition';
export * from './useDateFormatter/useDateFormatter';
