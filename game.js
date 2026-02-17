// ==================== CRAZYGAMES SDK ==========================================================
const CrazySDK = {
    crazysdk: null,
    init: async function() {
        if(window.CrazyGames && window.CrazyGames.SDK) {
            try {
                this.crazysdk = window.CrazyGames.SDK;
                await this.crazysdk.init();
                this.requestBanner();
                this.loadData();
            } catch(e) { console.log('SDK Local'); }
        }
    },
    gameplayStart: function() { if(this.crazysdk) this.crazysdk.game.gameplayStart(); },
    gameplayStop: function() { if(this.crazysdk) this.crazysdk.game.gameplayStop(); },
    happytime: function() { if(this.crazysdk) this.crazysdk.game.happytime(); },
    requestBanner: function() { if(this.crazysdk) this.crazysdk.banner.requestBanner({id:"bannerAd",width:320,height:50}); },
    requestRevive: function(cb) {
        if(this.crazysdk) this.crazysdk.ad.requestAd('rewarded', { adFinished: cb, adError: restartGame });
        else cb();
    },
    saveHighScore: function(s) {
        if(this.crazysdk) this.crazysdk.data.setItem('highScore', s.toString());
        localStorage.setItem('highScore', s);
    },
    loadData: function() {
        const best = localStorage.getItem('highScore') || 0;
        const el = document.getElementById('highScore');
        if(el) el.innerText = best;
    }
};

// ==================== GAME VARIABLES ====================
let scene, camera, renderer;
let snakeHead, snakeBody = [], food;
let snakeSegments = [];
let obstacles = [], waterPatches = [], enemySnakes = [], particles = [];

// State
let direction = new THREE.Vector3(1, 0, 0);
let nextDirection = new THREE.Vector3(1, 0, 0);
let score = 0, snakeLength = 3;
let gameState = 'MENU'; 
let lastMoveTime = 0;
let isInWater = false;

// Config
const SPEED_NORMAL = 90;
const SPEED_WATER = 170; 
const SPAWN_DIST = 55;
const SAFE_ZONE = 25; 

// Themes
const THEMES = [
    { main: 0xFF5252, stripe: 0xD32F2F }, // Red
    { main: 0x00E676, stripe: 0x00C853 }, // Green
    { main: 0x448AFF, stripe: 0x2962FF }, // Blue
    { main: 0xFFA726, stripe: 0xEF6C00 }  // Orange
];
let currentTheme = THEMES[1]; 

let touchStartX = 0, touchStartY = 0;

// ==================== INITIALIZATION ====================
async function init() {
    setupGraphics();
    initSnake();
    createFood();
    initEnemies();
    
    // Initial World Gen (Safe)
    for(let i=0; i<40; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = SAFE_ZONE + 5 + Math.random() * 40;
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist;
        spawnRandomObject(x, z);
    }

    setupControls();
    window.addEventListener('resize', onWindowResize);
    animate();
    await CrazySDK.init();
}

