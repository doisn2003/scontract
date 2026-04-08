/**
 * projectService.ts
 * Business logic cho pipeline Compile & Deploy đa hợp đồng.
 *
 * Flow:
 *   createProject()       → Lưu project + mảng contracts ban đầu (status: created)
 *   compileContract()     → Compile theo contractId → Lưu ABI+Bytecode (status: compiled)
 *   deployContract()      → Deploy theo contractId → Lưu địa chỉ (status: deployed)
 *   addContract()         → Thêm contract mới vào project
 *   removeContract()      → Xóa contract (luôn giữ ít nhất 1)
 *   updateContract()      → Đổi tên / sửa source của 1 contract
 */

import { ethers } from 'ethers';
import Project from '../models/Project.js';
import Wallet from '../models/Wallet.js';
import { decrypt } from '../utils/encryption.js';
import { extractSolidityVersion, extractContractName, repairAddressChecksums } from '../utils/solidityParser.js';
import { compileContract } from './sandboxService.js';
import { createTransaction, getBnbPriceUSD } from './transactionService.js';
import type { ISmartContract } from '../types/index.js';

const GAS_PRICE_GWEI = 1; // BSC Testnet avg gas price

// Helper to find project where user is owner OR shared dev
async function findProjectWithAuth(projectId: string, userId: string) {
  const project = await Project.findOne({
    _id: projectId,
    $or: [
      { userId },
      { shared_devs: userId }
    ]
  });
  return project;
}

// ──────────────────────────────────────────────
// Create Project (với mảng contracts ban đầu)
// ──────────────────────────────────────────────

export async function createProject(
  userId: string,
  walletId: string,
  name: string,
  description: string,
  initialContracts: { soliditySource: string; name?: string }[]
) {
  const wallet = await Wallet.findOne({ _id: walletId, userId });
  if (!wallet) throw new Error('Wallet not found or does not belong to you');

  if (!initialContracts || initialContracts.length === 0) {
    throw new Error('At least one contract is required');
  }

  const contracts = initialContracts.map((c, idx) => {
    const solidityVersion = extractSolidityVersion(c.soliditySource);
    const detectedName = extractContractName(c.soliditySource);
    return {
      name: c.name || detectedName || `Contract${idx + 1}`,
      soliditySource: c.soliditySource,
      solidityVersion,
      status: 'created' as const,
    };
  });


  const projectName = name || contracts[0].name;

  const project = await Project.create({
    userId,
    walletId,
    name: projectName,
    description: description || '',
    network: 'bsc-testnet',
    contracts,
  });

  return project;
}

// ──────────────────────────────────────────────
// Compile một Contract cụ thể
// ──────────────────────────────────────────────

export async function compileContract_(projectId: string, userId: string, contractId: string) {
  const project = await findProjectWithAuth(projectId, userId);
  if (!project) throw new Error('Project not found');

  const contract = project.contracts.id(contractId);
  if (!contract) throw new Error('Contract not found in project');

  const repairedSource = repairAddressChecksums(contract.soliditySource);
  if (repairedSource !== contract.soliditySource) {
    contract.soliditySource = repairedSource;
  }

  const contractName = extractContractName(contract.soliditySource);
  console.log(`[projectService] Compiling contract ${contractId}: ${contractName}`);

  const result = await compileContract(contract.soliditySource, contractName);

  if (!result.success) {
    const err = new Error(result.error || 'Compilation failed') as any;
    err.details = result.details;
    throw err;
  }

  contract.abi = result.abi as any;
  contract.bytecode = result.bytecode || '';
  contract.name = contractName;
  contract.solidityVersion = extractSolidityVersion(contract.soliditySource);
  contract.status = 'compiled';

  await project.save();

  return {
    _id: project._id,
    contractId: contract._id,
    name: project.name,
    contractName: contract.name,
    status: contract.status,
    solidityVersion: contract.solidityVersion,
    abi: contract.abi,
    bytecode: contract.bytecode,
  };
}

// ──────────────────────────────────────────────
// Deploy một Contract cụ thể
// ──────────────────────────────────────────────

