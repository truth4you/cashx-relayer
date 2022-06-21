const { ethers } = require("hardhat")
const { deploy, deployProxy, upgradeProxy } = require('./utils')
const genContract = require('circomlib/src/mimcsponge_gencontract.js')

async function main() {
  const [owner] = await ethers.getSigners();

  console.log("Deploying the contracts with %s on %s",owner.address,network.name)
  // const bytecode = genContract.createCode("mimcsponge",220)
  // const factory = await ethers.getContractFactory([
  //     "function MiMCSponge(uint256, uint256) public view returns (uint256, uint256)"
  // ], bytecode)
  // const Hasher = await factory.deploy()
  // await Hasher.deployed()
  // console.log("hasher", Hasher.address)
  
  // const Verifier = await deploy("Verifier")
  await deploy("CashX", "0xC6b9904DD5beDF8DAa3542815B99848c44B127E7", "0x751bB437207FE2438ceb512c608a8dA6C1e75A26", ethers.utils.parseEther("0.1"), 20, ethers.utils.getAddress("0x95643CeD4DF4B5Bc605a4CEE79f470497CaF5dD9"))
  await deploy("CashX", "0xC6b9904DD5beDF8DAa3542815B99848c44B127E7", "0x751bB437207FE2438ceb512c608a8dA6C1e75A26", ethers.utils.parseEther("1"), 20, ethers.utils.getAddress("0x95643CeD4DF4B5Bc605a4CEE79f470497CaF5dD9"))
  await deploy("CashX", "0xC6b9904DD5beDF8DAa3542815B99848c44B127E7", "0x751bB437207FE2438ceb512c608a8dA6C1e75A26", ethers.utils.parseEther("10"), 20, ethers.utils.getAddress("0x95643CeD4DF4B5Bc605a4CEE79f470497CaF5dD9"))
  await deploy("CashX", "0xC6b9904DD5beDF8DAa3542815B99848c44B127E7", "0x751bB437207FE2438ceb512c608a8dA6C1e75A26", ethers.utils.parseEther("100"), 20, ethers.utils.getAddress("0x95643CeD4DF4B5Bc605a4CEE79f470497CaF5dD9"))
  // await deploy("Multicall")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
