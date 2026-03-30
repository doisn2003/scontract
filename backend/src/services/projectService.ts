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

  const contract = await factory.deploy(...constructorArgs);
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  const deployTx = contract.deploymentTransaction();

  console.log(`[projectService] ✅ Deployed at: ${contractAddress}`);

  // Update project
  project.contractAddress = contractAddress;
  project.status = 'deployed';
  await project.save();

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
  return Project.findOne({ _id: projectId, userId }).lean();
}

export async function getDeployedProjects() {
  return Project.find({ status: 'deployed' })
    .select('name description contractAddress network status createdAt userId')
    .sort({ createdAt: -1 })
    .lean();
}
