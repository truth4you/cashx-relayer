const { ethers } = require("hardhat")
const { deploy } = require("../scripts/utils")

async function msg2sig(wallet, msg) {
    const payload = ethers.utils.defaultAbiCoder.encode(["string"], [msg])
    const payloadHash = ethers.utils.keccak256(payload)
    return await wallet.signMessage(ethers.utils.arrayify(payloadHash))
}

async function createProof(note) {
    const rx = /cashx-(?<amount>[\d.]+)(?<symbol>\w+)-(?<chainId>\d+)-(?<key>[0-9a-fA-F]{64})/g
    const match = rx.exec(note)
    if(match) {
        const wallet = new ethers.Wallet(`0x${match.groups.key}`)
        return {
            key: match.groups.key,
            sig: await msg2sig(wallet, "withdraw")
        }
    }
}

async function createDeposit() {
    const wallet = ethers.Wallet.createRandom()
    return {
        key: wallet.privateKey,
        sig: await msg2sig(wallet, "deposit"),
        note: `cashx-0.1eth-56-${wallet.privateKey.slice(2)}`
    }
}

describe("Test total", () => {
    it("Deploy", async () => {
        await deploy("CashX", ethers.constants.AddressZero, ethers.utils.parseEther("0.1"), ethers.utils.parseEther("0.001"), true)
        await deploy("CashX", ethers.constants.AddressZero, ethers.utils.parseEther("1"), ethers.utils.parseEther("0.001"), true)
        await deploy("CashX", ethers.constants.AddressZero, ethers.utils.parseEther("10"), ethers.utils.parseEther("0.001"), true)
        const USDT = await deploy("BEP20Token")
        await deploy("CashX", USDT.address, ethers.utils.parseEther("10"), 100, false)
        await deploy("CashX", USDT.address, ethers.utils.parseEther("100"), 100, false)
        await deploy("Multicall")
        // const deposit = await createDeposit()
        // console.log(ethers.utils.formatEther(await addr1.getBalance()))
        // await CashX.connect(addr1).deposit(deposit.sig, {value:ethers.utils.parseEther("10")})
        // console.log(ethers.utils.formatEther(await addr1.getBalance()))
        // const proof = await createProof(deposit.note)
        // console.log(ethers.utils.formatEther(await addr3.getBalance()))
        // const gas = await CashX.estimateGas.withdraw(proof.sig, addr3.address, 1)
        // const tx = await CashX.connect(addr2).withdraw(proof.sig, addr3.address, gas.mul(await owner.getGasPrice()))
        // await tx.wait()
        // console.log(tx)
        // console.log(ethers.utils.formatEther(await addr3.getBalance()))
    })
})