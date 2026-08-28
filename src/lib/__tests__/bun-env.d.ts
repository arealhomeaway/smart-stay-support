// Makes `bun:test` (describe/it/expect/mock/beforeEach, etc.) resolve for
// typechecking. Deliberately scoped to a single ambient declarations file
// under __tests__ rather than added to compilerOptions.types, so it only
// loads when test files are part of the compilation and stays out of the
// way of the app's own automatic @types inclusion. Bun's types are built to
// coexist with the DOM lib already used by the rest of this project (see
// bun-types' `UseLibDomIfAvailable` pattern), so this does not change how
// browser-facing code typechecks.
/// <reference types="bun" />
