const welcomeContainer = document.querySelector('.container-welcome')
const gameboardContainer = document.querySelector('.container-gameboard')
const nameInput = document.querySelector('.join-name > input')
const joinButton = document.querySelector('.join')
const playersInLobbyInfo = document.querySelector('.players-in-lobby > b')
const welcomePopup = document.querySelector('.welcome-popups')
const welcomePopupButton = welcomePopup.querySelector('.button')

// player game info components
const playerNameSpans = document.querySelectorAll('.player-name > span')
let myNameSpan
let myFistHand
const playerCoinsDivs = Array.from(document.querySelectorAll('.coins'))
const playerfistHandDivs = Array.from(document.querySelectorAll('.fist-hand'))
let playerGuessDivs = Array.from(document.querySelectorAll('.guess-div'))
const leaderboard = document.querySelector('.leaderboard')

// game-info-display templates
const gameInfoDisplay = document.querySelector('.game-info-display')
let readyButton

const socket = io();
let playersInLobby = 0;
let gameStarted = false;
let myPlayer
let allrGuessed;

socket.emit('check-players-connected')

socket.on('someone-connected', msg => {
    console.log(msg)
})

socket.on('check-players-connected', (num, players, gameStart) => {
    playersInLobby = num
    gameStarted = gameStart
    playersInLobbyInfo.innerHTML = num

    if (num > 0) {
        players.filter(p => p !== null).forEach(player => {
            playerSpan = document.querySelector(`.player-name > .p${player.id}`)
            playerSpan.innerHTML = player.name
            if (player.ready && !gameStarted) playerSpan.classList.add('highlight-green')
        })
    }
})

socket.on('player-disconnects', num => {
    console.log('player ' + num + ' disconnected')

    const playerNameSpan = document.querySelector(`.player-name > .p${num}`)
    playerNameSpan.innerHTML = '<div></div>';
    playerNameSpan.classList.remove('highlight-green')
})


joinButton.addEventListener('click', () => {
    let playerName = nameInput.value

    if (playerCanEnter(playerName)) {
        enterLobby(playerName);
        gameboardContainer.classList.remove('hide');
        welcomeContainer.classList.add('hide');
    }
})

function playerCanEnter(name) {
    if (name === '') {
        popup('You must input a name')
        return false
    } else if (name.length > 14) {
        popup('Chose a shorter name, no longer than 14 characters')
        return false
    } else if ([...playerNameSpans].some(span => span.innerHTML === name)) {
        popup('Sorry, another player has already that name')
        return false
    } else if (playersInLobby === 4) {
        popup('Sorry, the lobby is full')
        return false
    } else if (gameStarted) {
        popup('Sorry, a game has already started')
        return false
    }
    return true
}

function popup(msg) {
    welcomePopup.querySelector('.popup-info > p').innerHTML = msg
    welcomePopup.classList.remove('hide')
    welcomePopupButton.addEventListener('click', () => {
        welcomePopup.classList.add('hide')
    })
}


// Players enter to the lobby, all see who are in the lobby
function enterLobby(playerName) {
    socket.emit('player-enter-lobby', playerName)
    socket.on('pass-player-obj', player => {
        myPlayer = player
        fistHandDiv = document.querySelector(`.p${myPlayer.id}.fist-hand`)
        myNameSpan = document.querySelector(`.player-name > .p${myPlayer.id}`)
        myNameSpan.innerHTML = myPlayer.name
        socket.emit('update-name-span', `p${myPlayer.id}`, myPlayer.name)

        // put the ready button
        displayReadyButtonOrRestart(player)
    })
}

function displayReadyButtonOrRestart(myPlayer) {
    const readyButtonDisplay = `
            <div class="ready-button-display p${myPlayer.id}">
                <span>When all players are ready the game will start<br></span>
                <div class="button ready-button" onclick="playerIsReady(${myPlayer.id})">I'm ready!</div>
            </div>
        `
    gameInfoDisplay.innerHTML = readyButtonDisplay
}

socket.on('update-name-spans', (spanClass, playerName) => {
    playerSpan = Array.from(playerNameSpans).filter(span => span.classList.contains(spanClass))[0]
    playerSpan.innerHTML = playerName
})


// onclick event on the --ready button--
function playerIsReady(id) {
    myNameSpan.classList.add('highlight-green')
    myPlayer.ready = true
    gameInfoDisplay.innerHTML = `
        <div class="basic-info">
            <span>Waiting for the other players to be ready</span>
        </div>
    `
    socket.emit('player-is-ready', id)
}

socket.on('only-one-player', () => {
    gameInfoDisplay.innerHTML = `
        <div>You can't play alone!<br>Wait for other players to join</div>
    `
    setTimeout(() => {
        gameInfoDisplay.innerHTML = `
        <div class="basic-info">
            <span>Waiting for the other players to be ready</span>
        </div>
    `
    }, 3000)
})

