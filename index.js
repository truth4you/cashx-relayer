const express = require('express')
const app = express()
// const http = require('http').createServer(app)
// const io = require('socket.io')(http)
const cors = require('cors')
const bodyParser = require('body-parser')
const router = require('./src/router')
const worker = require('./src/worker')
const wallet = require('./src/wallet')
require('dotenv').config()

app.use(cors({
    origin: '*'
}))
app.use(bodyParser.json())
app.use(router)

// io.on('connection', (socket) => {
//     console.log(socket)
// })

// router.setSocketIO(io)

const port = process.argv[2] ?? 8000
const server = app.listen(port, () => {
    console.log(`Relayer is started thru ${port}!`)
})
server.timeout = 600000
wallet.init()
worker.start()