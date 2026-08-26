// Three.js and GLTFLoader loaded via script tags (global THREE object)

// ==================== FIREBASE CONFIG ====================
let DB_URL = 'https://rpg-gaim-default-rtdb.asia-southeast1.firebasedatabase.app/';

function getDbUrl() {
    const input = document.getElementById('db-url');
    if (input && input.value.trim()) DB_URL = input.value.trim();
    if (!DB_URL.endsWith('/')) DB_URL += '/';
    return DB_URL;
}

async function dbGet(path) {
    const res = await fetch(getDbUrl() + path + '.json');
    return res.json();
}

async function dbSet(path, data) {
    await fetch(getDbUrl() + path + '.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
}

// ==================== GLOBALS ====================
window.switchTab = switchTab;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.respawnPlayer = respawnPlayer;
window.toggleInventory = toggleInventory;
window.toggleShop = toggleShop;
window.toggleRoulette = toggleRoulette;
window.spinRoulette = spinRoulette;
window.closeDocument = closeDocument;
window.buyItem = buyItem;
window.toggleAdmin = toggleAdmin;
window.switchAdminTab = switchAdminTab;
window.loadPlayerList = loadPlayerList;
window.adminGiveCoins = adminGiveCoins;
window.adminGiveDiamonds = adminGiveDiamonds;
window.adminSetHp = adminSetHp;
window.adminSetStage = adminSetStage;
window.adminResetPlayer = adminResetPlayer;
window.adminGodMode = adminGodMode;
window.adminTeleport = adminTeleport;
window.adminMaxStats = adminMaxStats;
window.adminSpawnSnake = adminSpawnSnake;
window.adminSpawnBoss = adminSpawnBoss;
window.adminSetRole = adminSetRole;
window.adminDeletePlayer = adminDeletePlayer;
window.sendChatMessage = sendChatMessage;
window.toggleChat = toggleChat;
window.toggleEquipment = toggleEquipment;
window.toggleRanking = toggleRanking;
window.toggleSound = toggleSound;
window.equipFromInventory = equipFromInventory;
window.unequipSlot = unequipSlot;
window.toggleQuestBoard = toggleQuestBoard;
window.acceptSideQuest = acceptSideQuest;
window.toggleCrafting = toggleCrafting;
window.craftItem = craftItem;
window.toggleAchievements = toggleAchievements;
window.toggleSkillTree = toggleSkillTree;
window.upgradeSkill = upgradeSkill;
window.startFishing = startFishing;
window.catchFish = catchFish;
window.togglePetPanel = togglePetPanel;
window.summonPet = summonPet;
window.challengePvP = challengePvP;

let currentPlayer = null;
let godMode = false;
let onlinePlayers = {};
let onlineModels = {};
let scene, camera, renderer, clock;
let playerBody;
let pitch = 0, yaw = 0;
let isPointerLocked = false;
let isMobile = false;
let joystickActive = false, joystickDir = { x: 0, y: 0 };
let keys = {};

const loader = (typeof THREE.GLTFLoader === 'function') ? new THREE.GLTFLoader() : null;
const modelCache = {};
const ASSET_PATH = 'assets/models/';
const PLAYER_SPEED = 8;
const PLAYER_HEIGHT = 1.7;

let npcs = [], enemies = [], interactables = [];
let arrowHelper = null;
let buildings = {};
let mineObjects = {};

let gameState = {
    stage: 1, quest: null, questStep: 0,
    inDialogue: false, dialogueQueue: [], dialogueCallback: null,
    inCombat: false, currentEnemy: null,
    canInteract: false, interactTarget: null,
    playerHp: 100, playerMaxHp: 100,
    coins: 0, diamonds: 0,
    inventory: [], tools: [], equippedWeapon: null,
    completedQuests: [],
    hasMovedStage1: false, hasMovedStage2: false,
    snakeDeaths: 0, stage2Phase: 0,
    mineTracesFound: 0, stonesActivated: 0,
    insideMine: false, mineCollapsed: false,
    documentRead: false, bossRoomReached: false,
    level: 1, xp: 0, xpToNext: 50,
    equipment: { weapon: null, armor: null, accessory: null },
    defense: 0, attackBonus: 0,
    kills: 0, stage3Phase: 0,
    insideRuins: false, tabletsFound: 0,
    soundOn: true, bgmType: null,
    // Side quests
    sideQuests: [], activeSideQuest: null, completedSideQuests: [],
    // Day/Night & Weather
    timeOfDay: 0, daySpeed: 0.001, weather: 'clear',
    // Pet
    pet: null, petModel: null,
    // Crafting
    materials: {},
    // PvP
    pvpTarget: null, pvpActive: false,
    // Achievements
    achievements: [], title: '',
    // Fishing
    fishing: false, fishingSpot: false,
    // Skills
    skillPoints: 0,
    skills: { vitality: 0, strength: 0, agility: 0, luck: 0, critical: 0 }
};

// ==================== ASSET LOADER ====================
function addMesh(group, geo, color, x, y, z, emissive) {
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, emissive: emissive || 0x000000 }));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
}

function createFallbackModel(name) {
    const g = new THREE.Group();
    try {
        if (name.startsWith('tree-pine')) {
            addMesh(g, new THREE.CylinderGeometry(0.1, 0.15, 1, 6), 0x8B4513, 0, 0.5, 0);
            addMesh(g, new THREE.ConeGeometry(0.6, 1.5, 8), 0x228B22, 0, 1.8, 0);
            addMesh(g, new THREE.ConeGeometry(0.45, 1.2, 8), 0x2E8B57, 0, 2.8, 0);
        } else if (name.startsWith('tree')) {
            addMesh(g, new THREE.CylinderGeometry(0.12, 0.18, 1.2, 6), 0x8B4513, 0, 0.6, 0);
            addMesh(g, new THREE.SphereGeometry(0.8, 8, 8), 0x2E8B57, 0, 1.8, 0);
        } else if (name.startsWith('block-snow')) {
            const h = name.includes('tall') ? 1.5 : 1;
            addMesh(g, new THREE.BoxGeometry(1, h, 1), 0xcccccc, 0, h / 2, 0);
        } else if (name.startsWith('block-grass')) {
            const h = name.includes('tall') ? 1.5 : 1;
            addMesh(g, new THREE.BoxGeometry(1, h, 1), 0x5a8a4a, 0, h / 2, 0);
        } else if (name.startsWith('door')) {
            addMesh(g, new THREE.BoxGeometry(0.8, 1.2, 0.1), 0x8B4513, 0, 0.6, 0);
        } else if (name.startsWith('fence')) {
            addMesh(g, new THREE.BoxGeometry(1.5, 0.5, 0.08), 0x9E7E56, 0, 0.35, 0);
            addMesh(g, new THREE.BoxGeometry(0.06, 0.7, 0.06), 0x8B7355, -0.6, 0.35, 0);
            addMesh(g, new THREE.BoxGeometry(0.06, 0.7, 0.06), 0x8B7355, 0.6, 0.35, 0);
        } else if (name === 'barrel.glb') {
            addMesh(g, new THREE.CylinderGeometry(0.3, 0.35, 0.7, 8), 0x8B5E3C, 0, 0.35, 0);
        } else if (name.startsWith('crate')) {
            addMesh(g, new THREE.BoxGeometry(0.6, 0.6, 0.6), 0x9E7E56, 0, 0.3, 0);
        } else if (name.startsWith('character-oopi')) {
            addMesh(g, new THREE.BoxGeometry(0.5, 0.8, 0.3), 0xaa3333, 0, 0.6, 0);
            addMesh(g, new THREE.SphereGeometry(0.25, 8, 8), 0xffcc88, 0, 1.25, 0);
        } else if (name.startsWith('character-ooli')) {
            addMesh(g, new THREE.BoxGeometry(0.5, 0.8, 0.3), 0x3355aa, 0, 0.6, 0);
            addMesh(g, new THREE.SphereGeometry(0.25, 8, 8), 0xffcc88, 0, 1.25, 0);
        } else if (name === 'rocks.glb' || name === 'stones.glb') {
            addMesh(g, new THREE.DodecahedronGeometry(0.3), 0x888888, 0, 0.2, 0);
            addMesh(g, new THREE.DodecahedronGeometry(0.2), 0x777777, 0.3, 0.15, 0.1);
        } else if (name === 'sign.glb') {
            addMesh(g, new THREE.CylinderGeometry(0.04, 0.04, 1, 6), 0x8B4513, 0, 0.5, 0);
            addMesh(g, new THREE.BoxGeometry(0.6, 0.35, 0.05), 0xC4A46C, 0, 0.9, 0);
        } else if (name === 'flag.glb') {
            addMesh(g, new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6), 0x8B4513, 0, 0.75, 0);
            addMesh(g, new THREE.BoxGeometry(0.4, 0.25, 0.02), 0xcc2222, 0.2, 1.3, 0);
        } else if (name === 'coin-gold.glb') {
            addMesh(g, new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16), 0xFFD700, 0, 0.1, 0, 0x332200);
        } else if (name === 'ladder.glb') {
            addMesh(g, new THREE.BoxGeometry(0.06, 1.5, 0.06), 0x8B4513, -0.2, 0.75, 0);
            addMesh(g, new THREE.BoxGeometry(0.06, 1.5, 0.06), 0x8B4513, 0.2, 0.75, 0);
            for (let r = 0; r < 4; r++) addMesh(g, new THREE.BoxGeometry(0.34, 0.04, 0.06), 0x9E7E56, 0, 0.3 + r * 0.35, 0);
        } else if (name.startsWith('flowers') || name.startsWith('mushroom') || name === 'grass.glb' || name === 'plant.glb') {
            const colors = { 'flowers.glb': 0xff6699, 'flowers-tall.glb': 0xff99cc, 'mushrooms.glb': 0xcc4444, 'grass.glb': 0x44aa44, 'plant.glb': 0x33aa33 };
            addMesh(g, new THREE.SphereGeometry(0.15, 6, 6), colors[name] || 0x44aa44, 0, 0.15, 0);
        } else {
            addMesh(g, new THREE.BoxGeometry(0.5, 0.5, 0.5), 0xaa66cc, 0, 0.25, 0);
        }
    } catch (e) {
        addMesh(g, new THREE.BoxGeometry(0.3, 0.3, 0.3), 0xff00ff, 0, 0.15, 0);
    }
    return g;
}

async function loadModel(name) {
    if (modelCache[name]) return modelCache[name].clone();
    if (!loader) throw new Error('GLTFLoader not available');
    return new Promise((resolve, reject) => {
        loader.load(ASSET_PATH + name, (gltf) => {
            const model = gltf.scene;
            model.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            modelCache[name] = model;
            resolve(model.clone());
        }, undefined, reject);
    });
}

async function placeModel(name, x, y, z, scale = 1, rotY = 0) {
    let model;
    try {
        model = await loadModel(name);
    } catch (e) {
        model = createFallbackModel(name);
    }
    if (!model) model = createFallbackModel(name);
    model.position.set(x, y, z);
    if (typeof scale === 'number') model.scale.set(scale, scale, scale);
    else model.scale.set(scale[0], scale[1], scale[2]);
    model.rotation.y = rotY;
    scene.add(model);
    return model;
}

// ==================== AUTH ====================
function switchTab(tab) {
    document.getElementById('login-form').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('register-form').style.display = tab === 'register' ? 'block' : 'none';
    const btns = document.querySelectorAll('.tab-btn');
    btns.forEach(b => b.classList.remove('active'));
    btns[tab === 'login' ? 0 : 1].classList.add('active');
}

async function handleRegister() {
    const nick = document.getElementById('reg-nickname').value.trim();
    const pass = document.getElementById('reg-password').value.trim();
    const msg = document.getElementById('auth-message');
    if (!nick || !pass) { msg.textContent = '닉네임과 비밀번호를 입력하세요.'; return; }
    if (nick.length < 2) { msg.textContent = '닉네임은 2자 이상이어야 합니다.'; return; }
    const existing = await dbGet('players/' + nick);
    if (existing) { msg.textContent = '이미 존재하는 닉네임입니다.'; return; }
    await dbSet('players/' + nick, {
        nickname: nick, password: pass,
        x: 0, y: 0, z: 0,
        coins: 0, diamonds: 0, hp: 100, maxHp: 100,
        inventory: {}, tools: {},
        currentStage: 1, completedQuests: [], deaths: 0
    });
    msg.style.color = '#4ade80';
    msg.textContent = '회원가입 성공! 로그인하세요.';
    switchTab('login');
}

async function handleLogin() {
    const nick = document.getElementById('login-nickname').value.trim();
    const pass = document.getElementById('login-password').value.trim();
    const msg = document.getElementById('auth-message');
    if (!nick || !pass) { msg.textContent = '닉네임과 비밀번호를 입력하세요.'; return; }
    const data = await dbGet('players/' + nick);
    if (!data) { msg.textContent = '존재하지 않는 닉네임입니다.'; return; }
    if (data.password !== pass) { msg.textContent = '비밀번호가 틀렸습니다.'; return; }
    currentPlayer = data;
    currentPlayer.nickname = nick;
    if (data.resetOnLogin) {
        currentPlayer.coins = 0;
        currentPlayer.diamonds = 0;
        currentPlayer.hp = 100;
        currentPlayer.maxHp = 100;
        currentPlayer.currentStage = 1;
        currentPlayer.completedQuests = [];
        currentPlayer.inventory = {};
        currentPlayer.deaths = 0;
        currentPlayer.x = 0;
        currentPlayer.y = 0;
        currentPlayer.z = 0;
        currentPlayer.level = 1;
        currentPlayer.xp = 0;
        currentPlayer.kills = 0;
        currentPlayer.defense = 0;
        currentPlayer.attackBonus = 0;
        currentPlayer.equipment = { weapon: null, armor: null, accessory: null };
        await dbSet('players/' + nick, currentPlayer);
    }
    startGame();
}

// ==================== GAME START ====================
async function startGame() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    document.getElementById('player-name-display').textContent = currentPlayer.nickname;

    if (currentPlayer.role === 'admin' || currentPlayer.role === 'superadmin') {
        document.getElementById('admin-menu-btn').style.display = 'inline-block';
    }

    gameState.coins = currentPlayer.coins || 0;
    gameState.diamonds = currentPlayer.diamonds || 0;
    gameState.playerHp = currentPlayer.hp || 100;
    gameState.playerMaxHp = currentPlayer.maxHp || 100;
    gameState.stage = currentPlayer.currentStage || 1;
    gameState.completedQuests = currentPlayer.completedQuests || [];
    gameState.level = currentPlayer.level || 1;
    gameState.xp = currentPlayer.xp || 0;
    gameState.xpToNext = getXPForLevel(gameState.level);
    gameState.kills = currentPlayer.kills || 0;
    gameState.defense = currentPlayer.defense || 0;
    gameState.attackBonus = currentPlayer.attackBonus || 0;
    gameState.skillPoints = currentPlayer.skillPoints || 0;
    if (currentPlayer.skills) gameState.skills = currentPlayer.skills;
    if (currentPlayer.achievements) gameState.achievements = currentPlayer.achievements;
    gameState.title = currentPlayer.title || '';
    if (currentPlayer.materials) gameState.materials = currentPlayer.materials;
    if (currentPlayer.completedSideQuests) gameState.completedSideQuests = currentPlayer.completedSideQuests;
    if (currentPlayer.pet) gameState.pet = currentPlayer.pet;
    if (currentPlayer.equipment) {
        gameState.equipment = currentPlayer.equipment;
        if (gameState.equipment.weapon) gameState.equippedWeapon = gameState.equipment.weapon;
    }
    if (currentPlayer.inventory) {
        Object.values(currentPlayer.inventory).forEach(item => { if (item) gameState.inventory.push(item); });
    }

    updateHUD();
    initThreeJS();
    setupControls();
    detectMobile();

    try {
        await buildWorld();
    } catch (e) {
        console.error('buildWorld error:', e);
    }

    if (gameState.stage === 1 && !gameState.completedQuests.includes('stage1_complete')) {
        startStage1();
    } else if (!gameState.completedQuests.includes('stage2_complete')) {
        startStage2();
    } else {
        showStageComplete('게임 클리어!', 3000);
    }

    renderInventoryGrid();
    renderShop();
    drawRoulette();
    startOnlineSync();
    startChatSync();
    initAudio();
    if (gameState.stage === 3 && !gameState.completedQuests.includes('stage3_complete')) {
        startStage3();
    }
    gameLoop();
}

