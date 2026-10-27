// Narrow, hand-written types for exactly the `bun:test` exports these test
// files use (describe/it/beforeEach/expect/mock.module). Deliberately NOT a
// `/// <reference types="bun" />` (or "bun-types") — that pulls in Bun's
// full global type surface, including its own `typeof fetch` augmentation,
// which collided with the generated Supabase integration files' fetch
// wrapper types project-wide ("Property 'preconnect' is missing..."). A
// `declare module` block, unlike a `/// <reference>`, only takes effect for
// code that actually imports from "bun:test" — it declares no globals and
// touches nothing outside these test files.
declare module "bun:test" {
  export function describe(name: string, fn: () => void): void;
  export const it: {
    (name: string, fn: () => void | Promise<void>): void;
    skip(name: string, fn: () => void | Promise<void>): void;
  };
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function beforeAll(fn: () => void | Promise<void>): void;
  export function afterAll(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;

  /** Only the matchers this test suite actually calls. */
  export interface Matchers<T> {
    toBe(expected: T): void;
    toEqual(expected: T): void;
    toMatchObject(expected: unknown): void;
    toHaveLength(expected: number): void;
    toContainEqual(expected: unknown): void;
    toBeNull(): void;
    toBeTruthy(): void;
    toContain(expected: unknown): void;
    toBeGreaterThan(expected: number): void;
    toBeLessThanOrEqual(expected: number): void;
    toThrow(expected?: string | RegExp): void;
    readonly not: Matchers<T>;
    readonly rejects: Matchers<unknown>;
  }

  export function expect<T>(actual: T): Matchers<T>;

  export const mock: {
    module(specifier: string, factory: () => unknown): void;
  };
}
