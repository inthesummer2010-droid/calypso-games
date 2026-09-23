'use strict';
const WIDTH=1920,HEIGHT=1080,FPS=60;
let particles=[];const keys={};const stats={touch_ctrl:true,mouse_ctrl:false};
function addParticle(){}
function toRGB(c,a=1){return 'rgba('+c[0]+','+c[1]+','+c[2]+','+a+')';}
class Rect {
    constructor(x, y, w, h) { this.x = x; this.y = y; this.w = Math.max(0, w); this.h = Math.max(0, h); }
    get left() { return this.x; }
    get right() { return this.x + this.w; }
    get top() { return this.y; }
    get bottom() { return this.y + this.h; }
    get centerx() { return this.x + this.w/2; }
    get centery() { return this.y + this.h/2; }
    collidepoint(px, py) { return px >= this.left && px <= this.right && py >= this.top && py <= this.bottom; }
    inflate(dw, dh) { return new Rect(this.x - dw/2, this.y - dh/2, this.w + dw, this.h + dh); }
    collidelist(rects) {
        for(let i=0; i<rects.length; i++){
            let r = rects[i];
            if(Math.max(this.left, r.left) < Math.min(this.right, r.right) && Math.max(this.top, r.top) < Math.min(this.bottom, r.bottom)) return i;
        }
        return -1;
    }
}

// Farben
const WHITE = [255, 255, 255], BLACK = [18, 18, 24], RED = [255, 60, 70];
const ZOMBIE_GREEN = [60, 190, 90], ACID_GREEN = [110, 255, 120];
const YELLOW = [255, 215, 40], CYAN = [0, 235, 235], ICE_BLUE = [150, 205, 255];
const PURPLE = [185, 90, 255], MAGENTA = [255, 80, 230], ORANGE = [255, 140, 40];
const LIME = [160, 255, 80], GHOST_WHITE = [225, 225, 235, 150];
const NEUTRAL_COLOR = [150, 150, 160];
const WALL_COLOR = [56, 58, 74], WALL_TOP = [88, 92, 116], WALL_EDGE = [128, 132, 160];
const BG_TOP = [14, 15, 24], BG_BOTTOM = [32, 34, 50], GRID_COLOR = [42, 45, 62];
const BOSS_COLOR = [165, 30, 60], GOLD = [255, 210, 60], PANEL_BG = [14, 14, 22];

const COLORS = [
    ["Blau", [70, 160, 255]], ["Grün", [70, 225, 120]], ["Orange", [255, 160, 60]],
    ["Pink", [255, 110, 200]], ["Gelb", [240, 210, 50]], ["Türkis", [0, 230, 230]],
    ["Weiß", [240, 240, 245]], ["Limette", [160, 255, 60]]
];
const SKINS = ["Kreis", "Quadrat", "Diamant", "Sechseck", "Dreieck", "Stern", "Kreuz"];
const MODES = ["1 vs 1 Fangen", "1-Spieler Zombie-Überleben", "2-Spieler Koop-Überleben", "1-Spieler Bosskampf", "2-Spieler Bosskampf"];

// --- Maps ---
const MAPS = [
    {name: "Klassisch", walls: [new Rect(910, 230, 100, 230), new Rect(910, 620, 100, 230), new Rect(380, 480, 240, 70), new Rect(1300, 480, 240, 70)]},
    {name: "Labyrinth", walls: [new Rect(280, 240, 480, 70), new Rect(1160, 240, 480, 70), new Rect(280, 780, 480, 70), new Rect(1160, 780, 480, 70), new Rect(570, 400, 70, 300), new Rect(1280, 400, 70, 300)]},
    {name: "Offenes Feld", walls: []},
    {name: "Kreuzung", walls: [new Rect(895, 340, 130, 400), new Rect(660, 505, 600, 70)]},
    {name: "Festung", walls: [new Rect(660, 330, 600, 60), new Rect(660, 690, 600, 60), new Rect(660, 390, 60, 90), new Rect(660, 600, 60, 90), new Rect(1200, 390, 60, 90), new Rect(1200, 600, 60, 90)]},
    {name: "Säulenhalle", walls: [new Rect(430, 300, 90, 90), new Rect(915, 300, 90, 90), new Rect(1400, 300, 90, 90), new Rect(430, 690, 90, 90), new Rect(915, 690, 90, 90), new Rect(1400, 690, 90, 90), new Rect(672, 495, 90, 90), new Rect(1158, 495, 90, 90)]},
    {name: "Zickzack", walls: [new Rect(300, 260, 500, 60), new Rect(1120, 430, 500, 60), new Rect(300, 600, 500, 60), new Rect(1120, 770, 500, 60)]},
    {name: "Vier Kammern", walls: [new Rect(930, 150, 60, 270), new Rect(930, 660, 60, 270), new Rect(300, 510, 460, 60), new Rect(1160, 510, 460, 60)]}
];

