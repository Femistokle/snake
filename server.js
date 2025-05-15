const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Раздача статических файлов
app.use(express.static(path.join(__dirname, 'public')));

// Хранение активных игр
const games = new Map();

// Константы игры
const GRID_SIZE = 20;
const CELL_SIZE = 30;
const SURVIVAL_POINTS = 10;
const SURVIVAL_INTERVAL = 10;
const GAME_TICK = 100; // миллисекунд (змея быстрее)
const RABBIT_MOVE_INTERVAL = 200; // миллисекунд (заяц медленнее)

// Направления (удаляем WASD)
const DIRECTIONS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
};

// Для хранения направлений игроков
const playerDirections = new Map(); // gameCode -> {snake: dir, rabbit: dir}

// Генерация уникального кода игры
function generateGameCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function move(pos, dir) {
    return {
        x: (pos.x + DIRECTIONS[dir].x + GRID_SIZE) % GRID_SIZE,
        y: (pos.y + DIRECTIONS[dir].y + GRID_SIZE) % GRID_SIZE
    };
}

function getRandomFreeCell(snake) {
    let cell;
    while (true) {
        cell = {
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE)
        };
        // Проверяем, что клетка не занята змейкой
        if (!snake.some(seg => seg.x === cell.x && seg.y === cell.y)) break;
    }
    return cell;
}

function getOppositeDirection(dir) {
    switch (dir) {
        case 'up': return 'down';
        case 'down': return 'up';
        case 'left': return 'right';
        case 'right': return 'left';
        default: return dir;
    }
}

function gameTick(gameCode) {
    const game = games.get(gameCode);
    if (!game || !game.isGameStarted || game.isGameOver) return;

    // Движение змейки (каждый тик)
    let snakeDir = playerDirections.get(gameCode)?.snake || game.snakeDir;
    let newHead = move(game.snake[0], snakeDir);
    game.snake.unshift(newHead);

    // Проверка поимки зайчика (до движения зайчика!)
    let rabbitEaten = false;
    if (newHead.x === game.rabbit.x && newHead.y === game.rabbit.y) {
        game.snakeScore += 10;
        // Змейка растёт: добавляем копию хвоста
        const tail = game.snake[game.snake.length - 1];
        game.snake.push({ x: tail.x, y: tail.y });
        game.rabbit = getRandomFreeCell(game.snake);
        rabbitEaten = true;
        // Змейка растёт (не удаляем хвост)
    } else {
        // Обычное движение — удаляем хвост
        game.snake.pop();
    }
    game.snakeDir = snakeDir;

    // Таймер движения зайца
    if (game.rabbitMoveTimer === undefined) game.rabbitMoveTimer = 0;
    game.rabbitMoveTimer += GAME_TICK;
    let moveRabbit = false;
    if (game.rabbitMoveTimer >= RABBIT_MOVE_INTERVAL) {
        moveRabbit = true;
        game.rabbitMoveTimer -= RABBIT_MOVE_INTERVAL;
    }

    // Движение зайца (ТОРОИДАЛЬНОЕ ПОЛЕ) — только если его не съели и пора двигаться
    if (!rabbitEaten && moveRabbit) {
        let rabbitDir = playerDirections.get(gameCode)?.rabbit || game.rabbitDir;
        let newRabbit = move(game.rabbit, rabbitDir);

        // Проверка столкновения с телом змейки (кроме головы)
        let collision = game.snake.some((seg, idx) => idx > 0 && seg.x === newRabbit.x && seg.y === newRabbit.y);
        if (collision) {
            // Меняем направление на противоположное и двигаем зайчика туда
            let oppositeDir = getOppositeDirection(rabbitDir);
            newRabbit = move(game.rabbit, oppositeDir);
            game.rabbitDir = oppositeDir;
        } else {
            game.rabbitDir = rabbitDir;
        }
        game.rabbit = newRabbit;

        // После движения зайчика — проверяем, не попал ли он на голову змейки
        if (newHead.x === newRabbit.x && newHead.y === newRabbit.y) {
            game.snakeScore += 10;
            const tail = game.snake[game.snake.length - 1];
            game.snake.push({ x: tail.x, y: tail.y });
            game.rabbit = getRandomFreeCell(game.snake);
            // Змейка растёт (не удаляем хвост)
        }
    }

    // Проверка столкновений змейки с собой
    for (let i = 1; i < game.snake.length; i++) {
        if (game.snake[i].x === newHead.x && game.snake[i].y === newHead.y) {
            game.isGameOver = true;
            io.to(gameCode).emit('gameState', game);
            io.to(gameCode).emit('gameOver');
            return;
        }
    }

    // Таймер и очки зайчика (раз в 10 секунд)
    if (game.rabbitSurvivalTimer === undefined) game.rabbitSurvivalTimer = 0;
    game.gameTime += GAME_TICK / 1000;
    game.rabbitSurvivalTimer += GAME_TICK / 1000;
    if (game.rabbitSurvivalTimer >= SURVIVAL_INTERVAL) {
        game.rabbitScore += SURVIVAL_POINTS;
        game.rabbitSurvivalTimer -= SURVIVAL_INTERVAL;
    }

    // Отправка состояния
    io.to(gameCode).emit('gameState', game);

    // Если игра не окончена, следующий тик
    if (!game.isGameOver) {
        setTimeout(() => gameTick(gameCode), GAME_TICK);
    }
}

