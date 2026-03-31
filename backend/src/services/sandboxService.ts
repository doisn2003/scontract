/**
 * sandboxService.ts
 * Core Orchestrator: Manages ephemeral Docker containers for Hardhat compilation/deployment/testing.
 *
 * Lifecycle per request:
 *   1. createSandbox()  → Tạo thư mục tạm, write .sol + hardhat.config.js + script
 *   2. runContainer()   → docker run --rm -v <sandboxPath>:/app/project <image> <command>
 *   3. collectResults() → Đọc result.json từ thư mục tạm
 *   4. cleanup()        → Xóa thư mục tạm
 *
 * Windows path note:
 *   os.tmpdir() → "C:\\Users\\HUST\\AppData\\Local\\Temp"
 *   Docker Desktop for Windows requires forward slashes in -v flag:
 *   "C:/Users/HUST/AppData/Local/Temp/project-uuid"
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { extractSolidityVersion, extractContractName } from '../utils/solidityParser.js';
import { generateCompileOnlyConfig, generateTestConfig, generateDeployConfig } from '../utils/hardhatConfigGen.js';
import { generateCompileScript, generateDeployScript } from '../utils/deployScriptGen.js';

const execAsync = promisify(exec);

// --- Constants ---
const DOCKER_IMAGE = 'scontract-hardhat-base';
const DOCKER_TIMEOUT_MS = 300_000; // 5 minutes per container run
const RESULT_FILE = 'result.json';
const TEST_RESULT_FILE = 'test-result.json';

// --- Types ---
export interface SandboxCompileResult {
  success: boolean;
  contractName: string;
  abi?: object[];
  bytecode?: string;
  deployedBytecode?: string;
  error?: string;
  details?: string;
}

export interface SandboxDeployResult {
  success: boolean;
  contractName: string;
  address?: string;
  abi?: object[];
  bytecode?: string;
  deployTxHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  error?: string;
  details?: string;
}

export interface SandboxTestResult {
  success: boolean;
  summary?: {
    total: number;
    passing: number;
    failing: number;
    duration: number;
  };
  tests?: Array<{
    title: string;
    status: 'passing' | 'failing';
    duration?: number;
    error?: string;
  }>;
  rawOutput?: string;
  error?: string;
}

export interface SandboxContext {
  sandboxId: string;
  sandboxPath: string;
  contractName: string;
  solidityVersion: string;
}

// --- Helpers ---

/**
 * Convert Windows path to Docker-compatible forward-slash path.
 * "C:\\Users\\foo\\bar" → "C:/Users/foo/bar"
 * "/tmp/foo" stays as-is (Linux/macOS)
 */
function toDockerPath(windowsPath: string): string {
  // Replace all backslashes with forward slashes
  return windowsPath.replace(/\\/g, '/');
}

/**
 * Build the docker run command string.
 * Uses --rm for auto-cleanup, -v for volume mount, and --network=none for security isolation.
 *
 * Note on --network:
 *   - For compile/test: --network=none (no internet needed, safer)
 *   - For deploy to BSC Testnet: --network=host or bridge (needs internet)
 */
function buildDockerCommand(
  sandboxPath: string,
  command: string,
  envVars: Record<string, string> = {},
  needsNetwork = false
): string {
  const dockerPath = toDockerPath(sandboxPath);

  // Build -e flags for environment variables
  const envFlags = Object.entries(envVars)
    .map(([k, v]) => `-e "${k}=${v}"`)
    .join(' ');

  // Note: We use bridge network (default) instead of --network=none
  // because Hardhat may need to download solc for uncommon versions not pre-cached in the image.
  // Common versions (0.8.20, 0.8.28 etc.) are pre-cached at build time.
  // For deploy mode, internet is required to reach BSC Testnet RPC.
  const networkFlag = needsNetwork ? '' : ''; // always use bridge network

  return [
    'docker run',
    '--rm',
    networkFlag,
    `--memory="2g"`,         // 2GB RAM
    `--cpus="2"`,              // 2 CPU cores
    `--ulimit nofile=1024:1024`, // File descriptor limit
    `-v "${dockerPath}:/app/project"`,
    envFlags,
    DOCKER_IMAGE,
    command,
  ]
    .filter(Boolean)
    .join(' ');
}

// --- Core Methods ---

/**
 * Step 1: Create sandbox directory structure.
 * Returns the SandboxContext with paths for subsequent steps.
 */
