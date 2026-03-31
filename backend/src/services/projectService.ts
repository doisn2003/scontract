/**
 * projectService.ts
 * Business logic for the Compile & Deploy pipeline.
 *
 * Flow:
 *   createProject()  → Lưu source vào DB (status: created)
 *   compileProject()  → Gọi sandboxService → Lưu ABI+Bytecode (status: compiled)
 *   deployProject()   → Lấy ABI+Bytecode, dùng ethers.ContractFactory.deploy() (status: deployed)
 */

import { ethers } from 'ethers';
import Project from '../models/Project.js';
import Wallet from '../models/Wallet.js';
import { decrypt } from '../utils/encryption.js';
import { extractSolidityVersion, extractContractName } from '../utils/solidityParser.js';
import { compileContract } from './sandboxService.js';
import { createTransaction, getBnbPriceUSD } from './transactionService.js';

const GAS_PRICE_GWEI = 1; // BSC Testnet avg gas price


// ──────────────────────────────
// Create Project
// ──────────────────────────────

export async function createProject(
  userId: string,
  walletId: string,
  name: string,
  description: string,
  soliditySource: string
) {
  // Validate wallet belongs to user
  const wallet = await Wallet.findOne({ _id: walletId, userId });
  if (!wallet) {
    throw new Error('Wallet not found or does not belong to you');
  }

  // Extract metadata from source
  const solidityVersion = extractSolidityVersion(soliditySource);
  const contractName = extractContractName(soliditySource);

  const project = await Project.create({
    userId,
    walletId,
    name: name || contractName,
    description: description || '',
    soliditySource,
    solidityVersion,
    status: 'created',
    network: 'bsc-testnet',
  });

  return project;
}

// ──────────────────────────────
// Compile Project
// ──────────────────────────────

export async function compileProject(projectId: string, userId: string) {
  const project = await Project.findOne({ _id: projectId, userId });
  if (!project) {
    throw new Error('Project not found');
  }

  if (!project.soliditySource) {
    throw new Error('No Solidity source code found for this project');
  }

  // Extract contract name from source
  const contractName = extractContractName(project.soliditySource);

  console.log(`[projectService] Compiling project ${projectId}: ${contractName}`);

  // Delegate to sandboxService (Phase 3)
  const result = await compileContract(project.soliditySource, contractName);

  if (!result.success) {
    throw new Error(result.error || 'Compilation failed');
  }

  // Update project with compile results
  project.abi = result.abi as any;
  project.bytecode = result.bytecode || '';
  project.solidityVersion = extractSolidityVersion(project.soliditySource);
  project.status = 'compiled';
  await project.save();

  return {
    _id: project._id,
    name: project.name,
    contractName,
    status: project.status,
    solidityVersion: project.solidityVersion,
    abi: project.abi,
    bytecode: project.bytecode,
  };
}

// ──────────────────────────────
// Deploy Project
// ──────────────────────────────

