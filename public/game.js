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
const roleSelectElement = document.getElementById('roleSelect');
const chooseSnakeBtn = document.getElementById('chooseSnake');
const chooseRabbitBtn = document.getElementById('chooseRabbit');
const roleErrorElement = document.getElementById('roleError');
const CELL_SIZE = 30;

let gameCode = null;
let gameState = {
    snake: [],
    rabbit: { x: 0, y: 0 },
    snakeScore: 0,
    rabbitScore: 0,
    gameTime: 0,
    isGameOver: false,
    isGameStarted: false
};
let myRole = null;
let canControl = false;

// --- Swipe gesture support for mobile ---
let touchStartX = null;
let touchStartY = null;

canvas.addEventListener('touchstart', function(e) {
    if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }
}, false);

canvas.addEventListener('touchend', function(e) {
    if (touchStartX === null || touchStartY === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const dx = touchEndX - touchStartX;
    const dy = touchEndY - touchStartY;
    let direction = null;
    if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 30) direction = 'right';
        else if (dx < -30) direction = 'left';
    } else {
        if (dy > 30) direction = 'down';
        else if (dy < -30) direction = 'up';
    }
    if (direction && gameState.isGameStarted && !gameState.isGameOver && canControl) {
        socket.emit('playerMove', { gameCode, role: myRole, direction });
    }
    touchStartX = null;
    touchStartY = null;
}, false);

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
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
        ctx.fillRect(segment.x * CELL_SIZE, segment.y * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(gameState.rabbit.x * CELL_SIZE, gameState.rabbit.y * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1);
}

const GAME_KEYS = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right'
};

chooseSnakeBtn.onclick = () => chooseRole('snake');
chooseRabbitBtn.onclick = () => chooseRole('rabbit');

function chooseRole(role) {
    if (!gameCode) return;
    socket.emit('chooseRole', { gameCode, role });
}

socket.on('roleChosen', ({ role }) => {
    myRole = role;
    canControl = true;
    roleSelectElement.style.display = 'none';
    roleErrorElement.textContent = '';
});

socket.on('roleError', ({ message }) => {
    roleErrorElement.textContent = message;
});

document.addEventListener('keydown', (event) => {
    if (!gameState.isGameStarted || gameState.isGameOver || !canControl) return;
    let direction = null;
    if (GAME_KEYS[event.key]) {
        direction = GAME_KEYS[event.key];
    }
    if (direction) {
        socket.emit('playerMove', { gameCode, role: myRole, direction });
    }
});

function createGame() {
    socket.emit('createGame');
}

function joinGame() {
    const code = document.getElementById('gameCodeInput').value.trim();
    if (code) {
        socket.emit('joinGame', code);
    } else {
        alert('Пожалуйста, введите код игры');
    }
}

function updateRoleButtons(state) {
    const roles = state.roles || {};
    if (Object.values(roles).includes('snake')) {
        chooseSnakeBtn.disabled = true;
        chooseSnakeBtn.textContent = 'Змейка (занято)';
    } else {
        chooseSnakeBtn.disabled = false;
        chooseSnakeBtn.textContent = 'Змейка';
    }
    if (Object.values(roles).includes('rabbit')) {
        chooseRabbitBtn.disabled = true;
        chooseRabbitBtn.textContent = 'Зайчик (занято)';
    } else {
        chooseRabbitBtn.disabled = false;
        chooseRabbitBtn.textContent = 'Зайчик';
    }
}

socket.on('gameState', (state) => {
    Object.assign(gameState, state);
    updateScores();
    updateRoleButtons(state);
    if (!gameState.isGameStarted) {
        waitingMessageElement.style.display = 'block';
        roleSelectElement.style.display = 'block';
    } else {
        waitingMessageElement.style.display = 'none';
        roleSelectElement.style.display = 'none';
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
    if (data && data.gameCode) gameCode = data.gameCode;
});

socket.on('joinError', (message) => {
    alert(message);
});

socket.on('gameOver', () => {
    gameState.isGameOver = true;
    alert('Игра окончена!');
}); 