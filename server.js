const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

const players = {};

io.on('connection', (socket) => {
    console.log('Un utilisateur s\'est connecté : ' + socket.id);

    socket.on('joinGame', (data) => {
        players[socket.id] = {
            id: socket.id,
            nickname: data.nickname || "Uma",
            char: data.char || "Special_Week",
            x: 0,
            y: 1600, 
            anim: data.char + "_idle_down"
        };

        socket.emit('currentPlayers', players);
        socket.broadcast.emit('newPlayer', players[socket.id]);
    });

    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            players[socket.id].anim = movementData.anim;
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    socket.on('chatMessage', (text) => {
        if (players[socket.id]) {
            const messageData = {
                id: socket.id,
                name: players[socket.id].nickname,
                text: text
            };
            io.emit('newChatMessage', messageData);
        }
    });

    socket.on('disconnect', () => {
        console.log('Utilisateur déconnecté : ' + socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});