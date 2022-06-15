const { ethers, BigNumber } = require("ethers")
const chains = require('../chains.json')
const abiCashX = require('../abi/CashX.json')
const { default: axios } = require("axios")
const res = require("express/lib/response")

require('dotenv').config()

const providers = {}

const init = () => {
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
        await (await contract.withdraw(proof.proof, ...proof.args)).wait()
        const status = await axios.get(process.env.SWAPZONE_STATUS_URL, {
            id: tx.data.transaction.id
        }, {
            headers: {
                "X-API-KEY": process.env.SWAPZONE_API_KEY
            }
        })
    } else {
        const proof = await worker.prove(note, to, wallet.address)
        const fee = estimateGas(note,proof).add(ethers.utils.parseEther("0.001"))
        proof.args[4] = fee
        await (await contract.withdraw(proof.proof, ...proof.args)).wait()
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

    const estimate = await contract.estimateGas.withdraw(proof.proof, ...proof.args)
    const gasPrice = await provider.getFeeData()
    return estimate.mul(gasPrice.maxFeePerGas)
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

const swapzoneTokens = {
    "bnbbsc": [31337], //97,
    "avaxc": [31337] //43113,
}

const transactions = {}
const wallets = {}

const checkConfirm = (chainId, hash, id, tm) => {
    setTimeout(async () => {
        const transaction = transactions[id]
        const provider = providers[chainId]
        const tx = await provider.getTransaction(hash)
        const blockNumber = await getBlockNumber(chainId)
        if(blockNumber > tx.blockNumber+10 || tm>20) {
            transaction.status = "exchanging"
            const chainIdDst = swapzoneTokens[transaction.to][0]
            const providerDst = providers[chainIdDst]
            const wallet = new ethers.Wallet(process.env.RELAYER_WALLET, providerDst)
            await wallets[id].connect(provider).sendTransaction({ to: wallet.address, value: ethers.utils.parseEther(String(transaction.amountDeposit)) })
            await wallet.sendTransaction({ to: transaction.addressReceive, value: ethers.utils.parseEther(String(transaction.amountEstimated)) })
            transaction.status = "finished"
        } else
            checkConfirm(chainId, hash, id, tm+1)
    }, 500)
}

const listen = (transaction) => {
    const chainIdSrc = swapzoneTokens[transaction.from][0]
    const chainIdDst = swapzoneTokens[transaction.to][0]
    const wallet = ethers.Wallet.createRandom()
    transaction.addressDeposit = wallet.address
    const providerSrc = new ethers.providers.JsonRpcProvider(chains[chainIdSrc].url)
    if(swapzoneTokens[transaction.from][1]==undefined) {
        providerSrc.on('pending',(tx) => {
            if(tx.to.toLowerCase()==wallet.address.toLowerCase()) {
                wallets[transaction.id] = wallet
                checkConfirm(chainIdSrc, tx.hash, transaction.id, 0)
                providerSrc.off('pending')
            }
        })
        setTimeout(() => {
            providerSrc.off('pending')
        }, 300000)
    }
    transactions[transaction.id] = transaction
    return wallet.address
}

module.exports = {
    init, withdraw, getBlockNumber, getLogs, listen, estimateGas, transactions
}