class Player {
    constructor(x, y, color, controls, name, skin, joy_id=null, is_bot=false) {
        this.x = x; this.y = y; this.base_radius = 30; this.alive = true;
        this.radius = 30; this.speed = 8; this.normal_speed = 8;
        this.base_color = color; this.controls = controls; this.skin = skin; this.name = name;
        this.joy_id = joy_id; this.is_bot = is_bot; this.bot_speed_factor = 1.0;
        this.times_caught = 0; this.speed_timer = 0; this.freeze_timer = 0; this.ghost_timer = 0; this.shrink_timer = 0;
        this.has_shield = false; this.revive_timer = 0; this.rampage_timer = 0; this.score = 0;
    }

    get_wall_penetration(px, py, obstacles) {
        let pen = 0;
        for(let obs of obstacles) {
            let cx = Math.max(obs.left, Math.min(px, obs.right));
            let cy = Math.max(obs.top, Math.min(py, obs.bottom));
            let dist_sq = (px - cx)**2 + (py - cy)**2;
            if(dist_sq < this.radius**2) {
                let dist = Math.sqrt(dist_sq);
                if(dist === 0) pen += this.radius + Math.min(px - obs.left, obs.right - px, py - obs.top, obs.bottom - py);
                else pen += this.radius - dist;
            }
        }
        return pen;
    }

    move(obstacles, is_catcher=false, vjoy_dir=[0,0], mouse_target=null) {
        if(!this.alive) { if(this.revive_timer > 0) this.revive_timer--; return; }
        if(this.freeze_timer > 0) { this.freeze_timer--; return; }

        if(this.shrink_timer > 0) { this.shrink_timer--; this.radius = 15; this.speed = this.normal_speed * 1.3; }
        else { this.radius = this.base_radius; this.speed = this.normal_speed; }

        if(is_catcher) this.speed *= 1.05;
        if(this.is_bot) this.speed *= this.bot_speed_factor;
        
        if(this.speed_timer > 0) { this.speed_timer--; this.speed *= 1.6; addParticle(this.x, this.y, YELLOW, 1, 3, 1); }
        if(this.rampage_timer > 0) { this.rampage_timer--; addParticle(this.x, this.y, RED, 1, 4, 1); }
        if(this.ghost_timer > 0) { this.ghost_timer--; addParticle(this.x, this.y, WHITE, 0.5, 2, 1); }

        let dx=0, dy=0;
        if(vjoy_dir[0]!==0 || vjoy_dir[1]!==0) { dx += vjoy_dir[0]*this.speed; dy += vjoy_dir[1]*this.speed; }

        if(mouse_target !== null && !this.is_bot && !stats.touch_ctrl) {
            let tx = mouse_target.x, ty = mouse_target.y;
            let ddx = tx - this.x, ddy = ty - this.y;
            let d = Math.hypot(ddx, ddy);
            if(d > this.radius * 0.5) { dx += (ddx/d)*this.speed; dy += (ddy/d)*this.speed; }
        }

        if(!this.is_bot) {
            if(keys[this.controls.left]) dx -= this.speed;
            if(keys[this.controls.right]) dx += this.speed;
            if(keys[this.controls.up]) dy -= this.speed;
            if(keys[this.controls.down]) dy += this.speed;

            let gps = (navigator.getGamepads && typeof navigator.getGamepads === 'function') ? navigator.getGamepads() : [];
            if(this.joy_id !== null && gps[this.joy_id]) {
                let gp = gps[this.joy_id];
                if(gp && gp.axes.length >= 2) {
                    if(Math.abs(gp.axes[0]) > 0.2) dx += gp.axes[0]*this.speed;
                    if(Math.abs(gp.axes[1]) > 0.2) dy += gp.axes[1]*this.speed;
                }
            }
        }

        if(dx > this.speed) dx = this.speed; else if(dx < -this.speed) dx = -this.speed;
        if(dy > this.speed) dy = this.speed; else if(dy < -this.speed) dy = -this.speed;

        if(dx !== 0) {
            let pen_old = this.get_wall_penetration(this.x, this.y, obstacles);
            this.x += dx;
            if(this.x - this.radius < 0 || this.x + this.radius > WIDTH) this.x -= dx;
            else if(this.ghost_timer === 0) {
                let pen_new = this.get_wall_penetration(this.x, this.y, obstacles);
                if((pen_old===0 && pen_new>0) || (pen_old>0 && pen_new>=pen_old)) this.x -= dx;
            }
        }
        if(dy !== 0) {
            let pen_old = this.get_wall_penetration(this.x, this.y, obstacles);
            this.y += dy;
            if(this.y - this.radius < 0 || this.y + this.radius > HEIGHT) this.y -= dy;
            else if(this.ghost_timer === 0) {
                let pen_new = this.get_wall_penetration(this.x, this.y, obstacles);
                if((pen_old===0 && pen_new>0) || (pen_old>0 && pen_new>=pen_old)) this.y -= dy;
            }
        }
    }

