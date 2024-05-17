const { ethers } = require("hardhat")
const { deploy, verify, getAt } = require('./utils')
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

  const WETH = await getAt("WETH", "0xEd63A827aA9B851d6E806f27356f7E00433ffF0E")
  const FUSD = await getAt("Token", "0xDb777d3196Eb776197f7006B2dF207347C3F1D6f")
  const ANON = await getAt("Token", "0x2eebA97928d87efA50DAc8800E8a25801367cCA8")
  // const ANON = await deploy("Token", "Anonymous Token", "ANON", 18)
  if (await verify(ANON.address, ["Anonymous Token", "ANON", 18]))
    console.log("verified ANON")
  const Router = await getAt("PancakeRouter", "0xf6441bbbb55aaf15aaF4007b82202450858Da7c9")
  const Verifier = await getAt("contracts/Verifier.sol:Verifier", "0x98c3d0246e7AC706F9F379f411DA92fFCA9aa627")
  const Distributor = await getAt("Distributor", "0x6c0325fe027D20eeCa49dbBaa4692Fca8f835b7A")
  if (await verify(Distributor.address, [Router.address, ANON.address]))
    console.log("verified Distributor")
  // const Bridge = await deploy("BridgeRouter", "0xD3b06cEbF099CE7DA4AcCf578aaebFDBd6e88a93")
  const Bridge = await getAt("BridgeRouter", "0xF1DFc942Cc27ed1c29529953965C2F214f2e1eA4")
  if (await verify(Bridge.address, ["0xD3b06cEbF099CE7DA4AcCf578aaebFDBd6e88a93"]))
    console.log("verified Bridge")
  // const Mixer = await getAt("contracts/Mixer.sol:Mixer", "0x60b482F0E63C7Ae581A82402674be583569c0Fe3")
  const Mixer = await deploy(
    "contracts/Mixer.sol:Mixer", 
    Verifier.address,
    Router.address, 
    Bridge.address,
    Distributor.address,
    '0'
  )
  if (await verify(Mixer.address, [
    Verifier.address,
    Router.address, 
    Bridge.address,
    Distributor.address,
    '0'
  ]))
    console.log("verified Mixer")
  await Mixer.setDenominators(
      ethers.constants.AddressZero, 
      [0.1, 0.2, 0.5].map(v => ethers.utils.parseEther(String(v))), 
      [1, 1, 1].map(v => Math.floor(v * 100)),
      [],
  )
  await Mixer.setDenominators(
    FUSD.address, 
    [1, 2].map(v => ethers.utils.parseUnits(String(v), 6)), 
    [0.01, 0.01].map(v => Math.floor(v * 100)),
    [FUSD.address, WETH.address],
  )
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