export async function createSandbox(
  soliditySource: string,
  options: {
    mode: 'compile' | 'deploy' | 'test';
    contractName?: string;          // Optional override; auto-detected from pragma if not provided
    constructorArgs?: unknown[];    // For deploy mode
    privateKey?: string;            // For deploy to BSC Testnet
    rpcUrl?: string;                // For deploy to BSC Testnet
    testCode?: string;              // For test mode
    plugin?: 'toolbox' | 'viem';   // For test mode
  }
): Promise<SandboxContext> {
  const sandboxId = uuidv4();
  const sandboxPath = path.join(os.tmpdir(), `scontract-${sandboxId}`);

  // Create directory structure
  fs.mkdirSync(sandboxPath, { recursive: true });
  fs.mkdirSync(path.join(sandboxPath, 'contracts'), { recursive: true });
  fs.mkdirSync(path.join(sandboxPath, 'scripts'), { recursive: true });

  if (options.mode === 'test') {
    fs.mkdirSync(path.join(sandboxPath, 'test'), { recursive: true });
  }

  // Parse metadata from source
  const solidityVersion = extractSolidityVersion(soliditySource);
  const contractName = options.contractName ?? extractContractName(soliditySource);

  // Write .sol file
  const solFile = path.join(sandboxPath, 'contracts', `${contractName}.sol`);
  fs.writeFileSync(solFile, soliditySource, 'utf-8');
  console.log(`[sandboxService] Created sandbox: ${sandboxId}`);
  console.log(`[sandboxService] Contract: ${contractName} (Solidity ${solidityVersion})`);

  // Generate and write hardhat.config.js
  let configContent: string;
  if (options.mode === 'compile') {
    configContent = generateCompileOnlyConfig(solidityVersion);
  } else if (options.mode === 'test') {
    configContent = generateTestConfig(solidityVersion, options.plugin ?? 'toolbox');
  } else {
    // deploy mode
    if (options.rpcUrl && options.privateKey) {
      configContent = generateDeployConfig(solidityVersion, options.rpcUrl, options.privateKey);
    } else {
      configContent = generateCompileOnlyConfig(solidityVersion); // deploy to hardhat network (local)
    }
  }
  fs.writeFileSync(path.join(sandboxPath, 'hardhat.config.js'), configContent, 'utf-8');

  // Write script based on mode
  if (options.mode === 'compile') {
    const compileScript = generateCompileScript(contractName);
    fs.writeFileSync(path.join(sandboxPath, 'scripts', 'compile.js'), compileScript, 'utf-8');
  } else if (options.mode === 'deploy') {
    const deployScript = generateDeployScript({
      contractName,
      constructorArgs: options.constructorArgs ?? [],
    });
    fs.writeFileSync(path.join(sandboxPath, 'scripts', 'deploy.js'), deployScript, 'utf-8');
  } else if (options.mode === 'test' && options.testCode) {
    fs.writeFileSync(
      path.join(sandboxPath, 'test', `${contractName}.test.js`),
      options.testCode,
      'utf-8'
    );
  }

  return { sandboxId, sandboxPath, contractName, solidityVersion };
}

/**
 * Step 2: Run Docker container with the given command.
 * Returns { stdout, stderr, exitCode }.
 */
export async function runContainer(
  sandboxPath: string,
  command: string,
  envVars: Record<string, string> = {},
  needsNetwork = false
): Promise<{ stdout: string; stderr: string }> {
  const dockerCmd = buildDockerCommand(sandboxPath, command, envVars, needsNetwork);

  console.log(`[sandboxService] Running docker command:`);
  console.log(`  ${dockerCmd}`);

  try {
    const { stdout, stderr } = await execAsync(dockerCmd, {
      timeout: DOCKER_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for output
    });

    if (stderr) {
      console.warn('[sandboxService] Docker stderr:', stderr.substring(0, 500));
    }

    return { stdout, stderr };
  } catch (err: unknown) {
    const execErr = err as { stdout?: string; stderr?: string; message?: string };
    // Don't throw — let collectResults handle the failure via result.json
    // But return whatever we got for debugging
    return { 
      stdout: (execErr.stdout ?? "") + (execErr.message ? `\nError Message: ${execErr.message}` : ""), 
      stderr: execErr.stderr ?? ""
    };
  }
}

/**
 * Step 3: Collect compile/deploy results from result.json in sandbox.
 */
