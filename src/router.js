// const { ethers } = require('ethers')
const express = require('express')
const worker = require('./worker')
const { transactions, withdraw, listen, estimateGas } = require('./wallet')
const { default: axios } = require('axios')

const app = express()

const parseError = (ex) => {
    if (typeof ex == 'object')
      return (ex.error?.reason ?? null) ? ex.error.reason.replace('execution reverted: ', '') : ex.message
    return ex
}

app.post('/withdraw', async (req, res) => {
    try {
        await withdraw(worker, req.body.note, req.body.recipient, req.body.coin)
        res.json({
            success: true,
        })
    } catch(ex) {
        // throw ex
        res.json({
            success: false,
            message: parseError(ex)
        })
    }
})

app.post('/proof', async (req, res) => {
    try {
        const proof = await worker.prove(req.body.note, req.body.recipient)
        const gas = await estimateGas(req.body.note, proof)
        res.json({
            success: true,
            ...proof,
            gas
        })
    } catch(ex) {
        res.json({
            success: false,
            message: parseError(ex)
        })
    }
})

app.get('/v1/exchange/get-rate', async (req, res) => {
    const result = await axios.get("https://api.swapzone.io/v1/exchange/get-rate", {
        params: req.query,
        headers: {
            "X-API-KEY": process.env.SWAPZONE_API_KEY
        }
    })
    res.json(result.data)
})

app.post('/v1/exchange/create', async (req, res) => {
    const result = await axios.post("https://api.swapzone.io/v1/exchange/create", req.body, {
        headers: {
            "X-API-KEY": process.env.SWAPZONE_API_KEY
        }
    })
    const transaction = result.data.transaction
    // const transaction = { id: 1, from: 'bnbbsc', to: 'avaxc', amount: 10, status: "waiting" }
    listen(transaction)
    // transactions[transaction.id] = transaction
    res.json({ transaction })
})

app.get('/v1/exchange/tx', async (req, res) => {
    const transaction = transactions[req.query.id]
    res.json({ transaction })
})

module.exports = app