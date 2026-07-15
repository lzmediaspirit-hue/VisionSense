// Minimal ambient declarations for the Node globals the CLI uses. The project
// has no @types/node, and only src/polymarket/cli.ts runs under Node, so we
// declare just what that file needs rather than pulling in the full Node types.

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exitCode: number
  exit(code?: number): never
}
