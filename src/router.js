// const { ethers } = require('ethers')
const express = require('express')
const worker = require('./worker')
const { withdraw, estimateGas } = require('./wallet')

const app = express()

let io = null

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

app.get('/broadcast', (req, res) => {
    io?.sockets.emit('broadcast', {
        description: 'hello'
    })
    res.end()
})

app.setSocketIO = (_io) => {
    io = _io
}

module.exports = app