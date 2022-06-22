// const { createClient } = require('ioredis')
const MerkleTree = require('fixed-merkle-tree')
const snarkjs = require('snarkjs')
const circomlib = require('circomlib')
const websnarkUtils = require('websnark/src/utils')
const buildGroth16 = require('websnark/src/groth16')
const fs = require('fs')
const { getBlockNumber, getLogs, getLeaves, checkNullifier } = require('./wallet')
const pedersenHash = data => circomlib.babyJub.unpackPoint(circomlib.pedersenHash.hash(data))[0]
let groth16
const circuit = require('../key/withdraw.json')
const key = fs.readFileSync(__dirname + '/../key/key.bin').buffer

// const redis = createClient(process.env.REDIS_URL)

const trees = {}
// const redisSubscribe = createClient(process.env.REDIS_URL)

const start = async () => {
    console.log("Worker is started!")
    groth16 = await buildGroth16()
    // for(let chainId in chains) {
    //     for(let symbol in chains[chainId].tokens) {
    //         for(let amount in chains[chainId].tokens[symbol].instanceAddress) {
    //             await redis.set(`cashx:${chainId}:${amount}${symbol}:block`, 0)
    //             if(await redis.get(`cashx:${chainId}:${amount}${symbol}:block`) > 0)
    //                 trees[`tree:${chainId}:${amount}${symbol}`] = MerkleTree.deserialize(JSON.parse(await redis.get(`cashx:${chainId}:${amount}${symbol}:tree`)))
    //             else
    //                 trees[`tree:${chainId}:${amount}${symbol}`] = new MerkleTree(20)
    //             setTimeout(()=>fetchEvents(chainId, symbol, amount), 200)
    //         }
    //     }
    // }
    // await redis.set("cashx:avax:block",0)
    // if(await redis.get("cashx:avax:block")) {
    //     // const convert = (_, val) => (typeof val === 'string' && !val.startsWith('0x') ? snarkjs.bigInt(val) : val)
    //     tree = MerkleTree.deserialize(JSON.parse(await redis.get("cashx:avax:tree")))
    // }
    // fetchEvents()
}

// const fetchEvents = async (chainId, symbol, amount) => {
//     // console.log(`tree:${chainId}:${amount}${symbol} working`)
//     // const chain = chains[chainId]
//     const lastBlock = await getBlockNumber(chainId)
//     const fromBlock = Number(await redis.get(`cashx:${chainId}:${amount}${symbol}:block`))
//     if(lastBlock > fromBlock) {
//         const toBlock = Math.min(lastBlock, fromBlock + 2000)
//         const logs = await getLogs(chainId, symbol, amount, fromBlock, toBlock)
//         if(logs.length) {
//             const tree = trees[`tree:${chainId}:${amount}${symbol}`]
//             // console.log("root", tree.root())
//             for(const log of logs) {
//                 tree.insert(log.topics[1])
//                 // console.log("added", tree.root(), log.topics[1])
//             }
//             redis.set(`cashx:${chainId}:${amount}${symbol}:tree`, JSON.stringify(tree.serialize()))
//         }
//         // const cashX = new ethers.Contract("0x330bdFADE01eE9bF63C209Ee33102DD334618e0a", abiCashX, provider)
//         // const logs = await cashX.queryFilter({
//         //     topics: [
//         //         "0xa945e51eec50ab98c161376f0db4cf2aeba3ec92755fe2fcd388bdbbb80ff196"
//         //     ]        
//         // }, fromBlock, toBlock)
//         // console.log(logs)
//         await redis.set(`cashx:${chainId}:${amount}${symbol}:block`, toBlock)
//     }
//     setTimeout(() => fetchEvents(chainId, symbol, amount), 10000)
// }

function createDeposit(nullifier, secret) {
    const deposit = { nullifier, secret }
    const preimage = Buffer.concat([deposit.nullifier.leInt2Buff(31), deposit.secret.leInt2Buff(31)])
    deposit.commitment = pedersenHash(preimage)
    deposit.commitmentHex = toHex(deposit.commitment, 32)
    deposit.nullifierHash = pedersenHash(deposit.nullifier.leInt2Buff(31))
    deposit.nullifierHex = toHex(deposit.nullifierHash, 32)
    deposit.note = `cashx-0.1eth-${toHex(preimage,62).slice(2)}`
    return deposit
}

function getNullifierHash(note) {
    const buf = Buffer.from(note, 'hex')
    const nullifier = snarkjs.bigInt.leBuff2int(buf.slice(0, 31))
    const hash = pedersenHash(nullifier.leInt2Buff(31))
    return toHex(hash, 32)
}

function toHex(number, length = 32) {
    const str = number instanceof Buffer ? number.toString('hex') : snarkjs.bigInt(number).toString(16)
    return '0x' + str.padStart(length * 2, '0')
}

const prove = async (note, recipient, relayer = 0, fee = 0, refund = 0) => {
    const rx = /cashx-(?<amount>[\d.]+)(?<symbol>\w+)-(?<chainId>\d+)-(?<note>[0-9a-fA-F]{124})/g
    const match = rx.exec(note)
    if (!match) {
        throw new Error('The note has invalid format')
    }
    const { chainId, symbol, amount } = match.groups
    const buf = Buffer.from(match.groups.note, 'hex')
    const nullifier = snarkjs.bigInt.leBuff2int(buf.slice(0, 31))
    const secret = snarkjs.bigInt.leBuff2int(buf.slice(31, 62))
    const deposit = createDeposit(nullifier, secret)
    
    if(await checkNullifier(chainId, symbol, amount, deposit.nullifierHex)){
        throw new Error("The note has been already spent")
    }
    console.time("leaves")
    const tree = trees[`tree:${chainId}:${amount}${symbol}`] || new MerkleTree(20)
    const leaves = await getLeaves(chainId, symbol, amount )
    const len = tree.elements().length
    tree.bulkInsert(leaves.slice(len))
    console.timeEnd("leaves")
    const index = tree.indexOf(deposit.commitmentHex, (el1, el2) => {
        return snarkjs.bigInt(el1)==snarkjs.bigInt(el2)
    })
    if(index<0) throw new Error('The note has not deposited')
    const { pathElements, pathIndices } = tree.path(index)
    const input = {
        root: tree.root(),
        nullifierHash: deposit.nullifierHash,
        recipient: snarkjs.bigInt(recipient),
        relayer: snarkjs.bigInt(relayer),
        fee: snarkjs.bigInt(fee),
        refund: snarkjs.bigInt(refund),

        nullifier: deposit.nullifier,
        secret: deposit.secret,
        pathElements,
        pathIndices
    }
    const proofData = await websnarkUtils.genWitnessAndProve(groth16, input, circuit, key)
    const { proof } = websnarkUtils.toSolidityInput(proofData)

    return {
        proof,
        args: [
            toHex(input.root, 32),
            toHex(input.nullifierHash, 32),
            toHex(input.recipient, 20),
            toHex(input.relayer, 20),
            toHex(input.fee, 32),
            toHex(input.refund, 32),
        ]
    }
}

module.exports = { start, prove, getNullifierHash }