socket.on('player-is-ready', (id, allReady) => {
    if (allReady) {
        playerNameSpans.forEach(span => span.classList.remove('highlight-green'))
        socket.emit('display-players-points')
        socket.emit('game-started')
    } else {
        playerSpan = document.querySelector(`.player-name > .p${id}`)
        playerSpan.classList.add('highlight-green')
    }
})

socket.on('display-players-points', players => {
    players = players.sort((a, b) => b.points - a.points)
    leaderboard.innerHTML = ''
    playersPointsHtml = ''
    players.forEach(player => {
        playersPointsHtml += `
            <div class="p${player.id}">
                <div><b>${player.name}</b></div>
                <div><b>${player.points}</b>&nbsp; pts.</div>
            </div>
        `
    })
    leaderboard.innerHTML = playersPointsHtml;
})

socket.on('captain-choose-rounds', (id, max) => {
    if (myPlayer.id === id) {
        // display rounds form
        gameInfoDisplay.innerHTML = `
            <div class="input-rounds">
                <div><b>Rounds:</b></div>
                <input autocomplete="off" class="input-int" min="1" name="rounds" placeholder="" type="number">
                <div class="button rounds-button" onclick="giveRoundsInfo(${max})">OK</div>
            </div>
        `
    } else {
        // inform captain is choosing rounds
        gameInfoDisplay.innerHTML = `
            <div class="basic-info">
                <span>The captain is choosing the number of rounds</span>
            </div>
        `
    }
})

// Pass to the server the rounds when captain clicks the rounds-button
function giveRoundsInfo(max) {
    const roundsInput = document.querySelector('.input-rounds > input')
    let rounds = roundsInput.value

    if (rounds < 0 || rounds > max || [...rounds].includes('.')) {
        roundsInput.classList.add('highlight-red')
    } else {
        socket.emit('rounds', parseInt(rounds))
    }
}


// Choosing coins phase starts
socket.on('choose-coins', (correctPlayerId, players) => {

    clearHandsCoins()
    clearPlayerGuesses()
    if (typeof correctPlayerId === 'number') playerOutGreyName(correctPlayerId)

    if (!players[myPlayer.id].out) {
        gameInfoDisplay.innerHTML = `
            <div class="choose-coins">
                <div class="coins-div" onclick="playerCoins(0)"></div>
                <div class="coins-div" onclick="playerCoins(1)">
                    <img class="coin-svg" src="svg/coin.svg">
                </div>
                <div class="coins-div" onclick="playerCoins(2)">
                    <img class="coin-svg" src="svg/coin.svg">    
                    <img class="coin-svg" src="svg/coin.svg">    
                </div>
                <div class="coins-div" onclick="playerCoins(3)">
                    <img class="coin-svg" src="svg/coin.svg">    
                    <img class="coin-svg" src="svg/coin.svg">   
                    <img class="coin-svg" src="svg/coin.svg">   
                </div>
            </div>
        `
    } else {
        gameInfoDisplay.innerHTML = `
            <div class="basic-info">
                <span>Waiting for next round</span>
            </div>
        `
    }

    function playerOutGreyName(id) {
        const playerNameSpan = document.querySelector(`.player-name > .p${id}`)
        playerNameSpan.classList.add('grey-name')
    }

    function clearHandsCoins() {
        playerCoinsDivs.forEach(div => div.innerHTML = '')
        playerfistHandDivs.forEach(div => div.innerHTML = '')
    }

    function clearPlayerGuesses() {
        playerGuessDivs.forEach(div => {
            if (div.firstElementChild) div.removeChild(div.firstElementChild)
        })
    }
})


function playerCoins(num) {
    myPlayer.coins = num;
    gameInfoDisplay.innerHTML = `
        <div class="basic-info">
            <span>Waiting for the rest of the players...</span>
        </div>
    `
    fistHandDiv.innerHTML = `
        <img class="hand-svg" src="svg/fist.svg">
    `
    socket.emit('player-coins', num, myPlayer.id)
}

socket.on('display-player-fist', id => {
    const playerFistHandDiv = document.querySelector(`.p${id}.fist-hand`)
    playerFistHandDiv.innerHTML = `
        <img class="hand-svg" src="svg/fist.svg">
    `
})

