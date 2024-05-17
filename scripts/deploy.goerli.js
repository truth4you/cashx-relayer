const { ethers } = require("hardhat")
const { deploy, verify, getAt } = require('./utils')
// const genContract = require('circomlib/src/mimcsponge_gencontract.js')

const BALANCE_SIG = ethers.utils.id("balanceOf(bytes)").slice(0, 10)
const DEPOSIT_SIG = ethers.utils.id("deposit(bytes,uint256)").slice(0, 10)
const WITHDRAW_SIG = ethers.utils.id("withdraw(bytes,uint256,address)").slice(0, 10)
const SWAP_SIG = ethers.utils.id("swap(bytes,uint256,address,address[],uint32)").slice(0, 10)

async function msg2sig(wallet, msg) {
  const payload = ethers.utils.defaultAbiCoder.encode(["bytes4", "string"], [msg, "anon-mixer"])
  const payloadHash = ethers.utils.keccak256(payload)
  return await wallet.signMessage(ethers.utils.arrayify(payloadHash))
}

async function createProof(note, sig) {
  const rx = /cashx-(?<amount>[\d.]+)(?<symbol>\w+)-(?<chainId>\d+)-(?<key>[0-9a-fA-F]{64})/g
  const match = rx.exec(note)
  if (match) {
    const wallet = new ethers.Wallet(`0x${match.groups.key}`)
    return {
      key: match.groups.key,
      sig: await msg2sig(wallet, sig)
    }
  }
}

async function createDeposit() {
  // const wallet = ethers.Wallet.createRandom()
  const wallet = new ethers.Wallet('0x99482217ba6cb2805a18aac41747979bbb9c808451cd1c3f3e659f85f597eb6f')
  return {
    key: wallet.privateKey,
    sig: await msg2sig(wallet, DEPOSIT_SIG),
    note: `cashx-0.1eth-56-${wallet.privateKey.slice(2)}`
  }
}

async function main() {
  const [owner] = await ethers.getSigners();

  const Router = await getAt("PancakeRouter", "0xb70903830eF40Ccb458f2199BBaab50610cA2a0a")
  const WETH = await getAt("WETH", "0x50dD1aA7d28CDA8c31f2dAbe84b4BDcdF480959c")
  const USDT = await getAt("Token", "0x0114e318f1381123Cbb936093F2631283B19b6a2")
  const USDC = await getAt("Token", "0x9c014D71D31B9050D92BDB00A79A60f1BB7CB5e5")
  const ANON = await getAt("Token", "0x6e3ae6394a91719e45a709d303da5a34e7dc0db7")
  // const ANON = await deploy("Token", "Anonymous Token", "ANON", 18)
  if (await verify(ANON.address, ["Anonymous Token", "ANON", 18]))
    console.log("verified ANON")
  const Distributor = await deploy("Distributor", Router.address, ANON.address)
  if (await verify(Distributor.address, [Router.address, ANON.address]))
    console.log("verified Distributor")
  await (await Distributor.setSigner("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")).wait()
  await (await ANON.approve(Router.address, ethers.utils.parseUnits("1000000", 18))).wait()
  await (await Router.addLiquidityETH(ANON.address, ethers.utils.parseUnits("100000", 18), 0, 0, owner.address, 99999999999999, { value: ethers.utils.parseEther("1") })).wait()
  const result = []
  for (const [token, decimals, amount] of [
    [ethers.constants.AddressZero, 18, 0.1],
    [ethers.constants.AddressZero, 18, 0.5],
    // [USDT.address, 6, 100],
    // [USDT.address, 6, 500],
    [USDT.address, 6, 1000],
    [USDT.address, 6, 10000],
  ]) {
    const CashX = await deploy("CashX", Router.address, Distributor.address, token, ethers.utils.parseUnits(String(amount), decimals), 500, false)
    result.push({ address: CashX.address, denominate: amount })
  }
  console.log(JSON.stringify({
    router: Router.address,
    distributor: Distributor.address,
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