export async function deployProject(
  projectId: string,
  userId: string,
  constructorArgs: unknown[] = []
) {
  const project = await Project.findOne({ _id: projectId, userId });
  if (!project) {
    throw new Error('Project not found');
  }

  if (project.status !== 'compiled') {
    throw new Error(`Cannot deploy: project status is "${project.status}". Must compile first.`);
  }

  if (!project.abi || !project.bytecode) {
    throw new Error('ABI or Bytecode missing. Please compile the project first.');
  }

  // Get the wallet's private key for deployment
  const wallet = await Wallet.findById(project.walletId);
  if (!wallet) {
    throw new Error('Associated wallet not found');
  }

  const privateKey = decrypt(wallet.encryptedPrivateKey);
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) {
    throw new Error('RPC_URL is not configured');
  }

  console.log(`[projectService] Deploying project ${projectId} to BSC Testnet`);
  console.log(`[projectService] Deployer: ${wallet.address}`);

  // Deploy using ethers.js
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const deployerWallet = new ethers.Wallet(privateKey, provider);

  const factory = new ethers.ContractFactory(
    project.abi as any,
    project.bytecode,
    deployerWallet
  );

  let contract;
  try {
    contract = await factory.deploy(...constructorArgs);
    await contract.waitForDeployment();
  } catch (err: any) {
    if (err.message && err.message.includes('insufficient funds')) {
      throw new Error(`Insufficient funds for gas. The Server Wallet (${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}) does not have enough tBNB. Please use the Faucet on your Dashboard to get testnet BNB before deploying.`);
    }
    throw err;
  }

  const contractAddress = await contract.getAddress();
  const deployTx = contract.deploymentTransaction();

  console.log(`[projectService] ✅ Deployed at: ${contractAddress}`);

  // Update project
  project.contractAddress = contractAddress;
  project.status = 'deployed';
  await project.save();

  // Save deploy transaction to history
  if (deployTx?.hash) {
    try {
      const receipt = await provider.getTransactionReceipt(deployTx.hash);
      const gasUsed = receipt?.gasUsed ? Number(receipt.gasUsed) : 0;
      await createTransaction({
        projectId: (project._id as any).toString(),
        userId,
        txHash: deployTx.hash,
        functionName: '__deploy__',
        args: constructorArgs,
        gasUsed,
        status: 'success',
      });
      console.log(`[projectService] Deploy tx recorded: ${deployTx.hash}`);
    } catch (txErr) {
      // Non-critical — don't fail the whole deploy
      console.warn('[projectService] Failed to record deploy tx:', txErr);
    }
  }

  return {
    _id: project._id,
    name: project.name,
    status: project.status,
    contractAddress,
    network: project.network,
    txHash: deployTx?.hash || null,
  };
}

// ──────────────────────────────
// Query Helpers
// ──────────────────────────────

export async function getUserProjects(userId: string) {
  return Project.find({ userId })
    .select('-soliditySource')
    .sort({ createdAt: -1 })
    .lean();
}

export async function getProjectById(projectId: string, userId: string) {
  const project = await Project.findById(projectId)
    .populate('walletId', 'address')
    .lean();
  if (!project) return null;

  // Allow access if the user is the owner OR if the project is deployed (publicly available for interaction)
  if (project.userId.toString() !== userId.toString() && project.status !== 'deployed') {
    return null;
  }
  return project;
}

export async function getDeployedProjects() {
  return Project.find({ status: 'deployed' })
    .select('name description contractAddress network status createdAt userId')
    .sort({ createdAt: -1 })
    .lean();
}

// ──────────────────────────────
// Estimate Deploy Gas Cost
// ──────────────────────────────

export async function estimateDeployGas(
  projectId: string,
  userId: string,
  constructorArgs: unknown[] = []
): Promise<{
  gasLimit: string;
  gasBNB: string;
  gasUSD: string;
  bnbPrice: number;
  deployerAddress: string;
}> {
  const project = await Project.findOne({ _id: projectId, userId });
  if (!project) throw new Error('Project not found');

  if (project.status !== 'compiled') {
    throw new Error(`Cannot estimate: project status is "${project.status}". Must compile first.`);
  }

  if (!project.abi || !project.bytecode) {
    throw new Error('ABI or Bytecode missing. Please compile the project first.');
  }

  const wallet = await Wallet.findById(project.walletId);
  if (!wallet) throw new Error('Associated wallet not found');

  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) throw new Error('RPC_URL is not configured');

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Dry-run: build deploy transaction and estimate gas without signing/broadcasting
  const factory = new ethers.ContractFactory(project.abi as any, project.bytecode);
  const deployTx = await factory.getDeployTransaction(...constructorArgs);

  let gasLimit: bigint;
  try {
    gasLimit = await provider.estimateGas({
      ...deployTx,
      from: wallet.address,
    });
    // Add 20% buffer for safety
    gasLimit = (gasLimit * 120n) / 100n;
  } catch {
    // Fallback: rough estimate based on bytecode size
    const bytecodeBytes = project.bytecode.length / 2;
    gasLimit = BigInt(Math.ceil(bytecodeBytes * 200 + 21000));
  }

  const bnbPrice = await getBnbPriceUSD();
  const gasBNB = (Number(gasLimit) * GAS_PRICE_GWEI) / 1e9;
  const gasUSD = gasBNB * bnbPrice;

  return {
    gasLimit: gasLimit.toString(),
    gasBNB: gasBNB.toFixed(8),
    gasUSD: gasUSD.toFixed(4),
    bnbPrice,
    deployerAddress: wallet.address,
  };
}
