const { ethers } = require("hardhat")
const { deploy, verify, getAt, sleep } = require('./utils')
const { formatEther, formatUnits, parseUnits, parseEther } = require("ethers/lib/utils")

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
  const wallet = ethers.Wallet.createRandom()
  return {
    key: wallet.privateKey,
    sig: await msg2sig(wallet, DEPOSIT_SIG),
    note: `cashx-0.1eth-56-${wallet.privateKey.slice(2)}`
  }
}

async function main() {
  const [owner, addr1, addr2, addr3] = await ethers.getSigners();
  
  const WETH = await getAt("WETH", "0xE1818e1FBcC010c8eA1c9Aa4cAeB42b1030D7273")
  const USDT = await getAt("Token", "0xBb620AcB93281F700E61AE19F99913B2e79A04B1")
  const USDC = await getAt("Token", "0xFd3E13ef5368c25A26C4F54d3080E0a1057612a9")
  const ANON = await getAt("Token", "0xb9906f9b49DD159fF364a22b5cC2d357b92d4ef6")
  const BRIDGE = await getAt("Token", "0xfE8a8308E0d26E85f9593a443Bb61857f105C0B3")
  if (await verify(ANON.address, ["Anonymous Token", "ANON", 18]))
    console.log("verified ANON")
  const Router = await getAt("PancakeRouter", "0xDf247000F750AE87CE8C1a5E2c059592C9D0B09e")
  const Verifier = await getAt("contracts/Verifier.sol:Verifier", "0xc04A01d017F0f67b3Ae7b5557DB2E4593226cb75")
  const Distributor = await getAt("Distributor", "0xcdbaacEd10AEfB7364C7a48427BadDc1CBC4fb4e")
  if (await verify(Distributor.address, [Router.address, ANON.address]))
    console.log("verified Distributor")
  // const Bridge = await deploy("BridgeRouter", "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59")
  const Bridge = await getAt("BridgeRouter", "0x51b4B2C5fD1DFA8EDbC7Ef7307abAD27288637B0")
  // await sleep(60 * 1000)
  if (await verify(Bridge.address, ["0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59"]))
    console.log("verified Bridge")
  const Mixer = await deploy(
    "contracts/Mixer.sol:Mixer", 
    Verifier.address,
    Router.address, 
    Bridge.address,
    Distributor.address,
    ethers.utils.parseEther("0.001")
  )
  await sleep(60 * 1000)
  // const Mixer = await getAt("contracts/Mixer.sol:Mixer", "0x030073069806914315992a00238FB8CE0ef94B8f")
  if (await verify(Mixer.address, [
    Verifier.address,
    Router.address, 
    Bridge.address,
    Distributor.address,
    ethers.utils.parseEther("0.001")
  ]))
    console.log("verified Mixer")
  await (await Mixer.setDenominators(
      ethers.constants.AddressZero, 
      [0.1, 0.5, 1, 5, 10].map(v => ethers.utils.parseEther(String(v))), 
      [1, 2, 3, 4, 5].map(v => Math.floor(v * 100)),
      [],
  )).wait()
  await (await Mixer.setDenominators(
    USDT.address, 
    [1, 2].map(v => ethers.utils.parseUnits(String(v), 6)), 
    [0.01, 0.01].map(v => Math.floor(v * 100)),
    [USDT.address, BRIDGE.address, WETH.address],
  )).wait()
  return

  // const LINK = await getAt("Token", "0x779877a7b0d9e8603169ddbd7836e478b4624789")
  // const DAI = await getAt("Token", "0x51B9084BD85725D725608aC712dDc99894De965D")
  await (await Distributor.setSigner("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")).wait()
  await (await ANON.approve(Router.address, ethers.utils.parseUnits("1000000", 18))).wait()
  await (await Router.addLiquidityETH(ANON.address, ethers.utils.parseUnits("100000", 18), 0, 0, owner.address, 99999999999999, { value: ethers.utils.parseEther("2") })).wait()
  const MixerETH = await deploy(
    "AnonMixer",
    ethers.constants.AddressZero,
    Router.address,
    [0.1, 0.5, 1].map(v => ethers.utils.parseEther(String(v))),
    [0.1, 0.1, 0.1].map(v => Math.floor(v * 100)),
    [],
    Distributor.address,
    0
  )
  const MixerUSDT = await deploy(
    "AnonMixer",
    USDT.address,
    Router.address,
    [100, 500, 1000].map(v => ethers.utils.parseUnits(String(v), 6)),
    [0.1, 0.2, 0.5].map(v => Math.floor(v * 100)),
    [BRIDGE],
    Distributor.address,
    ethers.utils.parseEther("0.005")
  )
  const MixerUSDC = await deploy(
    "AnonMixer",
    USDC.address,
    Router.address,
    [100, 200, 300, 400, 500].map(v => ethers.utils.parseUnits(String(v), 6)),
    [],
    [BRIDGE],
    Distributor.address,
    ethers.utils.parseEther("0.01")
  )

  // const [feeOnDeposit, denominators, feeRates, feeETH] = await MixerETH.getConfig()

  // const deposit = await createDeposit()
  // const amount = parseEther("0.5")
  // const feeRate = denominators.map((denominator, index) => [denominator, feeRates[index]]).find(([denominator, feeRate]) => denominator.eq(amount))?.[1]
  // const fee = feeOnDeposit ? amount.mul(feeRate).div(10000) : BigNumber.from(0)
  // await MixerETH.connect(addr2).deposit(deposit.sig, amount, {value: amount.add(feeETH).add(fee)})

  // const proofBalance = await createProof(deposit.note, BALANCE_SIG)
  // const proofWithdraw = await createProof(deposit.note, WITHDRAW_SIG)
  // const proofSwap = await createProof(deposit.note, SWAP_SIG)
  // let balance = await MixerETH.balanceOf(proofBalance.sig)
  // console.log('LOCK', formatEther(balance))
  // await MixerETH.withdraw(proofWithdraw.sig, balance.div(3), addr3.address)
  // balance = await MixerETH.balanceOf(proofBalance.sig)
  // console.log('LOCK', formatEther(balance))
  // await MixerETH.swap(proofSwap.sig, balance.div(2), addr3.address, [WETH.address, BRIDGE, USDC.address], 0)
  // balance = await MixerETH.balanceOf(proofBalance.sig)
  // console.log('LOCK', formatEther(balance))
  // console.log('USDC', formatUnits(await USDC.balanceOf(addr3.address), 6))
  // await MixerETH.swap(proofSwap.sig, '0', addr3.address, [WETH.address, BRIDGE, USDC.address], 0)
  // balance = await MixerETH.balanceOf(proofBalance.sig)
  // console.log('LOCK', formatEther(balance))
  // console.log('USDC', formatUnits(await USDC.balanceOf(addr3.address), 6))

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
