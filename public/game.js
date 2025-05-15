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
    e.preventDefault();
}, { passive: false });

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
    e.preventDefault();
}, { passive: false });

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
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#34495e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Проверяем, ест ли змейка зайца на следующем ходу
    let eatingRabbit = false;
    if (gameState.snake.length > 0) {
        const head = gameState.snake[0];
        // Определяем текущее направление змейки
        let dir = null;
        if (window.playerDirections && window.playerDirections.snake) {
            dir = window.playerDirections.snake;
        } else if (gameState.snakeDir) {
            dir = gameState.snakeDir;
        }
        // Предсказываем следующий ход
        if (dir && typeof CELL_SIZE !== 'undefined') {
            let dx = 0, dy = 0;
            if (dir === 'up') dy = -1;
            if (dir === 'down') dy = 1;
            if (dir === 'left') dx = -1;
            if (dir === 'right') dx = 1;
            const nextX = (head.x + dx + 20) % 20;
            const nextY = (head.y + dy + 20) % 20;
            if (nextX === gameState.rabbit.x && nextY === gameState.rabbit.y) {
                eatingRabbit = true;
            }
        }
    }

    // Тень под змейкой
    ctx.save();
    for (let i = 0; i < gameState.snake.length; i++) {
        const segment = gameState.snake[i];
        const x = segment.x * CELL_SIZE;
        const y = segment.y * CELL_SIZE;
        ctx.beginPath();
        ctx.arc(x + CELL_SIZE / 2, y + CELL_SIZE / 2 + 2, CELL_SIZE / 2.2, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(30,40,50,0.18)';
        ctx.fill();
    }
    ctx.restore();

    // Рисуем змейку
    for (let i = 0; i < gameState.snake.length; i++) {
        const segment = gameState.snake[i];
        const x = segment.x * CELL_SIZE;
        const y = segment.y * CELL_SIZE;
        // Размер сегмента: голова самая большая, хвост — меньше
        const minRadius = CELL_SIZE / 3.2;
        const maxRadius = CELL_SIZE / 2 - 1;
        const radius = maxRadius - (maxRadius - minRadius) * (i / (gameState.snake.length - 1 || 1));
        // Цвет: плавный переход к более тёмному
        let colorStart = [67, 233, 123]; // #43e97b
        let colorEnd = [39, 174, 96];   // #27ae60
        let t = i / (gameState.snake.length - 1 || 1);
        let r = Math.round(colorStart[0] * (1 - t) + colorEnd[0] * t);
        let g = Math.round(colorStart[1] * (1 - t) + colorEnd[1] * t);
        let b = Math.round(colorStart[2] * (1 - t) + colorEnd[2] * t);
        const fillColor = `rgb(${r},${g},${b})`;
        if (i === 0) {
            // Голова змейки — овальная, с выразительными деталями
            // Определяем направление головы
            let dir = null;
            if (window.playerDirections && window.playerDirections.snake) {
                dir = window.playerDirections.snake;
            } else if (gameState.snakeDir) {
                dir = gameState.snakeDir;
            }
            let angle = 0;
            if (dir === 'up') angle = -Math.PI / 2;
            if (dir === 'down') angle = Math.PI / 2;
            if (dir === 'left') angle = Math.PI;
            if (dir === 'right') angle = 0;
            ctx.save();
            // Центр головы
            const cx = x + CELL_SIZE / 2;
            const cy = y + CELL_SIZE / 2;
            ctx.translate(cx, cy);
            ctx.rotate(angle);
            // Овальная форма головы
            ctx.beginPath();
            ctx.ellipse(0, 0, radius * 1.15, radius * 0.85, 0, 0, 2 * Math.PI);
            // Окантовка
            ctx.lineWidth = 2.2;
            ctx.strokeStyle = '#145a32';
            ctx.stroke();
            // Градиент головы
            const grad = ctx.createRadialGradient(0, 0, 6, 0, 0, radius * 1.15);
            grad.addColorStop(0, '#43e97b');
            grad.addColorStop(1, '#38b86c');
            ctx.fillStyle = grad;
            ctx.shadowColor = '#145a32';
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.shadowBlur = 0;
            // Глаза (белки)
            ctx.beginPath();
            ctx.ellipse(7, -6, 4, 4.7, 0, 0, 2 * Math.PI);
            ctx.ellipse(7, 6, 4, 4.7, 0, 0, 2 * Math.PI);
            ctx.fillStyle = '#fff';
            ctx.fill();
            // Зрачки
            ctx.beginPath();
            ctx.arc(9, -6, 1.7, 0, 2 * Math.PI);
            ctx.arc(9, 6, 1.7, 0, 2 * Math.PI);
            ctx.fillStyle = '#222';
            ctx.fill();
            // Блики в глазах
            ctx.beginPath();
            ctx.arc(10, -7, 0.7, 0, 2 * Math.PI);
            ctx.arc(10, 5, 0.7, 0, 2 * Math.PI);
            ctx.fillStyle = '#fff';
            ctx.globalAlpha = 0.7;
            ctx.fill();
            ctx.globalAlpha = 1;
            // Ноздри
            ctx.beginPath();
            ctx.arc(-4, -2, 0.7, 0, 2 * Math.PI);
            ctx.arc(-4, 2, 0.7, 0, 2 * Math.PI);
            ctx.fillStyle = '#222';
            ctx.fill();
            // Язычок (короче и тоньше)
            let dx = 1, dy = 0; // всегда вперёд по X после поворота
            const tongueLen = 8;
            const tx = radius * 1.15 + 2;
            const ty = 0;
            const tipX = tx + dx * tongueLen;
            const tipY = ty + dy * tongueLen;
            const forkAngle = Math.PI / 8;
            const angle0 = 0;
            const fork1X = tipX + 4 * Math.cos(angle0 - forkAngle);
            const fork1Y = tipY + 4 * Math.sin(angle0 - forkAngle);
            const fork2X = tipX + 4 * Math.cos(angle0 + forkAngle);
            const fork2Y = tipY + 4 * Math.sin(angle0 + forkAngle);
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(tipX, tipY);
            ctx.lineTo(fork1X, fork1Y);
            ctx.moveTo(tipX, tipY);
            ctx.lineTo(fork2X, fork2Y);
            ctx.strokeStyle = '#e17055';
            ctx.lineWidth = 1.5;
            ctx.lineCap = 'round';
            ctx.stroke();
            ctx.restore();
            ctx.restore();
        } else {
            // Тело змейки — зауженное и с градиентом
            ctx.save();
            ctx.beginPath();
            ctx.arc(x + CELL_SIZE / 2, y + CELL_SIZE / 2, radius, 0, 2 * Math.PI);
            ctx.fillStyle = fillColor;
            ctx.globalAlpha = 0.95;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.restore();
        }
    }

    // Тень под зайцем
    const rx = gameState.rabbit.x * CELL_SIZE;
    const ry = gameState.rabbit.y * CELL_SIZE;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(rx + CELL_SIZE / 2, ry + CELL_SIZE / 2 + 4, CELL_SIZE / 2.5, 5, 0, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(30,40,50,0.18)';
    ctx.fill();
    ctx.restore();

    // Рисуем зайца
    ctx.save();
    // Ушки (белые)
    ctx.beginPath();
    ctx.ellipse(rx + CELL_SIZE / 2 - 6, ry + CELL_SIZE / 2 - 12, 3, 9, Math.PI / 8, 0, 2 * Math.PI);
    ctx.ellipse(rx + CELL_SIZE / 2 + 6, ry + CELL_SIZE / 2 - 12, 3, 9, -Math.PI / 8, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.fill();
    // Ушки (розовые внутри)
    ctx.beginPath();
    ctx.ellipse(rx + CELL_SIZE / 2 - 6, ry + CELL_SIZE / 2 - 12, 1.2, 5, Math.PI / 8, 0, 2 * Math.PI);
    ctx.ellipse(rx + CELL_SIZE / 2 + 6, ry + CELL_SIZE / 2 - 12, 1.2, 5, -Math.PI / 8, 0, 2 * Math.PI);
    ctx.fillStyle = '#f8bbd0';
    ctx.fill();
    // Тело (круг)
    ctx.beginPath();
    ctx.arc(rx + CELL_SIZE / 2, ry + CELL_SIZE / 2, CELL_SIZE / 2 - 3, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#bbb';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.shadowBlur = 0;
    // Щёчки
    ctx.beginPath();
    ctx.arc(rx + CELL_SIZE / 2 - 6, ry + CELL_SIZE / 2 + 3, 2, 0, 2 * Math.PI);
    ctx.arc(rx + CELL_SIZE / 2 + 6, ry + CELL_SIZE / 2 + 3, 2, 0, 2 * Math.PI);
    ctx.fillStyle = '#f8bbd0';
    ctx.fill();
    // Глазки
    ctx.beginPath();
    ctx.arc(rx + CELL_SIZE / 2 - 4, ry + CELL_SIZE / 2 - 2, 1.3, 0, 2 * Math.PI);
    ctx.arc(rx + CELL_SIZE / 2 + 4, ry + CELL_SIZE / 2 - 2, 1.3, 0, 2 * Math.PI);
    ctx.fillStyle = '#222';
    ctx.fill();
    // Носик
    ctx.beginPath();
    ctx.arc(rx + CELL_SIZE / 2, ry + CELL_SIZE / 2 + 1, 1.2, 0, 2 * Math.PI);
    ctx.fillStyle = '#e17055';
    ctx.fill();
    ctx.restore();
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
    // Блокируем скролл при стрелках
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
    }
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
    const gameField = document.getElementById('gameFieldContainer');
    if (gameState.isGameStarted) {
        gameField.style.display = '';
    } else {
        gameField.style.display = 'none';
    }
    if (!gameState.isGameStarted) {
        waitingMessageElement.style.display = 'block';
        roleSelectElement.style.display = 'block';
    } else {
        waitingMessageElement.style.display = 'none';
        roleSelectElement.style.display = 'none';
    }
    draw();
});

// Скрываем инфоблок по умолчанию
const gameInfoBlock = document.getElementById('gameInfoBlock');
gameInfoBlock.style.display = 'none';

socket.on('gameCreated', (code) => {
    menuElement.style.display = 'none';
    gameContainerElement.style.display = 'block';
    gameCodeElement.textContent = `Код игры: ${code}`;
    gameCode = code;
    gameInfoBlock.style.display = '';
});

socket.on('gameJoined', (data) => {
    menuElement.style.display = 'none';
    gameContainerElement.style.display = 'block';
    if (data && data.gameCode) gameCode = data.gameCode;
    gameInfoBlock.style.display = '';
});

socket.on('joinError', (message) => {
    alert(message);
});

socket.on('gameOver', () => {
    gameState.isGameOver = true;
    alert('Игра окончена!');
}); 