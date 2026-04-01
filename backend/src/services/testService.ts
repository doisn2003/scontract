/**
 * testService.ts
 * Run unit tests inside Docker sandbox cho 1 smart contract cụ thể.
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
  contractId: string,
  testCode: string,
  library: 'viem' | 'ethers' = 'viem'
): Promise<SandboxTestResult> {
  const project = await Project.findOne({ _id: projectId, userId });
  if (!project) throw new Error('Project not found');

  const contract = project.contracts.id(contractId);
  if (!contract) throw new Error('Contract not found in project');

  if (!contract.soliditySource) {
    throw new Error('No Solidity source code found for this contract');
  }

  console.log(`[testService] Running tests for project ${projectId}, contract ${contractId} (lib: ${library})`);

  let context = null;
  try {
    const plugin = library === 'viem' ? 'viem' as const : 'toolbox' as const;

    context = await createSandbox(contract.soliditySource, {
      mode: 'test',
      testCode,
      plugin,
    });

    const { stdout, stderr } = await runContainer(
      context.sandboxPath,
      'npx hardhat test --config /app/project/hardhat.config.js',
      {},
      false
    );

    let result = collectTestResult(context.sandboxPath);

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
