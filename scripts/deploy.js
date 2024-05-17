const { ethers } = require("hardhat")
const { deploy, deployProxy, upgradeProxy, getAt, mineBlock } = require('./utils')
// const genContract = require('circomlib/src/mimcsponge_gencontract.js')

async function main() {
  const [owner, signer] = await ethers.getSigners();

  await mineBlock(100)
  return
  // const Router = await getAt("PancakeRouter", "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0")
  // const ANON = await getAt("Token", "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9")
  // await (await Router.addLiquidityETH(ANON.address, ethers.utils.parseUnits("100000", 18), 0, 0, owner.address, 99999999999999, {value: ethers.utils.parseEther("100")})).wait()

  const Factory = await deploy("PancakeFactory", owner.address)
  const WETH = await deploy("WETH")
  const Router = await deploy("PancakeRouter", Factory.address, WETH.address)
  const ANON = await deploy("Token", "Anonymous Token", "ANON", 18)
  const USDT = await deploy("Token", "Tether", "USDT", 6)
  const USDC = await deploy("Token", "USD Coin", "USDC", 6)
  const Distributor = await deploy("Distributor", Router.address, ANON.address)
  await (await Distributor.setSigner(signer.address)).wait()
  // const Router = await getAt("PancakeRouter", "0xb70903830eF40Ccb458f2199BBaab50610cA2a0a")
  // const USDT = await getAt("Token", "0x0114e318f1381123Cbb936093F2631283B19b6a2")
  // const USDC = await getAt("Token", "0x9c014D71D31B9050D92BDB00A79A60f1BB7CB5e5")
  await (await USDT.approve(Router.address, ethers.utils.parseUnits("1000000", 6))).wait()
  await (await USDC.approve(Router.address, ethers.utils.parseUnits("1000000", 6))).wait()
  await (await ANON.approve(Router.address, ethers.utils.parseUnits("1000000", 18))).wait()
  await (await Router.addLiquidityETH(USDT.address, ethers.utils.parseUnits("100000", 6), 0, 0, owner.address, 99999999999999, {value: ethers.utils.parseEther("100")})).wait()
  await (await Router.addLiquidityETH(USDC.address, ethers.utils.parseUnits("100000", 6), 0, 0, owner.address, 99999999999999, {value: ethers.utils.parseEther("100")})).wait()
  await (await Router.addLiquidityETH(ANON.address, ethers.utils.parseUnits("100000", 18), 0, 0, owner.address, 99999999999999, {value: ethers.utils.parseEther("100")})).wait()
  const result = []
  for(const [token, decimals, amount] of [
    [ethers.constants.AddressZero, 18, 0.1],
    [ethers.constants.AddressZero, 18, 0.5],
    [ethers.constants.AddressZero, 18, 1],
    [ethers.constants.AddressZero, 18, 5],
    [ethers.constants.AddressZero, 18, 10],
    [ethers.constants.AddressZero, 18, 50],
    [USDT.address, 6, 100],
    [USDT.address, 6, 500],
    [USDT.address, 6, 1000],
    [USDT.address, 6, 10000],
  ]) {
    const CashX = await deploy("CashX", Router.address, Distributor.address, token, ethers.utils.parseUnits(String(amount), decimals), 500, false)
    result.push({address:CashX.address, denominate:amount})
  }
  const Multicall = await deploy("Multicall3")
  console.log(JSON.stringify({
    router: Router.address,
    distributor: Distributor.address,
    multicall: Multicall.address,
    anon: ANON.address,
    tokens: [
      {
          "address": WETH.address,
          "name": "Ethereum",
          "symbol": "ETH",
          "decimals": 18,
          "native": true,
          "logo": "https://assets.coingecko.com/coins/images/279/standard/ethereum.png?1696501628"
      },
      {
          "address": USDT.address,
          "name": "Tether",
          "symbol": "USDT",
          "decimals": 6,
          "logo": "https://assets.coingecko.com/coins/images/325/standard/Tether.png?1696501661"
      },
      {
          "address": USDC.address,
          "name": "USD Coin",
          "symbol": "USDC",
          "decimals": 6,
          "logo": "https://assets.coingecko.com/coins/images/6319/standard/usdc.png?1696506694"
      },
      {
          "address": ANON.address,
          "name": "$ANON",
          "symbol": "ANON",
          "decimals": 18,
          "logo": "/logo.png"
      }
    ],
    contracts: result
  }, null, 4))
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
