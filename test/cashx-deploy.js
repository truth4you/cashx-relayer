const { expect } = require("chai")
const { ethers, waffle, upgrades } = require("hardhat")
const { deploy } = require("../scripts/utils")
const genContract = require('circomlib/src/mimcsponge_gencontract.js')

describe("Test total", () => {
    it("Deploy", async () => {
        const bytecode = genContract.createCode("mimcsponge",220)
        const factory = await ethers.getContractFactory([
            "function MiMCSponge(uint256, uint256) public view returns (uint256, uint256)"
        ], bytecode)
        const Hasher = await factory.deploy()
        await Hasher.deployed()
        const Verifier = await deploy("Verifier")
        await deploy("CashX", Verifier.address, Hasher.address, ethers.utils.parseEther("0.1"), 20, ethers.utils.getAddress("0x0000000000000000000000000000000000000000"))
        await deploy("CashX", Verifier.address, Hasher.address, ethers.utils.parseEther("1"), 20, ethers.utils.getAddress("0x0000000000000000000000000000000000000000"))
        await deploy("CashX", Verifier.address, Hasher.address, ethers.utils.parseEther("10"), 20, ethers.utils.getAddress("0x0000000000000000000000000000000000000000"))
    })
})