    draw(ctx, status) {
        if(!this.alive) return;
        let color = status===-1 ? NEUTRAL_COLOR : (status===0 ? RED : this.base_color);
        drawSoftShadow(ctx, this.x, this.y, this.radius);
        if(this.ghost_timer > 0) {
            drawSkinShape(ctx, this.x, this.y, this.radius, GHOST_WHITE, this.skin); return;
        }

        blitGlow(ctx, this.x, this.y, this.radius*2.2, color, 80);

        if(this.freeze_timer > 0) {
            blitGlow(ctx, this.x, this.y, this.radius*2.6, ICE_BLUE, 120);
            drawSkinShape(ctx, this.x, this.y, this.radius+10, ICE_BLUE, this.skin);
        }
        if(this.rampage_timer > 0) drawSkinShape(ctx, this.x, this.y, this.radius+9, RED, this.skin, 5);
        if(this.has_shield) drawSkinShape(ctx, this.x, this.y, this.radius+9, CYAN, this.skin, 4);
        if(this.speed_timer > 0) drawSkinShape(ctx, this.x, this.y, this.radius+7, YELLOW, this.skin, 2);

        drawSkinShape(ctx, this.x, this.y, this.radius, color, this.skin);
        
        let hl = getGlow(this.radius*0.55, [255,255,255], 90, 6);
        ctx.drawImage(hl, Math.floor(this.x - this.radius*0.75), Math.floor(this.y - this.radius*0.85));
        drawSkinShape(ctx, this.x, this.y, this.radius, WHITE, this.skin, 3);
    }
}

class Zombie {
    constructor(x, y) { this.x=x; this.y=y; this.radius=27; this.speed=2.5; this.freeze_timer=0; }
    move_towards(p1, p2, obstacles) {
        if(this.freeze_timer > 0) { this.freeze_timer--; return; }
        let t = null, min_d = Infinity;
        if(p1 && p1.alive) { min_d = Math.hypot(p1.x-this.x, p1.y-this.y); t = p1; }
        if(p2 && p2.alive && Math.hypot(p2.x-this.x, p2.y-this.y) < min_d) t = p2;
        if(!t) return;
        let dist = Math.hypot(t.x-this.x, t.y-this.y);
        if(dist > 0) {
            let vx = ((t.x-this.x)/dist)*this.speed, vy = ((t.y-this.y)/dist)*this.speed;
            this.x += vx;
            if(obstacles.some(o => Math.pow(this.x - Math.max(o.left, Math.min(this.x, o.right)),2) + Math.pow(this.y - Math.max(o.top, Math.min(this.y, o.bottom)),2) < this.radius**2)) this.x -= vx;
            this.y += vy;
            if(obstacles.some(o => Math.pow(this.x - Math.max(o.left, Math.min(this.x, o.right)),2) + Math.pow(this.y - Math.max(o.top, Math.min(this.y, o.bottom)),2) < this.radius**2)) this.y -= vy;
        }
    }
    draw(ctx) {
        drawSoftShadow(ctx, this.x, this.y, this.radius);
        blitGlow(ctx, this.x, this.y, this.radius*1.9, ZOMBIE_GREEN, 60);
        if(this.freeze_timer > 0) {
            ctx.beginPath(); ctx.arc(this.x, this.y, this.radius+6, 0, Math.PI*2); ctx.fillStyle=toRGB(ICE_BLUE); ctx.fill();
        }
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2); ctx.fillStyle=toRGB(ZOMBIE_GREEN); ctx.fill();
        ctx.lineWidth=3; ctx.strokeStyle=toRGB([25,90,45]); ctx.stroke();
        ctx.beginPath(); ctx.arc(this.x-8, this.y-6, 5, 0, Math.PI*2); ctx.fillStyle=toRGB([200,30,30]); ctx.fill();
        ctx.beginPath(); ctx.arc(this.x+8, this.y-6, 5, 0, Math.PI*2); ctx.fill();
    }
}

