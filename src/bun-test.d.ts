declare module 'bun:test' {
  export function describe(name: string, fn: () => void): void
  export function test(name: string, fn: () => void): void
  export interface Matchers {
    toBe(expected: unknown): void
    toEqual(expected: unknown): void
    toHaveLength(expected: number): void
    toContain(expected: unknown): void
    toThrow(): void
    toBeNull(): void
    not: Matchers
  }
  export function expect(actual: unknown): Matchers
}
