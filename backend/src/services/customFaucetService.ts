import { ethers } from 'ethers';
import Project from '../models/Project.js';
import Wallet from '../models/Wallet.js';
import CustomFaucetLog from '../models/CustomFaucetLog.js';
import { createTransaction } from './transactionService.js';
import { decrypt } from '../utils/encryption.js';

export async function executeCustomFaucet(
  projectId: string,
  contractId: string,
  requesterUserId: string,
  targetAddress: string,
  ipAddress: string
) {
  // 1. Validate project and contract
  const project = await Project.findById(projectId);
  if (!project) throw new Error('Project not found');

  const contract = project.contracts.id(contractId) as any;
  if (!contract) throw new Error('Contract not found');

  if (contract.status !== 'deployed' || !contract.contractAddress) {
    throw new Error('Contract is not deployed yet');
  }

  const config = contract.faucetConfig;
  if (!config || !config.isEnabled) {
    throw new Error('Faucet is not enabled for this contract');
  }

  if (config.tokenType === 'UNKNOWN') {
    throw new Error('Token standard is UNKNOWN. Cannot perform automated faucet.');
  }

  // 2. Rate Limiting Check (Cooldown)
  const cooldownHours = config.cooldownHours || 24;
  const cooldownMs = cooldownHours * 60 * 60 * 1000;
  const cutoffTime = new Date(Date.now() - cooldownMs);

  const recentLog = await CustomFaucetLog.findOne({
    contractId,
    targetAddress,
    requestedAt: { $gte: cutoffTime }
  });

  if (recentLog) {
    const nextAvailable = new Date(recentLog.requestedAt.getTime() + cooldownMs);
    throw new Error(`Cooldown active. Try again after ${nextAvailable.toLocaleString()}`);
  }

  // 3. Load Developer Wallet
  const wallet = await Wallet.findById(project.walletId);
  if (!wallet) throw new Error('Project owner wallet not found');

  const privateKey = decrypt(wallet.encryptedPrivateKey);
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) throw new Error('RPC_URL is not configured');

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const deployerWallet = new ethers.Wallet(privateKey, provider);

  // 4. Initialize Ethers Contract
  const ethersContract = new ethers.Contract(contract.contractAddress, contract.abi, deployerWallet);

  let tx;
  let amountLabel = '';
  const isERC20 = config.tokenType === 'ERC20';
  const decimals = isERC20 ? 18 : 0;
  
  const parsedAmount = config.amountPerRequest && config.amountPerRequest !== '0' 
      ? ethers.parseUnits(config.amountPerRequest, decimals) 
      : ethers.parseUnits('1', decimals); // fallback to 1 item if not set

  // 5. Route by Token Type
  try {
    if (config.tokenType === 'ERC20') {
      amountLabel = `${ethers.formatUnits(parsedAmount)} ERC20`;
      tx = await ethersContract.transfer(targetAddress, parsedAmount);
    } 
    else if (config.tokenType === 'ERC721') {
      const mintFn = config.mintFunctionName || 'mint';
      amountLabel = `1 ERC721`;
      tx = await ethersContract[mintFn](targetAddress);
    } 
    else if (config.tokenType === 'ERC1155') {
      const mintFn = config.mintFunctionName || 'mint';
      const tokenId = config.faucetTokenId || '0';
      amountLabel = `${ethers.formatUnits(parsedAmount, 0)} ERC1155 (ID:${tokenId})`;
      
      if (mintFn === 'safeTransferFrom') {
        // signature: safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)
        tx = await ethersContract.safeTransferFrom(deployerWallet.address, targetAddress, tokenId, parsedAmount, '0x');
      } else {
        // Standard signature: mint(address to, uint256 id, uint256 amount, bytes data)
        tx = await ethersContract[mintFn](targetAddress, tokenId, parsedAmount, '0x');
      }
    }

    const receipt = await tx.wait();

    // 6. Log success
    await CustomFaucetLog.create({
      projectId,
      contractId,
      targetAddress,
      amountLabel,
      requestedAt: new Date()
    });

    const gasUsed = receipt?.gasUsed ? Number(receipt.gasUsed) : 0;
    
    await createTransaction({
      projectId: project._id.toString(),
      contractId: contract._id.toString(),
      userId: requesterUserId,
      txHash: tx.hash,
      functionName: '__custom_faucet__',
      args: [targetAddress, amountLabel],
      gasUsed,
      status: 'success'
    });

    return { txHash: tx.hash, amountLabel };

  } catch (error: any) {
    if (error.message?.includes('insufficient funds')) {
      throw new Error('Developer wallet has insufficient native funds to pay for gas.');
    }
    throw new Error(`Smart contract execution failed: ${error.message}`);
  }
}
