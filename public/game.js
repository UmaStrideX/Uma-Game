const UMA_LIST = [
    "Special_Week", "Silence_Suzuka", "Tokai_Teio", "Maruzensky",
    "Oguri_Cap", "Kitasan_Black", "Almond_Eye", "Biwa_Hayahide",
    "Daiwa_Scarlet", "El_Condor_Pasa", "Gold_Ship", "Haru_Urara",
    "Mejiro_Mcqueen", "Narita_Brian", "Rice_Shower", "Sakura_Bakushin_O",
    "Seiun_Sky", "Super_Creek", "Symboli_Rudolf", "TM_Opera_O",
    "Taiki_Shuttle", "Tamamo_Cross", "Vodka"
];

class ScenePreload extends Phaser.Scene {
    constructor() { super({ key: 'ScenePreload' }); }

    preload() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x002222, 0.8);
        progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

        const loadingText = this.make.text({
            x: width / 2, y: height / 2 - 50, text: 'CHARGEMENT...',
            style: { font: '14px monospace', fill: '#00ffcc' }
        }).setOrigin(0.5, 0.5);

        const percentText = this.make.text({
            x: width / 2, y: height / 2, text: '0%',
            style: { font: '18px monospace', fill: '#ffffff' }
        }).setOrigin(0.5, 0.5);

        this.load.on('progress', (value) => {
            percentText.setText(parseInt(value * 100) + '%');
            progressBar.clear().fillStyle(0x00ffcc, 1);
            progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
        });

        this.load.on('complete', () => {
            progressBar.destroy(); progressBox.destroy();
            loadingText.destroy(); percentText.destroy();
        });

        UMA_LIST.forEach(name => {
            this.load.path = `assets/${name}/`;
            this.load.image(`${name}_idle_img`, `${name}_idle.png`);
            this.load.json(`${name}_idle_data`, `${name}_idle.json`);
            this.load.image(`${name}_run_img`, `${name}_run.png`);
            this.load.json(`${name}_run_data`, `${name}_run.json`);
        });
    }

    create() {
        const tileW = 128, tileH = 64;
        const drawTile = (key, color) => {
            const graphics = this.make.graphics({ x: 0, y: 0, add: false });
            graphics.fillStyle(color, 1).fillPoints([
                { x: tileW / 2, y: 0 }, { x: tileW, y: tileH / 2 }, 
                { x: tileW / 2, y: tileH }, { x: 0, y: tileH / 2 }
            ], true);
            graphics.generateTexture(key, tileW, tileH);
        };
        drawTile('tile_light', 0xece4dd);
        drawTile('tile_dark', 0xd1c8c1);

        UMA_LIST.forEach(name => {
            this.parseCustomJson(name, 'idle', 16);
            this.parseCustomJson(name, 'run', 24);
        });

        this.scene.start('SceneMenu');
    }

    parseCustomJson(name, type, fps) {
        const jsonData = this.cache.json.get(`${name}_${type}_data`);
        const textureKey = `${name}_${type}_img`;
        if (!jsonData || !jsonData.animations) return;
        Object.keys(jsonData.animations).forEach(animKey => {
            const framesData = jsonData.animations[animKey];
            const phaserFrames = [];
            framesData.forEach((f, i) => {
                const fName = `${name}_${type}_${animKey}_${i}`;
                this.textures.get(textureKey).add(fName, 0, f.x, f.y, f.w, f.h);
                phaserFrames.push({ key: textureKey, frame: fName });
            });
            this.anims.create({
                key: `${name}_${animKey}`,
                frames: phaserFrames,
                frameRate: fps,
                repeat: -1
            });
        });
    }
}

class SceneMenu extends Phaser.Scene {
    constructor() { super({ key: 'SceneMenu' }); }
    