export async function deployContract_(
  projectId: string,
  userId: string,
  contractId: string,
  constructorArgs: unknown[] = []
) {
  const project = await findProjectWithAuth(projectId, userId);
  if (!project) throw new Error('Project not found');

  const contract = project.contracts.id(contractId);
  if (!contract) throw new Error('Contract not found in project');

  if (contract.status !== 'compiled') {
    throw new Error(`Cannot deploy: contract status is "${contract.status}". Must compile first.`);
  }
  if (!contract.abi || !contract.bytecode) {
    throw new Error('ABI or Bytecode missing. Please compile first.');
  }

  const wallet = await Wallet.findById(project.walletId);
  if (!wallet) throw new Error('Associated wallet not found');

  const privateKey = decrypt(wallet.encryptedPrivateKey);
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) throw new Error('RPC_URL is not configured');

  console.log(`[projectService] Deploying contract ${contractId} to BSC Testnet`);
  console.log(`[projectService] Deployer: ${wallet.address}`);

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const deployerWallet = new ethers.Wallet(privateKey, provider);

  const factory = new ethers.ContractFactory(contract.abi as any, contract.bytecode, deployerWallet);
  let deployedContract;

  try {
    deployedContract = await factory.deploy(...constructorArgs);
    await deployedContract.waitForDeployment();
  } catch (err: any) {
    if (err.message?.includes('insufficient funds')) {
      throw new Error(
        `Insufficient funds. Wallet ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)} does not have enough tBNB. Use the Faucet to get testnet BNB.`
      );
    }
    throw err;
  }

  const contractAddress = await deployedContract.getAddress();
  const deployTx = deployedContract.deploymentTransaction();

  console.log(`[projectService] ✅ Deployed at: ${contractAddress}`);

  contract.contractAddress = contractAddress;
  contract.status = 'deployed';
  await project.save();

  if (deployTx?.hash) {
    try {
      const receipt = await provider.getTransactionReceipt(deployTx.hash);
      const gasUsed = receipt?.gasUsed ? Number(receipt.gasUsed) : 0;
      await createTransaction({
        projectId: (project._id as any).toString(),
        contractId: contractId,
        userId,
        txHash: deployTx.hash,
        functionName: '__deploy__',
        args: constructorArgs,
        gasUsed,
        status: 'success',
      });
      console.log(`[projectService] Deploy tx recorded: ${deployTx.hash}`);
    } catch (txErr) {
      console.warn('[projectService] Failed to record deploy tx:', txErr);
    }
  }

  return {
    _id: project._id,
    contractId: contract._id,
    name: project.name,
    contractName: contract.name,
    status: contract.status,
    contractAddress,
    network: project.network,
    txHash: deployTx?.hash || null,
  };
}

// ──────────────────────────────────────────────
// Thêm Contract mới vào Project
// ──────────────────────────────────────────────

export async function addContract(
  projectId: string,
  userId: string,
  soliditySource: string,
  name?: string
) {
  const project = await findProjectWithAuth(projectId, userId);
  if (!project) throw new Error('Project not found');

  const detectedName = extractContractName(soliditySource);
  const solidityVersion = extractSolidityVersion(soliditySource);

  const newContract = {
    name: name || detectedName || `Contract${project.contracts.length + 1}`,
    soliditySource,
    solidityVersion,
    status: 'created' as const,
    abi: null,
    bytecode: null,
    contractAddress: null,
  };

  project.contracts.push(newContract as any);
  await project.save();

  return project;
}

// ──────────────────────────────────────────────
// Xóa Contract (luôn giữ ít nhất 1)
// ──────────────────────────────────────────────

export async function removeContract(projectId: string, userId: string, contractId: string) {
  const project = await findProjectWithAuth(projectId, userId);
  if (!project) throw new Error('Project not found');

  if (project.contracts.length <= 1) {
    throw new Error('Cannot delete the last contract. A project must have at least one smart contract.');
  }

  const contract = project.contracts.id(contractId);
  if (!contract) throw new Error('Contract not found in project');

  project.contracts.pull({ _id: contractId });
  await project.save();

  return project;
}

// ──────────────────────────────────────────────
// Cập nhật Contract (đổi tên / sửa source)
// ──────────────────────────────────────────────

export async function updateContract(
  projectId: string,
  userId: string,
  contractId: string,
  updates: { name?: string; soliditySource?: string }
) {
  const project = await findProjectWithAuth(projectId, userId);
  if (!project) throw new Error('Project not found');

  const contract = project.contracts.id(contractId);
  if (!contract) throw new Error('Contract not found in project');

  if (updates.name !== undefined) {
    contract.name = updates.name;
  }

  if (updates.soliditySource !== undefined) {
    if (contract.status === 'deployed') {
      throw new Error('Cannot edit source code after contract is deployed');
    }
    contract.soliditySource = updates.soliditySource;
    contract.solidityVersion = extractSolidityVersion(updates.soliditySource);
    // Reset compilation state nếu source thay đổi
    contract.abi = null as any;
    contract.bytecode = null as any;
    contract.status = 'created';
  }

  await project.save();
  return project;
}

