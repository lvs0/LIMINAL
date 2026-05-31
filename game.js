import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ═══════════════════════════════════════════════════════════════
//  LIMINAL — Chef d'œuvre psychologique interactif
//  Moteur Three.js + Post-processing + Audio spatialisé
// ═══════════════════════════════════════════════════════════════

class LiminalEngine {
    constructor() {
        this.scene = null; this.camera = null; this.renderer = null; this.composer = null;
        this.player = { x:0, y:1.7, z:5, rotY:0, rotX:0, speed:.12 };
        this.keys = {}; this.touch = { active:false, startX:0, startY:0, currX:0, currY:0 };
        this.sanity = 100; this.time = 0; this.chapter = 0; this.subtitleIdx = 0;
        this.objects = []; this.interactables = []; this.lights = []; this.particles = null;
        this.heartbeat = null; this.audioCtx = null; this.ambienceNode = null;
        this.narrativeEl = document.getElementById('narrative');
        this.choicesEl = document.getElementById('choices');
        this.sanityFill = document.getElementById('sanity-fill');
        this.grainEl = document.getElementById('grain');
        this.vignetteEl = document.getElementById('vignette');
        this.subtitles = [
            "Vous vous réveillez dans un couloir qui n'existe pas. Les murs respirent silencieusement.",
            "Cet endroit n'existe pas. C'est une projection de votre culpabilité, fossilisée dans l'espace-temps.",
            "Les murmures que vous entendez sont vos propres pensées, échos d'une vie que vous avez essayé d'oublier.",
            "Chaque pas vous rapproche de la vérité. Chaque vérité vous efface un peu plus.",
            "Il n'y a pas de monstre ici. Seulement vous, et tout ce que vous avez enfoui.",
            "Le miroir ne reflète pas votre visage. Il reflète la personne que vous auriez pu devenir.",
            "Les murs se rapprochent quand vous ne les regardez pas. Ou peut-être est-ce vous qui reculez ?",
            "Ce téléphone n'est pas branché. Pourtant, il sonne. Et vous savez qui est au bout du fil.",
            "La pendule indique 3h17 depuis que vous êtes arrivé. Ou peut-être 3h17 indique votre âge mental.",
            "La porte à votre gauche mène à l'endroit où vous avez laissé quelqu'un. Vous savez de qui il s'agit."
        ];
        this.storyChoices = {
            2: [
                { text: "Regarder le miroir", action: () => this.triggerMirror() },
                { text: "Détourner le regard", action: () => this.avoidMirror() }
            ],
            5: [
                { text: "Décrocher le téléphone", action: () => this.answerPhone() },
                { text: "Ignorer l'appel", action: () => this.ignorePhone() }
            ],
            8: [
                { text: "Ouvrir la porte rouge", action: () => this.openRedDoor() },
                { text: "Rester dans le couloir", action: () => this.stayCorridor() }
            ]
        };
        this.clock = new THREE.Clock();
        this.init();
    }

