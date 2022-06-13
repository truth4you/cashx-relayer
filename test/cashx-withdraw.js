const { expect } = require("chai")
const { getAt } = require("../scripts/utils")
const axios = require('axios')
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
    it("Withdraw", async () => {
        const [owner, addr1, addr2, ...addrs] = await ethers.getSigners()
        const CashX = await getAt("CashX", "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0")
        console.log(await CashX.roots(0))
        console.log(await CashX.roots(1))
        
        const { data } = await axios.post('http://localhost:8000/proof', {
            "note": "cashx-0.1bnbbsc-31337-52c07dc12595a9311474917bacb1e93dc2f3aec887d90a34b653b0694143453cdb95d18b0f23fd0de292f3a715c30a5a1e244e737e2860bf2d3e28c87595",
            "recipient": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
        })
        await (await CashX.connect(addr1).withdraw(data.proof, ...data.args)).wait()
    })
})