/**
 * deploy.js — Template Deploy Script
 *
 * Được gọi bởi sandboxService với lệnh:
 *   npx hardhat run /app/scripts/deploy.js --config /app/project/hardhat.config.js [--network bscTestnet]
 *
 * Kết quả được ghi vào /app/project/result.json dạng JSON để Backend đọc.
 *
 * Output format:
 * {
 *   "success": true,
 *   "contractName": "MyContract",
 *   "address": "0x...",
 *   "abi": [...],
 *   "bytecode": "0x...",
 *   "deployTx": "0x...",
 *   "blockNumber": 12345
 * }
 *
 * Error format (khi success = false):
 * {
 *   "success": false,
 *   "error": "CompileError: ...",
 *   "details": "..."
 * }
 */

const { ethers, artifacts } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Kết quả sẽ ghi vào volume mount shared với host
const RESULT_PATH = path.join("/app/project", "result.json");
const PROJECT_DIR = "/app/project";

function writeResult(data) {
  fs.writeFileSync(RESULT_PATH, JSON.stringify(data, null, 2), "utf-8");
  console.log("[deploy.js] Result written to", RESULT_PATH);
  console.log(JSON.stringify(data)); // Cũng log ra stdout để backup
}

async function main() {
  try {
    // Đọc CONTRACT_NAME từ env (được sandboxService set)
    const contractName = process.env.CONTRACT_NAME;
    if (!contractName) {
      throw new Error("CONTRACT_NAME environment variable is required");
    }

    // Đọc constructor args từ file nếu có
    let constructorArgs = [];
    const argsPath = path.join(PROJECT_DIR, "constructor-args.json");
    if (fs.existsSync(argsPath)) {
      constructorArgs = JSON.parse(fs.readFileSync(argsPath, "utf-8"));
    }

    console.log(`[deploy.js] Deploying contract: ${contractName}`);
    console.log(`[deploy.js] Constructor args: ${JSON.stringify(constructorArgs)}`);

    // Get signers (trên Hardhat Network local)
    const [deployer] = await ethers.getSigners();
    console.log(`[deploy.js] Deployer: ${deployer.address}`);

    // Deploy contract
    const ContractFactory = await ethers.getContractFactory(contractName);
    const contract = await ContractFactory.deploy(...constructorArgs);
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    const deployTx = contract.deploymentTransaction();

    // Lấy ABI và Bytecode từ artifacts
    const artifact = await artifacts.readArtifact(contractName);

    const result = {
      success: true,
      contractName,
      address,
      abi: artifact.abi,
      bytecode: artifact.bytecode,
      deployTx: deployTx ? deployTx.hash : null,
      blockNumber: deployTx ? (await deployTx.wait())?.blockNumber : null,
    };

    writeResult(result);
    console.log(`[deploy.js] ✅ Deployed to: ${address}`);
  } catch (err) {
    const result = {
      success: false,
      error: err.message || String(err),
      details: err.stack || "",
    };
    writeResult(result);
    console.error("[deploy.js] ❌ Deploy failed:", err.message);
    // Exit with non-zero để sandboxService biết có lỗi
    process.exit(1);
  }
}

main();