function initThreeJS() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 60, 250);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    clock = new THREE.Clock();

    // Lighting
    scene.add(new THREE.AmbientLight(0x8899bb, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffeedd, 1.0);
    dirLight.position.set(50, 80, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 200;
    dirLight.shadow.camera.left = -100;
    dirLight.shadow.camera.right = 100;
    dirLight.shadow.camera.top = 100;
    dirLight.shadow.camera.bottom = -100;
    scene.add(dirLight);
    scene.add(new THREE.HemisphereLight(0x87CEEB, 0x362907, 0.4));

    playerBody = new THREE.Group();
    playerBody.position.set(0, PLAYER_HEIGHT, 0);
    scene.add(playerBody);
    playerBody.add(camera);
    camera.position.set(0, 0, 0);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// ==================== WORLD BUILDING ====================
function createBox(w, h, d, color, x, y, z) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshLambertMaterial({ color })
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
}

async function buildWorld() {
    // Ground
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(300, 300),
        new THREE.MeshLambertMaterial({ color: 0x4a7c3f })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Dirt paths
    const pathMat = new THREE.MeshLambertMaterial({ color: 0x8B7355 });
    const path1 = new THREE.Mesh(new THREE.PlaneGeometry(4, 80), pathMat);
    path1.rotation.x = -Math.PI / 2; path1.position.set(0, 0.02, -20); scene.add(path1);
    const path2 = new THREE.Mesh(new THREE.PlaneGeometry(60, 4), pathMat.clone());
    path2.rotation.x = -Math.PI / 2; path2.position.set(10, 0.02, 0); scene.add(path2);

    // Load all 3D assets in parallel
    const tasks = [];

    // === VILLAGE TREES ===
    const treePositions = [
        [-20, 5], [-18, -5], [-25, 10], [15, 8], [18, -8],
        [-10, -15], [12, -12], [-22, 20], [20, 20], [-5, 25],
        [-15, -25], [10, -20], [-8, -35], [8, -35], [-15, -40],
        [12, -42], [-5, -50], [5, -48], [-12, -55], [8, -55]
    ];
    for (const [x, z] of treePositions) {
        const treeName = Math.random() > 0.5 ? 'tree.glb' : 'tree-pine.glb';
        tasks.push(placeModel(treeName, x, 0, z, 2 + Math.random()));
    }

    // === PLAYER HOUSE ===
    // Build with grass blocks
    tasks.push(placeModel('block-grass-large.glb', -8, 0, 5, 3));
    tasks.push(placeModel('block-grass-large-tall.glb', -8, 0, 5, 2.5));
    // Door
    tasks.push(placeModel('door-open.glb', -5.5, 0, 5, 2).then(m => { if(m) buildings.playerDoor = m; }));

    // === OTHER VILLAGE HOUSES ===
    tasks.push(placeModel('block-grass-large-tall.glb', -15, 0, -10, 2.5));
    tasks.push(placeModel('door-open.glb', -12.5, 0, -10, 2));
    tasks.push(placeModel('block-grass-large-tall.glb', 8, 0, 12, 2.5));
    tasks.push(placeModel('door-open.glb', 10.5, 0, 12, 2));
    tasks.push(placeModel('block-grass-large.glb', -12, 0, 15, 2));

    // === CASTLE (Village Chief) ===
    // Castle walls with blocks
    const castleBlocks = [];
    for (let bx = 0; bx < 4; bx++) {
        for (let bz = 0; bz < 3; bz++) {
            tasks.push(placeModel('block-snow-large-tall.glb', 24 + bx * 4, 0, -4 + bz * 4, 2));
        }
    }
    // Castle towers
    for (const [tx, tz] of [[23, -6], [37, -6], [23, 6], [37, 6]]) {
        tasks.push(placeModel('block-snow-large-tall.glb', tx, 0, tz, 1.5));
        tasks.push(placeModel('block-snow-large-tall.glb', tx, 3, tz, 1.5));
        tasks.push(placeModel('flag.glb', tx, 7, tz, 2));
    }
    // Castle door
    tasks.push(placeModel('door-rotate-large.glb', 23, 0, -4, 3).then(m => {
        if (m) {
            m.userData = { name: 'castleDoor', type: 'door', isOpen: false };
            buildings.castleDoor = m;
            interactables.push(m);
        }
    }));

    // === VILLAGE DECORATIONS ===
    // Fences around village
    for (let i = 0; i < 8; i++) {
        tasks.push(placeModel('fence-straight.glb', -25 + i * 7, 0, 30, 2, 0));
    }
    for (let i = 0; i < 8; i++) {
        tasks.push(placeModel('fence-straight.glb', -25 + i * 7, 0, -20, 2, 0));
    }

    // Barrels and crates in village
    tasks.push(placeModel('barrel.glb', -6, 0, 8, 1.5));
    tasks.push(placeModel('barrel.glb', -7, 0, 9, 1.5));
    tasks.push(placeModel('crate.glb', -10, 0, 8, 1.5));
    tasks.push(placeModel('crate-item.glb', 10, 0, 14, 1.5));
    tasks.push(placeModel('barrel.glb', 6, 0, 14, 1.5));

    // Flowers and plants
    for (let i = 0; i < 15; i++) {
        const fx = (Math.random() - 0.5) * 60;
        const fz = (Math.random() - 0.5) * 40 + 5;
        const flowerType = ['flowers.glb', 'flowers-tall.glb', 'grass.glb', 'plant.glb', 'mushrooms.glb'][Math.floor(Math.random() * 5)];
        tasks.push(placeModel(flowerType, fx, 0, fz, 1.5 + Math.random()));
    }

    // Rocks decorations
    tasks.push(placeModel('rocks.glb', -20, 0, 0, 2));
    tasks.push(placeModel('stones.glb', 15, 0, -5, 2));
    tasks.push(placeModel('rocks.glb', -5, 0, -20, 2));

    // Signs
    tasks.push(placeModel('sign.glb', 2, 0, 2, 2, Math.PI));

    // Coins scattered in village (decorative)
    for (let i = 0; i < 5; i++) {
        tasks.push(placeModel('coin-gold.glb', Math.random() * 20 - 10, 0.5, Math.random() * 20 - 5, 1.5));
    }

    // === MOUNTAINS ===
    const mountainGeo = new THREE.ConeGeometry(25, 30, 8);
    const mountain = new THREE.Mesh(mountainGeo, new THREE.MeshLambertMaterial({ color: 0x6B8E23 }));
    mountain.position.set(0, 10, -60); mountain.castShadow = true; scene.add(mountain);
    const m2 = new THREE.Mesh(new THREE.ConeGeometry(20, 25, 8), new THREE.MeshLambertMaterial({ color: 0x556B2F }));
    m2.position.set(-20, 8, -70); scene.add(m2);
    const m3 = new THREE.Mesh(new THREE.ConeGeometry(18, 22, 8), new THREE.MeshLambertMaterial({ color: 0x4a6b3f }));
    m3.position.set(20, 7, -65); scene.add(m3);

    // === SNAKE AREA ===
    const snakeArea = createBox(1, 0.1, 1, 0x333333, 0, 0.05, -45);
    snakeArea.userData = { name: 'snakeArea', type: 'area' };
    buildings.snakeArea = snakeArea;

    // Mountain path decorations
    const mountainPath = new THREE.Mesh(new THREE.PlaneGeometry(3, 40), new THREE.MeshLambertMaterial({ color: 0x7a6b55 }));
    mountainPath.rotation.x = -Math.PI / 2; mountainPath.position.set(0, 0.02, -30); scene.add(mountainPath);

    // === NPC: Village Chief ===
    const chiefModel = await placeModel('character-oopi.glb', 30, 0, 0, 2);
    if (chiefModel) {
        chiefModel.userData = { name: '마을 이장', type: 'npc', dialogueState: 0 };
        npcs.push(chiefModel);
    }

    // === NPC: Villager ===
    const villagerModel = await placeModel('character-ooli.glb', -5, 0, 8, 2);
    if (villagerModel) {
        villagerModel.userData = { name: '마을 주민', type: 'npc', dialogueState: 0 };
        npcs.push(villagerModel);
    }

    // === MINE ENTRANCE ===
    tasks.push(placeModel('block-snow-large-tall.glb', -30, 0, -55, 2).then(m => {
        if (m) { buildings.mineEntrance = m; }
    }));
    tasks.push(placeModel('door-rotate-large.glb', -30, 0, -53.5, 2).then(m => {
        if (m) {
            m.userData = { name: 'mineDoor', type: 'door', isOpen: false };
            buildings.mineDoor = m;
            interactables.push(m);
        }
    }));
    // Mine frame
    tasks.push(placeModel('ladder.glb', -31, 0, -54, 2));
    tasks.push(placeModel('ladder.glb', -29, 0, -54, 2));

    // === STAGE 2 TRACES ===
    await buildStage2Traces();

    // === MINE INTERIOR ===
    buildMineInterior();
    buildFishingSpot();
    buildGatheringSpots();

    await Promise.allSettled(tasks);
}

async function buildStage2Traces() {
    const traces = [
        { pos: [-15, 0, -30], type: 'footprint', text: '검은 발자국이 있다. 누군가 최근에 이곳을 지나간 것 같다.', model: 'stones.glb' },
        { pos: [-20, 0, -35], type: 'branch', text: '부서진 나뭇가지가 있다. 무언가 큰 것이 지나간 흔적이다.', model: 'fence-broken.glb' },
        { pos: [-22, 0, -40], type: 'stone', text: '이상한 돌이 있다. 표면에 알 수 없는 문양이 새겨져 있다.', model: 'rocks.glb' },
        { pos: [-25, 0, -45], type: 'cloth', text: '오래된 천 조각이 있다. 누군가의 옷에서 찢어진 것 같다.', model: 'flag.glb' },
        { pos: [-28, 0, -50], type: 'gear', text: '떨어진 낡은 장비가 있다. 광부의 것으로 보인다.', model: 'crate.glb' }
    ];
    for (const t of traces) {
        const m = await placeModel(t.model, t.pos[0], t.pos[1], t.pos[2], 1.2);
        if (m) {
            m.userData = { name: 'trace_' + t.type, type: 'trace', text: t.text, investigated: false };
            interactables.push(m);
        }
    }
}

function buildMineInterior() {
    const mineY = -10;

    // Mine tunnels
    const tunnelMat = new THREE.MeshLambertMaterial({ color: 0x3a3a2a, side: THREE.BackSide });
    const mainTunnel = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 30), tunnelMat);
    mainTunnel.position.set(-30, mineY + 2, -70); scene.add(mainTunnel);
    const mineFloor = createBox(4, 0.2, 30, 0x4a4a3a, -30, mineY, -70);

    const leftPath = new THREE.Mesh(new THREE.BoxGeometry(15, 4, 4), tunnelMat.clone());
    leftPath.position.set(-38, mineY + 2, -85); scene.add(leftPath);
    createBox(15, 0.2, 4, 0x4a4a3a, -38, mineY, -85);

    const rightPath = new THREE.Mesh(new THREE.BoxGeometry(15, 4, 4), tunnelMat.clone());
    rightPath.position.set(-22, mineY + 2, -85); scene.add(rightPath);
    createBox(15, 0.2, 4, 0x4a4a3a, -22, mineY, -85);

    // Crate with document
    const crate = createBox(1.2, 1, 1.2, 0x5C4033, -30, mineY + 0.5, -83);
    crate.userData = { name: 'mineCrate', type: 'crate', searched: false };
    interactables.push(crate);
    mineObjects.crate = crate;

    // Mine cart
    createBox(1.5, 0.8, 2, 0x666655, -28, mineY + 0.4, -82);

    // Collapse rocks
    const collapseRocks = createBox(4, 4, 3, 0x555544, -30, mineY + 2, -75);
    collapseRocks.visible = false;
    mineObjects.collapseRocks = collapseRocks;

    // Sealed door
    const sealedDoor = createBox(3, 3.5, 0.5, 0x2a2a3a, -15, mineY + 1.75, -85);
    sealedDoor.userData = { name: 'sealedDoor', type: 'sealedDoor', isOpen: false };
    interactables.push(sealedDoor);
    mineObjects.sealedDoor = sealedDoor;

    // Door symbol
    const symbol = new THREE.Mesh(
        new THREE.RingGeometry(0.3, 0.5, 6),
        new THREE.MeshLambertMaterial({ color: 0x7722aa, emissive: 0x330066 })
    );
    symbol.position.set(-15, mineY + 2, -84.7); scene.add(symbol);

    // Activation stones
    const stonePositions = [[-17, mineY + 0.3, -83], [-13, mineY + 0.3, -83], [-15, mineY + 0.3, -87]];
    stonePositions.forEach((pos, i) => {
        const stone = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.4),
            new THREE.MeshLambertMaterial({ color: 0x555577 })
        );
        stone.position.set(pos[0], pos[1], pos[2]);
        stone.userData = { name: 'activationStone_' + i, type: 'activationStone', activated: false, index: i };
        stone.castShadow = true;
        scene.add(stone);
        interactables.push(stone);
    });

    // Boss room
    const bossRoom = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 12), new THREE.MeshLambertMaterial({ color: 0x2a1a2a, side: THREE.BackSide }));
    bossRoom.position.set(-15, mineY + 3, -95); scene.add(bossRoom);
    createBox(12, 0.2, 12, 0x3a2a3a, -15, mineY, -95);

    // Mystery light (hidden)
    const lightSpot = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0x9933ff, transparent: true, opacity: 0.8 })
    );
    lightSpot.position.set(-15, mineY + 1, -95);
    lightSpot.visible = false;
    lightSpot.userData = { name: 'mysteryLight', type: 'mysteryLight' };
    scene.add(lightSpot);
    interactables.push(lightSpot);
    mineObjects.lightSpot = lightSpot;

    const mineLight = new THREE.PointLight(0xffaa44, 0.5, 20);
    mineLight.position.set(-30, mineY + 3, -70);
    scene.add(mineLight);
}

// ==================== CONTROLS ====================
function setupControls() {
    document.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        if (e.code === 'KeyF') handleInteraction();
        if (e.code === 'KeyI') toggleInventory();
        if (e.code === 'KeyP') toggleShop();
        if (e.code === 'KeyR' && !gameState.inCombat) toggleRoulette();
        if (e.code === 'KeyE') toggleEquipment();
        if (e.code === 'KeyT') toggleChat();
        if (e.code === 'KeyL') toggleRanking();
        if (e.code === 'KeyK') toggleSkillTree();
        if (e.code === 'KeyJ') toggleQuestBoard();
        if (e.code === 'KeyC') toggleCrafting();
        if (e.code === 'KeyH') toggleAchievements();
        if (e.code === 'KeyG') togglePetPanel();
        if (e.code === 'Backquote') toggleAdmin();
    });
    document.addEventListener('keyup', (e) => { keys[e.code] = false; });

    const canvas = document.getElementById('game-canvas');
    canvas.addEventListener('click', () => {
        if (!isPointerLocked && !isMobile) canvas.requestPointerLock();
        if (gameState.inCombat && gameState.equippedWeapon) attackEnemy();
    });
    document.addEventListener('pointerlockchange', () => {
        isPointerLocked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', (e) => {
        if (!isPointerLocked) return;
        yaw -= e.movementX * 0.002;
        pitch -= e.movementY * 0.002;
        pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, pitch));
    });

    // Joystick
    const base = document.getElementById('joystick-base');
    const thumb = document.getElementById('joystick-thumb');
    base.addEventListener('touchstart', (e) => { e.preventDefault(); joystickActive = true; });
    base.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!joystickActive) return;
        const t = e.touches[0], r = base.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        let dx = t.clientX - cx, dy = t.clientY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy), max = 40;
        if (dist > max) { dx = dx / dist * max; dy = dy / dist * max; }
        thumb.style.transform = `translate(${dx}px, ${dy}px)`;
        joystickDir = { x: dx / max, y: dy / max };
    });
    base.addEventListener('touchend', () => {
        joystickActive = false;
        thumb.style.transform = 'translate(0,0)';
        joystickDir = { x: 0, y: 0 };
    });

    // Mobile camera
    let lastTouch = null;
    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1 && e.touches[0].clientX > window.innerWidth / 3)
            lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    });
    canvas.addEventListener('touchmove', (e) => {
        if (lastTouch && e.touches.length === 1) {
            const t = e.touches[0];
            yaw -= (t.clientX - lastTouch.x) * 0.005;
            pitch -= (t.clientY - lastTouch.y) * 0.005;
            pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, pitch));
            lastTouch = { x: t.clientX, y: t.clientY };
        }
    });
    canvas.addEventListener('touchend', () => { lastTouch = null; });

    document.getElementById('mobile-attack-btn').addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameState.inCombat && gameState.equippedWeapon) attackEnemy();
    });
    document.getElementById('mobile-interact-btn').addEventListener('touchstart', (e) => {
        e.preventDefault(); handleInteraction();
    });
}

function detectMobile() {
    isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || ('ontouchstart' in window) || (window.innerWidth <= 800);
    if (isMobile) {
        document.getElementById('mobile-joystick').style.display = 'block';
        document.getElementById('mobile-interact-btn').style.display = 'flex';
        document.getElementById('crosshair').style.display = 'none';
    }
}

// ==================== GAME LOOP ====================
function gameLoop() {
    requestAnimationFrame(gameLoop);
    const delta = Math.min(clock.getDelta(), 0.05);
    updatePlayer(delta);
    updateNPCs(delta);
    updateEnemies(delta);
    updateInteractions();
    updateArrow();
    updateMineEffects();
    checkSnakeArea();
    updateOnlineLabels();
    updatePartyDisplay();
    updateDayNight(delta);
    updateWeather(delta);
    updatePet(delta);
    updateFishing();
    renderer.render(scene, camera);
    drawMinimap();
}

function updatePlayer(delta) {
    camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)));
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)));
    const moveDir = new THREE.Vector3();

    if (isMobile && joystickActive) {
        moveDir.add(forward.clone().multiplyScalar(-joystickDir.y));
        moveDir.add(right.clone().multiplyScalar(joystickDir.x));
    } else {
        if (keys['KeyW'] || keys['ArrowUp']) moveDir.add(forward);
        if (keys['KeyS'] || keys['ArrowDown']) moveDir.sub(forward);
        if (keys['KeyA'] || keys['ArrowLeft']) moveDir.sub(right);
        if (keys['KeyD'] || keys['ArrowRight']) moveDir.add(right);
    }

    if (moveDir.length() > 0) {
        moveDir.normalize();
        playerBody.position.x += moveDir.x * PLAYER_SPEED * delta;
        playerBody.position.z += moveDir.z * PLAYER_SPEED * delta;

        if (gameState.stage === 1 && !gameState.hasMovedStage1 && !gameState.completedQuests.includes('chief_talked')) {
            gameState.hasMovedStage1 = true;
            showQuest('마을 이장에게 가기');
            setArrowTarget(new THREE.Vector3(30, 2, 0));
        }
        if (gameState.stage === 2 && !gameState.hasMovedStage2 && gameState.stage2Phase === 0) {
            gameState.hasMovedStage2 = true;
            showQuest('수상한 소문을 조사하기');
        }
    }

    playerBody.position.y = gameState.insideMine ? -10 + PLAYER_HEIGHT : (gameState.insideRuins ? -20 + PLAYER_HEIGHT : PLAYER_HEIGHT);

    if (gameState.insideMine) playBGM('mine');
    else if (gameState.insideRuins) playBGM('ruins');
    else if (gameState.inCombat) playBGM('battle');
    else playBGM('village');
    playerBody.position.x = Math.max(-140, Math.min(140, playerBody.position.x));
    playerBody.position.z = Math.max(-140, Math.min(140, playerBody.position.z));

    checkCollisions();
    if (gameState.stage === 2 && gameState.stage2Phase >= 1) checkTraceProximity();
}