class Boss {
    constructor(x, y) {
        this.x=x; this.y=y; this.radius=70; this.hp=1000; this.max_hp=1000;
        this.base_speed = 3.2; this.stun_timer=0; this.slow_timer=0; this.burn_timer=0;
        this.state = 'shoot'; this.state_timer=0; this.dash_vx=0; this.dash_vy=0;
    }
    update(p1, p2, projectiles) {
        let speed = this.base_speed;
        if(this.stun_timer>0) { this.stun_timer--; speed = 0; }
        else if(this.slow_timer>0) { this.slow_timer--; speed = this.base_speed * 0.4; }

        if(this.burn_timer>0) {
            this.burn_timer--;
            if(this.burn_timer%10===0) { this.hp-=2; addParticle(this.x, this.y, ORANGE, 3, 5, 1); }
        }

        this.state_timer++;
        if(this.state === 'shoot') {
            if(speed > 0) {
                let t=null, min_d=Infinity;
                if(p1 && p1.alive) { min_d = Math.hypot(p1.x-this.x, p1.y-this.y); t=p1; }
                if(p2 && p2.alive && Math.hypot(p2.x-this.x, p2.y-this.y) < min_d) t=p2;
                if(t) {
                    let d = Math.hypot(t.x-this.x, t.y-this.y);
                    if(d>0) { this.x += ((t.x-this.x)/d)*speed; this.y += ((t.y-this.y)/d)*speed; }
                }
            }
            if(this.state_timer > 180) { this.state = 'nova'; this.state_timer = 0; }
            else if(this.state_timer%60===0 && speed>0) {
                let t = (p1 && p1.alive && (!p2 || !p2.alive || Math.random()>0.5)) ? p1 : p2;
                if(t && t.alive) {
                    let d = Math.hypot(t.x-this.x, t.y-this.y);
                    if(d>0) projectiles.push(new BossProjectile(this.x, this.y, ((t.x-this.x)/d)*6.5, ((t.y-this.y)/d)*6.5));
                }
            }
        } else if(this.state === 'nova') {
            if(this.state_timer === 30 && speed>0) {
                for(let a=0; a<360; a+=45) {
                    let rad = a * Math.PI/180;
                    projectiles.push(new BossProjectile(this.x, this.y, Math.cos(rad)*7.5, Math.sin(rad)*7.5));
                }
            }
            if(this.state_timer > 60) { this.state = 'dash_aim'; this.state_timer = 0; }
        } else if(this.state === 'dash_aim') {
            if(this.state_timer === 45 && speed>0) {
                let t=null, min_d=Infinity;
                if(p1 && p1.alive) { min_d = Math.hypot(p1.x-this.x, p1.y-this.y); t=p1; }
                if(p2 && p2.alive && Math.hypot(p2.x-this.x, p2.y-this.y) < min_d) t=p2;
                if(t) {
                    let d = Math.hypot(t.x-this.x, t.y-this.y);
                    if(d>0) { this.dash_vx = ((t.x-this.x)/d)*19; this.dash_vy = ((t.y-this.y)/d)*19; this.state='dash'; this.state_timer=0; }
                }
            } else if(this.state_timer > 45) { this.state='shoot'; this.state_timer=0; }
        } else if(this.state === 'dash') {
            if(speed>0) { this.x+=this.dash_vx; this.y+=this.dash_vy; addParticle(this.x, this.y, RED, 1, 8, 2); }
            if(this.state_timer > 20) { this.state='shoot'; this.state_timer=0; }
        }
    }
    draw(ctx) {
        drawSoftShadow(ctx, this.x, this.y, this.radius);
        blitGlow(ctx, this.x, this.y, this.radius*2.1, BOSS_COLOR, 90);
        ctx.beginPath();
        if(this.burn_timer>0) { ctx.arc(this.x, this.y, this.radius+10, 0, Math.PI*2); ctx.fillStyle=toRGB(ORANGE); ctx.fill(); ctx.beginPath(); }
        if(this.slow_timer>0) { ctx.arc(this.x, this.y, this.radius+7, 0, Math.PI*2); ctx.fillStyle=toRGB(ICE_BLUE); ctx.fill(); ctx.beginPath(); }
        if(this.stun_timer>0) { ctx.arc(this.x, this.y, this.radius+14, 0, Math.PI*2); ctx.strokeStyle=toRGB(PURPLE); ctx.lineWidth=6; ctx.stroke(); ctx.beginPath(); }
        if(this.state==='dash_aim') { ctx.arc(this.x, this.y, this.radius+7+Math.sin(this.state_timer*0.5)*14, 0, Math.PI*2); ctx.fillStyle=toRGB(RED); ctx.fill(); ctx.beginPath(); }

        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2); ctx.fillStyle=toRGB(BOSS_COLOR); ctx.fill();
        ctx.strokeStyle=toRGB([60,8,25]); ctx.lineWidth=6; ctx.stroke();
        
