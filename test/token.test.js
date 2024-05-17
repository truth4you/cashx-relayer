const { ethers, waffle } = require("hardhat")
const { deploy } = require("../scripts/utils")

describe("Test total", () => {
    it("Deploy ERC", async () => {
        const [owner, treasury, addr1, addr2] = await ethers.getSigners()
        const TestToken = await deploy("Test", treasury.address, [])
        const Factory = await deploy("PancakeFactory", owner.address)
        const WETH = await deploy("WETH")
        const Router = await deploy("PancakeRouter", Factory.address, WETH.address)
        await TestToken.transfer(TestToken.address, ethers.utils.parseEther('100000000'))
        await TestToken.transfer(addr1.address, ethers.utils.parseEther('50000000'))
        await TestToken.transfer(addr2.address, ethers.utils.parseEther('50000000'))
        await owner.sendTransaction({to: TestToken.address, value:ethers.utils.parseEther('10')})
        await TestToken.openTrading(Router.address)

        await TestToken.connect(addr1).transfer(addr2.address, ethers.utils.parseEther('20000000'))
        console.log([
            await TestToken.balanceOf(owner.address),
            await TestToken.balanceOf(treasury.address),
            await TestToken.balanceOf(addr1.address),
            await TestToken.balanceOf(addr2.address),
        ])
    })
})