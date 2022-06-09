// const { ethers } = require('ethers')
const express = require('express')
const worker = require('./worker')
const { withdraw } = require('./wallet')

const app = express()

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
            message: ex.message
        })
    }
})

app.post('/proof', async (req, res) => {
    try {
        const proof = await worker.prove(req.body.note, req.body.recipient)
        res.json({
            success: true,
            ...proof
        })
    } catch(ex) {
        res.json({
            success: false,
            message: ex.message
        })
    }
})

module.exports = app