function checkCollisions() {
    const px = playerBody.position.x, pz = playerBody.position.z;
    const castle = { x: 30, z: 0, hw: 7, hd: 6 };
    const door = buildings.castleDoor;
    if (door && !door.userData.isOpen) {
        if (px > castle.x - castle.hw && px < castle.x + castle.hw &&
            pz > castle.z - castle.hd && pz < castle.z + castle.hd) {
            const dx = px - castle.x, dz = pz - castle.z;
            if (Math.abs(dx) / castle.hw > Math.abs(dz) / castle.hd)
                playerBody.position.x = castle.x + (dx > 0 ? castle.hw : -castle.hw);
            else
                playerBody.position.z = castle.z + (dz > 0 ? castle.hd : -castle.hd);
        }
    }
    if (!gameState.insideMine && buildings.mineDoor) {
        if (!buildings.mineDoor.userData.isOpen) {
            if (Math.abs(px - (-30)) < 2 && Math.abs(pz - (-55)) < 1)
                playerBody.position.z = -54;
        } else if (Math.abs(px - (-30)) < 1.5 && Math.abs(pz - (-56)) < 1) {
            enterMine();
        }
    }
    if (gameState.insideMine && gameState.mineCollapsed && mineObjects.collapseRocks && mineObjects.collapseRocks.visible) {
        const rp = mineObjects.collapseRocks.position;
        if (Math.abs(px - rp.x) < 2 && Math.abs(pz - rp.z) < 1.5)
            playerBody.position.z = rp.z + 1.5;
    }
}

function checkTraceProximity() {
    interactables.forEach(obj => {
        if (obj.userData.type === 'trace' && !obj.userData.investigated) {
            if (playerBody.position.distanceTo(obj.position) < 3) {
                obj.userData.investigated = true;
                gameState.mineTracesFound++;
                showInvestigationText(obj.userData.text);
            }
        }
    });
}

// ==================== NPC ====================
function updateNPCs(delta) {
    npcs.forEach(npc => {
        npc.position.y = Math.sin(Date.now() * 0.002) * 0.05;
    });
}

// ==================== ENEMY SYSTEM ====================
function spawnSnake(x, y, z) {
    const group = new THREE.Group();

    const texLoader = new THREE.TextureLoader();
    let spriteLoaded = false;
    try {
        const tex = texLoader.load('assets/textures/snake.png',
            () => { spriteLoaded = true; },
            undefined,
            () => { if (!spriteLoaded) buildGeometrySnake(group); }
        );
        tex.encoding = THREE.sRGBEncoding;
        const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(4, 2, 1);
        sprite.position.set(0, 1, 0);
        sprite.userData.isSprite = true;
        group.add(sprite);
    } catch (e) {
        buildGeometrySnake(group);
    }

    group.position.set(x, y, z);
    group.userData = { name: '독사', type: 'enemy', hp: 50, maxHp: 50, damage: [1, 5], attackCooldown: 0, attackInterval: 2 };
    scene.add(group);
    enemies.push(group);
    return group;
}

function buildGeometrySnake(group) {
    if (group.children.length > 0) return;
    const green = new THREE.MeshLambertMaterial({ color: 0x228B22 });
    const darkGreen = new THREE.MeshLambertMaterial({ color: 0x006400 });
    const brown = new THREE.MeshLambertMaterial({ color: 0x8B5E3C });

    // Body segments - coiled shape
    for (let i = 0; i < 8; i++) {
        const r = 0.22 - i * 0.02;
        const seg = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), i % 2 === 0 ? green : darkGreen);
        const angle = i * 0.6;
        seg.position.set(Math.sin(angle) * 0.5, r, i * 0.25 - 0.5);
        seg.scale.set(1, 0.7, 1.2);
        seg.castShadow = true;
        group.add(seg);
    }
    // Belly (brown underside)
    const belly = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 1.8), brown);
    belly.position.set(0, 0.05, 0.3);
    group.add(belly);

    // Head - triangular
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.5, 4), darkGreen);
    head.rotation.x = -Math.PI / 2;
    head.position.set(0, 0.35, -0.7);
    head.castShadow = true;
    group.add(head);

    // Eyes - dark with red pupil
    for (const sx of [0.12, -0.12]) {
        const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), new THREE.MeshBasicMaterial({ color: 0x332200 }));
        eyeWhite.position.set(sx, 0.42, -0.8);
        group.add(eyeWhite);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), new THREE.MeshBasicMaterial({ color: 0xcc0000 }));
        pupil.position.set(sx, 0.43, -0.85);
        group.add(pupil);
    }

    // Tongue
    const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.3), new THREE.MeshBasicMaterial({ color: 0xcc0000 }));
    tongue.position.set(0, 0.32, -1.0);
    group.add(tongue);
    // Tongue fork
    for (const sx of [0.03, -0.03]) {
        const fork = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.1), new THREE.MeshBasicMaterial({ color: 0xcc0000 }));
        fork.position.set(sx, 0.32, -1.18);
        fork.rotation.y = sx > 0 ? 0.3 : -0.3;
        group.add(fork);
    }

    // Tail - thin and tapered
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.6, 6), green);
    tail.rotation.x = Math.PI / 2;
    tail.position.set(0, 0.12, 1.6);
    group.add(tail);
}

function spawnShadowBoss(x, y, z) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 1.5), new THREE.MeshLambertMaterial({ color: 0x1a0a2e, emissive: 0x110022 }));
    body.position.y = 1.5; body.castShadow = true; group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 12), new THREE.MeshLambertMaterial({ color: 0x220044, emissive: 0x110022 }));
    head.position.y = 3.3; head.castShadow = true; group.add(head);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff00ff });
    for (const sx of [-0.3, 0.3]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), eyeMat);
        eye.position.set(sx, 3.4, -0.6); group.add(eye);
    }
    for (const side of [-1, 1]) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1, 6), new THREE.MeshLambertMaterial({ color: 0x330044 }));
        claw.position.set(side * 1.3, 2, -0.5); claw.rotation.z = side * 0.3; group.add(claw);
    }
    group.position.set(x, y, z);
    group.userData = {
        name: '폐광의 그림자', type: 'enemy', hp: 150, maxHp: 150,
        damage: [2, 6], attackCooldown: 0, attackInterval: 2.5,
        phase: 1, specialCooldown: 0, teleportCooldown: 0, roarCooldown: 0
    };
    scene.add(group); enemies.push(group);
    return group;
}

function updateEnemies(delta) {
    enemies.forEach(enemy => {
        if (!enemy.userData || enemy.userData.hp <= 0) return;
        const dist = playerBody.position.distanceTo(enemy.position);
        const data = enemy.userData;
        const dir = new THREE.Vector3().subVectors(playerBody.position, enemy.position);
        dir.y = 0;
        if (dir.length() > 0.1) enemy.rotation.y = Math.atan2(dir.x, dir.z);

        if (data.name === '독사') {
            data.attackCooldown -= delta;
            enemy.children.forEach((c, i) => { if (i < 5) c.position.x = Math.sin(Date.now() * 0.003 + i * 0.8) * 0.15; });
            if (dist < 15 && dist > 3) enemy.position.add(dir.normalize().multiplyScalar(3 * delta));
            if (data.attackCooldown <= 0 && dist < 8) {
                damagePlayer(randomInt(data.damage[0], data.damage[1]));
                spawnProjectile(enemy.position.clone(), 0x00ff00);
                data.attackCooldown = data.attackInterval;
            }
        } else if (data.name === '폐광의 그림자') {
            data.attackCooldown -= delta;
            data.specialCooldown -= delta;
            data.teleportCooldown -= delta;
            enemy.position.y = (gameState.insideMine ? -10 : 0) + Math.sin(Date.now() * 0.002) * 0.3;

            if (dist > 4) {
                const mv = dir.normalize().multiplyScalar(4 * delta);
                enemy.position.x += mv.x; enemy.position.z += mv.z;
            }
            if (data.hp <= data.maxHp / 2 && data.phase === 1) {
                data.phase = 2; data.attackInterval = 2;
                showInvestigationText('폐광의 그림자가 더 강해졌다!');
            }
            if (data.attackCooldown <= 0) {
                if (dist < 5) {
                    damagePlayer(randomInt(2, 6));
                    showInvestigationText('검은 발톱 공격!');
                    data.attackCooldown = data.attackInterval;
                } else if (dist < 15 && data.specialCooldown <= 0) {
                    damagePlayer(randomInt(3, 8));
                    spawnProjectile(enemy.position.clone(), 0x6600cc);
                    showInvestigationText('어둠의 구체!');
                    data.specialCooldown = 4;
                    data.attackCooldown = data.attackInterval;
                }
            }
            if (data.teleportCooldown <= 0 && dist < 12) {
                data.teleportCooldown = 8;
                const behind = new THREE.Vector3(0, 0, 3).applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)));
                enemy.position.x = playerBody.position.x + behind.x;
                enemy.position.z = playerBody.position.z + behind.z;
                showInvestigationText('그림자 이동!');
            }
            if (data.phase === 2) {
                if (data.roarCooldown === undefined) data.roarCooldown = 12;
                data.roarCooldown -= delta;
                if (data.roarCooldown <= 0) {
                    data.roarCooldown = 12;
                    damagePlayer(randomInt(5, 10));
                    shakeScreen();
                    showInvestigationText('어둠의 포효!');
                }
            }
        } else if (data.name === '고대의 수호자') {
            data.attackCooldown -= delta;
            data.specialCooldown -= delta;
            enemy.position.y = (gameState.insideRuins ? -20 : 0) + Math.sin(Date.now() * 0.001) * 0.2;

            if (dist > 4) {
                const mv = dir.normalize().multiplyScalar(3 * delta);
                enemy.position.x += mv.x; enemy.position.z += mv.z;
            }
            if (data.hp <= data.maxHp / 2 && data.phase === 1) {
                data.phase = 2; data.attackInterval = 1.5;
                showInvestigationText('수호자가 분노한다!');
                shakeScreen();
            }
            if (data.attackCooldown <= 0 && dist < 6) {
                damagePlayer(randomInt(data.damage[0], data.damage[1]));
                showInvestigationText('돌 주먹!');
                data.attackCooldown = data.attackInterval;
            }
            if (data.specialCooldown <= 0 && dist < 15) {
                data.specialCooldown = 5;
                for (let i = 0; i < 3; i++) {
                    const angle = (Math.PI * 2 / 3) * i;
                    spawnProjectile(enemy.position.clone().add(new THREE.Vector3(Math.sin(angle) * 2, 1, Math.cos(angle) * 2)), 0xffaa00);
                }
                damagePlayer(randomInt(3, 7));
                showInvestigationText('고대의 파동!');
            }
        }
    });
}

function spawnProjectile(from, color) {
    const proj = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 8),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 })
    );
    proj.position.copy(from); proj.position.y += 0.5;
    scene.add(proj);
    setTimeout(() => scene.remove(proj), 1000);
}

function attackEnemy() {
    if (!gameState.equippedWeapon || !gameState.inCombat) return;
    const enemy = enemies.find(e => e.userData.hp > 0);
    if (!enemy) return;
    if (playerBody.position.distanceTo(enemy.position) > 5) {
        showInvestigationText('너무 멀다!'); return;
    }
    const baseDmg = randomInt(gameState.equippedWeapon.minDmg, gameState.equippedWeapon.maxDmg);
    let dmg = baseDmg + gameState.attackBonus + gameState.skills.strength;
    const critChance = 0.05 + gameState.skills.critical * 0.03;
    if (Math.random() < critChance) { dmg = Math.floor(dmg * 2); showInvestigationText('크리티컬!'); }
    enemy.userData.hp -= dmg;
    playSFX('attack');
    showDamageNumber(dmg, enemy.position);
    enemy.children.forEach(c => {
        if (c.material) {
            const orig = c.material.color.getHex();
            c.material.color.setHex(0xffffff);
            setTimeout(() => c.material.color.setHex(orig), 100);
        }
    });
    updateEnemyHP(enemy);
    if (enemy.userData.hp <= 0) onEnemyDeath(enemy);
}

function onEnemyDeath(enemy) {
    scene.remove(enemy);
    enemies = enemies.filter(e => e !== enemy);
    document.getElementById('enemy-hp-container').style.display = 'none';
    gameState.inCombat = false;
    gameState.kills++;
    if (isMobile) document.getElementById('mobile-attack-btn').style.display = 'none';
    playSFX('kill');
    dropMaterials(enemy.userData.name);
    checkAchievements();
    updateSideQuestProgress('kill', enemy.userData.name);

    if (enemy.userData.name === '독사') {
        gainXP(20);
        addCoins(5);
        showQuest('퀘스트 완료: 독사 죽이기');
        setTimeout(() => {
            showQuest('마을 이장에게 가기');
            setArrowTarget(new THREE.Vector3(30, 2, 0));
            gameState.quest = 'return_chief';
        }, 2000);
    } else if (enemy.userData.name === '폐광의 그림자') {
        gainXP(100);
        addCoins(30);
        showQuest('퀘스트 완료: 폐광의 그림자를 처치하기');
        if (mineObjects.lightSpot) {
            mineObjects.lightSpot.visible = true;
            mineObjects.lightSpot.position.copy(enemy.position);
            mineObjects.lightSpot.position.y = (gameState.insideMine ? -10 : 0) + 1;
        }
        setTimeout(() => { showQuest('이상한 빛의 정체 확인하기'); gameState.quest = 'check_light'; }, 2000);
    } else if (enemy.userData.name === '고대의 수호자') {
        gainXP(200);
        addCoins(100);
        addDiamonds(10);
        showQuest('퀘스트 완료: 고대의 수호자를 처치하기');
        setTimeout(() => {
            addToInventory({ name: '고대의 유물', icon: '🏺', type: 'special', desc: '고대 유적에서 발견된 신비한 유물.' });
            showItemNotification('고대의 유물을 획득했습니다!');
            showQuest('마을로 돌아가기');
            gameState.quest = 'return_village_s3';
            setArrowTarget(new THREE.Vector3(-5, 0, 8));
            if (gameState.insideRuins) exitRuins();
        }, 2000);
    }
    saveGameData();
}

function updateEnemyHP(enemy) {
    document.getElementById('enemy-hp-container').style.display = 'block';
    document.getElementById('enemy-name').textContent = enemy.userData.name;
    const pct = Math.max(0, enemy.userData.hp / enemy.userData.maxHp * 100);
    document.getElementById('enemy-hp-bar').style.width = pct + '%';
    document.getElementById('enemy-hp-text').textContent = `HP: ${Math.max(0, enemy.userData.hp)} / ${enemy.userData.maxHp}`;
}

// ==================== INTERACTIONS ====================
function updateInteractions() {
    let found = false;
    const playerPos = playerBody.position;
    const lookDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);

    npcs.forEach(npc => {
        const dist = playerPos.distanceTo(npc.position);
        if (dist < 4) {
            const toNpc = new THREE.Vector3().subVectors(npc.position, playerPos).normalize();
            if (lookDir.dot(toNpc) > 0.5) {
                found = true; gameState.canInteract = true; gameState.interactTarget = npc;
            }
        }
    });

    interactables.forEach(obj => {
        if (!obj.visible) return;
        const dist = playerPos.distanceTo(obj.position);
        if (dist < 4) {
            const toObj = new THREE.Vector3().subVectors(obj.position, playerPos).normalize();
            if (lookDir.dot(toObj) > 0.3 || dist < 2) {
                found = true; gameState.canInteract = true; gameState.interactTarget = obj;
            }
        }
    });

    enemies.forEach(enemy => {
        if (enemy.userData.hp <= 0) return;
        const dist = playerPos.distanceTo(enemy.position);
        const toEnemy = new THREE.Vector3().subVectors(enemy.position, playerPos).normalize();
        if (dist < 15 && lookDir.dot(toEnemy) > 0.3 && !gameState.inCombat) startCombat(enemy);
    });

    document.getElementById('interact-prompt').style.display = (found && !gameState.inDialogue) ? 'block' : 'none';
}

function handleInteraction() {
    if (gameState.inDialogue) { advanceDialogue(); return; }
    if (!gameState.canInteract || !gameState.interactTarget) return;
    const data = gameState.interactTarget.userData;

    if (data.type === 'npc') handleNPCInteraction(gameState.interactTarget);
    else if (data.type === 'door') handleDoorInteraction(gameState.interactTarget);
    else if (data.type === 'crate') handleCrateInteraction(gameState.interactTarget);
    else if (data.type === 'activationStone') handleStoneInteraction(gameState.interactTarget);
    else if (data.type === 'sealedDoor') handleSealedDoorInteraction();
    else if (data.type === 'mysteryLight') handleMysteryLightInteraction(gameState.interactTarget);
    else if (data.type === 'tablet' && !data.investigated) {
        data.investigated = true;
        gameState.tabletsFound++;
        showInvestigationText(data.text);
        showItemNotification('석판 발견! (' + gameState.tabletsFound + '/3)');
        if (gameState.tabletsFound >= 3) {
            setTimeout(() => {
                showInvestigationText('수호자의 방이 열렸다!');
                shakeScreen();
                if (buildings.guardianDoor) buildings.guardianDoor.position.y = -25;
                gameState.quest = 'fight_guardian';
                showQuest('고대의 수호자를 처치하기');
                setTimeout(() => spawnAncientGuardian(), 2000);
            }, 1500);
        }
    }
    else if (data.type === 'sealedDoor2') {
        if (gameState.tabletsFound < 3) showInvestigationText('석판 ' + gameState.tabletsFound + '/3 - 더 많은 석판이 필요하다.');
    }
    else if (data.type === 'trace' && !data.investigated) {
        data.investigated = true; gameState.mineTracesFound++;
        showInvestigationText(data.text);
    }
    else if (data.type === 'gather') {
        if (data.gathered) { showInvestigationText('이미 채집했습니다. 잠시 후 다시 시도하세요.'); return; }
        const mat = data.material;
        const amt = 1 + Math.floor(Math.random() * 2);
        gameState.materials[mat] = (gameState.materials[mat] || 0) + amt;
        showItemNotification(mat + ' x' + amt + ' 획득!');
        updateSideQuestProgress('collect', mat);
        data.gathered = true;
        gameState.interactTarget.visible = false;
        setTimeout(() => { data.gathered = false; gameState.interactTarget.visible = true; }, 15000);
        saveGameData();
    }
}

// ==================== NPC DIALOGUES ====================
// handleNPCInteraction is defined below with stage 3 NPC support

