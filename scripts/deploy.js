const { ethers } = require("hardhat")
const { deploy, deployProxy, upgradeProxy } = require('./utils')
const genContract = require('circomlib/src/mimcsponge_gencontract.js')

async function main() {
  const [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

  console.log("Deploying the contracts with %s on %s",owner.address,network.name)
  const bytecode = genContract.createCode("mimcsponge",220)
  const factory = await ethers.getContractFactory([
      "function MiMCSponge(uint256, uint256) public view returns (uint256, uint256)"
  ], bytecode)
  const Hasher = await factory.deploy()
  await Hasher.deployed()
  const Verifier = await deploy("Verifier")
  await deploy("CashX", Verifier.address, Hasher.address, ethers.utils.parseEther("0.1"), 20, ethers.utils.getAddress("0x0000000000000000000000000000000000000000"))
  await deploy("CashX", Verifier.address, Hasher.address, ethers.utils.parseEther("1"), 20, ethers.utils.getAddress("0x0000000000000000000000000000000000000000"))
  await deploy("CashX", Verifier.address, Hasher.address, ethers.utils.parseEther("10"), 20, ethers.utils.getAddress("0x0000000000000000000000000000000000000000"))
  await deploy("Multicall")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
