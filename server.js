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

const normalTurnOrder = [0, 3, 1, 2] // clock-wise
let turnOrder = []
let pointsDistribution = []
let firstId = 0
let gameRounds = 0

io.on('connection', socket => {
    console.log('New WS Connection')
    let playerNumber = -1

    // outside lobby
    socket.on('check-players-connected', () => {
        io.emit('check-players-connected', players.filter(p => p !== null).length, players, gameStarted)
    })

    socket.on('disconnect', () => {
        console.log(`Player ${playerNumber} disconnected`)

        if (playerNumber !== -1 && gameStarted) {
            gameStarted = false
            turnOrder = []
            pointsDistribution = []
            firstId = 0
            gameRounds = 0
            for (let i = 0; i < 4; i++) {
                players[i] = null;
            }
            console.log(players)
            io.emit('game-ends')
        }

        if (playerNumber !== -1) {
            players[playerNumber] = null

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

        if (players.filter(p => p !== null).length === 1) {
            socket.emit('only-one-player')
        } else {
            players[id].ready = true;
            allReady = players.filter(p => p !== null).every(player => player.ready === true)

            io.emit('player-is-ready', id, allReady)
        }
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
        gameRounds = rounds
        const playersNum = players.filter(p => p !== null).length
        pointsDistribution = assignPointsDistribution(playersNum)
        turnOrder = assignTurnOrder(firstId)

        console.log(pointsDistribution)
        console.log(turnOrder)

        io.emit('choose-coins', undefined, players)
    })
    function assignPointsDistribution(num) {
        if (num === 2) return [10, -5]
        else if (num === 3) return [15, 10, -5]
        else if (num === 4) return [20, 15, 10, -10]
    }
    function assignTurnOrder(firstId) {
        let arr = normalTurnOrder.filter(turn => players[turn] !== null).filter(turn => !players[turn].out)
        let chunk = arr.splice(0, arr.indexOf(firstId))
        return arr.concat(chunk)
    }


    socket.on('player-coins', (num, id) => {
        players[id].coins = num

        socket.broadcast.emit('display-player-fist', id)

        if (players.filter(player => player !== null).filter(player => !player.out).every(player => player.coins !== null)) {
            let allreadyGuessed = players.filter(player => player !== null).map(player => player.guess)
            io.emit('guessing-phase', firstId, players, turnOrder, allreadyGuessed)
        }
    })

    socket.on('display-player-guess', (id, guess) => {
        io.emit('display-player-guess', id, guess)
    })

    socket.on('a-player-guessed', (playerId, guess) => {
        players[playerId].guess = guess
        let allreadyGuessed = players.filter(player => player !== null).map(player => player.guess)

        // if (players.every(player => player.guess !== null)) {
        if (playerId === turnOrder[turnOrder.length - 1]) {
            io.emit('show-results', players.filter(player => player !== null).filter(player => !player.out))
        } else {
            let currentTurn = turnOrder[turnOrder.indexOf(playerId) + 1]
            io.emit('guessing-phase', currentTurn, players, turnOrder, allreadyGuessed)
        }
    })

    socket.on('result-phase-done', correctPlayer => {
        console.log(correctPlayer)

        playersIn = players.filter(player => player !== null)
        playersIn.forEach(player => {
            player.coins = null;
            player.guess = null;
        })

        if (correctPlayer) {
            correctPlayer = players[correctPlayer.id]

            let numPlayersOut = playersIn.filter(player => player.out).length
            correctPlayer.points += pointsDistribution[numPlayersOut]
            correctPlayer.out = true

            if (correctPlayer.id === turnOrder[1]) {
                firstId = turnOrder[2]
                turnOrder = assignTurnOrder(firstId)
            } else {
                firstId = turnOrder[1]
                turnOrder = assignTurnOrder(firstId)
            }

            console.log('correctPlayer Points: ' + correctPlayer.points)

            if (playersIn.length - numPlayersOut === 2) {
                gameRounds--;
                loserPlayer = playersIn.find(player => !player.out)
                loserPlayer.points = pointsDistribution[pointsDistribution.length - 1]
                playersIn.forEach(player => player.out = false)

                io.emit('display-players-points', players.filter(player => player !== null))

                if (gameRounds === 0) {
                    io.emit('display-players-points', players.filter(player => player !== null))
                    gameStarted = false
                    turnOrder = []
                    pointsDistribution = []
                    firstId = 0
                    gameRounds = 0
                    for (let i = 0; i < 4; i++) {
                        players[i] = null;
                    }
                    console.log(players)

                    io.emit('game-ends')
                } else {
                    io.emit('loser-choose-id', loserPlayer.id, players)
                }

            } else {
                io.emit('display-players-points', players.filter(player => player !== null))
                io.emit('choose-coins', correctPlayer.id, players)
            }
        } else {
            firstId = turnOrder[1]
            turnOrder = assignTurnOrder(firstId)
            io.emit('choose-coins', undefined, players)
        }
    })

    socket.on('loser-chose-first', id => {
        firstId = id;
        turnOrder = assignTurnOrder(firstId)
        io.emit('remove-grey-names')
        io.emit('choose-coins', undefined, players)
    })
})
