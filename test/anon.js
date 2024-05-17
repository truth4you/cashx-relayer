const { ethers } = require("hardhat")
const { deploy, getAt } = require("../scripts/utils")
const { formatEther, formatUnits, parseUnits, parseEther } = require("ethers/lib/utils")
const { BigNumber } = require("ethers")

const BALANCE_SIG = ethers.utils.id("balanceOf(bytes)").slice(0, 10)
const DEPOSIT_SIG = ethers.utils.id("deposit(bytes,address,uint256)").slice(0, 10)
const WITHDRAW_SIG = ethers.utils.id("withdraw(bytes,address,uint256,address)").slice(0, 10)
const SWAP_SIG = ethers.utils.id("swap(bytes,uint256,address,address[],uint32)").slice(0, 10)
const BRIDGE_SIG = ethers.utils.id("bridge(bytes,uint256,address,address[],uint32,uint64,bytes)").slice(0, 10)

async function msg2sig(wallet, msg) {
    const payload = ethers.utils.defaultAbiCoder.encode(["bytes4", "string"], [msg, "anon-mixer"])
    const payloadHash = ethers.utils.keccak256(payload)
    return await wallet.signMessage(ethers.utils.arrayify(payloadHash))
}

async function createProof(note, sig) {
    const rx = /cashx-(?<amount>[\d.]+)(?<symbol>\w+)-(?<chainId>\d+)-(?<key>[0-9a-fA-F]{64})/g
    const match = rx.exec(note)
    if(match) {
        const wallet = new ethers.Wallet(`0x${match.groups.key}`)
        return {
            key: match.groups.key,
            sig: await msg2sig(wallet, sig)
        }
    }
}

async function createDeposit() {
    const wallet = ethers.Wallet.createRandom()
    return {
        key: wallet.privateKey,
        sig: await msg2sig(wallet, DEPOSIT_SIG),
        note: `cashx-0.1eth-56-${wallet.privateKey.slice(2)}`
    }
}