        ctx.beginPath(); ctx.arc(this.x-24, this.y-16, 12, 0, Math.PI*2); ctx.fillStyle=toRGB([255,230,90]); ctx.fill();
        ctx.beginPath(); ctx.arc(this.x+24, this.y-16, 12, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(this.x-24, this.y-16, 5, 0, Math.PI*2); ctx.fillStyle=toRGB(BLACK); ctx.fill();
        ctx.beginPath(); ctx.arc(this.x+24, this.y-16, 5, 0, Math.PI*2); ctx.fill();
        
        ctx.beginPath(); ctx.moveTo(this.x-32, this.y+16); ctx.lineTo(this.x+32, this.y+16); ctx.lineTo(this.x, this.y+40); ctx.closePath(); ctx.fill();
    }
}

class BossProjectile {
    constructor(x,y,vx,vy) { this.x=x; this.y=y; this.vx=vx; this.vy=vy; this.radius=18; }
    update() { this.x+=this.vx; this.y+=this.vy; addParticle(this.x, this.y, ACID_GREEN, 1, 4, 1); }
    draw(ctx) {
        blitGlow(ctx, this.x, this.y, this.radius*2, ACID_GREEN, 110);
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2); ctx.fillStyle=toRGB(ACID_GREEN); ctx.fill();
        ctx.lineWidth=3; ctx.strokeStyle=toRGB([30,110,45]); ctx.stroke();
    }
}

class WeaponDrop {
    constructor(obstacles) {
        this.radius = 24;
        let t = ['sword','bomb','ice','fire','shock'];
        this.type = t[Math.floor(Math.random()*t.length)];
        this.color = {sword:WHITE, bomb:ORANGE, ice:ICE_BLUE, fire:RED, shock:PURPLE}[this.type];
        while(true) {
            this.x = 80 + Math.random()*(WIDTH-160); this.y = 160 + Math.random()*(HEIGHT-240);
            if(!obstacles.some(o => o.collidepoint(this.x, this.y))) break;
        }
    }
    draw(ctx) {
        drawSoftShadow(ctx, this.x, this.y, this.radius);
        blitGlow(ctx, this.x, this.y, this.radius*2, this.color, 90);
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2); ctx.fillStyle=toRGB(this.color); ctx.fill();
        ctx.lineWidth=3; ctx.strokeStyle=toRGB(BLACK); ctx.stroke();
        let x=this.x, y=this.y;
        ctx.beginPath();
        if(this.type==='sword') { ctx.moveTo(x, y-12); ctx.lineTo(x, y+12); ctx.moveTo(x-8,y+6); ctx.lineTo(x+8,y+6); ctx.lineWidth=4; ctx.stroke(); }
        else if(this.type==='bomb') { ctx.arc(x,y+3,9,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.moveTo(x,y-6); ctx.lineTo(x+6,y-12); ctx.strokeStyle=toRGB(WHITE); ctx.stroke(); }
        else if(this.type==='ice') { ctx.moveTo(x-9,y-9); ctx.lineTo(x+9,y+9); ctx.moveTo(x-9,y+9); ctx.lineTo(x+9,y-9); ctx.moveTo(x,y-12); ctx.lineTo(x,y+12); ctx.strokeStyle=toRGB(WHITE); ctx.stroke(); }
        else if(this.type==='fire') { ctx.moveTo(x,y-12); ctx.lineTo(x-9,y+9); ctx.lineTo(x+9,y+9); ctx.fillStyle=toRGB(WHITE); ctx.fill(); }
        else if(this.type==='shock') { ctx.moveTo(x+3,y-9); ctx.lineTo(x-6,y+2); ctx.lineTo(x+2,y+2); ctx.lineTo(x-4,y+12); ctx.fillStyle=toRGB(WHITE); ctx.fill(); }
    }
}