    async create() {
        let twitchName = "UMA-UNIT";
        try {
            const res = await fetch('/user-data');
            const data = await res.json();
            if (data.display_name) twitchName = data.display_name;
        } catch (e) { console.error("Erreur auth:", e); }

        const overlay = document.getElementById('ui-overlay');
        overlay.classList.add('visible');
        overlay.style.display = 'flex'; 

        const nickInput = document.getElementById('nickname-input');
        nickInput.value = twitchName;

        document.getElementById('logout-btn-menu').onclick = () => {
            window.location.href = '/logout';
        };

        let currentIndex = 0;
        const nameDisplay = document.getElementById('uma-name');
        const previewSprite = this.add.sprite(this.scale.width / 2, this.scale.height / 2, `${UMA_LIST[currentIndex]}_idle_img`);
        previewSprite.setScale(1.4);

        const updateDisplay = () => {
            const name = UMA_LIST[currentIndex];
            nameDisplay.innerText = name.replace(/_/g, ' ');
            previewSprite.play(`${name}_idle_down`);
        };
        updateDisplay();

        this.scale.on('resize', (gameSize) => {
            previewSprite.setPosition(gameSize.width / 2, gameSize.height / 2);
        });

        document.getElementById('next-btn').onclick = () => { currentIndex = (currentIndex + 1) % UMA_LIST.length; updateDisplay(); };
        document.getElementById('prev-btn').onclick = () => { currentIndex = (currentIndex - 1 + UMA_LIST.length) % UMA_LIST.length; updateDisplay(); };
        document.getElementById('confirm-btn').onclick = () => {
            overlay.classList.remove('visible'); overlay.style.display = 'none';
            previewSprite.destroy();
            this.scene.start('SceneMain', { char: UMA_LIST[currentIndex], nickname: nickInput.value });
        };
    }
}

class SceneMain extends Phaser.Scene {
    constructor() { super({ key: 'SceneMain' }); }
    
    init(data) { 
        this.charName = data.char; 
        this.nickname = data.nickname;
        this.currentDir = 'down'; 
        this.isPaused = false;
        this.otherPlayers = this.add.group();
        if (typeof io !== 'undefined') {
            this.socket = io({ reconnection: true });
        }
    }
    
    create() {
        const mapSize = 60, tileW = 128, tileH = 64;
        for (let y = 0; y < mapSize; y++) {
            for (let x = 0; x < mapSize; x++) {
                const tx = (x - y) * (tileW / 2);
                const ty = (x + y) * (tileH / 2);
                this.add.image(tx, ty, (x + y) % 2 === 0 ? 'tile_light' : 'tile_dark').setOrigin(0.5, 0);
            }
        }

        this.player = this.physics.add.sprite(0, (mapSize * tileH) / 2, `${this.charName}_idle_img`);
        this.player.setOrigin(0.5, 1);
        this.player.nameTag = this.add.text(0, 0, this.nickname, {
            fontSize: '18px', fill: '#00ffcc', backgroundColor: 'rgba(0,0,0,0.6)', padding: { x: 6, y: 3 }
        }).setOrigin(0.5, 0).setDepth(20000);
        this.player.chatBubble = this.createChatBubble();

        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.cameras.main.setZoom(1.1);
        this.cursors = this.input.keyboard.createCursorKeys();

        this.setupEscMenu();
        if (this.socket) {
            this.setupSocket();
            this.setupChat();
        }
    }

    createChatBubble() {
        const container = this.add.container(0, 0).setDepth(20001).setVisible(false);
        const bg = this.add.graphics();
        const txt = this.add.text(0, 0, '', { fontSize: '14px', fill: '#ffffff', align: 'center', wordWrap: { width: 200 } }).setOrigin(0.5, 1);
        container.add([bg, txt]);
        return { container, bg, txt };
    }

    drawBubble(bubble, message) {
        const { bg, txt, container } = bubble;
        txt.setText(message);
        const p = 8, w = txt.width + p * 2, h = txt.height + p * 2;
        bg.clear().fillStyle(0x000000, 0.8).lineStyle(1, 0x00ffcc, 1);
        bg.fillRoundedRect(-w / 2, -h - 10, w, h, 4).strokeRoundedRect(-w / 2, -h - 10, w, h, 4);
        txt.y = -10 - p;
        container.setVisible(true);
    }

    setupEscMenu() {
        const resumeBtn = document.getElementById('resume-btn');
        const exitBtn = document.getElementById('exit-btn');
        this.input.keyboard.on('keydown-ESC', () => {
            if (document.activeElement !== document.getElementById('chat-input')) this.toggleMenu();
        });
        resumeBtn.onclick = () => this.toggleMenu();
        exitBtn.onclick = () => window.location.href = '/logout';
    }

    toggleMenu() {
        const menu = document.getElementById('esc-menu');
        this.isPaused = !this.isPaused;
        if (this.isPaused) {
            menu.classList.remove('hidden');
            this.input.keyboard.enabled = false;
            this.player.setVelocity(0);
        } else {
            menu.classList.add('hidden');
            this.input.keyboard.enabled = true;
        }
    }

