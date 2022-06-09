const { expect } = require("chai")
const { ethers, waffle, upgrades } = require("hardhat")
const { getAt } = require("../scripts/utils")
const genContract = require('circomlib/src/mimcsponge_gencontract.js')

const snarkjs = require('snarkjs')
const crypto = require('crypto')
const circomlib = require('circomlib')
const rbigint = nbytes => snarkjs.bigInt.leBuff2int(crypto.randomBytes(nbytes))
const pedersenHash = data => circomlib.babyJub.unpackPoint(circomlib.pedersenHash.hash(data))[0]


function createDeposit() {
    const deposit = { nullifier: rbigint(31), secret: rbigint(31) }
    const preimage = Buffer.concat([deposit.nullifier.leInt2Buff(31), deposit.secret.leInt2Buff(31)])
    deposit.commitment = pedersenHash(preimage)
    deposit.commitmentHex = ethers.utils.hexZeroPad(deposit.commitment, 32)
    deposit.nullifierHash = pedersenHash(deposit.nullifier.leInt2Buff(31))
    deposit.nullifierHex = ethers.utils.hexZeroPad(deposit.nullifierHash, 32)
    deposit.note = `cashx-0.1eth-${ethers.utils.hexZeroPad(preimage,62).slice(2)}`
    return deposit
}

describe("Test total", () => {
    it("Deploy", async () => {
        const CashX = await getAt("CashX", "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0")
        const deposit = createDeposit()
        console.log(deposit.note)
        await CashX.deposit(deposit.commitmentHex, {value:ethers.utils.parseEther("0.1")})
    })
})