class PlayerAttack {
    constructor(t, x, y) { this.type=t; this.x=x; this.y=y; this.timer=t==='bomb'?FPS*1.5:0; this.active=true; }
    update(boss) {
        if(!this.active || !boss) return;
        if(this.type === 'bomb') {
            this.timer--;
            if(this.timer<=0) {
                this.active=false; addParticle(this.x, this.y, ORANGE, 10, 12, 50);
                if(Math.hypot(boss.x-this.x, boss.y-this.y) < 260) boss.hp-=150;
            }
        } else {
            let d = Math.hypot(boss.x-this.x, boss.y-this.y);
            if(d < boss.radius+14) {
                this.active=false;
                if(this.type==='ice') { boss.slow_timer=FPS*4; boss.hp-=20; }
                else if(this.type==='fire') { boss.burn_timer=FPS*5; boss.hp-=10; }
                else if(this.type==='shock') { boss.stun_timer=FPS*2; boss.hp-=30; }
            } else {
                this.x += ((boss.x-this.x)/d)*19; this.y += ((boss.y-this.y)/d)*19;
                let c = this.type==='ice'?ICE_BLUE:(this.type==='fire'?RED:PURPLE);
                addParticle(this.x, this.y, c, 2, 6, 2);
            }
        }
    }
    draw(ctx) {
        if(!this.active) return;
        if(this.type==='bomb') {
            blitGlow(ctx, this.x, this.y, 46, ORANGE, 120);
            ctx.beginPath(); ctx.arc(this.x, this.y, 22+Math.sin(this.timer*0.5)*7, 0, Math.PI*2); ctx.fillStyle=toRGB(ORANGE); ctx.fill();
        } else {
            let c = this.type==='ice'?ICE_BLUE:(this.type==='fire'?RED:PURPLE);
            blitGlow(ctx, this.x, this.y, 34, c, 120);
            ctx.beginPath(); ctx.arc(this.x, this.y, 14, 0, Math.PI*2); ctx.fillStyle=toRGB(c); ctx.fill();
        }
    }
}

class PowerUp {
    constructor(obstacles, mode_idx) {
        this.radius = 20; this.born = Date.now();
        let types = ['speed', 'shield', 'freeze', 'ghost', 'teleport', 'shrink', 'bomb', 'rampage'];
        if(mode_idx === 0) {
            let w = [10, 1, 1, 1, 1, 1, 1, 1, 1]; let sum = 18;
            let r = Math.random() * sum;
            if(r < 10) this.type = 'point';
            else this.type = types[Math.floor(r-10)];
        } else this.type = types[Math.floor(Math.random()*types.length)];
        
        this.color = {point:GOLD, speed:YELLOW, shield:CYAN, freeze:ICE_BLUE, ghost:WHITE, teleport:MAGENTA, shrink:LIME, bomb:ORANGE, rampage:RED}[this.type];
        while(true) {
            this.x = 80 + Math.random()*(WIDTH-160); this.y = 160 + Math.random()*(HEIGHT-240);
            if(!obstacles.some(o => o.collidepoint(this.x, this.y))) break;
        }
    }
    draw(ctx) {
        drawSoftShadow(ctx, this.x, this.y, this.radius);
        let pulse = 1.0 + 0.18 * Math.sin((Date.now() - this.born)*0.006);
        blitGlow(ctx, this.x, this.y, this.radius*2.2*pulse, this.color, 100);
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2); ctx.fillStyle=toRGB(this.color); ctx.fill();
        if(this.type === 'point') {
            ctx.beginPath(); ctx.arc(this.x, this.y, this.radius-4, 0, Math.PI*2); ctx.fillStyle=toRGB(YELLOW); ctx.fill();
            textCenter(ctx, "+1", "bold 26px Arial", toRGB(BLACK), this.x, this.y-13);
        } else {
            ctx.beginPath(); ctx.arc(this.x, this.y, this.radius/2, 0, Math.PI*2); ctx.fillStyle=toRGB(WHITE); ctx.fill();
        }
        ctx.lineWidth=2; ctx.strokeStyle="rgb(255,255,255)"; ctx.stroke();
    }
}

// ============================================================
//  COMPUTER-GEGNER (KI)
// ============================================================


module.exports={Rect,MAPS,Player,Zombie,Boss,BossProjectile,WeaponDrop,PlayerAttack,PowerUp,WIDTH,HEIGHT,FPS};
