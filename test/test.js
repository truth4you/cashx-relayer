const { ethers, waffle } = require("hardhat")
const { deploy } = require("../scripts/utils")

describe("Test total", () => {
    it("Deploy ERC", async () => {
        const [owner] = await ethers.getSigners()
        const Token = await deploy("Token", "Test", "Test", 18)
        const tx = await (await Token.drip(owner.address)).wait()
        console.log(tx)
    })
})