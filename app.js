const welcomeContainer = document.querySelector('.container-welcome')
const gameboardContainer = document.querySelector('.container-gameboard')
const joinButton = document.querySelector('.join')

joinButton.addEventListener('click', () => {
    console.log('working')
    gameboardContainer.classList.remove('hide');
    welcomeContainer.classList.add('hide');
})  