export function collectCompileResult(sandboxPath: string): SandboxCompileResult {
  const resultPath = path.join(sandboxPath, RESULT_FILE);

  if (!fs.existsSync(resultPath)) {
    return {
      success: false,
      contractName: 'Unknown',
      error: 'No result.json found. Container may have crashed before writing output.',
    };
  }

  try {
    const raw = fs.readFileSync(resultPath, 'utf-8');
    return JSON.parse(raw) as SandboxCompileResult;
  } catch (err) {
    return {
      success: false,
      contractName: 'Unknown',
      error: 'Failed to parse result.json',
      details: String(err),
    };
  }
}

/**
 * Step 3 (variant): Collect deploy results from result.json in sandbox.
 */
export function collectDeployResult(sandboxPath: string): SandboxDeployResult {
  return collectCompileResult(sandboxPath) as SandboxDeployResult;
}

/**
 * Step 3 (variant): Collect test results from test-result.json in sandbox.
 */
export function collectTestResult(sandboxPath: string): SandboxTestResult {
  const resultPath = path.join(sandboxPath, TEST_RESULT_FILE);

  if (!fs.existsSync(resultPath)) {
    // Fall back to checking result.json
    const altPath = path.join(sandboxPath, RESULT_FILE);
    if (!fs.existsSync(altPath)) {
      return {
        success: false,
        error: 'No test-result.json found. Container may have crashed.',
      };
    }
    const raw = fs.readFileSync(altPath, 'utf-8');
    return JSON.parse(raw) as SandboxTestResult;
  }

  try {
    const raw = fs.readFileSync(resultPath, 'utf-8');
    return JSON.parse(raw) as SandboxTestResult;
  } catch (err) {
    return {
      success: false,
      error: 'Failed to parse test-result.json',
    };
  }
}

/**
 * Step 4: Clean up sandbox directory.
 * Called in finally block to ensure cleanup even on error.
 */
export function cleanup(sandboxPath: string): void {
  try {
    if (fs.existsSync(sandboxPath)) {
      fs.rmSync(sandboxPath, { recursive: true, force: true });
      console.log(`[sandboxService] Cleaned up sandbox: ${sandboxPath}`);
    }
  } catch (err) {
    console.error(`[sandboxService] Cleanup warning: ${err}`);
    // Non-fatal — OS will clean temp files eventually
  }
}

// --- High-level Compound Methods ---

/**
 * Compile a Solidity contract inside a Docker sandbox.
 * Full lifecycle: createSandbox → runContainer → collectResults → cleanup.
 *
 * @param soliditySource - Raw Solidity source code
 * @param contractName - Optional contract name override
 * @returns SandboxCompileResult
 */
export async function compileContract(
  soliditySource: string,
  contractName?: string
): Promise<SandboxCompileResult> {
  let context: SandboxContext | null = null;

  try {
    context = await createSandbox(soliditySource, { mode: 'compile', contractName });

    const { stdout, stderr } = await runContainer(
      context.sandboxPath,
      `npx hardhat run /app/project/scripts/compile.js --config /app/project/hardhat.config.js`,
      { CONTRACT_NAME: context.contractName },
      false // no network needed for compile
    );

    const result = collectCompileResult(context.sandboxPath);
    
    // If result.json missing, it means container crashed or hardhat failed
    if (!result.success && result.error?.includes('No result.json')) {
      const errorDetail = stderr || stdout || 'Unknown error during compilation.';
      return {
        ...result,
        error: `Compilation Failed: ${errorDetail.split('\n')[0]}`,
        details: errorDetail
      };
    }

    return result;
  } catch (err) {
    console.error('[sandboxService] compileContract error:', err);
    return {
      success: false,
      contractName: contractName ?? 'Unknown',
      error: String(err),
    };
  } finally {
    if (context) cleanup(context.sandboxPath);
  }
}

/**
 * Compile ONLY (used internally in Phase 4 before deploy).
 * Does NOT cleanup — caller must call cleanup() manually.
 */
export async function compileInSandbox(context: SandboxContext): Promise<SandboxCompileResult> {
  await runContainer(
    context.sandboxPath,
    `npx hardhat run /app/project/scripts/compile.js --config /app/project/hardhat.config.js`,
    { CONTRACT_NAME: context.contractName },
    false
  );
  return collectCompileResult(context.sandboxPath);
}
