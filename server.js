const express = require('express')
const path = require('path')
const http = require('http')
const PORT = process.env.PORT || 3000
const socketio = require('socket.io')
const { Console } = require('console')
const app = express()
const server = http.createServer(app)
const io = socketio(server)

// Set static folder
app.use(express.static(path.join(__dirname, "public")))

// Start server
server.listen(PORT, () => console.log(`Server running on port ${PORT}`))

const players = [null, null, null, null] // Set for 4 players
let gameStarted = false
const MAX_ROUNDS = 12

let pointsDistribution = []
const normalTurnOrder = [0, 3, 1, 2] // clock-wise
let turnOrder = []
let firstId = 0
let rounds = 0



io.on('connection', socket => {
    console.log('New WS Connection')

    let playerNumber = -1

    // outside lobby
    socket.on('check-players-connected', () => {
        io.emit('check-players-connected', players.filter(p => p !== null).length, players, gameStarted)
    })

    socket.on('disconnect', () => {
        console.log(`Player ${playerNumber} disconnected`)

        if (playerNumber !== -1) {
            players[playerNumber] = null

            console.log(players)

            // Tell everyone what player number just disconnected
            socket.broadcast.emit('player-disconnects', playerNumber);
            io.emit('check-players-connected', players.filter(p => p !== null).length, players, gameStarted)
        }
    })

    // inside lobby

    socket.on('player-enter-lobby', playerName => {

        for (const i in players) {
            if (players[i] === null) {

                // create player object
                player = {}
                player.id = parseInt(i)
                player.name = playerName
                player.points = 0
                player.coins = null
                player.guess = null
                player.ready = false
                player.out = false

                playerNumber = i
                players[i] = player
                socket.emit('pass-player-obj', player)
                break
            }
        }

        io.emit('check-players-connected', players.filter(p => p !== null).length, players, gameStarted)

        console.log(players)
    })

    socket.on('update-name-span', (spanClass, playerName) => {
        console.log(spanClass, playerName)
        socket.broadcast.emit('update-name-spans', spanClass, playerName)
    })

    // A player is ready to start, highlight to the rest of the players
    socket.on('player-is-ready', id => {
        console.log('player id: ' + id)
        players[id].ready = true;
        allReady = players.filter(p => p !== null).every(player => player.ready === true)
        // if (allReady) gameStarted = true
        io.emit('player-is-ready', id, allReady)
    })

    socket.on('display-players-points', () => {
        socket.emit('display-players-points', players.filter(player => player !== null))
    })

    // All players are ready, captain choose how many rounds
    socket.on('game-started', () => {
        gameStarted = true
        firstId = normalTurnOrder.find(id => players[id] !== null)
        console.log(firstId)
        io.emit('captain-choose-rounds', firstId, MAX_ROUNDS)
    })


    // captain chose rounds, "make game state" and start first part of the round: choosing coins
    socket.on('rounds', rounds => {
        rounds = rounds
        const playersNum = players.filter(p => p !== null).length
        pointsDistribution = assignPointsDistribution(playersNum)
        turnOrder = assignTurnOrder(firstId)

        console.log(pointsDistribution)
        console.log(turnOrder)

        io.emit('choose-coins')
    })
    function assignPointsDistribution(num) {
        if (num === 2) return [10, -5]
        else if (num === 3) return [15, 10, -5]
        else if (num === 4) return [20, 15, 10, -10]
    }
    function assignTurnOrder(firstId) {
        arr = normalTurnOrder.filter(turn => players[turn] !== null).filter(turn => !players[turn].out)
        let chunk = arr.splice(0, arr.indexOf(firstId))
        return arr.concat(chunk)
    }


    socket.on('player-coins', (num, id) => {
        players[id].coins = num

        socket.broadcast.emit('display-player-fist', id)

        if (players.filter(player => player !== null).every(player => player.coins !== null)) {
            let currentTurn = firstId
            let allreadyGuessed = players.filter(player => player !== null).map(player => player.guess)
            io.emit('guessing-phase', currentTurn, players, turnOrder, allreadyGuessed)
        }
    })

    socket.on('display-player-guess', (id, guess) => {
        console.log('working')
        io.emit('display-player-guess', id, guess)
    })

    socket.on('a-player-guessed', (playerId, guess) => {
        players[playerId].guess = guess
        let allreadyGuessed = players.filter(player => player !== null).map(player => player.guess)

        // if (players.every(player => player.guess !== null)) {
        if (playerId === turnOrder[turnOrder.length - 1]) {
            io.emit('show-results', players.filter(player => player !== null).sort((a, b) => b.coins - a.coins))
        } else {
            let currentTurn = turnOrder[turnOrder.indexOf(playerId) + 1]
            io.emit('guessing-phase', currentTurn, players, turnOrder, allreadyGuessed)
        }
    })
})
