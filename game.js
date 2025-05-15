const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const snakeScoreElement = document.getElementById('snakeScore');
const rabbitScoreElement = document.getElementById('rabbitScore');
const gameTimerElement = document.getElementById('gameTimer');
const waitingMessageElement = document.getElementById('waitingMessage');
const menuElement = document.getElementById('menu');
const gameContainerElement = document.getElementById('gameContainer');
const gameCodeElement = document.getElementById('gameCode');

let gameCode = null;
let gameState = {
    snake: [],
    rabbit: { x: 0, y: 0 },
    food: { x: 0, y: 0 },
    snakeScore: 0,
    rabbitScore: 0,
    gameTime: 0,
    isGameOver: false,
    isGameStarted: false
};
let myRole = null;

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function updateScores() {
    snakeScoreElement.textContent = `Змейка: ${gameState.snakeScore}`;
    rabbitScoreElement.textContent = `Зайчик: ${gameState.rabbitScore}`;
    gameTimerElement.textContent = formatTime(gameState.gameTime);
}

function draw() {
    ctx.fillStyle = '#34495e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#2ecc71';
    for (let segment of gameState.snake) {
        ctx.fillRect(segment.x * 20, segment.y * 20, 19, 19);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(gameState.rabbit.x * 20, gameState.rabbit.y * 20, 19, 19);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(gameState.food.x * 20, gameState.food.y * 20, 19, 19);
}

const SNAKE_KEYS = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right'
};
const RABBIT_KEYS = {
    w: 'up',
    s: 'down',
    a: 'left',
    d: 'right'
};

document.addEventListener('keydown', (event) => {
    if (!gameState.isGameStarted || gameState.isGameOver) return;
    let direction = null;
    let role = null;
    if (SNAKE_KEYS[event.key]) {
        direction = SNAKE_KEYS[event.key];
        role = 'snake';
    } else if (RABBIT_KEYS[event.key]) {
        direction = RABBIT_KEYS[event.key];
        role = 'rabbit';
    }
    if (direction && role) {
        socket.emit('playerMove', { gameCode, role, direction });
    }
});

socket.on('gameState', (state) => {
    Object.assign(gameState, state);
    updateScores();
    if (gameState.isGameStarted) {
        waitingMessageElement.style.display = 'none';
    } else {
        waitingMessageElement.style.display = 'block';
    }
    draw();
});

socket.on('gameCreated', (code) => {
    menuElement.style.display = 'none';
    gameContainerElement.style.display = 'block';
    gameCodeElement.textContent = `Код игры: ${code}`;
    gameCode = code;
});

socket.on('gameJoined', (data) => {
    menuElement.style.display = 'none';
    gameContainerElement.style.display = 'block';
    if (data && data.role) {
        myRole = data.role;
    }
});

socket.on('joinError', (message) => {
    alert(message);
});

socket.on('gameOver', () => {
    gameState.isGameOver = true;
    alert('Игра окончена!');
});

function gameTick(gameCode) {
    const game = games.get(gameCode);
    if (!game || !game.isGameStarted || game.isGameOver) return;

    // ... движение, таймер, очки, столкновения ...

    io.to(gameCode).emit('gameState', game);

    if (!game.isGameOver) {
        setTimeout(() => gameTick(gameCode), GAME_TICK);
    } else {
        io.to(gameCode).emit('gameOver');
    }
} 