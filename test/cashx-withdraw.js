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
        const { data } = await axios.post('http://localhost:3000/proof', {
            "note": "cashx-0.1eth-6170376338cb99f6eb2e3b03e547130b39e1fc3c923fd37ca67bb6b03ae142effd1e112d108e72787895eb4bb51cb69292d6b490e20f5d59e3efee9f4ec1",
            "recipient": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            "currency": "avaxc"
        })
        await (await CashX.connect(addr1).withdraw(data.proof, ...data.args)).wait()
    })
})