// ──────────────────────────────────────────────
// Estimate Gas cho 1 Contract
// ──────────────────────────────────────────────

export async function estimateDeployGas(
  projectId: string,
  userId: string,
  contractId: string,
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

  const contract = project.contracts.id(contractId);
  if (!contract) throw new Error('Contract not found in project');

  if (contract.status !== 'compiled') {
    throw new Error(`Cannot estimate: contract status is "${contract.status}". Must compile first.`);
  }
  if (!contract.abi || !contract.bytecode) {
    throw new Error('ABI or Bytecode missing. Please compile first.');
  }

  const wallet = await Wallet.findById(project.walletId);
  if (!wallet) throw new Error('Associated wallet not found');

  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) throw new Error('RPC_URL is not configured');

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const factory = new ethers.ContractFactory(contract.abi as any, contract.bytecode);
  
  let deployTx;
  try {
    deployTx = await factory.getDeployTransaction(...constructorArgs);
  } catch (err: any) {
    if (err.message?.includes('incorrect number of arguments')) {
      throw new Error('common.errors.constructor_mismatch');
    }
    throw err;
  }

  let gasLimit: bigint;
  try {
    gasLimit = await provider.estimateGas({ ...deployTx, from: wallet.address });
    gasLimit = (gasLimit * 120n) / 100n;
  } catch {
    const bytecodeBytes = contract.bytecode.length / 2;
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

// ──────────────────────────────────────────────
// Query Helpers
// ──────────────────────────────────────────────

export async function getUserProjects(userId: string) {
  return Project.find({
    $or: [
      { userId },
      { shared_devs: userId }
    ]
  })
    .select('-contracts.soliditySource -contracts.bytecode')
    .sort({ createdAt: -1 })
    .lean();
}

export async function getProjectById(projectId: string, userId: string) {
  const project = await Project.findById(projectId)
    .populate('walletId', 'address')
    .lean();
  if (!project) return null;

  // Access control
  const isOwner = project.userId.toString() === userId.toString();
  const isSharedDev = project.shared_devs?.some((devId: any) => devId.toString() === userId.toString());
  const hasDeployed = project.contracts.some((c: any) => c.status === 'deployed');

  if (!isOwner && !isSharedDev && !hasDeployed) {
    return null;
  }
  return project;
}

export async function getDeployedProjects() {
  // Lấy projects có ít nhất 1 contract deployed
  return Project.find({ 'contracts.status': 'deployed' })
    .select('name description contracts.contractAddress contracts.status contracts.name network createdAt userId')
    .sort({ createdAt: -1 })
    .lean();
}

export async function deleteProject(projectId: string, userId: string) {
  const result = await Project.deleteOne({ _id: projectId, userId });
  if (result.deletedCount === 0) {
    throw new Error('Project not found or you are not authorized to delete it');
  }
}

export async function updateProject(
  projectId: string,
  userId: string,
  updates: { 
    name?: string; 
    description?: string; 
    guest_permissions?: any[]; 
    shared_devs?: string[];
  }
) {
  const project = await findProjectWithAuth(projectId, userId);
  if (!project) throw new Error('Project not found');

  if (updates.name !== undefined) project.name = updates.name;
  if (updates.description !== undefined) project.description = updates.description;
  if (updates.guest_permissions !== undefined) project.guest_permissions = updates.guest_permissions;
  if (updates.shared_devs !== undefined) project.shared_devs = updates.shared_devs as any;

  await project.save();
  return project;
}

export async function reorderContracts(projectId: string, userId: string, contractIds: string[]) {
  const project = await findProjectWithAuth(projectId, userId);
  if (!project) throw new Error('Project not found');

  if (contractIds.length !== project.contracts.length) {
    throw new Error('Invalid number of contracts provided for reordering');
  }

  // Sắp xếp lại dựa trên mảng IDs nhận được
  const reordered = contractIds.map(id => {
    const c = project.contracts.id(id);
    if (!c) throw new Error(`Contract ${id} not found in project`);
    return c;
  });

  // Gán lại mảng (Mongoose subdoc array)
  project.contracts = reordered as any;
  await project.save();
  
  return project;
}
