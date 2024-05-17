const { ethers } = require("hardhat")
const { Contract, Provider, setMulticallAddress } = require("ethers-multicall")
const { deploy } = require("../scripts/utils")

describe("Test total", () => {
    it("Deploy", async () => {
        const CashX1 = await deploy("CashX", ethers.constants.AddressZero, ethers.utils.parseEther("0.1"))
        const CashX2 = await deploy("CashX", ethers.constants.AddressZero, ethers.utils.parseEther("1"))
        const CashX3 = await deploy("CashX", ethers.constants.AddressZero, ethers.utils.parseEther("10"))
        const Multicall = await deploy("Multicall")


    })
})