function handleChiefDialogue() {
    if (gameState.quest === 'return_chief') {
        startDialogue('마을 이장', ['고맙구나. 너는 무시무시한 독사를 죽여 줘서 고맙다.'], () => {
            addCoins(50);
            const freshSword = { name: '신선한 칼', icon: '🗡️', type: 'weapon', minDmg: 2, maxDmg: 6, desc: '신선한 칼. 대미지: 2~6' };
            addToInventory(freshSword);
            gameState.equippedWeapon = freshSword;
            showItemNotification('50 코인과 신선한 칼을 받았습니다!');
            gameState.completedQuests.push('stage1_complete');
            gameState.quest = null; clearArrow();
            setTimeout(() => {
                showStageComplete('1 STAGE CLEAR!', 3000);
                setTimeout(() => startStage2(), 4000);
            }, 2000);
        });
    } else if (!gameState.completedQuests.includes('chief_talked')) {
        startDialogue('마을 이장', [
            '여기는 미스테리 마을이다.',
            '너가 마을에서 태어난 것을 축하한다.',
            '저기 산에 있는 독사를 죽이고 다시 오렴.'
        ], () => {
            gameState.completedQuests.push('chief_talked');
            addCoins(20);
            const rustySword = { name: '녹슨 칼', icon: '🔪', type: 'weapon', minDmg: 1, maxDmg: 7, desc: '녹슨 칼. 대미지: 1~7' };
            addToInventory(rustySword);
            gameState.equippedWeapon = rustySword;
            showItemNotification('녹슨 칼과 20코인을 받았습니다!');
            showQuest('뒷산으로 가기');
            setArrowTarget(new THREE.Vector3(0, 1, -45));
            gameState.quest = 'go_mountain';
        });
    }
}

function handleVillagerDialogue() {
    if (gameState.stage === 2 && gameState.stage2Phase === 0) {
        startDialogue('마을 주민', [
            '요즘 밤마다 산에서 이상한 빛이 보인단다.',
            '특히 오래된 폐광 근처에서 이상한 소리가 들린다고 하더구나.',
            '조심해서 조사해 보거라.'
        ], () => {
            gameState.stage2Phase = 1;
            showQuest('폐광으로 가기');
            setArrowTarget(new THREE.Vector3(-30, 2, -55));
        });
    } else if (gameState.quest === 'return_village') {
        startDialogue('마을 주민', [
            '뭐라고? 폐광에서 그걸 발견했다고?',
            '그렇다면 네가 찾은 것은 오래전부터 전해 내려오는 미스터리의 조각일 거야.',
            '아직 모든 미스터리가 밝혀진 것은 아니란다.'
        ], () => {
            gameState.completedQuests.push('stage2_complete');
            gameState.quest = null; clearArrow();
            addCoins(100); addDiamonds(5);
            showItemNotification('2스테이지 완료! 코인 +100, 다이아몬드 +5');
            setTimeout(() => {
                showStageComplete('2 STAGE CLEAR!', 4000);
                gameState.stage = 3; saveGameData();
                setTimeout(() => startStage3(), 5000);
            }, 2000);
        });
    } else if (gameState.quest === 'return_village_s3') {
        startDialogue('마을 주민', [
            '그건... 고대의 유물이 아닌가!',
            '전설에 따르면, 이 유물에는 이 세계의 비밀이 담겨 있다고 한다.',
            '네가 진정한 모험가라는 것을 증명했구나. 축하한다!'
        ], () => {
            gameState.completedQuests.push('stage3_complete');
            gameState.quest = null; clearArrow();
            addCoins(200); addDiamonds(20);
            showItemNotification('3스테이지 완료! 코인 +200, 다이아몬드 +20');
            setTimeout(() => showStageComplete('3 STAGE CLEAR! 게임 클리어!', 5000), 2000);
            saveGameData();
        });
    } else {
        startDialogue('마을 주민', ['좋은 하루 되거라.'], null);
    }
}

// ==================== DIALOGUE ====================
function startDialogue(speaker, lines, callback) {
    gameState.inDialogue = true;
    gameState.dialogueQueue = [...lines];
    gameState.dialogueCallback = callback;
    document.getElementById('dialogue-box').style.display = 'block';
    document.getElementById('dialogue-speaker').textContent = speaker;
    document.getElementById('dialogue-text').textContent = gameState.dialogueQueue.shift();
    document.getElementById('interact-prompt').style.display = 'none';
    document.getElementById('dialogue-prompt').textContent =
        gameState.dialogueQueue.length === 0 && !callback ? 'F키를 눌러 닫기' : 'F키를 누르시오.';
}

function advanceDialogue() {
    if (gameState.dialogueQueue.length > 0) {
        document.getElementById('dialogue-text').textContent = gameState.dialogueQueue.shift();
        if (gameState.dialogueQueue.length === 0 && !gameState.dialogueCallback)
            document.getElementById('dialogue-prompt').textContent = 'F키를 눌러 닫기';
    } else {
        document.getElementById('dialogue-box').style.display = 'none';
        gameState.inDialogue = false;
        if (gameState.dialogueCallback) { gameState.dialogueCallback(); gameState.dialogueCallback = null; }
    }
}

// ==================== DOORS ====================
// handleDoorInteraction is defined below with stage 3 support

// ==================== MINE ====================
function enterMine() {
    if (gameState.insideMine) return;
    gameState.insideMine = true;
    playerBody.position.set(-30, -10 + PLAYER_HEIGHT, -60);
    scene.background = new THREE.Color(0x111111);
    scene.fog = new THREE.Fog(0x111111, 5, 30);
    const flashlight = new THREE.SpotLight(0xffffcc, 1.5, 25, Math.PI / 5, 0.5);
    flashlight.position.set(0, 0, 0);
    flashlight.target.position.set(0, 0, -1);
    camera.add(flashlight); camera.add(flashlight.target);
    showQuest('폐광 조사하기');
    startMineSounds();
}

function exitMine() {
    gameState.insideMine = false;
    playerBody.position.set(-30, PLAYER_HEIGHT, -52);
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 60, 250);
    camera.children.forEach(child => { if (child.isSpotLight) camera.remove(child); });
}

function startMineSounds() {
    const sounds = ['...발자국 소리가 들린다...', '...금속이 떨어지는 소리...', '...멀리서 울음소리가 들린다...', '...갑자기 큰 소리가 들렸다!...'];
    const play = () => {
        if (!gameState.insideMine) return;
        showInvestigationText(sounds[Math.floor(Math.random() * sounds.length)]);
        setTimeout(play, 5000 + Math.random() * 10000);
    };
    setTimeout(play, 3000);
}

function updateMineEffects() {
    if (mineObjects.lightSpot && mineObjects.lightSpot.visible) {
        const s = 1 + Math.sin(Date.now() * 0.003) * 0.3;
        mineObjects.lightSpot.scale.set(s, s, s);
        mineObjects.lightSpot.material.opacity = 0.5 + Math.sin(Date.now() * 0.005) * 0.3;
    }
}

// ==================== MINE INTERACTIONS ====================
function handleCrateInteraction(crate) {
    if (crate.userData.searched) return;
    crate.userData.searched = true;
    const doc = { name: '이상한 문서', icon: '📜', type: 'document', desc: '오래된 문서. 읽어보자.',
        content: '산 깊은 곳에 있는 문을 열지 마라. 그 안에는 잠들어 있는 것이 있다.' };
    addToInventory(doc);
    showItemNotification('이상한 문서를 발견했습니다!');
    showQuest('이상한 문서 읽기');
    gameState.quest = 'read_document';
    setTimeout(() => showDocument(doc), 1000);
}

function handleStoneInteraction(stone) {
    if (stone.userData.activated) return;
    stone.userData.activated = true;
    gameState.stonesActivated++;
    stone.material.color.setHex(0xaa44ff);
    stone.material.emissive = new THREE.Color(0x6622aa);
    showInvestigationText(`봉인석 활성화 (${gameState.stonesActivated}/3)`);
    if (gameState.stonesActivated >= 3) {
        setTimeout(() => {
            showInvestigationText('봉인된 문이 열리고 있다!');
            shakeScreen();
            if (mineObjects.sealedDoor) mineObjects.sealedDoor.position.y = -15;
            gameState.quest = 'enter_boss';
            showQuest('폐광의 그림자를 처치하기');
            setTimeout(() => {
                spawnShadowBoss(-15, gameState.insideMine ? -10 : 0, -95);
                gameState.bossRoomReached = true;
            }, 2000);
        }, 1000);
    }
}

function handleSealedDoorInteraction() {
    if (gameState.stonesActivated < 3) {
        showInvestigationText('문 너머에서 무언가 움직이고 있다.');
        showQuest('봉인된 문 조사하기');
        gameState.quest = 'investigate_seal';
    }
}

function handleMysteryLightInteraction(light) {
    showInvestigationText('이건 단순한 빛이 아니다.');
    addToInventory({ name: '미스터리의 조각', icon: '💎', type: 'special', desc: '이상한 보라색 빛에서 나온 미스터리의 조각.' });
    showItemNotification('미스터리의 조각을 획득했습니다!');
    light.visible = false;
    setTimeout(() => {
        showQuest('마을로 돌아가기');
        gameState.quest = 'return_village';
        setArrowTarget(new THREE.Vector3(-5, 0, 8));
        exitMine();
    }, 2000);
}

function showDocument(doc) {
    document.getElementById('doc-title').textContent = doc.name;
    document.getElementById('doc-content').textContent = doc.content;
    document.getElementById('document-viewer').style.display = 'block';
    gameState.documentRead = true;
}

function closeDocument() {
    document.getElementById('document-viewer').style.display = 'none';
    if (gameState.quest === 'read_document') {
        shakeScreen();
        showInvestigationText('갑자기 큰 소리가 났다!');
        setTimeout(() => {
            flickerLights();
            showQuest('폐광에서 탈출하기');
            gameState.quest = 'escape_mine';
            gameState.mineCollapsed = true;
            if (mineObjects.collapseRocks) mineObjects.collapseRocks.visible = true;
            setArrowTarget(new THREE.Vector3(-15, -10, -85));
        }, 1500);
    }
}

function flickerLights() {
    scene.background = new THREE.Color(0x000000);
    setTimeout(() => { scene.background = new THREE.Color(0x111111); }, 300);
    setTimeout(() => { scene.background = new THREE.Color(0x000000); }, 600);
    setTimeout(() => { scene.background = new THREE.Color(0x111111); }, 900);
}

// ==================== COMBAT ====================
function startCombat(enemy) {
    gameState.inCombat = true;
    gameState.currentEnemy = enemy;
    updateEnemyHP(enemy);
    if (enemy.userData.name === '독사') {
        showQuest('독사 죽이기');
        if (gameState.snakeDeaths > 0 && gameState.equippedWeapon && gameState.equippedWeapon.name === '녹슨 칼') {
            gameState.equippedWeapon.minDmg = 1;
            gameState.equippedWeapon.maxDmg = 5;
        }
    }
    if (isMobile) document.getElementById('mobile-attack-btn').style.display = 'flex';
}

function damagePlayer(dmg) {
    if (godMode) return;
    const dodgeChance = gameState.skills.agility * 0.03;
    if (Math.random() < dodgeChance) { showInvestigationText('회피!'); return; }
    const totalDef = gameState.defense + (gameState.equipment.armor ? gameState.equipment.armor.defense || 0 : 0) + (gameState.equipment.accessory ? gameState.equipment.accessory.defense || 0 : 0) + Math.floor(gameState.skills.vitality * 0.5);
    dmg = Math.max(1, dmg - totalDef);
    gameState.playerHp -= dmg;
    playSFX('hit');
    showDamageNumber(dmg, playerBody.position, true);
    updateHUD();
    const flash = document.createElement('div');
    flash.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,0,0,0.2);z-index:999;pointer-events:none;';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 200);
    if (gameState.playerHp <= 0) playerDeath();
}

function playerDeath() {
    gameState.playerHp = 0; updateHUD();
    document.getElementById('death-screen').style.display = 'flex';
    if (gameState.currentEnemy && gameState.currentEnemy.userData.name === '독사') gameState.snakeDeaths++;
}

function respawnPlayer() {
    document.getElementById('death-screen').style.display = 'none';
    gameState.playerHp = gameState.playerMaxHp; updateHUD();
    if (gameState.currentEnemy) {
        const enemy = gameState.currentEnemy;
        if (enemy.userData.name === '독사') {
            if (gameState.insideMine) exitMine();
            playerBody.position.set(0, PLAYER_HEIGHT, -30);
        } else if (enemy.userData.name === '폐광의 그림자') {
            playerBody.position.set(-15, -10 + PLAYER_HEIGHT, -88);
        }
        enemy.userData.hp = enemy.userData.maxHp;
        updateEnemyHP(enemy);
        gameState.inCombat = false;
        document.getElementById('enemy-hp-container').style.display = 'none';
    } else {
        playerBody.position.set(0, PLAYER_HEIGHT, 0);
        if (gameState.insideMine) exitMine();
    }
}

// ==================== STAGES ====================
function startStage1() {
    gameState.stage = 1;
    playerBody.position.set(0, PLAYER_HEIGHT, 5);
    yaw = 0; pitch = 0;
}

function startStage2() {
    gameState.stage = 2;
    gameState.stage2Phase = 0; gameState.hasMovedStage2 = false;
    gameState.mineTracesFound = 0; gameState.stonesActivated = 0;
    gameState.mineCollapsed = false; gameState.documentRead = false;
    gameState.bossRoomReached = false;
    showStageComplete('2스테이지 시작', 2500);
    setTimeout(() => {
        playerBody.position.set(-6, PLAYER_HEIGHT, 5);
        yaw = 0; pitch = 0;
        if (gameState.insideMine) exitMine();
    }, 2500);
}

function showStageComplete(text, duration) {
    const el = document.getElementById('stage-transition');
    document.getElementById('stage-text').textContent = text;
    el.style.display = 'flex';
    setTimeout(() => { el.style.display = 'none'; }, duration);
}

let snakeSpawned = false;
function checkSnakeArea() {
    if (snakeSpawned || !playerBody) return;
    if (playerBody.position.distanceTo(new THREE.Vector3(0, PLAYER_HEIGHT, -45)) < 15 && gameState.quest === 'go_mountain') {
        snakeSpawned = true;
        spawnSnake(0, 0, -45);
    }
}

// ==================== ARROW ====================
function setArrowTarget(target) {
    if (arrowHelper) scene.remove(arrowHelper);
    const arrowMesh = new THREE.Mesh(
        new THREE.ConeGeometry(0.3, 1, 8),
        new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.8 })
    );
    arrowMesh.userData = { target };
    scene.add(arrowMesh);
    arrowHelper = arrowMesh;
}

function clearArrow() {
    if (arrowHelper) { scene.remove(arrowHelper); arrowHelper = null; }
}

function updateArrow() {
    if (!arrowHelper) return;
    const target = arrowHelper.userData.target;
    const dir = new THREE.Vector3().subVectors(target, playerBody.position).normalize();
    arrowHelper.position.copy(playerBody.position);
    arrowHelper.position.y += 2.5 + Math.sin(Date.now() * 0.003) * 0.3;
    arrowHelper.position.add(dir.clone().multiplyScalar(3));
    arrowHelper.lookAt(target);
    arrowHelper.rotateX(Math.PI / 2);
}

// ==================== INVENTORY ====================
function addToInventory(item) {
    if (gameState.inventory.length >= 18) { showInvestigationText('인벤토리가 가득 찼습니다!'); return false; }
    gameState.inventory.push(item);
    renderInventoryGrid(); saveGameData();
    return true;
}

function renderInventoryGrid() {
    const grid = document.getElementById('inventory-grid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 0; i < 18; i++) {
        const slot = document.createElement('div');
        slot.className = 'inv-slot' + (gameState.inventory[i] ? ' has-item' : '');
        if (gameState.inventory[i]) {
            slot.textContent = gameState.inventory[i].icon || '?';
            slot.onclick = () => showItemDetail(i);
        }
        grid.appendChild(slot);
    }
}

function showItemDetail(index) {
    const item = gameState.inventory[index];
    if (!item) return;
    document.getElementById('item-detail').style.display = 'block';
    document.getElementById('item-detail-name').textContent = item.name;
    document.getElementById('item-detail-desc').textContent = item.desc || '';
    const useBtn = document.getElementById('item-use-btn');
    if (item.type === 'weapon') {
        useBtn.style.display = 'block'; useBtn.textContent = '장착';
        useBtn.onclick = () => { equipFromInventory(index, 'weapon'); };
    } else if (item.type === 'armor') {
        useBtn.style.display = 'block'; useBtn.textContent = '장착';
        useBtn.onclick = () => { equipFromInventory(index, 'armor'); };
    } else if (item.type === 'accessory') {
        useBtn.style.display = 'block'; useBtn.textContent = '장착';
        useBtn.onclick = () => { equipFromInventory(index, 'accessory'); };
    } else if (item.type === 'potion') {
        useBtn.style.display = 'block'; useBtn.textContent = '사용';
        useBtn.onclick = () => {
            gameState.playerHp = Math.min(gameState.playerMaxHp, gameState.playerHp + (item.heal || 30));
            gameState.inventory.splice(index, 1);
            updateHUD(); renderInventoryGrid();
            document.getElementById('item-detail').style.display = 'none';
            showInvestigationText(item.name + ' 사용!');
            saveGameData();
        };
    } else if (item.type === 'document') {
        useBtn.style.display = 'block'; useBtn.textContent = '읽기';
        useBtn.onclick = () => showDocument(item);
    } else { useBtn.style.display = 'none'; }
}

function toggleInventory() {
    const el = document.getElementById('inventory-screen');
    const isOpen = el.style.display !== 'none';
    el.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
        renderInventoryGrid();
        document.getElementById('item-detail').style.display = 'none';
        document.getElementById('shop-screen').style.display = 'none';
        document.getElementById('roulette-screen').style.display = 'none';
    }
}

// ==================== SHOP ====================
const shopItems = [
    { name: '체력 포션', icon: '🧪', type: 'potion', desc: '체력을 30 회복합니다.', price: 15, heal: 30 },
    { name: '큰 체력 포션', icon: '🧪', type: 'potion', desc: '체력을 60 회복합니다.', price: 30, heal: 60 },
    { name: '강화석', icon: '💠', type: 'upgrade', desc: '무기 대미지 +1', price: 50 },
    { name: '가죽 갑옷', icon: '🛡️', type: 'armor', desc: '방어력 +2', price: 60, defense: 2, slot: 'armor' },
    { name: '철 갑옷', icon: '🛡️', type: 'armor', desc: '방어력 +5', price: 150, defense: 5, slot: 'armor' },
    { name: '보호의 반지', icon: '💍', type: 'accessory', desc: '방어력 +1, 최대HP +20', price: 80, defense: 1, maxHpBonus: 20, slot: 'accessory' },
    { name: '힘의 목걸이', icon: '📿', type: 'accessory', desc: '공격력 +2', price: 120, attackBonus: 2, slot: 'accessory' },
    { name: '강철 검', icon: '⚔️', type: 'weapon', desc: '대미지 3~8', price: 200, minDmg: 3, maxDmg: 8, slot: 'weapon' },
];

