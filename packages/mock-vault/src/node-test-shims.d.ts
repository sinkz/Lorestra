/**
 * The mock package intentionally has no Node runtime dependency.  These
 * narrow declarations keep the Vitest-only vault coverage test typed without
 * pulling the full Node type bundle into the published package.
 */

declare module 'node:fs' {
  interface Dirent {
    readonly name: string
    isDirectory(): boolean
    isFile(): boolean
  }

  export function readdirSync(
    directory: string,
    options: { readonly withFileTypes: true },
  ): Dirent[]
}

declare module 'node:path' {
  export function relative(from: string, to: string): string
  export function resolve(...paths: string[]): string
}

interface ImportMeta {
  readonly dirname: string
}