describe("Test total", () => {
    it("Deploy", async () => {
        const [ owner, addr1, addr2, addr3 ] = await ethers.getSigners()
        const Factory = await deploy("PancakeFactory", owner.address)
        const WETH = await deploy("WETH")
        const Router = await deploy("PancakeRouter", Factory.address, WETH.address)
        const ANON = await deploy("Token", "ANON", "ANON", 18)
        const USDT = await deploy("Token", "USDT", "USDT", 6)
        const USDC = await deploy("Token", "USDC", "USDC", 6)
        await USDT.approve(Router.address, ethers.utils.parseEther("10000"))
        await Router.addLiquidityETH(USDT.address, ethers.utils.parseUnits("10000", 6), 0, 0, owner.address, 99999999999999, {value: ethers.utils.parseEther("10")})
        await USDC.approve(Router.address, ethers.utils.parseEther("10000"))
        await Router.addLiquidityETH(USDC.address, ethers.utils.parseUnits("10000", 6), 0, 0, owner.address, 99999999999999, {value: ethers.utils.parseEther("10")})
        const BnM = await getAt("Token", "0xFd57b4ddBf88a4e07fF4e34C487b99af2Fe82a05")
        for(let i = 0;i<10;i++) {
            await BnM.drip(owner.address)
        }
        await BnM.approve(Router.address, ethers.utils.parseEther("10"))
        await Router.addLiquidityETH(BnM.address, ethers.utils.parseEther("10"), 0, 0, owner.address, 99999999999999, {value: ethers.utils.parseEther("100")})
        
        const Distributor = await deploy("contracts/Distributor.sol:Distributor", Router.address, ANON.address)
        const Verifier = await deploy("contracts/Verifier.sol:Verifier")
        const Bridge = await deploy("contracts/BridgeRouter.sol:BridgeRouter", "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59")
        const Mixer = await deploy(
            "contracts/Mixer.sol:Mixer", 
            Verifier.address,
            Router.address, 
            Bridge.address,
            Distributor.address,
            ethers.utils.parseEther("0.01")
        )
        await Mixer.setDenominators(
            ethers.constants.AddressZero, 
            [0.1, 0.5, 1, 5, 10].map(v => ethers.utils.parseEther(String(v))), 
            [1, 2, 3, 4, 5].map(v => Math.floor(v * 100)),
            [],
        )
        await Mixer.setDenominators(
            USDT.address, 
            [100, 500, 1000].map(v => ethers.utils.parseUnits(String(v), 6)), 
            [1, 2, 3].map(v => Math.floor(v * 100)),
            [],
        )        
        await Mixer.setDenominators(
            USDT.address, 
            [],
            [],
            [USDT.address, WETH.address],
        )

        const [config, feeInAmount, feeETH] = await Mixer.getAllConfig()
        
        // describe("Mix", () => {
        //     it("ETH", async () => {
        //         // await Mixer.setFeeOnDeposit(false)

        //         const { denominators, feeRates } = config.find(c => c.token==ethers.constants.AddressZero)

        //         const deposit = await createDeposit()
        //         console.log(deposit)
        //         const amount = parseEther("0.5")
        //         const feeRate = denominators.map((denominator, index) => [denominator, feeRates[index]]).find(([denominator, feeRate]) => denominator.eq(amount))?.[1]
        //         const fee = feeInAmount ? BigNumber.from(0) : amount.mul(feeRate).div(10000)
        //         await Mixer.connect(addr2).deposit(deposit.sig, ethers.constants.AddressZero, amount, {value: amount.add(feeETH).add(fee)})

        //         const proofBalance = await createProof(deposit.note, BALANCE_SIG)
        //         const proofWithdraw = await createProof(deposit.note, WITHDRAW_SIG)
        //         const proofSwap = await createProof(deposit.note, SWAP_SIG)
        //         let [token, balance] = await Mixer.balanceOf(proofBalance.sig)
        //         console.log('LOCK', token, formatEther(balance))
        //         await Mixer.withdraw(proofWithdraw.sig, token, balance.div(3), addr3.address)
        //         ;[token, balance] = await Mixer.balanceOf(proofBalance.sig)
        //         console.log('LOCK', token, formatEther(balance))
        //         await Mixer.swap(proofSwap.sig, balance.div(2), addr3.address, [WETH.address, USDC.address], 0)
        //         ;[token, balance] = await Mixer.balanceOf(proofBalance.sig)
        //         console.log('LOCK', token, formatEther(balance))
        //         console.log('USDC', formatUnits(await USDC.balanceOf(addr3.address), 6))
        //         await Mixer.swap(proofSwap.sig, '0', addr3.address, [WETH.address, USDC.address], 0)
        //         ;[token, balance] = await Mixer.balanceOf(proofBalance.sig)
        //         console.log('LOCK', token, formatEther(balance))
        //         console.log('USDC', formatUnits(await USDC.balanceOf(addr3.address), 6))
        //     })

        //     it("USDT", async () => {
        //         // await Mixer.setFeeOnDeposit(false)

        //         const { denominators, feeRates } = config.find(c => c.token==USDT.address)

        //         const deposit = await createDeposit()
        //         console.log(deposit)
        //         const amount = parseUnits("100", 6)
        //         const feeRate = denominators.map((denominator, index) => [denominator, feeRates[index]]).find(([denominator, feeRate]) => denominator.eq(amount))?.[1]
        //         const fee = feeInAmount ? BigNumber.from(0) : amount.mul(feeRate).div(10000)

        //         await USDT.transfer(addr2.address, parseUnits("1000", 6))
        //         await USDT.connect(addr2).approve(Mixer.address, amount.add(fee))
        //         await Mixer.connect(addr2).deposit(deposit.sig, USDT.address, amount, {value: feeETH})

        //         const proofBalance = await createProof(deposit.note, BALANCE_SIG)
        //         const proofWithdraw = await createProof(deposit.note, WITHDRAW_SIG)
        //         const proofSwap = await createProof(deposit.note, SWAP_SIG)

        //         let [token, balance] = await Mixer.balanceOf(proofBalance.sig)
        //         console.log('LOCK', token, formatUnits(balance, 6))

        //         await Mixer.withdraw(proofWithdraw.sig, USDT.address, balance.div(3), addr3.address)
        //         ;[token, balance] = await Mixer.balanceOf(proofBalance.sig)
        //         console.log('LOCK', token, formatUnits(balance, 6))

        //         await Mixer.swap(proofSwap.sig, balance.div(2), addr3.address, [USDT.address, WETH.address, USDC.address], 0)
        //         ;[token, balance] = await Mixer.balanceOf(proofBalance.sig)
        //         console.log('LOCK', formatUnits(balance, 6))
        //         console.log('USDC', formatUnits(await USDC.balanceOf(addr3.address), 6))

        //         await Mixer.swap(proofSwap.sig, '0', addr3.address, [USDT.address, WETH.address, USDC.address], 0)
        //         ;[token, balance] = await Mixer.balanceOf(proofBalance.sig)
        //         console.log('LOCK', token, formatUnits(balance, 6))
        //         console.log('USDC', formatUnits(await USDC.balanceOf(addr3.address), 6))
        //     })
        // })
        
        describe("Bridge", () => {
            it("ETH", async () => {
                const { denominators, feeRates } = config.find(c => c.token==ethers.constants.AddressZero)

                const deposit = await createDeposit()
                console.log(deposit)
                const amount = parseEther("0.5")
                const feeRate = denominators.map((denominator, index) => [denominator, feeRates[index]]).find(([denominator, feeRate]) => denominator.eq(amount))?.[1]
                const fee = feeInAmount ? BigNumber.from(0) : amount.mul(feeRate).div(10000)
                await Mixer.connect(addr2).deposit(deposit.sig, ethers.constants.AddressZero, amount, {value: amount.add(feeETH).add(fee)})

                const proofBalance = await createProof(deposit.note, BALANCE_SIG)
                const proofWithdraw = await createProof(deposit.note, WITHDRAW_SIG)
                const proofBridge = await createProof(deposit.note, BRIDGE_SIG)
                let [token, balance] = await Mixer.balanceOf(proofBalance.sig)
                // console.log('LOCK', token, formatEther(balance))
                // await Mixer.withdraw(proofWithdraw.sig, token, balance.div(3), addr3.address)
                // ;[token, balance] = await Mixer.balanceOf(proofBalance.sig)
                // console.log('LOCK', token, formatEther(balance))
                const data = ethers.utils.defaultAbiCoder.encode(["address", "address", "address[]"], [Mixer.address, addr3.address, [BnM.address, WETH.address, USDC.address]])
                await Mixer.bridge(proofBridge.sig, '0', addr3.address, [WETH.address, BnM.address], 0, '10344971235874465080', data)
                // ;[token, balance] = await Mixer.balanceOf(proofBalance.sig)
                // console.log('LOCK', token, formatEther(balance))
                // console.log('USDC', formatUnits(await USDC.balanceOf(addr3.address), 6))
            })
            it("Receive", async () => {

            })
        })
    })
})