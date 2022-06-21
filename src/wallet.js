const { ethers, BigNumber } = require("ethers")
const chains = require('../chains.json')
const abiCashX = require('../abi/CashX.json')
const { default: axios } = require("axios")

require('dotenv').config()

const providers = {}
let lastGas = ethers.BigNumber.from(0)

const init = async () => {
    for(let chainId in chains) {
        providers[chainId] = new ethers.providers.JsonRpcProvider(chains[chainId].url)
    }
}

const withdraw = async (worker, note, to, coin) => {
    const rx = /cashx-(?<amount>[\d.]+)(?<symbol>\w+)-(?<chainId>\d+)-(?<note>[0-9a-fA-F]{124})/g
    const match = rx.exec(note)
    if (!match) {
        throw new Error('The note has invalid format')
    }
    const chain = chains[match.groups.chainId]
    const provider = providers[match.groups.chainId]
    const wallet = new ethers.Wallet(process.env.RELAYER_WALLET, provider)
    const address = chain.tokens[match.groups.symbol].instanceAddress[String(match.groups.amount)]
    const contract = new ethers.Contract(address, abiCashX, wallet)
    
    const isSwap = coin!=undefined && coin!=match.groups.symbol
    if(isSwap) {
        const quota = await axios.get(process.env.SWAPZONE_GETRATE_URL, {
            params: {
                from: match.groups.symbol,
                to: coin,
                amount: match.groups.amount
            },
            headers: {
                "X-API-KEY": process.env.SWAPZONE_API_KEY
            }
        })
        const tx = await axios.post(process.env.SWAPZONE_CREATE_URL, {
            from: match.groups.symbol,
            to: coin,
            amountDeposit: match.groups.amount,
            addressReceive: to,
            refundAddress: to,
            quotaId: quota.data.quotaId
        }, {
            headers: {
                "X-API-KEY": process.env.SWAPZONE_API_KEY
            }
        })
        const proof = await worker.prove(note, tx.data.transaction.addressDeposit, wallet.address)
        await contract.withdraw(proof.proof, ...proof.args)
        return tx.data.transaction.id
        // const status = await axios.get(process.env.SWAPZONE_STATUS_URL, {
        //     id: tx.data.transaction.id
        // }, {
        //     headers: {
        //         "X-API-KEY": process.env.SWAPZONE_API_KEY
        //     }
        // })
    } else {
        let fee = ethers.utils.parseEther("0.001")
        if(lastGas.gt(0)) {
            const gasPrice = await provider.getGasPrice()
            fee = fee.add(gasPrice.mul(lastGas))
        } else {
            const proof0 = await worker.prove(note, to, wallet.address)
            fee = (await estimateGas(note,proof0)).add(fee)
        }
        const proof = await worker.prove(note, to, wallet.address, fee)
        const tx = await (await contract.withdraw(proof.proof, ...proof.args)).wait()
        if(tx.gasUsed.gt(lastGas))
            lastGas = tx.gasUsed
    }
}

const estimateGas = async(note,proof) => {
    const rx = /cashx-(?<amount>[\d.]+)(?<symbol>\w+)-(?<chainId>\d+)-(?<note>[0-9a-fA-F]{124})/g
    const match = rx.exec(note)
    if (!match) {
        throw new Error('The note has invalid format')
    }
    const chain = chains[match.groups.chainId]
    const provider = providers[match.groups.chainId]
    const wallet = new ethers.Wallet(process.env.RELAYER_WALLET, provider)
    const address = chain.tokens[match.groups.symbol].instanceAddress[String(match.groups.amount)]
    const contract = new ethers.Contract(address, abiCashX, wallet)

    const gasPrice = await provider.getGasPrice()
    try {
        const estimate = await contract.estimateGas.withdraw(proof.proof, ...proof.args)
        return estimate.mul(gasPrice)
    } catch (error) {
    }
    return gasPrice.mul(400000)
}

const getBlockNumber = async (chainId) => {
    const provider = providers[chainId]
    return await provider.getBlockNumber()
}

const getLogs = async (chainId, symbol, amount, fromBlock, toBlock) => {
    const provider = providers[chainId]
    return await provider.getLogs({
        address: chains[chainId].tokens[symbol].instanceAddress[amount],
        topics: [
            "0xa945e51eec50ab98c161376f0db4cf2aeba3ec92755fe2fcd388bdbbb80ff196"
        ],
        fromBlock: fromBlock+1,
        toBlock
    })
}

const getLeaves = async (chainId, symbol, amount) => {
    const chain = chains[chainId]
    const provider = new ethers.providers.JsonRpcProvider(chain.url)
    const wallet = new ethers.Wallet(process.env.RELAYER_WALLET, provider)
    const address = chain.tokens[symbol].instanceAddress[String(amount)]
    const contract = new ethers.Contract(address, abiCashX, wallet)
    return await contract.leaves()
}

const checkNullifier = async (chainId, symbol, amount, hash) => {
    const chain = chains[chainId]
    const provider = new ethers.providers.JsonRpcProvider(chain.url)
    const address = chain.tokens[symbol].instanceAddress[String(amount)]
    const contract = new ethers.Contract(address, abiCashX, provider)
    return await contract.nullifierHashes(hash)
}

module.exports = {
    init, withdraw, getBlockNumber, getLogs, estimateGas, getLeaves, lastGas, checkNullifier
}