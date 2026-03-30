/**
 * testTemplates.ts
 * Pre-built test code templates for Ethers.js and Viem.
 * Auto-filled into the test editor to help user onboarding.
 */

export function getEthersTemplate(contractName: string): string {
  return `const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

describe("${contractName}", function () {
  async function deployFixture() {
    const [owner, otherAccount] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("${contractName}");
    const contract = await Factory.deploy();
    return { contract, owner, otherAccount };
  }

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      const { contract } = await loadFixture(deployFixture);
      const address = await contract.getAddress();
      expect(address).to.be.properAddress;
    });
  });

  // Add more tests below...
});
`;
}

export function getViemTemplate(contractName: string): string {
  return `const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

describe("${contractName}", function () {
  async function deployFixture() {
    const contract = await hre.viem.deployContract("${contractName}");
    const publicClient = await hre.viem.getPublicClient();
    const [owner, otherAccount] = await hre.viem.getWalletClients();
    return { contract, publicClient, owner, otherAccount };
  }

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      const { contract } = await loadFixture(deployFixture);
      expect(contract.address).to.match(/^0x[0-9a-fA-F]{40}$/);
    });
  });

  // Add more tests below...
});
`;
}
