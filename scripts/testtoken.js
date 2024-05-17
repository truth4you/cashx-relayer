const { expect } = require("chai")
const { ethers, upgrades } = require("hardhat")
const fs = require('fs')



describe("Token", ()=>{
    let owner, addr1, addr2, addrs;
    let Token, Router, WETH;
  describe("Deploy", () => {
    it("Deploy", async () => {
        const deploy = async (contractName,...args)=>{
            const factory = await ethers.getContractFactory(contractName)
            const contract = await factory.deploy(...args)
            await contract.deployed()
            console.log(contractName, contract.address)
            return contract
        }
          
        const deployProxy = async (contractName,args)=>{
            const factory = await ethers.getContractFactory(contractName)
            const contract = await upgrades.deployProxy(factory,args)
            await contract.deployed()
            console.log(contractName, contract.address)
            return contract
        }
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

        WETH = await deploy("WETH")
        Token = await deployProxy("Token")
        const Factory = await deploy("PancakeFactory",WETH.address)
        const path = './contracts/Uniswap/Router.sol'
        const content = fs.readFileSync(path)
        fs.writeFileSync(path,content.toString('utf8').replace(/[\da-f]{64}/mi,String(await Factory.INIT_CODE_PAIR_HASH()).slice(2)))
        Router = await deploy("PancakeRouter", Factory.address, WETH.address)
        addrRouter = Router.address
        addrTreasury = addrs[3].address
        addrOperator = addrs[4].address
        await(await Token.approve(Router.address, ethers.utils.parseEther("100000000"))).wait()
        await(await Router.addLiquidityETH(Token.address, ethers.utils.parseEther("1000000") ,"0","0", owner.address, parseInt(new Date().getTime()/1000)+100 ,{ value: ethers.utils.parseEther("1000") })).wait()
        await(await Token.updateuniswapV2Router(Router.address)).wait()
    })

  })

  describe(" Transfer", () => {
    it("transfer from owner to others", async () => {
        // await(await Token.transfer(addr1.address, ethers.utils.parseEther("100000"))).wait()
    })
    it("transfer other to other", async () => {
        // await(await Token.connect(addr1).transfer(addr2.address, ethers.utils.parseEther("50000"))).wait()
    })
    // it("transfer other to other", async () => {
    //     await(await Token.connect(addr1).transfer(addr2.address, ethers.utils.parseEther("50000"))).wait()
    // })
    it("buy token from Router" ,async ()=>{
        await(await Router.connect(addr1).swapExactETHForTokens(0,[await(Router.WETH()),Token.address],addr1.address,parseInt(new Date().getTime()/1000)+100,{value:ethers.utils.parseEther("1")} )).wait()
    })
    it("Sell token from Router" ,async ()=>{
        const amount = await Token.balanceOf(addr1.address)
        console.log(amount)
        await(await Token.connect(addr1).approve(Router.address,amount)).wait()
        await(await Router.connect(addr1).swapExactTokensForETHSupportingFeeOnTransferTokens(amount,0,[Token.address,await(Router.WETH())],addr1.address,parseInt(new Date().getTime()/1000+1000) )).wait()
    })
     
    
  })

})



  