function setupGraphics() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 30, 80);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 45, 20);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffe0b2, 1.0);
    sun.position.set(40, 60, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const d = 70;
    sun.shadow.camera.left = -d; sun.shadow.camera.right = d;
    sun.shadow.camera.top = d; sun.shadow.camera.bottom = -d;
    scene.add(sun);

    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(500, 500),
        new THREE.MeshStandardMaterial({ color: 0x66BB6A, roughness: 1, metalness: 0 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.1;
    floor.receiveShadow = true;
    scene.add(floor);
}

// ==================== ENEMIES ====================
function initEnemies() {
    enemySnakes.forEach(e => {
        scene.remove(e.headGroup);
        e.bodyMeshes.forEach(b => scene.remove(b));
    });
    enemySnakes = [];
    for(let i=0; i<4; i++) spawnEnemy();
}

function spawnEnemy() {
    const angle = Math.random() * Math.PI * 2;
    const dist = 35 + Math.random() * 30;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    
    const colors = [0x9C27B0, 0xFFEB3B, 0x00BCD4];
    const color = colors[Math.floor(Math.random()*colors.length)];
    
    const enemy = {
        segments: [], bodyMeshes: [], headGroup: null,
        dir: new THREE.Vector3(Math.random()<0.5?1:-1, 0, 0),
        timer: 0, length: 6
    };
    
    for(let j=0; j<enemy.length; j++) enemy.segments.push(new THREE.Vector3(x-j, 0.5, z));
    
    const g = new THREE.Group();
    const h = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshStandardMaterial({color: color}));
    h.castShadow = true;
    const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshBasicMaterial({color: 0xff0000})); e1.position.set(0.3,0.2,0.35);
    const e2 = e1.clone(); e2.position.set(0.3,0.2,-0.35);
    g.add(h, e1, e2); g.position.copy(enemy.segments[0]); scene.add(g);
    enemy.headGroup = g;
    
    for(let j=1; j<enemy.length; j++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.5,8,8), new THREE.MeshStandardMaterial({color: color}));
        b.position.copy(enemy.segments[j]); b.castShadow = true; scene.add(b); enemy.bodyMeshes.push(b);
    }
    enemySnakes.push(enemy);
}

function updateEnemies(delta) {
    enemySnakes.forEach(e => {
        e.timer += delta;
        if(e.timer > 150) {
            e.timer = 0;
            if(Math.random() < 0.1) {
                const r = Math.random();
                if(r<0.25) e.dir.set(1,0,0); else if(r<0.5) e.dir.set(-1,0,0);
                else if(r<0.75) e.dir.set(0,0,1); else e.dir.set(0,0,-1);
            }
            for(let i=e.segments.length-1; i>0; i--) e.segments[i].copy(e.segments[i-1]);
            e.segments[0].add(e.dir);
            
            if(e.segments[0].distanceTo(snakeSegments[0]) > 90) {
                 const ang = Math.random() * 6.28;
                 e.segments[0].set(snakeSegments[0].x + Math.cos(ang)*45, 0.5, snakeSegments[0].z + Math.sin(ang)*45);
                 for(let i=1; i<e.segments.length; i++) e.segments[i].copy(e.segments[0]);
            }
            
            e.headGroup.position.copy(e.segments[0]);
            e.headGroup.lookAt(e.segments[0].clone().add(e.dir));
            for(let i=0; i<e.bodyMeshes.length; i++) e.bodyMeshes[i].position.copy(e.segments[i+1]);
        }
    });
}

// ==================== REALISTIC ASSETS ====================
function updateWorld() {
    const head = snakeHead.position;
    if (Math.random() < 0.5) {
        const angle = Math.random() * Math.PI * 2;
        const dist = SPAWN_DIST - Math.random() * 5;
        const x = head.x + Math.cos(angle) * dist;
        const z = head.z + Math.sin(angle) * dist;
        if (new THREE.Vector3(x,0,z).distanceTo(head) > 20) {
            if (isPosClear(x, z)) spawnRandomObject(x, z);
        }
    }
    cullObjects(obstacles, head, 65);
    cullObjects(waterPatches, head, 65);
}

function isPosClear(x, z) {
    for(let o of obstacles) if(o.position.distanceToSquared(new THREE.Vector3(x,0,z)) < 25) return false;
    return true;
}

function cullObjects(arr, head, dist) {
    for (let i = arr.length - 1; i >= 0; i--) {
        if (arr[i].position.distanceTo(head) > dist) {
            scene.remove(arr[i]); arr.splice(i, 1);
        }
    }
}

function spawnRandomObject(x, z) {
    const r = Math.random();
    if (r < 0.1) createWater(x, z);
    else if (r < 0.25) createMushroom(x, z);
    else if (r < 0.45) createPine(x, z);
    else if (r < 0.6) createOak(x, z);
    else if (r < 0.75) createStump(x, z);
    else if (r < 0.85) createRock(x, z);
    else createLog(x, z);
}