function renderShop() {
    const container = document.getElementById('shop-items');
    if (!container) return;
    container.innerHTML = '';
    shopItems.forEach((item, i) => {
        const div = document.createElement('div');
        div.className = 'shop-item';
        div.innerHTML = `<div class="shop-item-info"><div class="shop-item-name">${item.icon} ${item.name}</div><div class="shop-item-desc">${item.desc}</div></div><button class="shop-buy-btn" onclick="buyItem(${i})">${item.price} 코인</button>`;
        container.appendChild(div);
    });
}

function buyItem(index) {
    const item = shopItems[index];
    if (gameState.coins < item.price) { showInvestigationText('코인이 부족합니다!'); return; }
    if (item.type === 'potion') {
        gameState.coins -= item.price;
        gameState.playerHp = Math.min(gameState.playerMaxHp, gameState.playerHp + item.heal);
        updateHUD();
        showItemNotification(item.name + '을 사용했습니다!');
    } else {
        gameState.coins -= item.price;
        if (!addToInventory({ ...item })) { gameState.coins += item.price; return; }
        showItemNotification(item.name + '을 구매했습니다!');
    }
    updateHUD(); saveGameData();
}

function toggleShop() {
    const el = document.getElementById('shop-screen');
    const isOpen = el.style.display !== 'none';
    el.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
        document.getElementById('inventory-screen').style.display = 'none';
        document.getElementById('roulette-screen').style.display = 'none';
    }
}

// ==================== ROULETTE ====================
let rouletteAngle = 0, rouletteSpinning = false;
const rouletteRewards = [
    { label: '5 코인', type: 'coin', amount: 5, color: '#fbbf24' },
    { label: '10 코인', type: 'coin', amount: 10, color: '#f59e0b' },
    { label: '20 코인', type: 'coin', amount: 20, color: '#d97706' },
    { label: '1 다이아', type: 'diamond', amount: 1, color: '#60a5fa' },
    { label: '50 코인', type: 'coin', amount: 50, color: '#ea580c' },
    { label: '꽝', type: 'nothing', amount: 0, color: '#666' },
    { label: '3 다이아', type: 'diamond', amount: 3, color: '#3b82f6' },
    { label: '체력 회복', type: 'heal', amount: 50, color: '#22c55e' },
];

function drawRoulette() {
    const canvas = document.getElementById('roulette-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d'), cx = 150, cy = 150, r = 130;
    const segs = rouletteRewards.length, arc = (Math.PI * 2) / segs;
    ctx.clearRect(0, 0, 300, 300);
    for (let i = 0; i < segs; i++) {
        const angle = rouletteAngle + i * arc;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, angle, angle + arc);
        ctx.fillStyle = rouletteRewards[i].color; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle + arc / 2);
        ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif';
        ctx.fillText(rouletteRewards[i].label, r - 10, 4); ctx.restore();
    }
    ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI * 2); ctx.fillStyle = '#a855f7'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + r + 5, cy); ctx.lineTo(cx + r - 15, cy - 10); ctx.lineTo(cx + r - 15, cy + 10);
    ctx.fillStyle = '#f87171'; ctx.fill();
}

function spinRoulette() {
    if (rouletteSpinning) return;
    if (gameState.coins < 10) { showInvestigationText('코인이 부족합니다! (10 코인 필요)'); return; }
    gameState.coins -= 10; updateHUD(); rouletteSpinning = true;
    document.getElementById('roulette-spin-btn').disabled = true;
    document.getElementById('roulette-result').textContent = '';
    let speed = 0.3;
    const spin = () => {
        rouletteAngle += speed; speed *= 0.995; drawRoulette();
        if (speed > 0.002) { requestAnimationFrame(spin); return; }
        rouletteSpinning = false;
        document.getElementById('roulette-spin-btn').disabled = false;
        const segs = rouletteRewards.length, arc = (Math.PI * 2) / segs;
        const norm = (((-rouletteAngle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const idx = Math.floor(norm / arc) % segs;
        const reward = rouletteRewards[idx];
        if (reward.type === 'coin') { addCoins(reward.amount); document.getElementById('roulette-result').textContent = `${reward.amount} 코인 획득!`; }
        else if (reward.type === 'diamond') { addDiamonds(reward.amount); document.getElementById('roulette-result').textContent = `${reward.amount} 다이아몬드 획득!`; }
        else if (reward.type === 'heal') { gameState.playerHp = Math.min(gameState.playerMaxHp, gameState.playerHp + reward.amount); updateHUD(); document.getElementById('roulette-result').textContent = `체력 ${reward.amount} 회복!`; }
        else { document.getElementById('roulette-result').textContent = '꽝! 다음에 다시!'; }
        saveGameData();
    };
    requestAnimationFrame(spin);
}

function toggleRoulette() {
    const el = document.getElementById('roulette-screen');
    const isOpen = el.style.display !== 'none';
    el.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
        drawRoulette();
        document.getElementById('inventory-screen').style.display = 'none';
        document.getElementById('shop-screen').style.display = 'none';
    }
}

// ==================== HUD ====================
function updateHUD() {
    const pct = Math.max(0, gameState.playerHp / gameState.playerMaxHp * 100);
    document.getElementById('health-bar').style.width = pct + '%';
    document.getElementById('health-text').textContent = `${Math.max(0, Math.floor(gameState.playerHp))} / ${gameState.playerMaxHp}`;
    document.getElementById('health-bar').style.background =
        pct > 50 ? 'linear-gradient(90deg, #22c55e, #4ade80)' :
        pct > 25 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' :
        'linear-gradient(90deg, #dc2626, #f87171)';
    document.getElementById('coin-display').textContent = '코인: ' + gameState.coins;
    document.getElementById('diamond-display').textContent = '다이아: ' + gameState.diamonds;
    const lvlEl = document.getElementById('level-display');
    if (lvlEl) lvlEl.textContent = 'Lv.' + gameState.level;
    const xpBar = document.getElementById('xp-bar');
    if (xpBar) xpBar.style.width = (gameState.xp / gameState.xpToNext * 100) + '%';
    const xpText = document.getElementById('xp-text');
    if (xpText) xpText.textContent = gameState.xp + ' / ' + gameState.xpToNext;
}

function showQuest(text) {
    const el = document.getElementById('quest-display');
    document.getElementById('quest-text').textContent = text;
    el.style.display = 'block'; el.style.animation = 'none'; el.offsetHeight; el.style.animation = 'questAppear 0.5s ease-out';
}

function showItemNotification(text) {
    const el = document.getElementById('item-notification');
    document.getElementById('item-notif-text').textContent = text;
    el.style.display = 'block'; el.style.animation = 'none'; el.offsetHeight; el.style.animation = 'notifAnim 0.5s ease-out';
    setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function showInvestigationText(text) {
    const el = document.getElementById('investigation-text');
    el.textContent = text; el.style.display = 'block'; el.style.animation = 'none'; el.offsetHeight; el.style.animation = 'fadeInUp 0.3s ease-out';
    setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function showDamageNumber(dmg, position) {
    const el = document.createElement('div');
    el.className = 'damage-num'; el.textContent = '-' + dmg;
    el.style.left = (window.innerWidth / 2 + (Math.random() - 0.5) * 100) + 'px';
    el.style.top = (window.innerHeight / 2 - 50 + (Math.random() - 0.5) * 50) + 'px';
    document.getElementById('damage-numbers').appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

function shakeScreen() {
    const c = document.getElementById('game-canvas');
    c.style.animation = 'none'; c.offsetHeight; c.style.animation = 'shake 0.5s ease-out';
}

// ==================== UTILITY ====================
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function addCoins(n) { gameState.coins += n; updateHUD(); playSFX('coin'); }
function addDiamonds(n) { gameState.diamonds += n; updateHUD(); }

// ==================== SAVE ====================
async function saveGameData() {
    if (!currentPlayer) return;
    const data = {
        nickname: currentPlayer.nickname, password: currentPlayer.password,
        role: currentPlayer.role || 'player',
        x: playerBody ? playerBody.position.x : 0, y: playerBody ? playerBody.position.y : 0, z: playerBody ? playerBody.position.z : 0,
        coins: gameState.coins, diamonds: gameState.diamonds,
        hp: gameState.playerHp, maxHp: gameState.playerMaxHp,
        inventory: {}, tools: {},
        currentStage: gameState.stage, completedQuests: gameState.completedQuests, deaths: gameState.snakeDeaths,
        level: gameState.level, xp: gameState.xp, kills: gameState.kills,
        defense: gameState.defense, attackBonus: gameState.attackBonus,
        equipment: gameState.equipment,
        skillPoints: gameState.skillPoints,
        skills: gameState.skills,
        achievements: gameState.achievements,
        title: gameState.title,
        materials: gameState.materials,
        completedSideQuests: gameState.completedSideQuests,
        pet: gameState.pet
    };
    if (currentPlayer.resetOnLogin) data.resetOnLogin = true;
    gameState.inventory.forEach((item, i) => { data.inventory['slot_' + i] = item; });
    await dbSet('players/' + currentPlayer.nickname, data);
}

setInterval(() => { if (currentPlayer) saveGameData(); }, 30000);

// ==================== ONLINE MULTIPLAYER ====================
function startOnlineSync() {
    uploadPosition();
    setInterval(uploadPosition, 1500);
    setInterval(syncOnlinePlayers, 2000);
}

async function uploadPosition() {
    if (!currentPlayer) return;
    const data = {
        x: Math.round(playerBody.position.x * 10) / 10,
        y: Math.round(playerBody.position.y * 10) / 10,
        z: Math.round(playerBody.position.z * 10) / 10,
        rotY: Math.round(yaw * 100) / 100,
        stage: gameState.stage,
        inMine: gameState.insideMine,
        hp: gameState.playerHp,
        maxHp: gameState.playerMaxHp,
        level: gameState.level,
        lastSeen: Date.now()
    };
    try {
        await fetch(getDbUrl() + 'online/' + currentPlayer.nickname + '.json', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (e) {}
}

async function syncOnlinePlayers() {
    if (!currentPlayer || !scene) return;
    try {
        const res = await fetch(getDbUrl() + 'online.json');
        const data = await res.json();
        if (!data) return;

        const now = Date.now();
        const activeNames = new Set();
        let count = 0;

        for (const [name, info] of Object.entries(data)) {
            if (name === currentPlayer.nickname) { count++; continue; }
            if (now - info.lastSeen > 15000) {
                if (onlineModels[name]) removeOnlinePlayer(name);
                continue;
            }
            count++;
            activeNames.add(name);

            onlinePlayers[name] = info;
            if (!onlineModels[name]) {
                createOnlinePlayer(name, info);
            }
            updateOnlinePlayer(name, info);
        }

        for (const name of Object.keys(onlineModels)) {
            if (!activeNames.has(name)) removeOnlinePlayer(name);
        }

        document.getElementById('online-count').textContent = '온라인: ' + count;
    } catch (e) {}
}

function createOnlinePlayer(name, info) {
    const group = new THREE.Group();

    const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 1.0, 0.4),
        new THREE.MeshLambertMaterial({ color: 0x6d28d9 })
    );
    body.position.y = 0.7;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 8, 8),
        new THREE.MeshLambertMaterial({ color: 0xffcc88 })
    );
    head.position.y = 1.5;
    head.castShadow = true;
    group.add(head);

    const legMat = new THREE.MeshLambertMaterial({ color: 0x333366 });
    for (const lx of [-0.15, 0.15]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.25), legMat);
        leg.position.set(lx, 0.25, 0);
        group.add(leg);
    }

    const armMat = new THREE.MeshLambertMaterial({ color: 0x7c3aed });
    for (const ax of [-0.45, 0.45]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.2), armMat);
        arm.position.set(ax, 0.7, 0);
        group.add(arm);
    }

    const groundY = info.inMine ? -10 : 0;
    group.position.set(info.x || 0, groundY, info.z || 0);
    scene.add(group);

    const labelDiv = document.createElement('div');
    labelDiv.className = 'player-label';
    labelDiv.textContent = name;
    document.getElementById('game-container').appendChild(labelDiv);

    onlineModels[name] = { group, label: labelDiv, targetPos: new THREE.Vector3(info.x || 0, groundY, info.z || 0) };
}

function updateOnlinePlayer(name, info) {
    const om = onlineModels[name];
    if (!om) return;
    const ty = info.inMine ? -10 : 0;
    om.targetPos.set(info.x || 0, ty, info.z || 0);
    om.group.rotation.y = info.rotY || 0;

    const sameArea = info.inMine === gameState.insideMine;
    om.group.visible = sameArea;
    om.label.style.display = sameArea ? 'block' : 'none';
}

function removeOnlinePlayer(name) {
    const om = onlineModels[name];
    if (!om) return;
    scene.remove(om.group);
    om.label.remove();
    delete onlineModels[name];
}

function updateOnlineLabels() {
    for (const [name, om] of Object.entries(onlineModels)) {
        if (!om.group.visible) continue;

        const g = om.group;
        const curr = g.position;
        curr.lerp(om.targetPos, 0.1);

        g.children.forEach((child, i) => {
            if (i >= 3) {
                child.rotation.x = Math.sin(Date.now() * 0.005 + (i === 3 ? 0 : Math.PI)) * 0.3;
            }
        });

        const pos = new THREE.Vector3(curr.x, curr.y + 0.5, curr.z);
        pos.project(camera);
        if (pos.z > 1 || pos.z < -1) { om.label.style.display = 'none'; continue; }
        const hw = window.innerWidth / 2, hh = window.innerHeight / 2;
        om.label.style.left = (pos.x * hw + hw) + 'px';
        om.label.style.top = (-pos.y * hh + hh - 30) + 'px';
        om.label.style.display = 'block';
    }
}

function goOffline() {
    if (currentPlayer) {
        navigator.sendBeacon(getDbUrl() + 'online/' + currentPlayer.nickname + '.json', 'null');
    }
}
window.addEventListener('beforeunload', goOffline);

// ==================== ADMIN SYSTEM ====================
function toggleAdmin() {
    if (!currentPlayer || (currentPlayer.role !== 'admin' && currentPlayer.role !== 'superadmin')) return;
    const panel = document.getElementById('admin-panel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    if (panel.style.display === 'block') {
        document.getElementById('admin-role-badge').textContent = currentPlayer.role === 'superadmin' ? '최고관리자' : '관리자';
        if (currentPlayer.role === 'superadmin') document.getElementById('super-tab').style.display = 'block';
        loadPlayerList();
    }
}

function switchAdminTab(tab) {
    document.querySelectorAll('.admin-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.admin-tab').forEach(el => el.classList.remove('active'));
    document.getElementById('admin-tab-' + tab).style.display = 'flex';
    event.target.classList.add('active');
}

