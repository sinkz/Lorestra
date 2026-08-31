/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular imports make vertical slices and public APIs unstable.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-unresolved',
      severity: 'error',
      comment: 'Every import must resolve in the workspace.',
      from: {},
      // Workerd provides these virtual modules; they are not npm packages.
      to: { couldNotResolve: true, pathNot: '^cloudflare:(workers|test)$' },
    },
    {
      name: 'contracts-are-runtime-agnostic',
      severity: 'error',
      comment:
        'Transport contracts must not depend on server, browser, or storage code.',
      from: { path: '^packages/contracts/src' },
      to: { path: '(^|/)(apps|packages/(?!contracts))/' },
    },
  ],
  options: {
    doNotFollow: { path: ['node_modules'] },
    exclude: {
      path: ['(^|/)(?:dist|coverage|playwright-report|test-results|reports)(?:/|$)'],
    },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    combinedDependencies: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['types', 'import', 'browser', 'node', 'default'],
      extensions: ['.ts', '.tsx', '.d.ts', '.js', '.jsx', '.mjs', '.cjs', '.json'],
    },
    skipAnalysisNotInRules: true,
  },
}