// Realistic Object Generators
function createPine(x,z){
    const g=new THREE.Group();
    const t=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.5,1.5,7), new THREE.MeshStandardMaterial({color:0x3E2723}));
    t.position.y=0.75; t.castShadow=true;
    const m=new THREE.MeshStandardMaterial({color:0x1B5E20, roughness: 0.8});
    const c1=new THREE.Mesh(new THREE.ConeGeometry(1.8, 2.5, 7), m); c1.position.y=2; c1.castShadow=true;
    const c2=new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.2, 7), m); c2.position.y=3.5; c2.castShadow=true;
    const c3=new THREE.Mesh(new THREE.ConeGeometry(1.0, 1.8, 7), m); c3.position.y=4.8; c3.castShadow=true;
    g.add(t,c1,c2,c3); g.position.set(x,0,z); scene.add(g); obstacles.push(g);
}

function createOak(x,z){
    const g=new THREE.Group();
    const t=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.7,1.5,8), new THREE.MeshStandardMaterial({color:0x5D4037}));
    t.position.y=0.75; t.castShadow=true;
    const m=new THREE.MeshStandardMaterial({color:0x43A047, roughness: 0.9});
    const l1=new THREE.Mesh(new THREE.DodecahedronGeometry(1.5), m); l1.position.y=2.2; l1.castShadow=true;
    const l2=new THREE.Mesh(new THREE.DodecahedronGeometry(1.0), m); l2.position.set(0.8, 2.5, 0); l2.castShadow=true;
    const l3=new THREE.Mesh(new THREE.DodecahedronGeometry(1.0), m); l3.position.set(-0.8, 2.5, 0.5); l3.castShadow=true;
    g.add(t,l1,l2,l3); g.position.set(x,0,z); scene.add(g); obstacles.push(g);
}

function createRock(x,z){
    const g=new THREE.Group();
    const m=new THREE.MeshStandardMaterial({color:0x757575, roughness: 0.9});
    const r1=new THREE.Mesh(new THREE.DodecahedronGeometry(0.7,0), m); r1.position.y=0.4; r1.castShadow=true;
    const r2=new THREE.Mesh(new THREE.DodecahedronGeometry(0.5,0), m); r2.position.set(0.6, 0.2, 0.3); r2.castShadow=true;
    g.add(r1,r2); g.rotation.y=Math.random()*6; g.position.set(x,0,z); scene.add(g); obstacles.push(g);
}

function createMushroom(x,z){
    const g=new THREE.Group();
    const s=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.25,0.8,6), new THREE.MeshStandardMaterial({color:0xFFF9C4}));
    s.position.y=0.4; s.castShadow=true;
    const c=new THREE.Mesh(new THREE.SphereGeometry(0.6,16,16,0,6.28,0,1.57), new THREE.MeshStandardMaterial({color:0xFF5252}));
    c.position.y=0.8; c.castShadow=true;
    const dMat = new THREE.MeshBasicMaterial({color:0xffffff});
    const d1=new THREE.Mesh(new THREE.SphereGeometry(0.1), dMat); d1.position.set(0.3, 1.1, 0.1);
    const d2=new THREE.Mesh(new THREE.SphereGeometry(0.12), dMat); d2.position.set(-0.2, 1.2, -0.2);
    g.add(s,c,d1,d2); g.position.set(x,0,z); scene.add(g); obstacles.push(g);
}

function createStump(x,z){
    const g=new THREE.Group();
    const s=new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.8,0.8,9), new THREE.MeshStandardMaterial({color:0x5D4037}));
    s.position.y=0.4; s.castShadow=true;
    const t=new THREE.Mesh(new THREE.CircleGeometry(0.55,9), new THREE.MeshStandardMaterial({color:0x8D6E63}));
    t.rotation.x=-1.57; t.position.y=0.81;
    g.add(s,t); g.position.set(x,0,z); scene.add(g); obstacles.push(g);
}

