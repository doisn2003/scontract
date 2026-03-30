/**
 * testService.ts
 * Phase 6: Run unit tests inside Docker sandbox.
 *
 * Flow:
 *   1. createSandbox({mode:'test', testCode, plugin})
 *   2. runContainer('npx hardhat test --config ...')
 *   3. collectTestResult() → parse test-result.json or Mocha stdout
 *   4. cleanup()
 */

import Project from '../models/Project.js';
import {
  createSandbox,
  runContainer,
  collectTestResult,
  cleanup,
  type SandboxTestResult,
} from './sandboxService.js';
import { parseTestOutput } from '../utils/testResultParser.js';

export async function runTests(
  projectId: string,
  userId: string,
  testCode: string,
  library: 'viem' | 'ethers' = 'viem'
): Promise<SandboxTestResult> {
  const project = await Project.findOne({ _id: projectId, userId });
  if (!project) throw new Error('Project not found');

  if (!project.soliditySource) {
    throw new Error('No Solidity source code found');
  }

  console.log(`[testService] Running tests for project ${projectId} (lib: ${library})`);

  let context = null;
  try {
    // Map library to plugin name
    const plugin = library === 'viem' ? 'viem' as const : 'toolbox' as const;

    context = await createSandbox(project.soliditySource, {
      mode: 'test',
      testCode,
      plugin,
    });

    // Run: npx hardhat test with 60s timeout (sandbox already has 120s)
    const { stdout, stderr } = await runContainer(
      context.sandboxPath,
      'npx hardhat test --config /app/project/hardhat.config.js',
      {},
      false // no network needed — runs on Hardhat local node
    );

    // First try structured result file
    let result = collectTestResult(context.sandboxPath);

    // If no structured result, parse from Mocha stdout
    if (!result.tests || result.tests.length === 0) {
      const parsed = parseTestOutput(stdout + '\n' + stderr);
      if (parsed.tests.length > 0) {
        result = {
          success: parsed.summary.failing === 0,
          summary: parsed.summary,
          tests: parsed.tests,
          rawOutput: stdout.substring(0, 5000),
        };
      } else if (!result.error) {
        // No result at all — provide raw output
        result = {
          success: false,
          rawOutput: (stdout + '\n' + stderr).substring(0, 5000),
          error: 'Could not parse test results. Check raw output.',
        };
      }
    }

    return result;
  } catch (err) {
    console.error('[testService] Error:', err);
    return {
      success: false,
      error: String(err),
    };
  } finally {
    if (context) cleanup(context.sandboxPath);
  }
}