    init() {
        // Scène
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x050505, .035);
        // Caméra
        this.camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, .1, 100);
        this.camera.position.set(0, 1.7, 5);
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias:false, powerPreference:'high-performance' });
        this.renderer.setSize(innerWidth, innerHeight);
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = .7;
        // Post-processing
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .4, .5, .85);
        this.composer.addPass(this.bloom);
        // Build world
        this.buildWorld();
        this.buildAtmosphere();
        this.buildAudio();
        // Events
        this.setupInput();
        // UI
        setTimeout(()=>{ document.getElementById('loading').style.opacity=0; setTimeout(()=>document.getElementById('loading').remove(),2500); }, 1000);
        document.getElementById('start-btn').addEventListener('click', ()=>this.startGame());
        window.addEventListener('resize', ()=>this.onResize());
        // Loop
        this.animate();
    }

    buildWorld() {
        // Textures procédurales avancées
        const wallTex = this.procTexture(512, (ctx,w,h)=>{
            ctx.fillStyle='#0d0d0d'; ctx.fillRect(0,0,w,h);
            for(let i=0;i<80000;i++){ ctx.fillStyle=Math.random()>.5?'#111':'#0a0a0a'; ctx.fillRect(Math.random()*w,Math.random()*h,Math.random()*3,Math.random()*3); }
            // Moisture stains
            for(let i=0;i<30;i++){ let x=Math.random()*w,y=Math.random()*h,r=20+Math.random()*80; let g=ctx.createRadialGradient(x,y,0,x,y,r); g.addColorStop(0,'rgba(30,30,30,.4)'); g.addColorStop(1,'transparent'); ctx.fillStyle=g; ctx.fillRect(x-r,y-r,r*2,r*2); }
        });
        const floorTex = this.procTexture(512, (ctx,w,h)=>{
            ctx.fillStyle='#080808'; ctx.fillRect(0,0,w,h);
            for(let i=0;i<60000;i++){ ctx.fillStyle=Math.random()>.6?'#0f0f0f':'#050505'; ctx.fillRect(Math.random()*w,Math.random()*h,Math.random()*2,Math.random()*2); }
            // Tile lines
            ctx.strokeStyle='rgba(40,40,40,.3)'; ctx.lineWidth=1;
            for(let i=0;i<=w;i+=64){ ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,h); ctx.stroke(); }
            for(let i=0;i<=h;i+=64){ ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(w,i); ctx.stroke(); }
        });
        const ceilingTex = this.procTexture(512, (ctx,w,h)=>{
            ctx.fillStyle='#050505'; ctx.fillRect(0,0,w,h);
            for(let i=0;i<40000;i++){ ctx.fillStyle=Math.random()>.5?'#080808':'#030303'; ctx.fillRect(Math.random()*w,Math.random()*h,Math.random()*3,Math.random()*3); }
        });
        [wallTex,floorTex,ceilingTex].forEach(t=>{ t.wrapS=t.wrapT=THREE.RepeatWrapping; });
        const wallMat = new THREE.MeshStandardMaterial({ map:wallTex, roughness:.95, metalness:.05, color:0x333333 });
        const floorMat = new THREE.MeshStandardMaterial({ map:floorTex, roughness:.7, metalness:.15, color:0x111111 });
        const ceilMat = new THREE.MeshStandardMaterial({ map:ceilingTex, roughness:.9, metalness:.02, color:0x0a0a0a });

        // Labyrinthe procédural — 8 segments de couloirs
        const corridors = [
            [0,0,0, 12,3.2,3.2, 0],      // Hall d'entrée
            [0,0,-8, 12,3.2,3.2, Math.PI/2], // Gauche
            [8,0,-8, 16,3.2,3.2, 0],     // Long couloir
            [16,0,-8, 8,3.2,3.2, Math.PI/2], // Droite
            [16,0,-16, 10,3.2,3.2, 0],   // Profond
            [-6,0,0, 8,3.2,3.2, Math.PI/2], // Vers miroir
            [-6,0,-8, 8,3.2,3.2, 0],    // Salle miroir
            [0,0,8, 8,3.2,3.2, 0],       // Couloir retour
        ];
        corridors.forEach(([x,y,z,l,h,w,rot])=>this.buildCorridor(x,y,z,l,h,w,rot,wallMat,floorMat,ceilMat));

        // Salle du miroir (plus grande)
        this.buildRoom(-6,0,-12, 6,4,6, wallMat,floorMat,ceilMat);

        // Objets interactifs
        this.addInteractable(-5.5,.8,-11.5, 'miroir', 0x4444ff, .5, 1.8, .05);
        this.addInteractable(2,.4,0, 'livre', 0xff4400, .3, .05, .4);
        this.addInteractable(8,.5,-8, 'telephone', 0x00ff00, .15, .1, .15);
        this.addInteractable(14,.5,-8, 'porte_rouge', 0xcc0000, 1.2, 2.2, .08);
        this.addInteractable(16,1,-15, 'pendule', 0xffaa00, .3, .3, .3);
        this.addInteractable(-2,.3,2, 'photo', 0xffffff, .2, .25, .02);

        // Ombre humaine (silhouette)
        this.createSilhouette(10, 0, -8);

        // Lumières d'ambiance + flickering
        this.addFlickerLight(0, 2.8, 0, 0xffaa44, 3, .02);
        this.addFlickerLight(8, 2.8, -8, 0xff4400, 2, .04);
        this.addFlickerLight(-6, 2.8, -12, 0x4444ff, 1.5, .03);
        this.addFlickerLight(16, 2.8, -16, 0xff0000, 1, .05);

        // Lumière faible ambiente
        const amb = new THREE.AmbientLight(0x111111, .15);
        this.scene.add(amb);
    }

    procTexture(size, drawFn) {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const ctx = c.getContext('2d');
        drawFn(ctx, size, size);
        const tex = new THREE.CanvasTexture(c);
        tex.needsUpdate = true;
        return tex;
    }

    buildCorridor(x,y,z,len,h,wid,rot,wallMat,floorMat,ceilMat) {
        const g = new THREE.Group();
        const fl = new THREE.Mesh(new THREE.PlaneGeometry(wid, len), floorMat);
        fl.rotation.x = -Math.PI/2; fl.receiveShadow = true; g.add(fl);
        const cl = new THREE.Mesh(new THREE.PlaneGeometry(wid, len), ceilMat);
        cl.rotation.x = Math.PI/2; cl.position.y = h; g.add(cl);
        const wg = new THREE.PlaneGeometry(len, h);
        const wl = new THREE.Mesh(wg, wallMat); wl.position.set(-wid/2, h/2, 0); wl.rotation.y = Math.PI/2; wl.receiveShadow = true; g.add(wl);
        const wr = new THREE.Mesh(wg, wallMat); wr.position.set(wid/2, h/2, 0); wr.rotation.y = -Math.PI/2; wr.receiveShadow = true; g.add(wr);
        g.position.set(x,y,z); if(rot) g.rotation.y = rot;
        this.scene.add(g);
    }

    buildRoom(x,y,z,w,h,d,wallMat,floorMat,ceilMat) {
        const g = new THREE.Group();
        const fl = new THREE.Mesh(new THREE.PlaneGeometry(w,d), floorMat);
        fl.rotation.x = -Math.PI/2; fl.receiveShadow = true; g.add(fl);
        const cl = new THREE.Mesh(new THREE.PlaneGeometry(w,d), ceilMat);
        cl.rotation.x = Math.PI/2; cl.position.y = h; g.add(cl);
        const walls = [
            {p:[0,h/2,-d/2], s:[w,h], r:[0,0,0]},
            {p:[0,h/2,d/2], s:[w,h], r:[0,Math.PI,0]},
            {p:[-w/2,h/2,0], s:[d,h], r:[0,Math.PI/2,0]},
            {p:[w/2,h/2,0], s:[d,h], r:[0,-Math.PI/2,0]}
        ];
        walls.forEach(({p,s,r})=>{ const m = new THREE.Mesh(new THREE.PlaneGeometry(s[0],s[1]), wallMat); m.position.set(...p); m.rotation.set(...r); m.receiveShadow = true; g.add(m); });
        g.position.set(x,y,z); this.scene.add(g);
    }

    addInteractable(x,y,z,type,color,sx,sy,sz) {
        const geo = new THREE.BoxGeometry(sx,sy,sz);
        const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .15, roughness:.6 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x,y,z);
        mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.userData = { type, interacted:false };
        // Lumière ponctuelle douce
        const pl = new THREE.PointLight(color, .6, 2);
        pl.position.set(0, .3, .2); mesh.add(pl);
        this.scene.add(mesh); this.interactables.push(mesh);
    }

    createSilhouette(x,y,z) {
        const geo = new THREE.CapsuleGeometry(.25, 1.6, 4, 8);
        const mat = new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:.85 });
        this.silhouette = new THREE.Mesh(geo, mat);
        this.silhouette.position.set(x, .8, z);
        this.scene.add(this.silhouette);
    }

    addFlickerLight(x,y,z,color,intensity,flickerRate) {
        const l = new THREE.PointLight(color, intensity, 8);
        l.position.set(x,y,z); l.castShadow = true; l.shadow.mapSize.set(512,512);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(.06,8,8), new THREE.MeshBasicMaterial({color}));
        l.add(bulb); this.scene.add(l); this.lights.push({light:l, base:intensity, rate:flickerRate, phase:Math.random()*10});
    }

    buildAtmosphere() {
        // Particules poussière / brume
        const cnt = 2000;
        const pos = new Float32Array(cnt*3);
        for(let i=0;i<cnt*3;i+=3){ pos[i]=(Math.random()-.5)*40; pos[i+1]=Math.random()*4; pos[i+2]=(Math.random()-.5)*40; }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
        const mat = new THREE.PointsMaterial({ color:0x444444, size:.04, transparent:true, opacity:.3, blending:THREE.AdditiveBlending });
        this.particles = new THREE.Points(geo, mat); this.scene.add(this.particles);
    }

    buildAudio() {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if(!AudioCtx) return;
        this.audioCtx = new AudioCtx();
        // Drone ambiant profond (sous-basse + harmoniques)
        this.createDrone();
        this.createHeartbeat();
        // Murmures occasionnels
        setInterval(()=>{ if(Math.random()>.65 && this.sanity<75) this.createWhisper(); }, 12000);
    }

    createDrone() {
        const c = this.audioCtx;
        const osc1 = c.createOscillator(), osc2 = c.createOscillator(), osc3 = c.createOscillator();
        const g1 = c.createGain(), g2 = c.createGain(), g3 = c.createGain();
        const f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter();
        [osc1,osc2,osc3].forEach((o,i)=>{ o.type=['sine','sawtooth','sine'][i]; o.frequency.value=[55,110,58][i]; });
        f1.type='lowpass'; f1.frequency.value=180; f1.Q.value=2;
        f2.type='highpass'; f2.frequency.value=40;
        g1.gain.value=.04; g2.gain.value=.015; g3.gain.value=.02;
        osc1.connect(g1); g1.connect(f1); f1.connect(f2);
        osc2.connect(g2); g2.connect(f1);
        osc3.connect(g3); g3.connect(f2);
        f2.connect(c.destination);
        osc1.start(); osc2.start(); osc3.start();
        this.ambienceNode = { osc1,osc2,osc3,g1,g2,g3,f1,f2 };
        // Modulations lentes
        setInterval(()=>{
            if(!this.ambienceNode) return;
            osc1.frequency.linearRampToValueAtTime(45+Math.random()*15, c.currentTime+3);
            osc3.frequency.linearRampToValueAtTime(52+Math.random()*12, c.currentTime+2);
            f1.frequency.linearRampToValueAtTime(140+Math.random()*80, c.currentTime+4);
        }, 4000);
    }

    createHeartbeat() {
        const c = this.audioCtx; if(!c) return;
        const beat = () => {
            if(this.sanity > 70) { setTimeout(beat, 2000); return; }
            const t = c.currentTime;
            const o = c.createOscillator(); const g = c.createGain();
            o.type='sine'; o.frequency.setValueAtTime(40, t);
            o.frequency.exponentialRampToValueAtTime(25, t+.15);
            g.gain.setValueAtTime(.12*(1-this.sanity/100), t);
            g.gain.exponentialRampToValueAtTime(.001, t+.25);
            o.connect(g); g.connect(c.destination);
            o.start(t); o.stop(t+.3);
            // Second beat
            const o2=c.createOscillator(), g2=c.createGain();
            o2.type='sine'; o2.frequency.setValueAtTime(35, t+.35);
            g2.gain.setValueAtTime(.08*(1-this.sanity/100), t+.35);
            g2.gain.exponentialRampToValueAtTime(.001, t+.55);
            o2.connect(g2); g2.connect(c.destination);
            o2.start(t+.35); o2.stop(t+.6);
            const interval = 800 + (this.sanity/100)*1200;
            setTimeout(beat, interval);
        };
        setTimeout(beat, 3000);
    }

    createWhisper() {
        const c = this.audioCtx; if(!c) return;
        const dur = 2 + Math.random()*2;
        const buf = c.createBuffer(1, c.sampleRate*dur, c.sampleRate);
        const d = buf.getChannelData(0);
        for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*.04;
        const s = c.createBufferSource(); s.buffer = buf;
        const g = c.createGain(); g.gain.setValueAtTime(0, c.currentTime);
        g.gain.linearRampToValueAtTime(.035*(1-this.sanity/150), c.currentTime+.3);
        g.gain.linearRampToValueAtTime(0, c.currentTime+dur);
        const f = c.createBiquadFilter(); f.type='bandpass';
        f.frequency.value = 800 + Math.random()*2000; f.Q.value = 3;
        s.connect(f); f.connect(g); g.connect(c.destination);
        s.start(); s.stop(c.currentTime+dur);
    }

    playFootstep() {
        const c = this.audioCtx; if(!c) return;
        const t = c.currentTime;
        const buf = c.createBuffer(1, c.sampleRate*.15, c.sampleRate);
        const d = buf.getChannelData(0);
        for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(.1-i/d.length*.09);
        const s = c.createBufferSource(); s.buffer = buf;
        const g = c.createGain(); g.gain.value=.06;
        const f = c.createBiquadFilter(); f.type='lowpass'; f.frequency.value=800;
        s.connect(f); f.connect(g); g.connect(c.destination);
        s.start(t); s.stop(t+.15);
    }

    setupInput() {
        // Clavier
        document.addEventListener('keydown', e=>{ this.keys[e.key.toLowerCase()]=true; if(e.key.toLowerCase()==='e'||e.key==='Enter') this.interact(); if(e.key==='Escape') this.showPause(); });
        document.addEventListener('keyup', e=>this.keys[e.key.toLowerCase()]=false);
        // Souris (desktop)
        document.addEventListener('mousemove', e=>{
            if(document.pointerLockElement){
                this.player.rotY -= e.movementX*.002;
                this.player.rotX -= e.movementY*.002;
                this.player.rotX = Math.max(-Math.PI/2.2, Math.min(Math.PI/2.2, this.player.rotX));
            }
        });
        document.addEventListener('click', ()=>{ if(document.pointerLockElement) this.interact(); });
        // Touch (mobile)
        const cv = document.getElementById('game-canvas');
        cv.addEventListener('touchstart', e=>{
            this.touch.active = true; this.touch.startX = e.touches[0].clientX; this.touch.startY = e.touches[0].clientY;
            this.touch.currX = this.touch.startX; this.touch.currY = this.touch.startY;
        }, {passive:false});
        cv.addEventListener('touchmove', e=>{
            if(!this.touch.active) return;
            const dx = e.touches[0].clientX - this.touch.currX;
            const dy = e.touches[0].clientY - this.touch.currY;
            this.player.rotY -= dx * .006;
            this.player.rotX -= dy * .006;
            this.player.rotX = Math.max(-Math.PI/2.2, Math.min(Math.PI/2.2, this.player.rotX));
            this.touch.currX = e.touches[0].clientX; this.touch.currY = e.touches[0].clientY;
            e.preventDefault();
        }, {passive:false});
        cv.addEventListener('touchend', ()=>{ this.touch.active = false; });
        // Virtual joystick zone (bottom-left)
        this.joystick = { active:false, originX:0, originY:0 };
        cv.addEventListener('touchstart', e=>{
            const t = e.touches[e.touches.length-1];
            if(t.clientX < innerWidth*.35 && t.clientY > innerHeight*.5){
                this.joystick.active = true; this.joystick.originX = t.clientX; this.joystick.originY = t.clientY;
            }
        }, {passive:false});
    }

    startGame() {
        document.getElementById('title-card').style.opacity = 0;
        setTimeout(()=>{ document.getElementById('title-card').remove(); this.lockPointer(); this.showSubtitle(); this.vignetteEl.style.opacity = 1; }, 3000);
        if(this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume();
    }

    lockPointer() { document.getElementById('game-canvas').requestPointerLock?.(); }

    showSubtitle(idx) {
        if(idx===undefined) idx = this.subtitleIdx;
        if(idx >= this.subtitles.length) return;
        this.narrativeEl.textContent = this.subtitles[idx];
        this.narrativeEl.classList.add('visible');
        this.subtitleIdx = idx + 1;
        setTimeout(()=>{ this.narrativeEl.classList.remove('visible'); }, 7000);
        // Choices at specific indices
        const choices = this.storyChoices[idx];
        if(choices) {
            setTimeout(()=>{
                this.choicesEl.innerHTML = '';
                choices.forEach(c=>{
                    const btn = document.createElement('button'); btn.className='choice-btn'; btn.textContent = c.text;
                    btn.onclick = ()=>{ c.action(); this.choicesEl.classList.remove('visible'); };
                    this.choicesEl.appendChild(btn);
                });
                this.choicesEl.classList.add('visible');
            }, 2000);
        }
    }

    showPause() {
        // Simple pause message
        this.narrativeEl.textContent = "PAUSE — Cliquez pour reprendre";
        this.narrativeEl.classList.add('visible');
        setTimeout(()=>this.narrativeEl.classList.remove('visible'), 3000);
    }

    interact() {
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(0,0), this.camera);
        const hits = ray.intersectObjects(this.interactables);
        if(hits.length>0 && hits[0].distance<3){
            const obj = hits[0].object;
            if(!obj.userData.interacted){
                obj.userData.interacted = true;
                switch(obj.userData.type){
                    case 'livre': this.showText("Un journal poussiéreux. 'Je ne sais plus qui je suis. Les murs se rapprochent chaque nuit.'"); this.decSanity(10); break;
                    case 'miroir': this.showText("Le reflet ne vous ressemble pas. Il sourit quand vous froncez les sourcils."); this.decSanity(15); this.showSubtitle(5); break;
                    case 'telephone': this.showText("Le téléphone sonne. Personne n'est branché. Pourtant, une voix chuchote votre prénom."); this.decSanity(12); this.showSubtitle(5); break;
                    case 'porte_rouge': this.showText("La porte s'ouvre sur... le même couloir. La boucle se referme."); this.chapter++; this.player.x=0; this.player.z=5; this.showSubtitle(8); break;
                    case 'pendule': this.showText("3h17. Ou 3h17. Ou 3h17. Le temps ne passe pas ici. Il tourne en rond."); this.decSanity(8); break;
                    case 'photo': this.showText("La photo montre vous, plus jeune, debout devant cette même maison. Vous ne vous souvenez pas de ce jour."); this.decSanity(10); break;
                }
            }
        }
    }

    showText(t) {
        this.narrativeEl.textContent = t;
        this.narrativeEl.classList.add('visible');
        setTimeout(()=>this.narrativeEl.classList.remove('visible'), 9000);
    }

    triggerMirror() { this.showText("Vous plongez votre regard dans le miroir. L'autre vous tend la main. Vous la prenez. Vous ne sentez rien."); this.decSanity(20); }
    avoidMirror() { this.showText("Vous détournez les yeux. Dans le coin de votre vision, le miroir se fissure lentement."); this.decSanity(5); }
    answerPhone() { this.showText("Une voix familière, éteinte : 'Tu m'as oublié. C'est pour ça que je suis ici.' La ligne coupe."); this.decSanity(18); }
    ignorePhone() { this.showText("Le téléphone continue de sonner. Maintenant, il sonne depuis l'intérieur de vos oreilles."); this.decSanity(12); }
    openRedDoor() { this.showText("Derrière la porte rouge : une chambre d'enfant, vide, sauf un ours en peluche au milieu. Il a vos yeux."); this.decSanity(25); }
    stayCorridor() { this.showText("Vous restez dans le couloir. Les murs avancent de quelques centimètres. Vous ne les aviez pas vus bouger."); this.decSanity(8); }

    decSanity(amt) {
        this.sanity = Math.max(0, this.sanity - amt);
        this.sanityFill.style.width = this.sanity + '%';
        const intensity = (100 - this.sanity) / 100;
        this.scene.fog.density = .035 + intensity * .025;
        this.bloom.strength = .4 + intensity * .6;
        this.grainEl.style.opacity = .04 + intensity * .12;
        if(this.sanity < 30) this.vignetteEl.style.background = `radial-gradient(circle at center, transparent 40%, rgba(120,0,0,${intensity*.5}) 100%)`;
        if(this.sanity < 15) this.triggerEnding();
    }

    triggerEnding() {
        if(this.ended) return; this.ended = true;
        this.narrativeEl.textContent = "Vous n'êtes plus sûr de savoir qui marche dans ces couloirs. Est-ce vous ? Est-ce ce que vous êtes devenu ?\n\nFIN — Chapitre 1";
        this.narrativeEl.classList.add('visible');
        // Drone intensif
        if(this.ambienceNode) {
            this.ambienceNode.g1.gain.linearRampToValueAtTime(.12, this.audioCtx.currentTime+4);
            this.ambienceNode.osc1.frequency.linearRampToValueAtTime(30, this.audioCtx.currentTime+6);
        }
    }

    onResize() {
        this.camera.aspect = innerWidth/innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(innerWidth, innerHeight);
        this.composer.setSize(innerWidth, innerHeight);
    }

    animate() {
        requestAnimationFrame(()=>this.animate());
        const dt = this.clock.getDelta(); this.time += dt;

        // Mouvement
        const mx = (this.keys['d']?1:0)-(this.keys['a']?1:0);
        const mz = (this.keys['s']?1:0)-(this.keys['w']?1:0);
        if(mx!==0 || mz!==0){
            const a = this.player.rotY;
            this.player.x += (mx*Math.cos(a)-mz*Math.sin(a))*this.player.speed;
            this.player.z += (mx*Math.sin(a)+mz*Math.cos(a))*this.player.speed;
            if(Math.floor(this.time*4)%4===0) this.playFootstep();
        }
        // Mobile joystick
        if(this.joystick.active){
            // Simplification : forward movement
            const a = this.player.rotY;
            this.player.x -= Math.sin(a)*this.player.speed*.5;
            this.player.z -= Math.cos(a)*this.player.speed*.5;
            if(Math.floor(this.time*4)%4===0) this.playFootstep();
        }
        // Bounds
        this.player.x = Math.max(-20, Math.min(20, this.player.x));
        this.player.z = Math.max(-20, Math.min(20, this.player.z));

        // Head bob
        const bob = (mx!==0||mz!==0)? Math.sin(this.time*10)*.03 : 0;
        this.camera.position.set(this.player.x, this.player.y+bob, this.player.z);
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = this.player.rotY;
        this.camera.rotation.x = this.player.rotX;

        // Flicker lights
        this.lights.forEach(l=>{
            if(Math.random()<l.rate){ l.light.intensity = l.base*(.3+Math.random()*.7); setTimeout(()=>l.light.intensity=l.base, 50+Math.random()*150); }
        });

        // Particules
        if(this.particles){
            this.particles.rotation.y += .0008;
            const pos = this.particles.geometry.attributes.position.array;
            for(let i=1;i<pos.length;i+=3){ pos[i] += Math.sin(this.time+i)*.003; if(pos[i]>4) pos[i]=0; }
            this.particles.geometry.attributes.position.needsUpdate = true;
        }

        // Silhouette
        if(this.silhouette){
            const dist = Math.sqrt((this.player.x-this.silhouette.position.x)**2+(this.player.z-this.silhouette.position.z)**2);
            this.silhouette.material.opacity = Math.max(0, .85 - dist*.04);
            // Silhouette looks at player
            this.silhouette.lookAt(this.camera.position.x, .8, this.camera.position.z);
        }

        // Glitch
        if(this.sanity<60 && Math.random()<(100-this.sanity)/800){
            this.camera.position.x += (Math.random()-.5)*.06;
            setTimeout(()=>this.camera.position.x=this.player.x, 60);
        }

        // Rendu
        this.composer.render();
    }
}

window.onload = () => new LiminalEngine();
