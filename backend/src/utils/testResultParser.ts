/**
 * testResultParser.ts
 * Parse Mocha console output (stdout) into structured JSON results.
 *
 * Mocha output patterns:
 *   ✓ Test name (42ms)
 *   1) Failing test name
 *
 *   N passing (Xms)
 *   N failing
 *
 *   1) Suite > Test name:
 *      Error: revert reason
 *      ...stack trace...
 */

export interface ParsedTestCase {
  title: string;
  status: 'passing' | 'failing';
  duration?: number;
  error?: string;
}

export interface ParsedTestOutput {
  summary: {
    total: number;
    passing: number;
    failing: number;
    duration: number;
  };
  tests: ParsedTestCase[];
}

export function parseTestOutput(output: string): ParsedTestOutput {
  const lines = output.split('\n');
  const tests: ParsedTestCase[] = [];

  let passing = 0;
  let failing = 0;
  let totalDuration = 0;

  // Match passing tests: "    ✓ Test name (42ms)" or "    ✓ Test name"
  const passRegex = /^\s*[✓✔]\s+(.+?)(?:\s+\((\d+)ms\))?\s*$/;
  // Match failing test reference: "    1) Test name"
  const failRefRegex = /^\s*(\d+)\)\s+(.+)\s*$/;
  // Match summary: "  N passing (Xms)"
  const passingSummaryRegex = /^\s*(\d+)\s+passing\s*\((.+?)\)\s*$/;
  const failingSummaryRegex = /^\s*(\d+)\s+failing\s*$/;

  // Error blocks after failures
  const errorBlockRegex = /^\s+\d+\)\s+(.+?):\s*$/;

  let currentError = '';
  let collectingError = false;
  let errorTestTitle = '';

  for (const line of lines) {
    // Passing test
    const passMatch = line.match(passRegex);
    if (passMatch) {
      tests.push({
        title: passMatch[1].trim(),
        status: 'passing',
        duration: passMatch[2] ? parseInt(passMatch[2]) : undefined,
      });
      continue;
    }

    // Failing test reference
    const failMatch = line.match(failRefRegex);
    if (failMatch && !collectingError) {
      tests.push({
        title: failMatch[2].trim(),
        status: 'failing',
      });
      continue;
    }

    // Summary passing
    const passSumMatch = line.match(passingSummaryRegex);
    if (passSumMatch) {
      passing = parseInt(passSumMatch[1]);
      const durStr = passSumMatch[2];
      if (durStr.includes('ms')) {
        totalDuration = parseInt(durStr);
      } else if (durStr.includes('s')) {
        totalDuration = parseFloat(durStr) * 1000;
      }
      continue;
    }

    // Summary failing
    const failSumMatch = line.match(failingSummaryRegex);
    if (failSumMatch) {
      failing = parseInt(failSumMatch[1]);
      continue;
    }

    // Error block start
    const errorMatch = line.match(errorBlockRegex);
    if (errorMatch) {
      // Attach previous error if any
      if (collectingError && errorTestTitle) {
        const errTest = tests.find(t => t.title === errorTestTitle && !t.error);
        if (errTest) errTest.error = currentError.trim();
      }
      errorTestTitle = errorMatch[1].trim();
      currentError = '';
      collectingError = true;
      continue;
    }

    if (collectingError) {
      if (line.trim() === '' && currentError.length > 0) {
        // End of error block
        const errTest = tests.find(t => t.title === errorTestTitle && !t.error);
        if (errTest) errTest.error = currentError.trim();
        collectingError = false;
      } else {
        currentError += line.trimEnd() + '\n';
      }
    }
  }

  // Finalize any remaining error
  if (collectingError && errorTestTitle) {
    const errTest = tests.find(t => t.title === errorTestTitle && !t.error);
    if (errTest) errTest.error = currentError.trim();
  }

  return {
    summary: {
      total: passing + failing,
      passing,
      failing,
      duration: totalDuration,
    },
    tests,
  };
}