async function loadPlayerList() {
    const list = document.getElementById('player-list');
    list.innerHTML = '<span style="color:#a78bfa">로딩 중...</span>';
    const players = await dbGet('players');
    if (!players) { list.innerHTML = '<span style="color:#ef4444">데이터 없음</span>'; return; }
    list.innerHTML = '';
    Object.entries(players).forEach(([name, p]) => {
        const roleClass = p.role === 'superadmin' ? 'role-superadmin' : p.role === 'admin' ? 'role-admin' : '';
        const roleText = p.role === 'superadmin' ? '최고관리자' : p.role === 'admin' ? '관리자' : '일반';
        const card = document.createElement('div');
        card.className = 'player-card';
        card.innerHTML = `<span class="name">${name}</span><span class="info">S${p.currentStage || 1} | 코인:${p.coins || 0} | HP:${p.hp || 0}</span><span class="${roleClass}">${roleText}</span>`;
        card.style.cursor = 'pointer';
        card.onclick = () => { document.getElementById('admin-target').value = name; switchAdminTab('give'); document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active')); document.querySelectorAll('.admin-tab')[1].classList.add('active'); };
        list.appendChild(card);
    });
}

function adminMsg(id, text, color) {
    const el = document.getElementById(id);
    el.textContent = text;
    el.style.color = color || '#4ade80';
    setTimeout(() => el.textContent = '', 3000);
}

async function adminGiveCoins() {
    const target = document.getElementById('admin-target').value.trim();
    const amount = parseInt(document.getElementById('admin-coins').value) || 0;
    if (!target) { adminMsg('admin-give-msg', '대상을 입력하세요', '#ef4444'); return; }
    const p = await dbGet('players/' + target);
    if (!p) { adminMsg('admin-give-msg', '존재하지 않는 유저', '#ef4444'); return; }
    await dbSet('players/' + target + '/coins', (p.coins || 0) + amount);
    if (target === currentPlayer.nickname) { gameState.coins += amount; updateHUD(); }
    adminMsg('admin-give-msg', target + '에게 코인 ' + amount + ' 지급 완료');
}

async function adminGiveDiamonds() {
    const target = document.getElementById('admin-target').value.trim();
    const amount = parseInt(document.getElementById('admin-diamonds').value) || 0;
    if (!target) { adminMsg('admin-give-msg', '대상을 입력하세요', '#ef4444'); return; }
    const p = await dbGet('players/' + target);
    if (!p) { adminMsg('admin-give-msg', '존재하지 않는 유저', '#ef4444'); return; }
    await dbSet('players/' + target + '/diamonds', (p.diamonds || 0) + amount);
    if (target === currentPlayer.nickname) { gameState.diamonds += amount; updateHUD(); }
    adminMsg('admin-give-msg', target + '에게 다이아 ' + amount + ' 지급 완료');
}

async function adminSetHp() {
    const target = document.getElementById('admin-target').value.trim();
    const hp = parseInt(document.getElementById('admin-hp').value) || 100;
    if (!target) { adminMsg('admin-give-msg', '대상을 입력하세요', '#ef4444'); return; }
    await dbSet('players/' + target + '/hp', hp);
    await dbSet('players/' + target + '/maxHp', hp);
    if (target === currentPlayer.nickname) { gameState.playerHp = hp; gameState.playerMaxHp = hp; updateHUD(); }
    adminMsg('admin-give-msg', target + ' HP를 ' + hp + '으로 설정');
}

async function adminSetStage() {
    const target = document.getElementById('admin-target').value.trim();
    const stage = parseInt(document.getElementById('admin-stage').value) || 1;
    if (!target) { adminMsg('admin-give-msg', '대상을 입력하세요', '#ef4444'); return; }
    await dbSet('players/' + target + '/currentStage', stage);
    if (stage === 1) await dbSet('players/' + target + '/completedQuests', {});
    adminMsg('admin-give-msg', target + ' 스테이지를 ' + stage + '로 설정');
}

async function adminResetPlayer() {
    const target = document.getElementById('admin-target').value.trim();
    if (!target) { adminMsg('admin-give-msg', '대상을 입력하세요', '#ef4444'); return; }
    const p = await dbGet('players/' + target);
    if (!p) { adminMsg('admin-give-msg', '존재하지 않는 유저', '#ef4444'); return; }
    const reset = { nickname: target, password: p.password, x: 0, y: 0, z: 0, coins: 0, diamonds: 0, hp: 100, maxHp: 100, inventory: {}, tools: {}, currentStage: 1, completedQuests: [], deaths: 0 };
    if (p.role) reset.role = p.role;
    if (p.resetOnLogin) reset.resetOnLogin = true;
    await dbSet('players/' + target, reset);
    adminMsg('admin-give-msg', target + ' 데이터 초기화 완료');
}

function adminGodMode() {
    godMode = !godMode;
    const btn = document.getElementById('godmode-btn');
    btn.textContent = godMode ? '갓모드 OFF' : '갓모드 ON';
    btn.classList.toggle('active', godMode);
    showInvestigationText(godMode ? '갓모드 활성화! 무적 상태입니다.' : '갓모드 비활성화');
}

function adminTeleport(location) {
    const positions = {
        village: [0, PLAYER_HEIGHT, 0],
        mountain: [0, PLAYER_HEIGHT, -45],
        mine: [-30, PLAYER_HEIGHT, -54],
        boss: [-15, -10 + PLAYER_HEIGHT, -95]
    };
    const pos = positions[location];
    if (location === 'boss') gameState.insideMine = true;
    else if (location !== 'mine') gameState.insideMine = false;
    playerBody.position.set(pos[0], pos[1], pos[2]);
    if (gameState.insideMine) {
        scene.background = new THREE.Color(0x111111);
        scene.fog = new THREE.Fog(0x111111, 5, 30);
    } else {
        scene.background = new THREE.Color(0x87CEEB);
        scene.fog = new THREE.Fog(0x87CEEB, 60, 250);
    }
    showInvestigationText(location + '(으)로 이동!');
}

function adminMaxStats() {
    gameState.coins += 9999;
    gameState.diamonds += 999;
    gameState.playerHp = 999;
    gameState.playerMaxHp = 999;
    updateHUD();
    showInvestigationText('스탯 최대화!');
}

function adminSpawnSnake() {
    const px = playerBody.position.x + Math.sin(yaw) * -8;
    const pz = playerBody.position.z + Math.cos(yaw) * -8;
    spawnSnake(px, gameState.insideMine ? -10 : 0, pz);
    showInvestigationText('독사 소환!');
}

function adminSpawnBoss() {
    const px = playerBody.position.x + Math.sin(yaw) * -10;
    const pz = playerBody.position.z + Math.cos(yaw) * -10;
    spawnShadowBoss(px, gameState.insideMine ? -10 : 0, pz);
    showInvestigationText('보스 소환!');
}

async function adminSetRole(role) {
    if (currentPlayer.role !== 'superadmin') { adminMsg('admin-super-msg', '최고관리자만 가능', '#ef4444'); return; }
    const target = document.getElementById('admin-role-target').value.trim();
    if (!target) { adminMsg('admin-super-msg', '대상을 입력하세요', '#ef4444'); return; }
    if (target === currentPlayer.nickname) { adminMsg('admin-super-msg', '자신의 권한은 변경 불가', '#ef4444'); return; }
    const p = await dbGet('players/' + target);
    if (!p) { adminMsg('admin-super-msg', '존재하지 않는 유저', '#ef4444'); return; }
    if (p.role === 'superadmin') { adminMsg('admin-super-msg', '최고관리자는 변경 불가', '#ef4444'); return; }
    await dbSet('players/' + target + '/role', role);
    adminMsg('admin-super-msg', target + ' 권한: ' + (role === 'admin' ? '관리자' : '일반'));
}

async function adminDeletePlayer() {
    if (currentPlayer.role !== 'superadmin') { adminMsg('admin-super-msg', '최고관리자만 가능', '#ef4444'); return; }
    const target = document.getElementById('admin-delete-target').value.trim();
    if (!target) { adminMsg('admin-super-msg', '대상을 입력하세요', '#ef4444'); return; }
    if (target === currentPlayer.nickname) { adminMsg('admin-super-msg', '자신은 삭제 불가', '#ef4444'); return; }
    const p = await dbGet('players/' + target);
    if (!p) { adminMsg('admin-super-msg', '존재하지 않는 유저', '#ef4444'); return; }
    if (p.role === 'superadmin') { adminMsg('admin-super-msg', '최고관리자는 삭제 불가', '#ef4444'); return; }
    await fetch(getDbUrl() + 'players/' + target + '.json', { method: 'DELETE' });
    adminMsg('admin-super-msg', target + ' 삭제 완료');
}

// ==================== LEVEL / XP SYSTEM ====================
function getXPForLevel(lv) { return Math.floor(50 * Math.pow(lv, 1.4)); }

function gainXP(amount) {
    gameState.xp += amount;
    showInvestigationText('+' + amount + ' XP');
    while (gameState.xp >= gameState.xpToNext) {
        gameState.xp -= gameState.xpToNext;
        gameState.level++;
        gameState.xpToNext = getXPForLevel(gameState.level);
        gameState.playerMaxHp += 10;
        gameState.playerHp = gameState.playerMaxHp;
        gameState.attackBonus += 1;
        gameState.skillPoints += 2;
        playSFX('levelup');
        showStageComplete('LEVEL UP! Lv.' + gameState.level, 2000);
    }
    updateHUD();
}

// ==================== EQUIPMENT SYSTEM ====================
function equipFromInventory(index, slot) {
    const item = gameState.inventory[index];
    if (!item) return;
    const prev = gameState.equipment[slot];
    if (prev) gameState.inventory.push(prev);
    gameState.equipment[slot] = item;
    gameState.inventory.splice(index, 1);
    if (slot === 'weapon') gameState.equippedWeapon = item;
    recalcEquipStats();
    renderInventoryGrid();
    renderEquipment();
    showInvestigationText(item.name + ' 장착!');
    saveGameData();
}

function unequipSlot(slot) {
    const item = gameState.equipment[slot];
    if (!item) return;
    if (gameState.inventory.length >= 18) { showInvestigationText('인벤토리가 가득 찼습니다!'); return; }
    gameState.inventory.push(item);
    gameState.equipment[slot] = null;
    if (slot === 'weapon') gameState.equippedWeapon = null;
    recalcEquipStats();
    renderInventoryGrid();
    renderEquipment();
    showInvestigationText(item.name + ' 해제!');
    saveGameData();
}

function recalcEquipStats() {
    let def = 0, atk = 0;
    const eq = gameState.equipment;
    if (eq.armor) def += eq.armor.defense || 0;
    if (eq.accessory) {
        def += eq.accessory.defense || 0;
        atk += eq.accessory.attackBonus || 0;
    }
    gameState.defense = def;
}

function renderEquipment() {
    const container = document.getElementById('equip-slots');
    if (!container) return;
    container.innerHTML = '';
    const slots = [
        { key: 'weapon', label: '무기' },
        { key: 'armor', label: '방어구' },
        { key: 'accessory', label: '장신구' }
    ];
    slots.forEach(s => {
        const div = document.createElement('div');
        div.className = 'equip-slot';
        const item = gameState.equipment[s.key];
        div.innerHTML = `<span class="equip-label">${s.label}</span><span class="equip-item">${item ? item.icon + ' ' + item.name : '없음'}</span>`;
        if (item) {
            const btn = document.createElement('button');
            btn.textContent = '해제';
            btn.onclick = () => unequipSlot(s.key);
            div.appendChild(btn);
        }
        container.appendChild(div);
    });
    const statsDiv = document.getElementById('equip-stats');
    if (statsDiv) statsDiv.innerHTML = `공격 보너스: +${gameState.attackBonus} | 방어력: ${gameState.defense} | 레벨: ${gameState.level}`;
}

function toggleEquipment() {
    const el = document.getElementById('equipment-screen');
    const isOpen = el.style.display !== 'none';
    el.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) renderEquipment();
}

// ==================== CHAT SYSTEM ====================
let chatMessages = [];
let chatSyncInterval = null;

function startChatSync() {
    loadChat();
    chatSyncInterval = setInterval(loadChat, 3000);
}

async function loadChat() {
    try {
        const data = await dbGet('chat');
        if (!data) return;
        const msgs = Object.entries(data).sort((a, b) => a[0].localeCompare(b[0])).slice(-30);
        chatMessages = msgs.map(([k, v]) => v);
        renderChat();
    } catch (e) {}
}

function renderChat() {
    const box = document.getElementById('chat-messages');
    if (!box) return;
    box.innerHTML = '';
    chatMessages.forEach(m => {
        const div = document.createElement('div');
        div.className = 'chat-msg';
        div.innerHTML = `<span class="chat-name">${m.name}</span> <span class="chat-text">${escapeHtml(m.text)}</span>`;
        box.appendChild(div);
    });
    box.scrollTop = box.scrollHeight;
}

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text || !currentPlayer) return;
    input.value = '';
    const key = Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    try {
        await dbSet('chat/' + key, { name: currentPlayer.nickname, text, time: Date.now() });
        loadChat();
    } catch (e) {}
}

function toggleChat() {
    const el = document.getElementById('chat-panel');
    el.style.display = el.style.display === 'none' ? 'flex' : 'none';
    if (el.style.display === 'flex') {
        loadChat();
        document.getElementById('chat-input').focus();
    }
}

// ==================== MINIMAP ====================
function drawMinimap() {
    const canvas = document.getElementById('minimap-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const scale = 0.5;
    const cx = w / 2, cy = h / 2;
    const px = playerBody.position.x, pz = playerBody.position.z;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = gameState.insideMine ? '#1a1a1a' : (gameState.insideRuins ? '#2a1a0a' : '#2d4a2d');
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(168,85,247,0.3)';
    ctx.lineWidth = 0.5;
    for (let i = -140; i <= 140; i += 20) {
        const sx = cx + (i - px) * scale;
        const sy = cy + (i - pz) * scale;
        if (sx > 0 && sx < w) { ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, h); ctx.stroke(); }
        if (sy > 0 && sy < w) { ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(w, sy); ctx.stroke(); }
    }

    ctx.fillStyle = '#8B7355';
    const pathPoints = [[0, -60, 4, 80], [10, 0, 60, 4]];
    pathPoints.forEach(([x, z, rw, rh]) => {
        ctx.fillRect(cx + (x - rw/2 - px) * scale, cy + (z - rh/2 - pz) * scale, rw * scale, rh * scale);
    });

    ctx.fillStyle = '#fbbf24';
    buildings && Object.entries(buildings).forEach(([name, obj]) => {
        if (!obj || !obj.position) return;
        const sx = cx + (obj.position.x - px) * scale;
        const sy = cy + (obj.position.z - pz) * scale;
        if (sx > 2 && sx < w - 2 && sy > 2 && sy < h - 2) {
            ctx.fillRect(sx - 2, sy - 2, 4, 4);
        }
    });

    npcs.forEach(npc => {
        const sx = cx + (npc.position.x - px) * scale;
        const sy = cy + (npc.position.z - pz) * scale;
        if (sx > 2 && sx < w - 2 && sy > 2 && sy < h - 2) {
            ctx.fillStyle = '#4ade80';
            ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2); ctx.fill();
        }
    });

    enemies.forEach(e => {
        if (e.userData.hp <= 0) return;
        const sx = cx + (e.position.x - px) * scale;
        const sy = cy + (e.position.z - pz) * scale;
        if (sx > 2 && sx < w - 2 && sy > 2 && sy < h - 2) {
            ctx.fillStyle = '#f87171';
            ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2); ctx.fill();
        }
    });

    for (const [name, om] of Object.entries(onlineModels)) {
        if (!om.group.visible) continue;
        const sx = cx + (om.group.position.x - px) * scale;
        const sy = cy + (om.group.position.z - pz) * scale;
        if (sx > 2 && sx < w - 2 && sy > 2 && sy < h - 2) {
            ctx.fillStyle = '#60a5fa';
            ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2); ctx.fill();
        }
    }

    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const dir = yaw;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.sin(dir) * -10, cy + Math.cos(dir) * -10);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(168,85,247,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, w, h);
}

// ==================== RANKING SYSTEM ====================
async function loadRanking() {
    const container = document.getElementById('ranking-list');
    if (!container) return;
    container.innerHTML = '<div style="color:#a78bfa;text-align:center;">로딩 중...</div>';
    try {
        const players = await dbGet('players');
        if (!players) { container.innerHTML = '<div style="color:#ef4444;">데이터 없음</div>'; return; }
        const arr = Object.entries(players).map(([name, p]) => ({
            name, level: p.level || 1, coins: p.coins || 0, kills: p.kills || 0, stage: p.currentStage || 1
        }));
        arr.sort((a, b) => b.level - a.level || b.kills - a.kills || b.coins - a.coins);
        container.innerHTML = '';
        arr.slice(0, 20).forEach((p, i) => {
            const div = document.createElement('div');
            div.className = 'ranking-row' + (i < 3 ? ' top' + (i + 1) : '');
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
            div.innerHTML = `<span class="rank-pos">${medal}</span><span class="rank-name">${p.name}</span><span class="rank-info">Lv.${p.level} | S${p.stage} | 처치:${p.kills} | 코인:${p.coins}</span>`;
            container.appendChild(div);
        });
    } catch (e) { container.innerHTML = '<div style="color:#ef4444;">로딩 실패</div>'; }
}

function toggleRanking() {
    const el = document.getElementById('ranking-screen');
    const isOpen = el.style.display !== 'none';
    el.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) loadRanking();
}

// ==================== STAGE 3 ====================
function startStage3() {
    gameState.stage = 3;
    gameState.stage3Phase = 0;
    gameState.tabletsFound = 0;
    gameState.insideRuins = false;
    showStageComplete('3스테이지: 고대 유적', 3000);
    setTimeout(() => {
        playerBody.position.set(-6, PLAYER_HEIGHT, 5);
        yaw = 0; pitch = 0;
        buildStage3World();
    }, 3000);
}

function buildStage3World() {
    const desertGround = new THREE.Mesh(
        new THREE.PlaneGeometry(80, 80),
        new THREE.MeshLambertMaterial({ color: 0xC2A645 })
    );
    desertGround.rotation.x = -Math.PI / 2;
    desertGround.position.set(80, 0.01, 0);
    desertGround.receiveShadow = true;
    scene.add(desertGround);

    const pillarGeo = new THREE.CylinderGeometry(0.8, 1, 6, 8);
    const pillarMat = new THREE.MeshLambertMaterial({ color: 0xA08050 });
    const pillarPositions = [[60, 3, -5], [60, 3, 5], [70, 3, -8], [70, 3, 8], [80, 3, -5], [80, 3, 5], [90, 3, -3], [90, 3, 3]];
    pillarPositions.forEach(([x, y, z]) => {
        const p = new THREE.Mesh(pillarGeo, pillarMat);
        p.position.set(x, y, z); p.castShadow = true; scene.add(p);
    });

    const ruinsEntrance = new THREE.Mesh(
        new THREE.BoxGeometry(6, 4, 1),
        new THREE.MeshLambertMaterial({ color: 0x705030 })
    );
    ruinsEntrance.position.set(100, 2, 0);
    ruinsEntrance.userData = { name: 'ruinsEntrance', type: 'door', isOpen: false };
    scene.add(ruinsEntrance);
    buildings.ruinsEntrance = ruinsEntrance;
    interactables.push(ruinsEntrance);

    const sage = createNPC('고대의 현자', 65, 0, 0, 0x886622);
    npcs.push(sage);

    for (let i = 0; i < 10; i++) {
        const cactus = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 2, 6), new THREE.MeshLambertMaterial({ color: 0x2d5a1e }));
        trunk.position.y = 1; cactus.add(trunk);
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1, 6), new THREE.MeshLambertMaterial({ color: 0x3a7a28 }));
        arm.position.set(0.5, 1.5, 0); arm.rotation.z = Math.PI / 3; cactus.add(arm);
        cactus.position.set(55 + Math.random() * 50, 0, (Math.random() - 0.5) * 40);
        cactus.castShadow = true;
        scene.add(cactus);
    }

    const signPost = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2, 1), new THREE.MeshLambertMaterial({ color: 0x8B4513 }));
    signPost.position.set(50, 1, 0);
    scene.add(signPost);

    buildRuinsInterior();
}

function buildRuinsInterior() {
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x3a2a1a });
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x4a3a2a });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.position.set(100, -20.01, 0);
    floor.receiveShadow = true; scene.add(floor);

    for (let i = 0; i < 4; i++) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(60, 6, 1), wallMat);
        const positions = [[100, -17, -30], [100, -17, 30], [70, -17, 0], [130, -17, 0]];
        const rotations = [0, 0, Math.PI / 2, Math.PI / 2];
        wall.position.set(positions[i][0], positions[i][1], positions[i][2]);
        if (i >= 2) wall.rotation.y = rotations[i];
        scene.add(wall);
    }

    const tabletPositions = [[85, -19, -15], [110, -19, 10], [120, -19, -20]];
    tabletPositions.forEach(([x, y, z], idx) => {
        const tablet = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1.5, 0.3),
            new THREE.MeshLambertMaterial({ color: 0xaa8844, emissive: 0x332200 })
        );
        tablet.position.set(x, y + 0.75, z);
        tablet.userData = { name: 'tablet_' + idx, type: 'tablet', investigated: false, text: ['첫 번째 석판: 어둠 속에 빛이 있으리라.', '두 번째 석판: 수호자는 잠들어 있다.', '세 번째 석판: 세 석판이 모이면 문이 열리리라.'][idx] };
        scene.add(tablet);
        interactables.push(tablet);
    });

    const bossRoom = new THREE.Mesh(
        new THREE.BoxGeometry(3, 3, 0.5),
        new THREE.MeshLambertMaterial({ color: 0x664400, emissive: 0x221100 })
    );
    bossRoom.position.set(100, -18.5, -25);
    bossRoom.userData = { name: 'guardianDoor', type: 'sealedDoor2' };
    scene.add(bossRoom);
    buildings.guardianDoor = bossRoom;
    interactables.push(bossRoom);
}

