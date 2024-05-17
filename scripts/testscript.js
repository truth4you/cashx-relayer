const { expect } = require("chai")
const { ethers, waffle, upgrades } = require("hardhat")
const fs = require('fs')

let owner, addr1, addr2, addrs;
let NodeGrid, NodeManager, NodePresale, FeeManager, BoostNFT, Router, BUSD, WETH;

const sleep = async (ms) => {
  return new Promise(resolve => setTimeout(resolve,ms))
}
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
const upgradeProxy = async (contractName, contractAddress)=>{
    const factory = await ethers.getContractFactory(contractName)
    const contract = await upgrades.upgradeProxy(contractAddress, factory)
    await contract.deployed()
    console.log(contractName, contract.address)
    return contract
}
const toTimestamp = (date) => parseInt(date==undefined?new Date():new Date(date)/1000)
const setBlockTime = async (date)=>{
  await network.provider.send("evm_setNextBlockTimestamp", [parseInt(date==undefined?new Date():new Date(date)/1000)] )
  await network.provider.send("evm_mine") 
}

describe("Test total", () => {
  it("Deploy", async () => {
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
    NodeGrid = await deployProxy("NodeGrid")
    await(await NodeGrid.transferOwnership(owner.address)).wait()
    BoostNFT = await deploy("BoostNFT")
    FeeManager = await deployProxy("FeeManager")
    NodeManager = await deployProxy("NodeManager",[FeeManager.address, BoostNFT.address])
    NodePresale = await deploy("NodePresale")
    WETH = await deploy("WETH")
    BUSD = await deploy("BEP20Token")
    const Factory = await deploy("PancakeFactory",WETH.address)
    const path = './contracts/Uniswap/Router.sol'
    const content = fs.readFileSync(path)
    fs.writeFileSync(path,content.toString('utf8').replace(/[\da-f]{64}/mi,String(await Factory.INIT_CODE_PAIR_HASH()).slice(2)))
    Router = await deploy("PancakeRouter", Factory.address, WETH.address)
    const Multicall = await deploy("Multicall")

    await (await NodeGrid.approve(Router.address, ethers.utils.parseEther("100000000"))).wait()
    await (await Router.addLiquidityETH(NodeGrid.address, ethers.utils.parseEther("1000") ,"0","0", owner.address, parseInt(new Date().getTime()/1000)+100 ,{ value: ethers.utils.parseEther("1000") })).wait()
    await (await BUSD.approve(NodeManager.address, ethers.utils.parseEther("100000000"))).wait()
    
    await (await NodeManager.bindFeeManager(FeeManager.address)).wait()
    await (await NodeManager.bindBoostNFT(BoostNFT.address)).wait()
    await (await NodeManager.setPayTokenAddress(BUSD.address)).wait()
    
    await (await NodeGrid.updateRouter(Router.address)).wait()  
    await (await NodeGrid.setNodeManagerAddress(NodeManager.address)).wait()  
    
    await (await NodePresale.updateTokenVest(BUSD.address)).wait()
    await (await NodePresale.allow([addr1.address,addr2.address,addrs[5].address])).wait()
    
    await (await FeeManager.setTreasury(addrs[3].address)).wait()
    await (await FeeManager.setOperator(addrs[4].address)).wait()
    await (await FeeManager.bindManager(NodeManager.address)).wait()
    await (await FeeManager.bindToken(NodeGrid.address)).wait()  

    await (await NodeGrid.setExcludedFromFee(FeeManager.address)).wait()

    await (await NodeGrid.transfer(FeeManager.address, ethers.utils.parseEther("100000"))).wait()

    console.log("Treasury Balance:", ethers.utils.formatEther(await waffle.provider.getBalance(addrs[3].address)))
    console.log("Token price1:", ethers.utils.formatEther(await FeeManager.getAmountETH1(ethers.utils.parseEther("1000"))))
    console.log("Token price2:", ethers.utils.formatEther(await FeeManager.getAmountETH2(ethers.utils.parseEther("1000"))))
  })
  describe("Node Create", () => {
    it('approve as addr1', async () => {
      await (await NodeGrid.transfer(addr1.address, ethers.utils.parseEther("1000"))).wait()
      await (await NodeGrid.connect(addr1).approve(FeeManager.address, ethers.utils.parseEther("1000000000"))).wait()
      expect(await NodeGrid.allowance(addr1.address, FeeManager.address),'allowance').to.equal(ethers.utils.parseEther("1000000000"))
    })
    it('approve as addr2', async () => {
      await (await NodeGrid.transfer(addr2.address, ethers.utils.parseEther("1000"))).wait()
      await (await NodeGrid.connect(addr2).approve(FeeManager.address, ethers.utils.parseEther("1000000000"))).wait()
      expect(await NodeGrid.allowance(addr2.address, FeeManager.address),'allowance').to.equal(ethers.utils.parseEther("1000000000"))
    })
    it("create basic 5 for addr1", async ()=>{
      await setBlockTime("2022-05-01")
      await (await NodeManager.connect(addr1).create("basic","Node1 - BASIC",5)).wait()
      console.log("Treasury Balance:", ethers.utils.formatEther(await waffle.provider.getBalance(addrs[3].address)))
      expect(await NodeManager.countTotal()).to.equal(5)
      console.log("Token price1:", ethers.utils.formatEther(await FeeManager.getAmountETH1(ethers.utils.parseEther("1000"))))
      console.log("Token price2:", ethers.utils.formatEther(await FeeManager.getAmountETH2(ethers.utils.parseEther("1000"))))
    })
    it("create basic 96 for addr1", async ()=>{
      await setBlockTime("2022-05-02")
      try {
        await (await NodeManager.connect(addr1).create("basic","Node1 - BASIC",96)).wait()
      } catch(ex) {
        expect(await NodeManager.countTotal(),ex.message).to.equal(5)
      }
    })
    it("create light 2 for addr1", async ()=>{
      await setBlockTime("2022-05-05")
      await (await NodeManager.connect(addr1).create("light","Node1 - LIGHT",2)).wait()
      expect(await NodeManager.countTotal()).to.equal(7)
      expect(await NodeManager.countOfUser(addr1.address)).to.equal(7)
    })
    it("create basic 3 for addr2", async ()=>{
      await setBlockTime("2022-05-07")
      await (await NodeManager.connect(addr2).create("basic","Node2 - BASIC",3)).wait()
      expect(await NodeManager.countTotal()).to.equal(10)
    })
    it("sell token from Router" ,async ()=>{
      const amount = ethers.utils.parseEther("200") //await NodeGrid.balanceOf(addr1.address)
      await (await NodeGrid.connect(addr1).approve(Router.address,amount)).wait()
      await (await Router.connect(addr1).swapExactTokensForETHSupportingFeeOnTransferTokens(amount,0,[NodeGrid.address,await(Router.WETH())],addr1.address,parseInt(new Date("2022-05-07").getTime()/1000+1000) )).wait()
    })
    it("count of nodes", async ()=>{
      expect(await NodeManager.countOfUser(addr2.address)).to.equal(3)
      expect(await NodeManager.countOfTier("basic")).to.equal(8)
      expect(await NodeManager.countOfTier("light")).to.equal(2)
    })
    it("claimable tokens", async()=>{
      await setBlockTime("2022-05-25")
      expect(await NodeManager.claimable(addr1.address)).to.equal("47599973958333333330")
    })
    it("mint boost token", async()=>{
      await (await BoostNFT.connect(addr1).mint('gold', 1, {value: ethers.utils.parseEther('0.01')})).wait()
      expect(await BoostNFT.getBalanceOf(addr1.address,'gold')).to.equal(1);
    })
    it("boost rate", async()=>{
      const mul1 = await NodeManager.getBoostRate(addr1.address, toTimestamp("2022-03-28"), toTimestamp("2022-06-16"))
      const mul2 = await BoostNFT.getMultiplier(addr1.address, toTimestamp("2022-03-28"), toTimestamp("2022-06-16"))
      expect(mul1).to.equal(mul2)
      expect(mul1).to.gt(ethers.utils.parseEther("1"))
    })
    it("claimable tokens with boost", async()=>{
      await setBlockTime("2022-06-16")
      expect(await NodeManager.claimable(addr1.address)).to.equal("146599947916666666637")
    })
    it("get nodes of addr1", async()=>{
      const nodes = await NodeManager.nodes(addr1.address)
      expect(nodes.length).to.equal(7)
      expect(nodes[0].title).to.equal('Node1 - BASIC')
    })
    it("get nodes of addr2", async()=>{
      const nodes = await NodeManager.nodes(addr2.address)
      expect(nodes.length).to.equal(3)
      expect(nodes[2].title).to.equal('Node2 - BASIC')
    })
  })
  describe("Node Compound", () => {
    it("compound with light 1 for addr1", async()=>{
      await setBlockTime("2022-06-20")
      console.log("claimable(addr1.address)",ethers.utils.formatEther(await NodeManager.claimable(addr1.address)))
      console.log("before-balanceOf(addr1.address)",ethers.utils.formatEther(await NodeGrid.balanceOf(addr1.address)))
      console.log("before-countOfNodes(light)",await NodeManager.countOfNodes(addr1.address,'light'))
      await (await NodeManager.connect(addr1).compound("light", "Node1 - Comp - LIGHT", 1)).wait()
      console.log("after-balanceOf(addr1.address)",ethers.utils.formatEther(await NodeGrid.balanceOf(addr1.address)))
      console.log("after-countOfNodes(light)",await NodeManager.countOfNodes(addr1.address,'light'))
      expect(await NodeManager.countTotal()).to.equal(11)
    })
    it("get nodes of addr1", async()=>{
      const nodes = await NodeManager.nodes(addr1.address)
      expect(nodes.length).to.equal(8)
      expect(nodes[7].title).to.equal('Node1 - Comp - LIGHT')
    })
    it("compound with basic 1 for addr2", async()=>{
      console.log("claimable",(await NodeManager.claimable(addr2.address)).toString())
      await (await NodeManager.connect(addr2).compound("basic", "Node2 - Comp - BASIC", 1)).wait()
      expect(await NodeManager.countTotal()).to.equal(12)
    })
    it("get nodes of addr2", async()=>{
      const nodes = await NodeManager.nodes(addr2.address)
      expect(nodes.length).to.equal(4)
      expect(nodes[3].title).to.equal('Node2 - Comp - BASIC')
    })
    it("get rewards of addr1", async()=>{
      console.log((await NodeManager.rewardsOfUser(addr1.address)).toString())
      console.log((await NodeGrid.balanceOf(addr1.address)).toString())
    })
    it("get rewards of addr2", async()=>{
      console.log((await NodeManager.rewardsOfUser(addr2.address)).toString())
      console.log((await NodeGrid.balanceOf(addr2.address)).toString())
    })
    it("get rewards of total", async()=>{
      console.log((await NodeManager.rewardsTotal()).toString())
      console.log((await NodeGrid.balanceOf(NodeManager.address)).toString())
    })
  })
  describe("Claim", () => {
    it("claim for addr1", async()=>{
      await setBlockTime("2022-06-25")
      console.log("balanceOf(addrs[4].address)",ethers.utils.formatEther(await waffle.provider.getBalance(addrs[4].address)))
      console.log("rewardsOfUser(addr1.address)",ethers.utils.formatEther(await NodeManager.rewardsOfUser(addr1.address)))
      console.log("balanceOf(addr1.address)",ethers.utils.formatEther(await NodeGrid.balanceOf(addr1.address)))
      console.log("claimable()",ethers.utils.formatEther(await NodeManager.claimable(addr1.address)))
      await (await NodeManager.connect(addr1).claim()).wait()
    })
    it("get rewards of addr1", async()=>{
      console.log("balanceOf(addrs[4].address)",ethers.utils.formatEther(await waffle.provider.getBalance(addrs[4].address)))
      console.log("rewardsOfUser(addr1.address)",ethers.utils.formatEther(await NodeManager.rewardsOfUser(addr1.address)))
      console.log("balanceOf(addr1.address)",ethers.utils.formatEther(await NodeGrid.balanceOf(addr1.address)))
    })
    it("get rewards of total", async()=>{
      console.log("rewardsTotal",(await NodeManager.rewardsTotal()).toString())
      console.log((await NodeGrid.balanceOf(NodeManager.address)).toString())
    })
  })
  describe("Node Upgrade", () => {
    it("upgrade 1 from basic to light for addr1", async()=>{
      const fees = await NodeManager.getUpgradeFee("basic", "light", 1)
      console.log(await NodeManager.countOfNodes(addr1.address,"basic"))
      console.log(await NodeManager.countOfNodes(addr1.address,"light"))
      await (await NodeManager.connect(addr1).upgrade("basic", "light", 1, {value:fees[0]})).wait()
      console.log(await NodeManager.countOfNodes(addr1.address,"basic"))
      console.log(await NodeManager.countOfNodes(addr1.address,"light"))
      // expect(await NodeManager.countOfNodes("basic")).to.equal(4)
      // expect(await NodeManager.countOfNodes("light")).to.equal(4)
    })
  })
  describe("Node Transfer", () => {
    it("transfer basic 1 from addr1 to addr2", async()=>{
      await (await NodeManager.setCanNodeTransfer(true)).wait()
      await (await NodeManager.connect(addr1).transfer("light", 1, addr2.address)).wait()
      expect(await NodeManager.countOfUser(addr1.address)).to.equal(3)
      expect(await NodeManager.countOfUser(addr2.address)).to.equal(5)
      expect(await NodeManager.countTotal()).to.equal(8)
    })
  })
  describe("Node Burn", () => {
    it("burn for nodes", async()=>{
      await (await NodeManager.burnNodes([1,2,7])).wait()
      expect(await NodeManager.countOfUser(addr1.address)).to.equal(2)
      expect(await NodeManager.countOfUser(addr2.address)).to.equal(5)
      expect(await NodeManager.countOfTier("basic")).to.equal(4)
      expect(await NodeManager.countTotal()).to.equal(7)
    })
    // it("burn for addr2", async()=>{
    //   await (await NodeManager.burnUser(addr2.address)).wait()
    //   expect(await NodeManager.countOfUser(addr2.address)).to.equal(0)
    //   expect(await NodeManager.countOfTier("basic")).to.equal(0)
    //   expect(await NodeManager.countTotal()).to.equal(2)
    // })
  })
  describe("Payment", () => {
    it("pay all nodes", async()=>{
      await (await BUSD.transfer(addr1.address, ethers.utils.parseEther('1000')))
      await (await BUSD.connect(addr1).approve(FeeManager.address, ethers.utils.parseEther('1000') ))
      const balance = await BUSD.balanceOf(addr1.address)
      const fee = ethers.utils.parseEther('90')
      await (await NodeManager.connect(addr1).pay(2, [])).wait()
      expect(await BUSD.balanceOf(addr1.address)).to.equal(balance.sub(fee))
    })
    it("pay selected nodes", async()=>{
      await (await BUSD.transfer(addr1.address, ethers.utils.parseEther('1000')))
      await (await BUSD.connect(addr1).approve(FeeManager.address, ethers.utils.parseEther('1000') ))
      const balance = await BUSD.balanceOf(addr1.address)
      const fee = ethers.utils.parseEther('60')
      await (await NodeManager.connect(addr1).pay(2,[10,12],{value: ethers.utils.parseEther('0')})).wait()
      expect(await BUSD.balanceOf(addr1.address)).to.equal(balance.sub(fee))
    })
  })
  describe("Swap", () => {
    it("swap in", async()=>{
      await setBlockTime("2022-09-01")
      await NodeManager.setMinter(addr2.address)
      const count = await NodeManager.countOfNodes(addr1.address,'light')
      const logger = (account) => new Promise((resolve,reject) => {
        waffle.provider.once({
          address: NodeManager.address,
          topics: [
              ethers.utils.id("SwapIn(address,uint32,string,uint32,int32)"),
              ethers.utils.hexZeroPad(account,32),
              ethers.utils.hexZeroPad(56,32)
          ]
        },async (log) => {
          const [tierName, amount, limitedTime] = ethers.utils.defaultAbiCoder.decode(
            ['string', 'uint32', 'int32'],
            log.data
          )
          await NodeManager.connect(addr2).swapOut(account,tierName,amount,limitedTime)
          resolve()
        })
        setTimeout(reject, 10000)
      })
      // Promise.all([
      //   new Promise((resolve, reject) => {
      //     NodeManager.connect(addr1).swapIn(56,'light',1,{value:ethers.utils.parseEther("10")})
      //     await logger(addr1.address)
      //     resolve()
      //   }),
      //   new Promise((resolve, reject) => {
      //     NodeManager.connect(addr2).swapIn(56,'basic',1,{value:ethers.utils.parseEther("10")})
      //     await logger(addr2.address)
      //     resolve()
      //   })
      // ])
      NodeManager.connect(addr1).swapIn(56,'light',1,{value:ethers.utils.parseEther("10")})
      // NodeManager.connect(addr2).swapIn(56,'basic',1,{value:ethers.utils.parseEther("10")})
      await logger(addr1.address)
      expect(await NodeManager.countOfNodes(addr1.address,'light')).to.equal(count)
    })
  })
})