socket.on('guessing-phase', (turn, players, turnOrder, allreadyGuessed) => {
    allrGuessed = allreadyGuessed

    if (myPlayer.id === turn) {
        gameInfoDisplay.innerHTML = `
            <div class="input-guess">
                <div><b>Guess:</b></div>
                <input autocomplete="off" class="input-int" min="0" name="guess" placeholder="" type="number">
                <div class="button guess-button" onclick="playerGuess()">OK</div>
            </div>
        `
    } else {
        gameInfoDisplay.innerHTML = `
            <div class="basic-info">
                <span>${players[turn].name} is guessing...</span>
            </div>
        `
    }
})
function playerGuess() {
    const guessInput = document.querySelector('.input-guess > input')
    let guess = guessInput.value

    if (parseInt(guess) < 0 || [...guess].includes('.') || allrGuessed.includes(parseInt(guess))) {
        guessInput.classList.add('highlight-red')
    } else {
        myNameSpan.classList.remove('outline-name-black')
        socket.emit('display-player-guess', myPlayer.id, guess)
        socket.emit('a-player-guessed', myPlayer.id, parseInt(guess))
    }
}

socket.on('display-player-guess', (id, guess) => {
    const playerGuessDiv = document.querySelector(`.p${id}.guess-div`)
    playerGuessDiv.innerHTML = `
        <div class="guess p${id}">Guess: <b>${guess}</b></div>
    `
})

socket.on('show-results', players => {
    let result = players.reduce((acc, player) => acc + player.coins, 0)
    let correctPlayer

    gameInfoDisplay.innerHTML = ''

    players.forEach(player => {
        let playerFistHandDiv = document.querySelector(`.p${player.id}.fist-hand`)
        playerFistHandDiv.innerHTML = '<img class="hand-svg" src="svg/open-hand.svg"></img>'

        let insertCoinsHTML = ''
        for (let i = 0; i < player.coins; i++) insertCoinsHTML += '<img class="coin-svg" src="svg/coin.svg">'
        let playerCoinDiv = document.querySelector(`.p${player.id}.coins`)
        playerCoinDiv.innerHTML = insertCoinsHTML;
    })

    setTimeout(displayResult, 1500)
    setTimeout(displayWhoCorrect, 1500 + 700)
    setTimeout(emitPhaseDoneToServer, 1500 + 700 + 2000)

    function displayResult() {
        gameInfoDisplay.innerHTML = `<span class="result">${result}</span>`
        correctPlayer = players.find(player => player.guess === result)
    }

    function displayWhoCorrect() {
        if (correctPlayer) {
            playerGuessDivs.forEach(div => {
                const span = div.firstElementChild
                if (span) {
                    if (span.classList.contains(`p${correctPlayer.id}`)) span.classList.add('highlight-green')
                    else span.classList.add('highlight-red')
                }
            })
        } else {
            playerGuessDivs.forEach(div => {
                if (div.firstElementChild) div.firstElementChild.classList.add('highlight-red')
            })
        }
    }

    function emitPhaseDoneToServer() {
        if (myPlayer.id === players[0].id) {
            socket.emit('result-phase-done', correctPlayer)
        }
    }
})

socket.on('remove-grey-names', () => {
    playerNameSpans.forEach(span => span.classList.remove('grey-name'))
})


socket.on('loser-choose-id', (id, players) => {
    if (myPlayer.id === id) {
        gameInfoDisplay.innerHTML = `
                <div class="arrows-container">
                    <div></div> 
                    ${players[0] !== null ? '<div class="arrow" onclick="loserInputNewFirst(0)"><img src="svg/arrow-up.svg"></div>' : '<div></div>'}
                    <div></div> 
                    ${players[2] !== null ? '<div class="arrow" onclick="loserInputNewFirst(2)"><img src="svg/arrow-left.svg"></div>' : '<div></div>'}
                    <div>Choose who starts next round</div>
                    ${players[3] !== null ? '<div class="arrow" onclick="loserInputNewFirst(3)"><img src="svg/arrow-right.svg"></div>' : '<div></div>'}
                    <div></div> 
                    ${players[1] !== null ? '<div class="arrow" onclick="loserInputNewFirst(1)"><img src="svg/arrow-down.svg"></div>' : '<div></div>'}
                    <div></div> 
                </div>
        `
    } else {
        const loserName = document.querySelector(`.player-name > .p${id}`).innerHTML
        gameInfoDisplay.innerHTML = `
            <div class="basic-info">
                <span>${loserName} is choosing who goes first this round...</span>
            </div>
        `
    }
})

function loserInputNewFirst(id) {
    socket.emit('loser-chose-first', parseInt(id))
}

socket.on('game-ends', () => {
    gameInfoDisplay.innerHTML = `
        <div class="basic-info">
            <span>GAME ENDED, all players should refresh the page</span>
        </div>
    `
})


// function originalHtmlBody() {
//     return `
//         <header>
//             <div class="header">
//                 <span class="game-title">Coin Guess</span>
//             </div>
//         </header>


//         <div class="container-welcome">