function createLog(x,z){
    const m=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.3,2.5,7), new THREE.MeshStandardMaterial({color:0x4E342E}));
    m.rotation.z=1.57; m.rotation.y=Math.random()*6; m.position.set(x,0.3,z); m.castShadow=true; scene.add(m); obstacles.push(m);
}

function createWater(x,z){
    const m=new THREE.Mesh(new THREE.CircleGeometry(3.0,16), new THREE.MeshStandardMaterial({color:0x29B6F6, transparent:true, opacity:0.6}));
    m.rotation.x=-1.57; m.position.set(x,0.05,z); scene.add(m); waterPatches.push(m);
}

// ==================== PLAYER SNAKE ====================
function initSnake() {
    if(snakeHead) scene.remove(snakeHead);
    snakeBody.forEach(b => scene.remove(b));
    snakeBody = []; snakeSegments = [];
    for(let i=0; i<snakeLength; i++) snakeSegments.push(new THREE.Vector3(-i, 0.5, 0));
    
    snakeHead = new THREE.Group();
    const h = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshStandardMaterial({color: currentTheme.main})); h.castShadow = true;
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshBasicMaterial({color:0xffffff}));
    const e1 = e.clone(); e1.position.set(0.3,0.2,0.35); const e2 = e.clone(); e2.position.set(0.3,0.2,-0.35);
    snakeHead.add(h, e1, e2); snakeHead.position.copy(snakeSegments[0]); scene.add(snakeHead);
    
    for(let i=1; i<snakeLength; i++) addBodySegment(i);
}

function addBodySegment(i) {
    const c = (i % 2 === 0) ? currentTheme.main : currentTheme.stripe;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.5,16,16), new THREE.MeshStandardMaterial({color:c}));
    m.position.copy(snakeSegments[i]); m.castShadow = true; snakeBody.push(m); scene.add(m);
}

function changeColor() {
    let t = currentTheme; while(t===currentTheme) t=THEMES[Math.floor(Math.random()*THEMES.length)];
    currentTheme = t;
    snakeHead.children[0].material.color.setHex(t.main);
    for(let i=0; i<snakeBody.length; i++) snakeBody[i].material.color.setHex((i+1)%2===0 ? t.main : t.stripe);
}

function createFood() {
    if(food) scene.remove(food);
    const g=new THREE.Group();
    const a=new THREE.Mesh(new THREE.SphereGeometry(0.5,16,16),new THREE.MeshStandardMaterial({color:0xFF1744}));
    const l=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.1,0.4),new THREE.MeshStandardMaterial({color:0x64DD17})); l.position.set(0,0.5,0);
    g.add(a,l);
    
    const h = snakeSegments[0];
    const ang = Math.atan2(direction.z, direction.x) + (Math.random()-0.5)*1.5;
    const d = 15 + Math.random() * 10;
    g.position.set(h.x+Math.cos(ang)*d, 0.5, h.z+Math.sin(ang)*d);
    g.castShadow=true; food=g; scene.add(food);
}

function moveSnake() {
    direction.copy(nextDirection);
    for(let i=snakeSegments.length-1; i>0; i--) snakeSegments[i].copy(snakeSegments[i-1]);
    snakeSegments[0].add(direction);
    snakeHead.position.copy(snakeSegments[0]); snakeHead.lookAt(snakeSegments[0].clone().add(direction));
    for(let i=0; i<snakeBody.length; i++) snakeBody[i].position.copy(snakeSegments[i+1]);

    const tx = snakeSegments[0].x; const tz = snakeSegments[0].z + 14;
    camera.position.x += (tx-camera.position.x)*0.1; camera.position.z += (tz-camera.position.z)*0.1;
    camera.lookAt(camera.position.x, 0, camera.position.z-15);

    const h=snakeSegments[0];
    let w=false; for(let p of waterPatches) if(h.distanceTo(p.position)<2.8) { w=true; break; }
    if(w!==isInWater) { isInWater=w; document.getElementById('waterOverlay').classList.toggle('active',w); }

    updateWorld();
    checkCollisions();
}

