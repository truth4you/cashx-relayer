const { ethers } = require("hardhat")
const { deploy, deployProxy, upgradeProxy, getAt } = require('./utils')
const genContract = require('circomlib/src/mimcsponge_gencontract.js')

async function main() {
  const [owner] = await ethers.getSigners();

  const Factory = await deploy("PancakeFactory", owner.address)
  const WETH = await deploy("WETH")
  const Router = await deploy("PancakeRouter", Factory.address, WETH.address)
  const NineInch = await deploy("Token", "9inch", "9INCH", 18)
  const BBC = await deploy("Token", "Big Bonus Coin", "BBC", 18)
  const PLD = await deploy("Token", "PLD", "PLD", 0)
  const PP = await deploy("Token", "PP", "PP", 18)
  const WHETH = await deploy("Token", "WHETH", "WHETH", 18)
  await (await NineInch.approve(Router.address, ethers.utils.parseUnits("1000000", 18))).wait()
  await (await Router.addLiquidityETH(NineInch.address, ethers.utils.parseUnits("100000", 18), 0, 0, owner.address, 99999999999999, {value: ethers.utils.parseEther("100")})).wait()
  await (await BBC.approve(Router.address, ethers.utils.parseUnits("100000", 18))).wait()
  await (await Router.addLiquidityETH(BBC.address, ethers.utils.parseUnits("100000", 18), 0, 0, owner.address, 99999999999999, {value: ethers.utils.parseEther("100")})).wait()
  await (await PLD.approve(Router.address, ethers.utils.parseUnits("10000", 0))).wait()
  await (await Router.addLiquidityETH(PLD.address, ethers.utils.parseUnits("10000", 0), 0, 0, owner.address, 99999999999999, {value: ethers.utils.parseEther("100")})).wait()
  await (await PP.approve(Router.address, ethers.utils.parseUnits("1000", 18))).wait()
  await (await Router.addLiquidityETH(PP.address, ethers.utils.parseUnits("1000", 18), 0, 0, owner.address, 99999999999999, {value: ethers.utils.parseEther("100")})).wait()
  await (await WHETH.approve(Router.address, ethers.utils.parseUnits("100", 18))).wait()
  await (await Router.addLiquidityETH(WHETH.address, ethers.utils.parseUnits("100", 18), 0, 0, owner.address, 99999999999999, {value: ethers.utils.parseEther("100")})).wait()
  // await deploy("Multicall")
  // await deploy("Multicall3")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
