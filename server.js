const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const TwitchStrategy = require('passport-twitch-new').Strategy;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    pingTimeout: 30000,
    pingInterval: 10000
});

const TWITCH_CLIENT_ID = '52swwi6jn9nth7ubkekb4mo7x8y6yr';
const TWITCH_CLIENT_SECRET = 'zfpafa835uycupk5reye65ses6u7m1';
const CALLBACK_URL = 'https://uma-game.onrender.com/auth/twitch/callback';

passport.use(new TwitchStrategy({
    clientID: TWITCH_CLIENT_ID,
    clientSecret: TWITCH_CLIENT_SECRET,
    callbackURL: CALLBACK_URL,
    scope: "user:read:email",
    forceVerify: true
}, (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

app.use(session({
    secret: 'uma-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

app.use(passport.initialize());
app.use(passport.session());

function checkAuth(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/login');
}

app.get('/login', (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/');
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>UMA GAME</title>
            <style>
                body, html {
                    margin: 0; padding: 0; width: 100%; height: 100%;
                    overflow: hidden; background: #050a0a;
                    font-family: 'Segoe UI', sans-serif;
                }
                .login-container {
                    height: 100vh; display: flex; flex-direction: column;
                    justify-content: center; align-items: center;
                    background: radial-gradient(circle, #0a1f1f 0%, #000 100%);
                    position: relative;
                }
                .scanline {
                    width: 100%; height: 100px; z-index: 5;
                    background: linear-gradient(0deg, rgba(0, 255, 204, 0) 0%, rgba(0, 255, 204, 0.05) 50%, rgba(0, 255, 204, 0) 100%);
                    opacity: 0.1; position: absolute; bottom: 100%;
                    animation: scan 4s linear infinite;
                }
                @keyframes scan {
                    to { bottom: -100px; }
                }
                .login-card {
                    z-index: 10; text-align: center; padding: 60px;
                    border: 1px solid rgba(0, 255, 204, 0.2);
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(10px);
                    box-shadow: 0 0 40px rgba(0, 0, 0, 0.5);
                    position: relative;
                }
                .login-card::before, .login-card::after {
                    content: ''; position: absolute; width: 20px; height: 20px;
                    border: 2px solid #00ffcc;
                }
                .login-card::before { top: -5px; left: -5px; border-right: 0; border-bottom: 0; }
                .login-card::after { bottom: -5px; right: -5px; border-left: 0; border-top: 0; }
                h1 {
                    color: #00ffcc; font-size: 2.5rem; letter-spacing: 15px;
                    margin: 0 0 10px 0; text-shadow: 0 0 15px rgba(0, 255, 204, 0.4);
                }
                p {
                    color: rgba(0, 255, 204, 0.5); margin-bottom: 40px;
                    text-transform: uppercase; font-size: 0.8rem; letter-spacing: 4px;
                }
                .twitch-btn {
                    display: inline-flex; align-items: center;
                    background: transparent; border: 1px solid #00ffcc;
                    color: #00ffcc; padding: 18px 35px; text-decoration: none;
                    font-weight: bold; letter-spacing: 2px; font-size: 0.9rem;
                    transition: all 0.3s ease; position: relative; overflow: hidden;
                }
                .twitch-btn:hover {
                    background: #00ffcc; color: #000;
                    box-shadow: 0 0 30px rgba(0, 255, 204, 0.4);
                    transform: translateY(-2px);
                }
                .grid {
                    position: absolute; width: 200%; height: 200%;
                    background-image: linear-gradient(rgba(0, 255, 204, 0.05) 1px, transparent 1px),
                                      linear-gradient(90deg, rgba(0, 255, 204, 0.05) 1px, transparent 1px);
                    background-size: 50px 50px;
                    transform: perspective(500px) rotateX(60deg);
                    bottom: -50%; left: -50%; z-index: 1;
                }
            </style>
        </head>
        <body>
            <div class="login-container">
                <div class="grid"></div>
                <div class="scanline"></div>
                <div class="login-card">
                    <h1>UMA GAME</h1>
                    <a href="/auth/twitch" class="twitch-btn">CONNEXION VIA TWITCH</a>
                </div>
            </div>
        </body>
        </html>
    `);
});

app.get('/auth/twitch', passport.authenticate('twitch'));
app.get('/auth/twitch/callback', passport.authenticate('twitch', { failureRedirect: '/login' }), (req, res) => res.redirect('/'));
app.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        res.redirect('/login');
    });
});

app.get('/user-data', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ display_name: req.user.display_name });
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
});

app.get('/', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use('/assets', express.static(path.join(__dirname, 'public/assets')));
app.use(checkAuth, express.static(path.join(__dirname, 'public')));

let players = {};

io.on('connection', (socket) => {
    socket.on('joinGame', (data) => {
        players[socket.id] = {
            id: socket.id,
            x: 0,
            y: 0,
            char: data.char,
            nickname: data.nickname,
            anim: `${data.char}_idle_down`
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

    socket.on('chatMessage', (msg) => {
        if (players[socket.id]) {
            io.emit('newChatMessage', {
                id: socket.id,
                name: players[socket.id].nickname,
                text: msg
            });
        }
    });

    socket.on('disconnect', () => {
        if (players[socket.id]) {
            delete players[socket.id];
            io.emit('playerDisconnected', socket.id);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur lancé sur le port ${PORT}`);
});