function createNPC(name, x, y, z, bodyColor) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.6), new THREE.MeshLambertMaterial({ color: bodyColor }));
    body.position.y = 0.9; body.castShadow = true; group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 10), new THREE.MeshLambertMaterial({ color: 0xffcc88 }));
    head.position.y = 1.85; head.castShadow = true; group.add(head);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.6, 8), new THREE.MeshLambertMaterial({ color: bodyColor }));
    hat.position.y = 2.3; group.add(hat);
    group.position.set(x, y, z);
    group.userData = { name, type: 'npc' };
    scene.add(group);
    return group;
}

function enterRuins() {
    if (gameState.insideRuins) return;
    gameState.insideRuins = true;
    playerBody.position.set(100, -20 + PLAYER_HEIGHT, 25);
    scene.background = new THREE.Color(0x1a0a00);
    scene.fog = new THREE.Fog(0x1a0a00, 5, 40);
    showQuest('고대 유적 조사하기');
}

function exitRuins() {
    gameState.insideRuins = false;
    playerBody.position.set(98, PLAYER_HEIGHT, 0);
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 60, 250);
}

function spawnAncientGuardian() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3.5, 2), new THREE.MeshLambertMaterial({ color: 0x8B7355, emissive: 0x332200 }));
    body.position.y = 1.75; body.castShadow = true; group.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), new THREE.MeshLambertMaterial({ color: 0x9B8365, emissive: 0x332200 }));
    head.position.y = 4; head.castShadow = true; group.add(head);
    for (const sx of [-0.3, 0.3]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
        eye.position.set(sx, 4.2, -0.6); group.add(eye);
    }
    for (const side of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.5, 0.8), new THREE.MeshLambertMaterial({ color: 0x7B6345 }));
        arm.position.set(side * 1.8, 2, 0); group.add(arm);
        const fist = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), new THREE.MeshLambertMaterial({ color: 0x6B5335 }));
        fist.position.set(side * 1.8, 0.5, 0); group.add(fist);
    }
    group.position.set(100, -20, -22);
    group.userData = {
        name: '고대의 수호자', type: 'enemy', hp: 300, maxHp: 300,
        damage: [5, 12], attackCooldown: 0, attackInterval: 2,
        phase: 1, specialCooldown: 0, teleportCooldown: 0, roarCooldown: 0
    };
    scene.add(group); enemies.push(group);
    return group;
}

// ==================== STAGE 3 INTERACTIONS ====================
function handleNPCInteraction(npc) {
    if (npc.userData.name === '마을 이장') handleChiefDialogue();
    else if (npc.userData.name === '마을 주민') handleVillagerDialogue();
    else if (npc.userData.name === '고대의 현자') handleSageDialogue();
}

function handleSageDialogue() {
    if (gameState.stage !== 3) {
        startDialogue('고대의 현자', ['때가 되면 다시 만나게 될 것이다.'], null);
        return;
    }
    if (gameState.stage3Phase === 0) {
        startDialogue('고대의 현자', [
            '오랜 세월을 기다렸다. 드디어 모험가가 왔군.',
            '동쪽의 고대 유적 안에 세 개의 석판이 숨겨져 있다.',
            '석판을 모두 찾으면 수호자의 방이 열릴 것이다.',
            '하지만 조심하거라. 수호자는 강력하다.'
        ], () => {
            gameState.stage3Phase = 1;
            showQuest('고대 유적으로 가기');
            setArrowTarget(new THREE.Vector3(100, 2, 0));
        });
    } else {
        startDialogue('고대의 현자', ['석판을 모두 찾았는가? 유적 안을 잘 살펴보거라.'], null);
    }
}

// ==================== SOUND SYSTEM ====================
let audioCtx = null;
let bgmGain = null;
let bgmOsc = null;

function initAudio() {
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        bgmGain = audioCtx.createGain();
        bgmGain.gain.value = 0.08;
        bgmGain.connect(audioCtx.destination);
    } catch (e) {}
}

function resumeAudio() {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function playBGM(type) {
    if (!audioCtx || !gameState.soundOn || gameState.bgmType === type) return;
    stopBGM();
    gameState.bgmType = type;
    bgmOsc = audioCtx.createOscillator();
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();

    if (type === 'village') {
        bgmOsc.type = 'sine';
        bgmOsc.frequency.value = 220;
        lfo.frequency.value = 0.5;
        lfoGain.gain.value = 20;
    } else if (type === 'mine') {
        bgmOsc.type = 'sawtooth';
        bgmOsc.frequency.value = 80;
        lfo.frequency.value = 0.2;
        lfoGain.gain.value = 10;
        bgmGain.gain.value = 0.03;
    } else if (type === 'battle') {
        bgmOsc.type = 'square';
        bgmOsc.frequency.value = 150;
        lfo.frequency.value = 4;
        lfoGain.gain.value = 30;
        bgmGain.gain.value = 0.05;
    } else if (type === 'ruins') {
        bgmOsc.type = 'triangle';
        bgmOsc.frequency.value = 110;
        lfo.frequency.value = 0.3;
        lfoGain.gain.value = 15;
        bgmGain.gain.value = 0.04;
    }

    lfo.connect(lfoGain);
    lfoGain.connect(bgmOsc.frequency);
    bgmOsc.connect(bgmGain);
    lfo.start();
    bgmOsc.start();
}

function stopBGM() {
    if (bgmOsc) { try { bgmOsc.stop(); } catch (e) {} bgmOsc = null; }
    gameState.bgmType = null;
    if (bgmGain) bgmGain.gain.value = 0.08;
}

function playSFX(type) {
    if (!audioCtx || !gameState.soundOn) return;
    resumeAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    gain.connect(audioCtx.destination);
    osc.connect(gain);

    if (type === 'attack') {
        osc.type = 'sawtooth'; osc.frequency.value = 300;
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
        osc.start(); osc.stop(audioCtx.currentTime + 0.15);
    } else if (type === 'hit') {
        osc.type = 'square'; osc.frequency.value = 150;
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
        osc.start(); osc.stop(audioCtx.currentTime + 0.2);
    } else if (type === 'kill') {
        osc.type = 'sine'; osc.frequency.value = 500;
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
        osc.start(); osc.stop(audioCtx.currentTime + 0.4);
    } else if (type === 'levelup') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.setValueAtTime(500, audioCtx.currentTime + 0.15);
        osc.frequency.setValueAtTime(600, audioCtx.currentTime + 0.3);
        osc.frequency.setValueAtTime(800, audioCtx.currentTime + 0.45);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
        osc.start(); osc.stop(audioCtx.currentTime + 0.6);
    } else if (type === 'coin') {
        osc.type = 'sine'; osc.frequency.value = 1200;
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    }
}

function toggleSound() {
    gameState.soundOn = !gameState.soundOn;
    const btn = document.getElementById('sound-btn');
    if (btn) btn.textContent = gameState.soundOn ? '🔊' : '🔇';
    if (!gameState.soundOn) stopBGM();
}

// ==================== PARTY / CO-OP ====================
function updatePartyDisplay() {
    const partyDiv = document.getElementById('party-display');
    if (!partyDiv) return;
    let html = '';
    let nearbyCount = 0;
    for (const [name, om] of Object.entries(onlineModels)) {
        if (!om.group.visible) continue;
        const dist = playerBody.position.distanceTo(om.group.position);
        if (dist < 20) {
            nearbyCount++;
            const info = onlinePlayers[name];
            const hp = info ? info.hp : '?';
            const maxHp = info ? info.maxHp : '?';
            const lv = info ? (info.level || 1) : '?';
            const pct = info ? Math.max(0, (info.hp / info.maxHp) * 100) : 100;
            html += `<div class="party-member"><span class="party-name">Lv.${lv} ${name}</span><div class="party-hp-bg"><div class="party-hp-bar" style="width:${pct}%"></div></div></div>`;
        }
    }
    if (nearbyCount > 0) {
        partyDiv.style.display = 'block';
        partyDiv.innerHTML = '<div class="party-title">근처 파티원</div>' + html;
    } else {
        partyDiv.style.display = 'none';
    }
}

// ==================== EXTENDED INTERACTIONS ====================
function handleDoorInteraction(door) {
    if (door.userData.name === 'castleDoor') {
        door.userData.isOpen = true;
        door.visible = false;
        showInvestigationText('성문이 열렸습니다.');
    } else if (door.userData.name === 'mineDoor') {
        if (gameState.stage2Phase >= 1) {
            door.userData.isOpen = true;
            door.visible = false;
            showInvestigationText('철문이 천천히 열렸습니다.');
        } else {
            showInvestigationText('아직 갈 이유가 없다.');
        }
    } else if (door.userData.name === 'ruinsEntrance') {
        if (gameState.stage3Phase >= 1) {
            enterRuins();
        } else {
            showInvestigationText('고대의 현자에게 먼저 이야기를 들어보자.');
        }
    }
}

// ==================== SIDE QUEST SYSTEM ====================
const sideQuestPool = [
    { id: 'sq_kill3snakes', name: '독사 사냥꾼', desc: '독사 3마리를 처치하세요.', type: 'kill', target: '독사', needed: 3, progress: 0, reward: { coins: 50, xp: 40 } },
    { id: 'sq_kill5snakes', name: '독사 토벌', desc: '독사 5마리를 처치하세요.', type: 'kill', target: '독사', needed: 5, progress: 0, reward: { coins: 100, xp: 80 } },
    { id: 'sq_collect_wood', name: '나무 수집', desc: '나무 재료 5개를 모으세요.', type: 'collect', target: '나무', needed: 5, progress: 0, reward: { coins: 40, xp: 30 } },
    { id: 'sq_collect_stone', name: '돌 수집', desc: '돌 재료 5개를 모으세요.', type: 'collect', target: '돌', needed: 5, progress: 0, reward: { coins: 40, xp: 30 } },
    { id: 'sq_collect_iron', name: '철 수집', desc: '철 재료 3개를 모으세요.', type: 'collect', target: '철', needed: 3, progress: 0, reward: { coins: 80, xp: 50 } },
    { id: 'sq_fish3', name: '낚시 초보', desc: '물고기 3마리를 잡으세요.', type: 'collect', target: '물고기', needed: 3, progress: 0, reward: { coins: 60, xp: 40 } },
];

function toggleQuestBoard() {
    const el = document.getElementById('quest-board');
    const isOpen = el.style.display !== 'none';
    el.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) renderQuestBoard();
}

function renderQuestBoard() {
    const container = document.getElementById('quest-list');
    if (!container) return;
    container.innerHTML = '';
    if (gameState.activeSideQuest) {
        const q = gameState.activeSideQuest;
        const div = document.createElement('div');
        div.className = 'quest-card active';
        div.innerHTML = `<div class="quest-name">${q.name} (진행중)</div><div class="quest-desc">${q.desc}</div><div class="quest-progress">진행: ${q.progress}/${q.needed}</div><div class="quest-reward">보상: ${q.reward.coins}코인, ${q.reward.xp}XP</div>`;
        container.appendChild(div);
    }
    const available = sideQuestPool.filter(q => !gameState.completedSideQuests.includes(q.id) && (!gameState.activeSideQuest || gameState.activeSideQuest.id !== q.id));
    available.forEach((q, i) => {
        const div = document.createElement('div');
        div.className = 'quest-card';
        div.innerHTML = `<div class="quest-name">${q.name}</div><div class="quest-desc">${q.desc}</div><div class="quest-reward">보상: ${q.reward.coins}코인, ${q.reward.xp}XP</div><button onclick="acceptSideQuest('${q.id}')">수락</button>`;
        container.appendChild(div);
    });
    if (available.length === 0 && !gameState.activeSideQuest) {
        container.innerHTML = '<div style="color:#94a3b8;text-align:center;">사용 가능한 퀘스트가 없습니다.</div>';
    }
}

function acceptSideQuest(id) {
    if (gameState.activeSideQuest) { showInvestigationText('이미 진행 중인 퀘스트가 있습니다!'); return; }
    const q = sideQuestPool.find(sq => sq.id === id);
    if (!q) return;
    gameState.activeSideQuest = { ...q, progress: 0 };
    if (q.type === 'collect') gameState.activeSideQuest.progress = gameState.materials[q.target] || 0;
    showItemNotification('퀘스트 수락: ' + q.name);
    renderQuestBoard();
}

function updateSideQuestProgress(type, target) {
    const q = gameState.activeSideQuest;
    if (!q) return;
    if (q.type === 'kill' && type === 'kill' && q.target === target) {
        q.progress++;
        showInvestigationText(q.name + ': ' + q.progress + '/' + q.needed);
    }
    if (q.progress >= q.needed) completeSideQuest();
}

function completeSideQuest() {
    const q = gameState.activeSideQuest;
    if (!q) return;
    addCoins(q.reward.coins);
    gainXP(q.reward.xp);
    gameState.completedSideQuests.push(q.id);
    showItemNotification('퀘스트 완료: ' + q.name + '!');
    gameState.activeSideQuest = null;
    checkAchievements();
    saveGameData();
}

// ==================== DAY/NIGHT SYSTEM ====================
let dayNightLight = null;
let weatherParticles = null;

function updateDayNight(delta) {
    if (!scene || gameState.insideMine || gameState.insideRuins) return;
    gameState.timeOfDay += gameState.daySpeed * delta;
    if (gameState.timeOfDay > 1) gameState.timeOfDay = 0;

    const t = gameState.timeOfDay;
    let skyR, skyG, skyB, lightIntensity;
    if (t < 0.25) {
        const f = t / 0.25;
        skyR = 0.05 + f * 0.48; skyG = 0.05 + f * 0.76; skyB = 0.15 + f * 0.77; lightIntensity = 0.3 + f * 0.7;
    } else if (t < 0.5) {
        skyR = 0.53; skyG = 0.81; skyB = 0.92; lightIntensity = 1.0;
    } else if (t < 0.75) {
        const f = (t - 0.5) / 0.25;
        skyR = 0.53 + f * 0.27; skyG = 0.81 - f * 0.51; skyB = 0.92 - f * 0.42; lightIntensity = 1.0 - f * 0.4;
    } else {
        const f = (t - 0.75) / 0.25;
        skyR = 0.8 - f * 0.75; skyG = 0.3 - f * 0.25; skyB = 0.5 - f * 0.35; lightIntensity = 0.6 - f * 0.3;
    }
    scene.background = new THREE.Color(skyR, skyG, skyB);
    scene.fog = new THREE.Fog(new THREE.Color(skyR, skyG, skyB), 60, 250);

    const timeEl = document.getElementById('time-display');
    if (timeEl) {
        const hour = Math.floor(t * 24);
        const min = Math.floor((t * 24 - hour) * 60);
        const icon = (t > 0.25 && t < 0.75) ? '☀️' : '🌙';
        timeEl.textContent = icon + ' ' + String(hour).padStart(2, '0') + ':' + String(min).padStart(2, '0');
    }
}

// ==================== WEATHER SYSTEM ====================
let rainDrops = [], snowFlakes = [];

function updateWeather(delta) {
    if (gameState.insideMine || gameState.insideRuins) return;
    if (Math.random() < 0.0002) {
        const weathers = ['clear', 'clear', 'clear', 'rain', 'snow'];
        const newW = weathers[Math.floor(Math.random() * weathers.length)];
        if (newW !== gameState.weather) {
            gameState.weather = newW;
            clearWeatherEffects();
            if (newW === 'rain') createRain();
            else if (newW === 'snow') createSnow();
        }
    }
    if (gameState.weather === 'rain') {
        rainDrops.forEach(drop => {
            drop.position.y -= 30 * delta;
            if (drop.position.y < 0) {
                drop.position.y = 20;
                drop.position.x = playerBody.position.x + (Math.random() - 0.5) * 40;
                drop.position.z = playerBody.position.z + (Math.random() - 0.5) * 40;
            }
        });
    } else if (gameState.weather === 'snow') {
        snowFlakes.forEach(flake => {
            flake.position.y -= 3 * delta;
            flake.position.x += Math.sin(Date.now() * 0.001 + flake.userData.offset) * 0.5 * delta;
            if (flake.position.y < 0) {
                flake.position.y = 15;
                flake.position.x = playerBody.position.x + (Math.random() - 0.5) * 30;
                flake.position.z = playerBody.position.z + (Math.random() - 0.5) * 30;
            }
        });
    }
}

function createRain() {
    const mat = new THREE.MeshBasicMaterial({ color: 0x6699cc, transparent: true, opacity: 0.5 });
    for (let i = 0; i < 100; i++) {
        const drop = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.03), mat);
        drop.position.set(playerBody.position.x + (Math.random() - 0.5) * 40, Math.random() * 20, playerBody.position.z + (Math.random() - 0.5) * 40);
        scene.add(drop); rainDrops.push(drop);
    }
}

function createSnow() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 60; i++) {
        const flake = new THREE.Mesh(new THREE.SphereGeometry(0.08, 4, 4), mat);
        flake.position.set(playerBody.position.x + (Math.random() - 0.5) * 30, Math.random() * 15, playerBody.position.z + (Math.random() - 0.5) * 30);
        flake.userData.offset = Math.random() * Math.PI * 2;
        scene.add(flake); snowFlakes.push(flake);
    }
}

function clearWeatherEffects() {
    rainDrops.forEach(d => scene.remove(d)); rainDrops = [];
    snowFlakes.forEach(f => scene.remove(f)); snowFlakes = [];
}

// ==================== PET SYSTEM ====================
let petMesh = null;

function togglePetPanel() {
    const el = document.getElementById('pet-panel');
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
    if (el.style.display === 'block') renderPetPanel();
}

function renderPetPanel() {
    const container = document.getElementById('pet-content');
    if (!container) return;
    if (gameState.pet) {
        container.innerHTML = `<div class="pet-info"><span class="pet-icon">${gameState.pet.icon}</span><span class="pet-name">${gameState.pet.name}</span></div><div class="pet-desc">타입: ${gameState.pet.type} | 공격력: ${gameState.pet.attack}</div><div class="pet-desc">상태: 활성</div>`;
    } else {
        const pets = [
            { name: '꼬마 늑대', icon: '🐺', type: '전투', attack: 3, cost: 200 },
            { name: '아기 드래곤', icon: '🐉', type: '전투', attack: 5, cost: 500 },
            { name: '요정', icon: '🧚', type: '회복', attack: 1, cost: 300 },
        ];
        container.innerHTML = pets.map(p =>
            `<div class="pet-option"><span>${p.icon} ${p.name}</span><span class="pet-desc">${p.type} | 공격: ${p.attack}</span><button onclick="summonPet('${p.name}','${p.icon}','${p.type}',${p.attack},${p.cost})">${p.cost} 코인</button></div>`
        ).join('');
    }
}