    setupSocket() {
        this.socket.on('connect', () => {
            this.socket.emit('joinGame', { char: this.charName, nickname: this.nickname });
        });

        this.socket.on('currentPlayers', (players) => {
            Object.keys(players).forEach((id) => { 
                if (id !== this.socket.id) this.addOtherPlayer(players[id]); 
            });
        });

        this.socket.on('newPlayer', (p) => {
            if (!this.otherPlayers.getChildren().find(op => op.playerId === p.id)) this.addOtherPlayer(p);
        });

        this.socket.on('playerMoved', (p) => {
            this.otherPlayers.getChildren().forEach((op) => {
                if (p.id === op.playerId) {
                    op.setPosition(p.x, p.y);
                    if (p.anim) op.play(p.anim, true);
                    op.setDepth(op.y);
                    op.nameTag.setPosition(p.x, p.y - 15);
                    op.chatBubble.container.setPosition(p.x, p.y - 120);
                }
            });
        });

        this.socket.on('playerDisconnected', (id) => {
            this.otherPlayers.getChildren().forEach((op) => {
                if (id === op.playerId) { op.nameTag.destroy(); op.chatBubble.container.destroy(); op.destroy(); }
            });
        });

        this.socket.on('newChatMessage', (d) => {
            const disp = document.getElementById('chat-display');
            const el = document.createElement('div'); 
            el.innerHTML = `<span style="color:#00ffcc">${d.name}:</span> ${d.text}`;
            disp.appendChild(el); 
            disp.scrollTop = disp.scrollHeight;
            let target = (d.id === this.socket.id) ? this.player : this.otherPlayers.getChildren().find(op => op.playerId === d.id);
            if (target) {
                this.drawBubble(target.chatBubble, d.text);
                if (target.bubbleTimer) target.bubbleTimer.remove();
                target.bubbleTimer = this.time.delayedCall(5000, () => target.chatBubble.container.setVisible(false));
            }
        });
    }

    addOtherPlayer(p) {
        const op = this.add.sprite(p.x, p.y, `${p.char}_idle_img`);
        op.playerId = p.id; op.setOrigin(0.5, 1);
        op.nameTag = this.add.text(p.x, p.y - 15, p.nickname, {
            fontSize: '18px', fill: '#ffffff', backgroundColor: 'rgba(0,0,0,0.6)', padding: { x: 6, y: 3 }
        }).setOrigin(0.5, 0).setDepth(20000);
        op.chatBubble = this.createChatBubble();
        this.otherPlayers.add(op);
    }

    setupChat() {
        const input = document.getElementById('chat-input'), wrap = document.getElementById('chat-wrapper');
        wrap.style.display = 'flex';
        input.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
                const m = input.value.trim();
                if (m !== "") this.socket.emit('chatMessage', m);
                input.value = ""; input.blur();
                this.input.keyboard.enabled = true;
            }
        });
        this.input.keyboard.on('keydown-ENTER', () => { 
            if (document.activeElement !== input && !this.isPaused) { input.focus(); this.input.keyboard.enabled = false; } 
        });
    }

    update() {
        if (this.isPaused || !this.input.keyboard.enabled) return;
        const speed = 350;
        let ix = 0, iy = 0;
        if (this.cursors.left.isDown) ix = -1; else if (this.cursors.right.isDown) ix = 1;
        if (this.cursors.up.isDown) iy = -1; else if (this.cursors.down.isDown) iy = 1;
        
        let state = "idle";
        if (ix !== 0 || iy !== 0) {
            let vx = ix * speed, vy = iy * (speed / 2);
            if (iy !== 0 && ix === 0) vy = iy * speed;
            this.player.setVelocity(vx, vy);
            let dir = (iy === -1 ? "top" : (iy === 1 ? "down" : ""));
            if (ix !== 0 && iy !== 0) dir += "-";
            dir += (ix === -1 ? "left" : (ix === 1 ? "right" : ""));
            this.currentDir = dir || this.currentDir; state = "run";
            this.player.play(`${this.charName}_run_${this.currentDir}`, true);
        } else {
            this.player.setVelocity(0);
            this.player.play(`${this.charName}_idle_${this.currentDir}`, true);
        }
        this.player.setDepth(this.player.y);
        this.player.nameTag.setPosition(this.player.x, this.player.y - 15);
        this.player.chatBubble.container.setPosition(this.player.x, this.player.y - 120);
        if (this.socket) this.socket.emit('playerMovement', { x: this.player.x, y: this.player.y, anim: `${this.charName}_${state}_${this.currentDir}` });
    }
}

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    physics: { default: 'arcade' },
    scene: [ScenePreload, SceneMenu, SceneMain]
};
new Phaser.Game(config);