function checkCollisions() {
    const h = snakeSegments[0];
    
    // Self Collision
    for(let i=1; i<snakeSegments.length; i++) {
        if(h.distanceTo(snakeSegments[i]) < 0.1) { fail(); return; }
    }
    
    // Obstacle Collision (Increased Radius to 2.2)
    for(let o of obstacles) {
        // Distance on XZ plane only
        const dx = h.x - o.position.x;
        const dz = h.z - o.position.z;
        const distSq = dx*dx + dz*dz;
        
        // 2.2 * 2.2 = 4.84
        if(distSq < 4.84) { fail(); return; }
    }
    
    // Enemy Collision
    for(let e of enemySnakes) {
        if(h.distanceTo(e.segments[0]) < 1.5) { fail(); return; }
        for(let s of e.segments) {
            if(h.distanceTo(s) < 1.0) { fail(); return; }
        }
    }
    
    // Food
    if(h.distanceTo(food.position) < 1.5) {
        score += 100; snakeLength++; document.getElementById('score').innerText=score;
        spawnParticles(food.position, currentTheme.main); changeColor();
        const t=snakeSegments[snakeSegments.length-1].clone(); snakeSegments.push(t); addBodySegment(snakeBody.length+1);
        createFood();
        if(score%500===0) CrazySDK.happytime();
    }
}

function fail() { spawnParticles(snakeHead.position, 0xFF5252); gameOver(); }
function spawnParticles(p,c) { for(let i=0;i<10;i++) { const m=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.3,0.3),new THREE.MeshBasicMaterial({color:c})); m.position.copy(p); m.userData.vel=new THREE.Vector3((Math.random()-0.5),Math.random(),(Math.random()-0.5)); scene.add(m); particles.push(m); }}

// ==================== STATE MANAGEMENT ====================
function startGame() {
    gameState='PLAYING';
    document.querySelectorAll('.overlay').forEach(e => {
        e.classList.remove('active');
        e.style.display = 'none';
    });
    document.getElementById('hud').style.display='flex';
    CrazySDK.gameplayStart();
}

function gameOver() {
    gameState='GAME_OVER';
    CrazySDK.gameplayStop();
    CrazySDK.saveHighScore(score);
    document.getElementById('finalScore').innerText = score;
    document.getElementById('finalBest').innerText = localStorage.getItem('highScore') || score;
    document.getElementById('hud').style.display = 'none';
    
    // Force show Game Over screen
    const go = document.getElementById('gameOver');
    go.style.display = 'flex';
    void go.offsetWidth; // Trigger reflow
    go.classList.add('active');
}

function restartGame() {
    score=0; snakeLength=3; document.getElementById('score').innerText=0;
    obstacles.forEach(o=>scene.remove(o)); obstacles=[];
    waterPatches.forEach(w=>scene.remove(w)); waterPatches=[];
    
    initSnake(); initEnemies(); createFood();
    for(let i=0; i<30; i++) {
        const a=Math.random()*6.28; const d=SAFE_ZONE+5+Math.random()*40;
        spawnRandomObject(Math.cos(a)*d, Math.sin(a)*d);
    }
    startGame();
}

function quitToMenu() {
    gameState='MENU';
    obstacles.forEach(o=>scene.remove(o)); obstacles=[];
    waterPatches.forEach(w=>scene.remove(w)); waterPatches=[];
    initSnake(); 
    camera.position.set(0, 45, 20); camera.lookAt(0, 0, 0);

    document.getElementById('hud').style.display='none';
    document.querySelectorAll('.overlay').forEach(e => {
        e.classList.remove('active'); e.style.display='none';
    });
    const start = document.getElementById('startScreen');
    start.style.display='flex';
    void start.offsetWidth;
    start.classList.add('active');
}