//             <div class="container-welcome--info">
//                 <div class="info-title">
//                     <span>How to play</span>
//                 </div>
//                 <div class="info-text">
//                     <p>Lorem, ipsum dolor sit amet consectetur adipisicing elit. Molestias quae in dolorem atque cumque cum
//                         nihil, id laborum rem corporis sunt dolore tenetur consequuntur vitae facere laboriosam inventore
//                         ducimus voluptas laudantium eum placeat? Ipsa quis neque delectus ullam ipsam. Error dicta, qui
//                         expedita inventore necessitatibus eius quidem voluptates rerum laboriosam, non sed nesciunt
//                         consequuntur, sint earum! Unde praesentium quis ratione, consectetur voluptates quibusdam alias amet
//                         vel in. Dolorum, animi impedit. Quidem ducimus deserunt maiores id eligendi nam repellendus earum
//                         perspiciatis?</p>
//                 </div>
//             </div>

//             <div class="container-welcome--join">
//                 <div class="join-title">Join the lobby!</div>
//                 <div class="join-info">
//                     <span class='players-in-lobby'><b>0</b> players connected (MAX: 4)</span>
//                 </div>
//                 <div class="join-name">
//                     <span>Name: </span>
//                     <input type="text" value="">
//                 </div>

//                 <div class="button join">JOIN</div>

//             </div>



//         </div>

//         <div class="welcome-popups hide">
//             <div class="popup-info">
//                 <p>Lorem ipsum dolor, sit amet consectetur adipisicing elit. Id ratione iure voluptatem repellendus
//                     provident repudiandae, dolorum repellat aut. Minima eos temporibus rerum. In tenetur delectus saepe
//                     quam sequi quo et.</p>
//                 <div class="button">
//                     OK
//                 </div>
//             </div>
//         </div>

//         <div class="container-gameboard hide">

//             <div class="gameboard">


//                 <div class="player-name p0">
//                     <span class="p0">
//                         <div></div>
//                     </span>
//                 </div>


//                 <div class="container-middle">

//                     <div class="player-name p2">
//                         <span class="p2">
//                             <div></div>
//                         </span>
//                     </div>


//                     <div class="table">
//                         <div class="blank"></div>
//                         <div class="p0 player-info pad-rl-25">
//                             <div class="p0 guess-div">

//                             </div>
//                             <div class="p0 fist-hand">

//                             </div>
//                             <div class="p0 coins">

//                             </div>
//                         </div>
//                         <div class="blank"></div>
//                         <div class="p2 player-info">
//                             <div class="p2 guess-div">

//                             </div>
//                             <div class="side">
//                                 <div class="p2 fist-hand">

//                                 </div>
//                                 <div class="p2 coins">

//                                 </div>
//                             </div>
//                             <div class="blank"></div>

//                         </div>
//                         <div class="game-info-display"></div>
//                         <div class="p3 player-info">
//                             <div class="p3 guess-div">

//                             </div>
//                             <div class="side">
//                                 <div class="p3 coins">

//                                 </div>
//                                 <div class="p3 fist-hand">

//                                 </div>
//                             </div>
//                             <div class="blank"></div>
//                         </div>
//                         <div class="test"></div>
//                         <div class="p1 player-info pad-rl-25">
//                             <div class="p1 coins">

//                             </div>
//                             <div class="p1 fist-hand">
//                             </div>
//                             <div class="p1 guess-div">

//                             </div>
//                         </div>
//                         <div class="test"></div>
//                     </div>

//                     <div class="player-name p3">
//                         <span class="p3">
//                             <div></div>
//                         </span>
//                     </div>

//                 </div>
//                 <div class="name-container">
//                     <div class="player-name p1">
//                         <span class="p1">
//                             <div></div>
//                         </span>
//                     </div>
//                 </div>
//             </div>

//             <!-- TODO /****** TEMPLATES VSGS AND GUESS *******/ -->
//             <!-- <div class="guess"><b>Guess: 10</b></div> -->

//             <!-- <img class="hand-svg" src="svg/fist.svg"> -->

//             <!-- <img class="hand-svg" src="svg/open-hand.svg"> -->

//             <!-- <img class="coin-svg" src="svg/coin.svg"> -->

//             <div class="leaderboard">
//                 <!-- <div class="p0"></div>
//                 <div class="p1"></div>
//                 <div class="p2"></div>
//                 <div class="p3"></div> -->
//             </div>
//         </div>


//         <!-- <div>Icons made by <a href="https://www.flaticon.com/authors/pixel-perfect" title="Pixel perfect">Pixel perfect</a>
//             from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a></div>
//         <div>Icons made by <a href="" title="turkkub">turkkub</a> from <a href="https://www.flaticon.com/"
//                 title="Flaticon">www.flaticon.com</a></div> -->
//         <script src="/socket.io/socket.io.js"></script>
//         <script src="app.js"></script>
//     `
// }













