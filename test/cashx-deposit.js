const { ethers } = require("hardhat")
const { deploy } = require("../scripts/utils")

const BALANCE_SIG = ethers.utils.id("balanceOf(bytes)").slice(0, 10)
const DEPOSIT_SIG = ethers.utils.id("deposit(bytes,uint256)").slice(0, 10)
const WITHDRAW_SIG = ethers.utils.id("withdraw(bytes,uint256,address)").slice(0, 10)
const SWAP_SIG = ethers.utils.id("swap(bytes,uint256,address,address,address[],uint32)").slice(0, 10)

async function msg2sig(wallet, msg) {
    const payload = ethers.utils.defaultAbiCoder.encode(["bytes4", "string"], [msg, "cashx-verifier"])
    const payloadHash = ethers.utils.keccak256(payload)
    return await wallet.signMessage(ethers.utils.arrayify(payloadHash))
}

async function createProof(note, sig) {
    const rx = /cashx-(?<amount>[\d.]+)(?<symbol>\w+)-(?<chainId>\d+)-(?<key>[0-9a-fA-F]{64})/g
    const match = rx.exec(note)
    if(match) {
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

describe("Test total", () => {
    it("Deploy", async () => {
        const [ owner, addr1, addr2, addr3 ] = await ethers.getSigners()
        const Factory = await deploy("PancakeFactory", owner.address)
        const WETH = await deploy("WETH")
        const Router = await deploy("PancakeRouter", Factory.address, WETH.address)
        const USDT = await deploy("Token", "USDT", "USDT")
        await USDT.approve(Router.address, ethers.utils.parseEther("10000"))
        await Router.addLiquidityETH(USDT.address, ethers.utils.parseEther("1000"), 0, 0, owner.address, 99999999999999, {value: ethers.utils.parseEther("10")})
        // const CashX = await deploy("CashX", ethers.constants.AddressZero, ethers.utils.parseEther("0.1"), 0, true)
        const CashX = await deploy("CashX", USDT.address, ethers.utils.parseEther("10"), 0, true)
        // await CashX.setRouter(Router.address)
        const deposit = await createDeposit()
        console.log(ethers.utils.formatEther(await addr1.getBalance()), ethers.utils.formatEther(await USDT.balanceOf(addr1.address)))
        // await CashX.connect(addr1).deposit(deposit.sig, {value:ethers.utils.parseEther("0.1")})
        await USDT.transfer(addr1.address, ethers.utils.parseEther("10"))
        await USDT.connect(addr1).approve(CashX.address, ethers.utils.parseEther("10"))
        await CashX.connect(addr1).deposit(deposit.sig)
        console.log(ethers.utils.formatEther(await addr1.getBalance()), ethers.utils.formatEther(await USDT.balanceOf(addr1.address)))
        // const proof = await createProof(deposit.note, WITHDRAW_SIG)
        // console.log(ethers.utils.formatEther(await addr3.getBalance()))
        // const tx = await CashX.connect(addr2).withdraw(proof.sig, addr3.address)
        // await tx.wait()
        const proof = await createProof(deposit.note, SWAP_SIG)
        console.log(ethers.utils.formatEther(await addr3.getBalance()), ethers.utils.formatEther(await USDT.balanceOf(addr3.address)))
        const tx = await CashX.connect(addr2).swap(proof.sig, addr3.address, Router.address, [USDT.address, WETH.address], 0)
        await tx.wait()
        console.log(ethers.utils.formatEther(await addr3.getBalance()), ethers.utils.formatEther(await USDT.balanceOf(addr3.address)))
    })
})