function summonPet(name, icon, type, attack, cost) {
    if (gameState.coins < cost) { showInvestigationText('코인이 부족합니다!'); return; }
    gameState.coins -= cost;
    gameState.pet = { name, icon, type, attack };
    updateHUD();
    createPetModel();
    showItemNotification(name + '을(를) 소환했습니다!');
    renderPetPanel();
    saveGameData();
}

function createPetModel() {
    if (petMesh) { scene.remove(petMesh); petMesh = null; }
    if (!gameState.pet) return;
    const group = new THREE.Group();
    const color = gameState.pet.type === '전투' ? 0x888888 : 0x88ddff;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), new THREE.MeshLambertMaterial({ color }));
    body.position.y = 0.3; body.castShadow = true; group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshLambertMaterial({ color }));
    head.position.set(0, 0.6, -0.2); group.add(head);
    for (const sx of [-0.12, 0.12]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), new THREE.MeshBasicMaterial({ color: 0x000000 }));
        eye.position.set(sx, 0.65, -0.35); group.add(eye);
    }
    group.position.copy(playerBody.position);
    group.position.y = gameState.insideMine ? -10 : (gameState.insideRuins ? -20 : 0);
    scene.add(group);
    petMesh = group;
}

function updatePet(delta) {
    if (!petMesh || !gameState.pet) return;
    const targetX = playerBody.position.x + Math.sin(Date.now() * 0.002) * 2;
    const targetZ = playerBody.position.z + Math.cos(Date.now() * 0.002) * 2;
    const groundY = gameState.insideMine ? -10 : (gameState.insideRuins ? -20 : 0);
    petMesh.position.lerp(new THREE.Vector3(targetX, groundY + Math.sin(Date.now() * 0.005) * 0.2, targetZ), 0.05);
    petMesh.rotation.y = Math.atan2(playerBody.position.x - petMesh.position.x, playerBody.position.z - petMesh.position.z);

    if (gameState.pet.type === '전투' && gameState.inCombat) {
        const enemy = enemies.find(e => e.userData.hp > 0 && petMesh.position.distanceTo(e.position) < 8);
        if (enemy && Math.random() < 0.02) {
            enemy.userData.hp -= gameState.pet.attack;
            showDamageNumber(gameState.pet.attack, enemy.position);
            updateEnemyHP(enemy);
            if (enemy.userData.hp <= 0) onEnemyDeath(enemy);
        }
    } else if (gameState.pet.type === '회복' && gameState.playerHp < gameState.playerMaxHp && Math.random() < 0.005) {
        gameState.playerHp = Math.min(gameState.playerMaxHp, gameState.playerHp + 2);
        updateHUD();
    }
}

// ==================== CRAFTING SYSTEM ====================
const craftingRecipes = [
    { name: '체력 물약', icon: '🧪', result: { name: '체력 물약', icon: '🧪', type: 'potion', heal: 40, desc: '체력을 40 회복합니다.' }, needs: { '약초': 3, '물': 1 } },
    { name: '강화된 검', icon: '⚔️', result: { name: '강화된 검', icon: '⚔️', type: 'weapon', minDmg: 5, maxDmg: 12, slot: 'weapon', desc: '대미지 5~12' }, needs: { '철': 5, '나무': 3 } },
    { name: '미스릴 갑옷', icon: '🛡️', result: { name: '미스릴 갑옷', icon: '🛡️', type: 'armor', defense: 8, slot: 'armor', desc: '방어력 +8' }, needs: { '철': 8, '돌': 5, '마법석': 2 } },
    { name: '행운의 부적', icon: '🍀', result: { name: '행운의 부적', icon: '🍀', type: 'accessory', defense: 0, slot: 'accessory', desc: '행운 +5%', luckBonus: 5 }, needs: { '약초': 5, '마법석': 1 } },
    { name: '낚싯대', icon: '🎣', result: { name: '낚싯대', icon: '🎣', type: 'tool', desc: '물고기를 잡을 수 있다.' }, needs: { '나무': 5, '철': 1 } },
    { name: '폭탄', icon: '💣', result: { name: '폭탄', icon: '💣', type: 'consumable', desc: '적에게 50 대미지', damage: 50 }, needs: { '철': 2, '돌': 3 } },
];

function dropMaterials(enemyName) {
    const drops = {
        '독사': [['약초', 0.5], ['마법석', 0.1]],
        '폐광의 그림자': [['마법석', 0.6], ['철', 0.4], ['돌', 0.5]],
        '고대의 수호자': [['마법석', 0.8], ['철', 0.6], ['돌', 0.5]],
    };
    const list = drops[enemyName];
    if (!list) return;
    list.forEach(([mat, chance]) => {
        const luckBonus = gameState.skills.luck * 0.02;
        if (Math.random() < chance + luckBonus) {
            gameState.materials[mat] = (gameState.materials[mat] || 0) + 1;
            showInvestigationText(mat + ' 획득!');
            updateSideQuestProgress('collect', mat);
        }
    });
}

function toggleCrafting() {
    const el = document.getElementById('crafting-screen');
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
    if (el.style.display === 'block') renderCrafting();
}

function renderCrafting() {
    const container = document.getElementById('crafting-list');
    if (!container) return;
    container.innerHTML = '';
    const matDiv = document.getElementById('materials-display');
    if (matDiv) {
        matDiv.innerHTML = '<strong>보유 재료:</strong> ' + (Object.keys(gameState.materials).length ? Object.entries(gameState.materials).map(([k, v]) => k + ':' + v).join(' | ') : '없음');
    }
    craftingRecipes.forEach((recipe, i) => {
        const canCraft = Object.entries(recipe.needs).every(([mat, amt]) => (gameState.materials[mat] || 0) >= amt);
        const div = document.createElement('div');
        div.className = 'craft-card' + (canCraft ? ' craftable' : '');
        div.innerHTML = `<div class="craft-name">${recipe.icon} ${recipe.name}</div><div class="craft-needs">${Object.entries(recipe.needs).map(([k, v]) => k + ' x' + v).join(', ')}</div><button ${canCraft ? '' : 'disabled'} onclick="craftItem(${i})">${canCraft ? '제작' : '재료 부족'}</button>`;
        container.appendChild(div);
    });
}

function craftItem(index) {
    const recipe = craftingRecipes[index];
    const canCraft = Object.entries(recipe.needs).every(([mat, amt]) => (gameState.materials[mat] || 0) >= amt);
    if (!canCraft) return;
    Object.entries(recipe.needs).forEach(([mat, amt]) => { gameState.materials[mat] -= amt; });
    addToInventory({ ...recipe.result });
    showItemNotification(recipe.name + ' 제작 완료!');
    playSFX('coin');
    if (!gameState.achievements.includes('crafted_once')) gameState.achievements.push('crafted_once');
    renderCrafting();
    checkAchievements();
    saveGameData();
}

// ==================== PvP SYSTEM ====================
function challengePvP() {
    let nearest = null, minDist = 15;
    for (const [name, om] of Object.entries(onlineModels)) {
        if (!om.group.visible) continue;
        const dist = playerBody.position.distanceTo(om.group.position);
        if (dist < minDist) { minDist = dist; nearest = name; }
    }
    if (!nearest) { showInvestigationText('근처에 대결할 플레이어가 없습니다!'); return; }
    showInvestigationText(nearest + '에게 결투 신청! (데모)');
    dbSet('pvp/' + nearest, { challenger: currentPlayer.nickname, time: Date.now() });
    showItemNotification(nearest + '에게 결투를 신청했습니다!');
}

// ==================== ACHIEVEMENT SYSTEM ====================
const achievementList = [
    { id: 'first_kill', name: '첫 처치', desc: '적을 처음 처치하세요.', icon: '⚔️', check: () => gameState.kills >= 1 },
    { id: 'kill_10', name: '사냥꾼', desc: '적 10마리를 처치하세요.', icon: '🗡️', check: () => gameState.kills >= 10 },
    { id: 'kill_50', name: '전설의 사냥꾼', desc: '적 50마리를 처치하세요.', icon: '🏆', check: () => gameState.kills >= 50 },
    { id: 'lv5', name: '성장', desc: '레벨 5에 도달하세요.', icon: '⭐', check: () => gameState.level >= 5 },
    { id: 'lv10', name: '베테랑', desc: '레벨 10에 도달하세요.', icon: '🌟', check: () => gameState.level >= 10 },
    { id: 'rich', name: '부자', desc: '코인 1000개를 모으세요.', icon: '💰', check: () => gameState.coins >= 1000 },
    { id: 'crafter', name: '장인', desc: '아이템을 처음 제작하세요.', icon: '🔨', check: () => gameState.achievements.includes('crafted_once') },
    { id: 'fisher', name: '낚시꾼', desc: '물고기를 5마리 잡으세요.', icon: '🐟', check: () => (gameState.materials['물고기'] || 0) >= 5 },
    { id: 'quest3', name: '모험가', desc: '사이드 퀘스트 3개를 완료하세요.', icon: '📜', check: () => gameState.completedSideQuests.length >= 3 },
    { id: 'pet_owner', name: '동반자', desc: '펫을 소환하세요.', icon: '🐾', check: () => !!gameState.pet },
    { id: 'stage2', name: '탐험가', desc: '스테이지 2를 클리어하세요.', icon: '🗺️', check: () => gameState.completedQuests.includes('stage2_complete') },
    { id: 'stage3', name: '영웅', desc: '스테이지 3를 클리어하세요.', icon: '👑', check: () => gameState.completedQuests.includes('stage3_complete') },
];

function checkAchievements() {
    let newAch = false;
    achievementList.forEach(ach => {
        if (gameState.achievements.includes(ach.id)) return;
        if (ach.check()) {
            gameState.achievements.push(ach.id);
            showItemNotification('업적 달성: ' + ach.icon + ' ' + ach.name + '!');
            playSFX('levelup');
            newAch = true;
        }
    });
    if (newAch) saveGameData();
}

function toggleAchievements() {
    const el = document.getElementById('achievements-screen');
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
    if (el.style.display === 'block') renderAchievements();
}

function renderAchievements() {
    const container = document.getElementById('achievements-list');
    if (!container) return;
    container.innerHTML = '';
    achievementList.forEach(ach => {
        const done = gameState.achievements.includes(ach.id);
        const div = document.createElement('div');
        div.className = 'achievement-card' + (done ? ' done' : '');
        div.innerHTML = `<span class="ach-icon">${ach.icon}</span><div class="ach-info"><div class="ach-name">${ach.name}</div><div class="ach-desc">${ach.desc}</div></div><span class="ach-status">${done ? '✅' : '❌'}</span>`;
        container.appendChild(div);
    });
}

// ==================== FISHING SYSTEM ====================
let fishingTimer = null;
let fishingPhase = 0;

function startFishing() {
    if (gameState.fishing) return;
    const hasFishingRod = gameState.inventory.some(i => i && i.name === '낚싯대') || gameState.tools.includes('낚싯대');
    if (!hasFishingRod) { showInvestigationText('낚싯대가 필요합니다! 제작해보세요.'); return; }
    const fishSpot = playerBody.position.distanceTo(new THREE.Vector3(20, PLAYER_HEIGHT, 25)) < 10;
    if (!fishSpot) { showInvestigationText('낚시할 수 있는 장소가 아닙니다! 마을 연못으로 가세요.'); return; }
    gameState.fishing = true;
    fishingPhase = 0;
    document.getElementById('fishing-ui').style.display = 'block';
    document.getElementById('fishing-status').textContent = '기다리는 중...';
    document.getElementById('fishing-bar-fill').style.width = '0%';
    const waitTime = 2000 + Math.random() * 3000;
    fishingTimer = setTimeout(() => {
        fishingPhase = 1;
        document.getElementById('fishing-status').textContent = '물고기가 물었다! 빨리 클릭!';
        document.getElementById('fishing-status').style.color = '#fbbf24';
        playSFX('coin');
        fishingTimer = setTimeout(() => {
            if (fishingPhase === 1) {
                fishingPhase = 0;
                gameState.fishing = false;
                document.getElementById('fishing-ui').style.display = 'none';
                showInvestigationText('물고기가 도망갔습니다...');
            }
        }, 2000);
    }, waitTime);
}

function updateFishing() {
    if (!gameState.fishing) return;
    if (fishingPhase === 1) {
        const fill = document.getElementById('fishing-bar-fill');
        if (fill) fill.style.width = (100 - ((Date.now() % 2000) / 2000 * 100)) + '%';
    }
}

function catchFish() {
    if (fishingPhase !== 1) return;
    clearTimeout(fishingTimer);
    fishingPhase = 0;
    gameState.fishing = false;
    document.getElementById('fishing-ui').style.display = 'none';
    const fishTypes = [
        { name: '붕어', value: 5 },
        { name: '잉어', value: 10 },
        { name: '금붕어', value: 30 },
        { name: '전설의 물고기', value: 100 },
    ];
    const luckBonus = gameState.skills.luck * 0.02;
    const roll = Math.random() + luckBonus;
    const fish = roll > 0.95 ? fishTypes[3] : roll > 0.7 ? fishTypes[2] : roll > 0.4 ? fishTypes[1] : fishTypes[0];
    gameState.materials['물고기'] = (gameState.materials['물고기'] || 0) + 1;
    addCoins(fish.value);
    showItemNotification(fish.name + '을(를) 잡았습니다! +' + fish.value + '코인');
    playSFX('levelup');
    updateSideQuestProgress('collect', '물고기');
    checkAchievements();
    saveGameData();
}

// ==================== SKILL TREE ====================
const skillDefs = {
    vitality: { name: '체력', desc: '방어력 +0.5/포인트', icon: '❤️', max: 20 },
    strength: { name: '힘', desc: '공격력 +1/포인트', icon: '💪', max: 20 },
    agility: { name: '민첩', desc: '회피율 +3%/포인트', icon: '🏃', max: 10 },
    luck: { name: '행운', desc: '드롭율, 낚시 보너스 +2%/포인트', icon: '🍀', max: 10 },
    critical: { name: '치명타', desc: '크리티컬 확률 +3%/포인트', icon: '⚡', max: 10 },
};

function toggleSkillTree() {
    const el = document.getElementById('skill-tree');
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
    if (el.style.display === 'block') renderSkillTree();
}

function renderSkillTree() {
    const container = document.getElementById('skill-list');
    if (!container) return;
    container.innerHTML = '';
    document.getElementById('skill-points-display').textContent = '스킬 포인트: ' + gameState.skillPoints;
    Object.entries(skillDefs).forEach(([key, def]) => {
        const lv = gameState.skills[key] || 0;
        const div = document.createElement('div');
        div.className = 'skill-row';
        div.innerHTML = `<span class="skill-icon">${def.icon}</span><div class="skill-info"><div class="skill-name">${def.name} Lv.${lv}/${def.max}</div><div class="skill-desc">${def.desc}</div><div class="skill-bar-bg"><div class="skill-bar-fill" style="width:${(lv/def.max)*100}%"></div></div></div><button ${gameState.skillPoints > 0 && lv < def.max ? '' : 'disabled'} onclick="upgradeSkill('${key}')">+</button>`;
        container.appendChild(div);
    });
}

function upgradeSkill(key) {
    if (gameState.skillPoints <= 0) return;
    const def = skillDefs[key];
    if ((gameState.skills[key] || 0) >= def.max) return;
    gameState.skills[key] = (gameState.skills[key] || 0) + 1;
    gameState.skillPoints--;
    if (key === 'vitality') gameState.playerMaxHp += 5;
    playSFX('coin');
    renderSkillTree();
    updateHUD();
    saveGameData();
}

// ==================== FISHING SPOT IN WORLD ====================
function buildFishingSpot() {
    const water = new THREE.Mesh(
        new THREE.CircleGeometry(6, 16),
        new THREE.MeshLambertMaterial({ color: 0x2288cc, transparent: true, opacity: 0.7 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(20, 0.05, 25);
    scene.add(water);

    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.5, 0.8), new THREE.MeshLambertMaterial({ color: 0x8B4513 }));
    sign.position.set(15, 0.75, 22);
    scene.add(sign);
}

// ==================== GATHERING SPOTS ====================
function buildGatheringSpots() {
    const spots = [
        { pos: [-20, 0.3, -15], mat: '나무', color: 0x8B4513 },
        { pos: [-15, 0.3, 20], mat: '나무', color: 0x8B4513 },
        { pos: [10, 0.3, -18], mat: '돌', color: 0x888888 },
        { pos: [-25, 0.3, 5], mat: '돌', color: 0x888888 },
        { pos: [5, 0.3, 15], mat: '약초', color: 0x44aa44 },
        { pos: [-10, 0.3, 10], mat: '약초', color: 0x44aa44 },
        { pos: [25, 0.3, 15], mat: '물', color: 0x4488cc },
    ];
    spots.forEach(s => {
        const mesh = new THREE.Mesh(
            s.mat === '나무' ? new THREE.CylinderGeometry(0.3, 0.4, 1.2, 6) :
            s.mat === '돌' ? new THREE.DodecahedronGeometry(0.5) :
            s.mat === '약초' ? new THREE.ConeGeometry(0.3, 0.8, 6) :
            new THREE.SphereGeometry(0.4, 8, 8),
            new THREE.MeshLambertMaterial({ color: s.color, emissive: 0x111111 })
        );
        mesh.position.set(s.pos[0], s.pos[1], s.pos[2]);
        mesh.userData = { name: s.mat + ' 채집', type: 'gather', material: s.mat, gathered: false, respawnTime: 0 };
        scene.add(mesh);
        interactables.push(mesh);
    });
}

// Shake animation
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `@keyframes shake { 0%,100%{transform:translate(0,0)} 10%{transform:translate(-5px,3px)} 20%{transform:translate(5px,-3px)} 30%{transform:translate(-3px,5px)} 40%{transform:translate(3px,-5px)} 50%{transform:translate(-5px,3px)} 60%{transform:translate(5px,-3px)} 70%{transform:translate(-3px,5px)} 80%{transform:translate(3px,-5px)} 90%{transform:translate(-5px,3px)} }`;
document.head.appendChild(shakeStyle);

document.addEventListener('click', resumeAudio, { once: true });
document.addEventListener('keydown', resumeAudio, { once: true });

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && document.getElementById('chat-panel').style.display === 'flex') {
        e.preventDefault();
        sendChatMessage();
    }
});