function togglePause() {
    const ps = document.getElementById('pauseScreen');
    if(gameState==='PLAYING') {
        gameState='PAUSED';
        ps.style.display='flex'; void ps.offsetWidth; ps.classList.add('active');
    } else if(gameState==='PAUSED') {
        gameState='PLAYING';
        ps.classList.remove('active'); setTimeout(() => ps.style.display='none', 300);
        lastMoveTime = performance.now();
    }
}

// ==================== LOOP ====================
function animate(time) {
    requestAnimationFrame(animate);
    const speed = isInWater ? 170 : 90;
    if(gameState==='PLAYING' && time-lastMoveTime > speed) {
        moveSnake(); updateEnemies(time-lastMoveTime); lastMoveTime=time;
    }
    if(food) { food.rotation.y+=0.05; food.scale.setScalar(1+Math.sin(time*0.005)*0.1); }
    for(let i=particles.length-1; i>=0; i--) {
        const p=particles[i]; p.position.add(p.userData.vel); p.scale.subScalar(0.04);
        if(p.scale.x<=0) { scene.remove(p); particles.splice(i,1); }
    }
    renderer.render(scene, camera);
}

function setupControls() {
    document.getElementById('startBtn').onclick = startGame;
    document.getElementById('restartBtn').onclick = restartGame;
    document.getElementById('quitBtn').onclick = quitToMenu;
    document.getElementById('quitFromPauseBtn').onclick = quitToMenu;
    document.getElementById('pauseBtn').onclick = togglePause;
    document.getElementById('resumeBtn').onclick = togglePause;
    
    document.getElementById('reviveBtn').onclick = () => CrazySDK.requestRevive(() => {
        const h = snakeSegments[0];
        obstacles.forEach((o,i)=>{if(o.position.distanceTo(h)<10){scene.remove(o);obstacles.splice(i,1)}});
        enemySnakes.forEach(e=>{if(e.segments[0].distanceTo(h)<15)e.segments[0].set(100,0,100)});
        direction.set(1,0,0); nextDirection.set(1,0,0);
        document.getElementById('gameOver').classList.remove('active');
        document.getElementById('gameOver').style.display='none';
        document.getElementById('hud').style.display='flex';
        gameState='PLAYING';
    });

    document.addEventListener('keydown', e => {
        const k=e.key.toLowerCase();
        if(k==='escape'||k==='p') togglePause();
        if(gameState!=='PLAYING') return;
        if((k==='w'||k==='arrowup')&&direction.z!==1) nextDirection.set(0,0,-1);
        if((k==='s'||k==='arrowdown')&&direction.z!==-1) nextDirection.set(0,0,1);
        if((k==='a'||k==='arrowleft')&&direction.x!==1) nextDirection.set(-1,0,0);
        if((k==='d'||k==='arrowright')&&direction.x!==-1) nextDirection.set(1,0,0);
    });
    
    document.addEventListener('touchstart', e=>{if(!e.target.closest('button')){touchStartX=e.touches[0].clientX;touchStartY=e.touches[0].clientY;}},{passive:false});
    document.addEventListener('touchend', e=>{
        if(e.target.closest('button')) return;
        const dx=e.changedTouches[0].clientX-touchStartX; const dy=e.changedTouches[0].clientY-touchStartY;
        if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>30) { if(dx>0&&direction.x!==-1)nextDirection.set(1,0,0); else if(dx<0&&direction.x!==1)nextDirection.set(-1,0,0); }
        else if(Math.abs(dy)>30) { if(dy>0&&direction.z!==-1)nextDirection.set(0,0,1); else if(dy<0&&direction.z!==1)nextDirection.set(0,0,-1); }
    },{passive:false});
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}


window.addEventListener('DOMContentLoaded', init);