// Обработка подключений
io.on('connection', (socket) => {
    console.log('Новое подключение:', socket.id);

    // Создание новой игры
    socket.on('createGame', () => {
        const gameCode = generateGameCode();
        const gameState = {
            snake: [
                { x: 5, y: 5 },
                { x: 4, y: 5 },
                { x: 3, y: 5 }
            ],
            snakeDir: 'right',
            rabbit: { x: 15, y: 15 },
            rabbitDir: 'left',
            snakeScore: 0,
            rabbitScore: 0,
            gameTime: 0,
            isGameOver: false,
            isGameStarted: false,
            players: [socket.id],
            roles: {} // никто не назначен!
        };
        games.set(gameCode, gameState);
        playerDirections.set(gameCode, { snake: 'right', rabbit: 'left' });
        socket.join(gameCode);
        socket.emit('gameCreated', gameCode);
    });

    // Присоединение к игре
    socket.on('joinGame', (gameCode) => {
        console.log(`Попытка присоединиться к игре ${gameCode}`);
        const game = games.get(gameCode);
        if (!game) {
            console.log(`Игра ${gameCode} не найдена`);
            socket.emit('joinError', 'Игра не найдена. Проверьте код игры.');
            return;
        }
        if (game.players.length >= 2) {
            console.log(`Игра ${gameCode} уже заполнена`);
            socket.emit('joinError', 'Игра уже заполнена');
            return;
        }
        if (game.players.includes(socket.id)) {
            console.log(`Игрок ${socket.id} уже в игре ${gameCode}`);
            socket.emit('joinError', 'Вы уже в этой игре');
            return;
        }
        console.log(`Игрок ${socket.id} присоединился к игре ${gameCode}`);
        game.players.push(socket.id);
        socket.join(gameCode);
        // Не назначаем роли и не запускаем игру!
        socket.emit('gameJoined', { gameCode });
        io.to(gameCode).emit('gameState', game);
    });

    // Выбор роли
    socket.on('chooseRole', ({ gameCode, role }) => {
        const game = games.get(gameCode);
        if (!game) return;
        if (!game.roles) game.roles = {};
        // Разрешаем выбрать роль только если она свободна
        if (!Object.values(game.roles).includes(role)) {
            game.roles[socket.id] = role;
            socket.emit('roleChosen', { role });
            // Если обе роли выбраны, запускаем игру
            if (Object.values(game.roles).includes('snake') && Object.values(game.roles).includes('rabbit')) {
                game.isGameStarted = true;
                io.to(gameCode).emit('gameState', game);
                setTimeout(() => gameTick(gameCode), GAME_TICK);
            } else {
                io.to(gameCode).emit('gameState', game);
            }
        } else {
            socket.emit('roleError', { message: 'Роль уже занята' });
        }
    });

    // Новый обработчик управления
    socket.on('playerMove', ({ gameCode, role, direction }) => {
        const game = games.get(gameCode);
        if (!playerDirections.has(gameCode) || !game || !game.roles) return;
        // Разрешаем управление только своей ролью и только после выбора роли
        if (game.roles[socket.id] !== role || !game.isGameStarted) return;
        const dirs = playerDirections.get(gameCode);

        // Проверка для змейки: нельзя развернуться в противоположную сторону
        if (role === 'snake') {
            const currentDir = dirs.snake || game.snakeDir;
            const opposite = getOppositeDirection(currentDir);
            if (direction === opposite) {
                return; // Игнорируем разворот
            }
        }

        dirs[role] = direction;
        playerDirections.set(gameCode, dirs);
    });

    // Обработка отключения
    socket.on('disconnect', () => {
        games.forEach((game, gameCode) => {
            if (game.players.includes(socket.id)) {
                game.players = game.players.filter(id => id !== socket.id);
                if (game.players.length === 0) {
                    games.delete(gameCode);
                } else {
                    io.to(gameCode).emit('gameOver');
                }
            }
        });
    });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
}); 