const { ethers } = require("hardhat")
const { deploy, deployProxy, upgradeProxy, getAt } = require('./utils')
const genContract = require('circomlib/src/mimcsponge_gencontract.js')

async function main() {
  const [owner] = await ethers.getSigners();

  // const Factory = await deploy("PancakeFactory", owner.address)
  // const WETH = await deploy("WETH")
  // const Router = await deploy("PancakeRouter", Factory.address, WETH.address)
  // const USDT = await deploy("Token", "Tether", "USDT", 6)
  // const USDC = await deploy("Token", "USD Coin", "USDC", 6)
  // const Router = await getAt("PancakeRouter", "0xb70903830eF40Ccb458f2199BBaab50610cA2a0a")
  const USDT = await getAt("Token", "0x0114e318f1381123Cbb936093F2631283B19b6a2")
  // const USDC = await getAt("Token", "0x9c014D71D31B9050D92BDB00A79A60f1BB7CB5e5")
  // await (await USDT.approve(Router.address, ethers.utils.parseUnits("1000000", 6))).wait()
  // await (await USDC.approve(Router.address, ethers.utils.parseUnits("1000000", 6))).wait()
  // await (await Router.addLiquidityETH(USDT.address, ethers.utils.parseUnits("100000", 6), 0, 0, owner.address, 99999999999999, {value: ethers.utils.parseEther("1")})).wait()
  // await (await Router.addLiquidityETH(USDC.address, ethers.utils.parseUnits("100000", 6), 0, 0, owner.address, 99999999999999, {value: ethers.utils.parseEther("1")})).wait()
  // await deploy("CashX", ethers.constants.AddressZero, ethers.utils.parseEther("0.1"), 0, true)
  await deploy("CashX", ethers.constants.AddressZero, ethers.utils.parseEther("0.5"), 0, true)
  // await deploy("CashX", ethers.constants.AddressZero, ethers.utils.parseEther("1"), 0, true)
  // await deploy("CashX", ethers.constants.AddressZero, ethers.utils.parseEther("5"), 0, true)
  // await deploy("CashX", ethers.constants.AddressZero, ethers.utils.parseEther("10"), 0, true)
  // await deploy("CashX", ethers.constants.AddressZero, ethers.utils.parseEther("50"), 0, true)
  // await deploy("CashX", ethers.constants.AddressZero, ethers.utils.parseEther("100"), 0, true)
  // await deploy("CashX", ethers.constants.AddressZero, ethers.utils.parseEther("500"), 0, true)
  await deploy("CashX", USDT.address, ethers.utils.parseUnits("100", 6), 0, true)
  await deploy("CashX", USDT.address, ethers.utils.parseUnits("500", 6), 0, true)
  await deploy("CashX", USDT.address, ethers.utils.parseUnits("1000", 6), 0, true)
  await deploy("CashX", USDT.address, ethers.utils.parseUnits("10000", 6), 0, true)
  // await deploy("Multicall")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
