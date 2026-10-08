/* The original Minigolf Cup physics, shared by local play and online rooms. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.Minigolf=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),RADIUS=9,STOP_SPEED=5;
  const names=(de,en=de,fr=en,es=en)=>[de,en,fr,es];
  // The first three greens keep their original geometry. New greens combine
  // physical bumpers, directional ramps, timed gates and safe pond bridges.
  const COURSES=[
    {name:names('Hudson Green'),style:'garden',start:[125,480],cup:[770,126],par:3,walls:[[260,95,30,240],[460,250,30,260],[610,100,25,170]],sand:[[350,380,90,75]],water:[[535,135,65,90]]},
    {name:names('Broadway Bend'),style:'stone',start:[130,450],cup:[765,140],par:4,walls:[[260,130,28,335],[420,70,28,320],[585,180,28,305]],sand:[[470,385,100,76]],water:[[310,90,80,78]]},
    {name:names('Brooklyn Bridge'),style:'autumn',start:[130,470],cup:[760,115],par:4,walls:[[250,80,30,340],[430,180,30,330],[605,65,30,300]],sand:[[295,420,82,70],[635,390,85,70]],water:[[480,95,72,78]]},
    {name:names('Windmühlenwiese','Windmill Meadow','Prairie du moulin','Pradera del molino'),style:'meadow',start:[115,475],cup:[780,120],par:4,walls:[[385,45,24,135],[385,420,24,135]],sand:[[650,370,125,80]],water:[],bumpers:[{x:260,y:295,r:32},{x:640,y:225,r:37}],gates:[{x:388,y:240,w:22,h:95,axis:'y',travel:65,period:4.8,phase:0}]},
    {name:names('Bumper-Garten','Bumper Garden','Jardin des rebonds','Jardín de rebotes'),style:'botanical',start:[110,490],cup:[790,100],par:4,walls:[],sand:[[460,425,100,72]],water:[[390,45,90,130]],bumpers:[{x:230,y:335,r:38},{x:365,y:275,r:34},{x:490,y:325,r:39},{x:610,y:210,r:35},{x:720,y:350,r:29}]},
    {name:names('Kaskadenlauf','Cascade Run','Parcours en cascade','Ruta de cascadas'),style:'coast',start:[115,480],cup:[775,115],par:4,walls:[[300,245,170,23],[610,320,25,180]],sand:[[485,85,115,95]],water:[[300,330,135,120]],boosts:[{x:155,y:365,w:115,h:65,dx:1,dy:-.65,strength:190},{x:475,y:305,w:110,h:70,dx:1,dy:-.55,strength:165}],bumpers:[{x:710,y:245,r:35}]},
    {name:names('Seerosenbrücke','Lily Crossing','Pont des nénuphars','Puente de nenúfares'),style:'lily',start:[105,480],cup:[780,110],par:5,walls:[[690,215,20,250]],sand:[[185,170,105,80]],water:[[340,45,205,510]],bridges:[{x:340,y:230,w:205,h:100}],bumpers:[{x:620,y:150,r:33}],boosts:[{x:220,y:245,w:90,h:65,dx:1,dy:0,strength:145}]},
    {name:names('Uhrwerk-Hof','Clockwork Court','Cour mécanique','Patio mecánico'),style:'clockwork',start:[110,480],cup:[780,105],par:5,walls:[[320,45,22,115],[320,415,22,140],[560,45,22,155],[560,440,22,115]],sand:[[655,400,105,75]],water:[],gates:[{x:321,y:240,w:20,h:105,axis:'y',travel:74,period:4.3,phase:.3},{x:561,y:250,w:20,h:100,axis:'y',travel:82,period:5.6,phase:2.4}],bumpers:[{x:450,y:310,r:32}]},
    {name:names('Gipfelgrün','Summit Links','Green des sommets','Green de la cumbre'),style:'alpine',start:[115,490],cup:[775,110],par:5,walls:[[315,350,180,22],[575,75,22,180]],sand:[[360,120,115,100],[635,400,130,75]],water:[[205,160,95,145]],bumpers:[{x:540,y:320,r:43},{x:725,y:270,r:32}],boosts:[{x:190,y:410,w:100,h:65,dx:1,dy:-.45,strength:180},{x:630,y:165,w:100,h:65,dx:1,dy:-.5,strength:160}]}
  ];
  function inRect(x,y,r){return x>r[0]&&x<r[0]+r[2]&&y>r[1]&&y<r[1]+r[3];}
  const asRect=r=>[r.x,r.y,r.w,r.h];
  function gateRect(g,time=0){const shift=Math.sin(time*Math.PI*2/g.period+(g.phase||0))*g.travel;return [g.x+(g.axis==='x'?shift:0),g.y+(g.axis==='y'?shift:0),g.w,g.h];}
  class Model {
    constructor({players=1,courseCount=9,onEnd=()=>{},onSound=()=>{}}={}){
      this.players=clamp(Math.round(Number(players)||1),1,4);this.courseCount=[3,6,9].includes(courseCount)?courseCount:9;this.onEnd=onEnd;this.onSound=onSound;this.phase='menu';this.player=0;this.hole=0;this.turnId=0;this.shotId=0;this.time=0;this.moving=false;this.shotAge=0;this.lastShot=null;this.result=null;this.turns=Array.from({length:this.players},()=>[]);this.balls=[];this.aim=[1,0];this.power=0;this.dragging=false;this.resetHole();
    }
    static gateRect(g,time){return gateRect(g,time);}
    get course(){return COURSES[this.hole%COURSES.length];}
    get ball(){return this.balls[this.player];}
    get ready(){return this.phase==='playing'&&!this.moving&&!!this.ball&&!this.ball.sunk&&Math.hypot(this.ball.vx,this.ball.vy)<=STOP_SPEED;}
    resetHole(){const c=this.course;this.balls=Array.from({length:this.players},(_,p)=>({x:c.start[0]+(p%2)*18,y:c.start[1]+Math.floor(p/2)*17,vx:0,vy:0,sunk:false,strokes:0}));this.player=this.hole%this.players;this.aim=[1,0];this.power=0;this.moving=false;this.shotAge=0;this.dragging=false;}
    start(){this.phase='playing';this.hole=0;this.time=0;this.turnId++;this.shotId=0;this.lastShot=null;this.result=null;this.turns=Array.from({length:this.players},()=>[]);this.resetHole();return this;}
    pause(){if(this.phase==='playing'){this.phase='paused';this.dragging=false;}}
    resume(){if(this.phase==='paused')this.phase='playing';}
    aimTo(x,y){if(!this.ready||!Number.isFinite(x)||!Number.isFinite(y))return;const dx=this.ball.x-x,dy=this.ball.y-y,d=Math.hypot(dx,dy)||1;this.aim=[dx/d,dy/d];this.power=clamp(d/150,0,1);}
    putt(aim=this.aim,power=this.power,expectedTurnId=this.turnId){
      if(!this.ready||expectedTurnId!==this.turnId||!Array.isArray(aim)||aim.length!==2||!aim.every(Number.isFinite)||!Number.isFinite(power)||power<0||power>1)return false;
      const d=Math.hypot(...aim);if(d<.0001)return false;this.aim=aim.map(n=>n/d);this.power=power;const b=this.ball;b.vx=this.aim[0]*(110+power*470);b.vy=this.aim[1]*(110+power*470);b.strokes++;this.moving=true;this.shotAge=0;this.turnId++;this.lastShot={id:++this.shotId,player:this.player,hole:this.hole,aim:[...this.aim],power};this.onSound('bounce',this.player);return true;
    }
    update(dt,input={}){
      if(this.phase!=='playing'||!Number.isFinite(dt)||dt<=0)return;dt=clamp(dt,0,.04);this.time+=dt;const b=this.ball,c=this.course;if(!b||b.sunk)return;
      if(!this.moving&&(input.axisX||input.axisY)){const ax=clamp(input.axisX||0,-1,1),ay=clamp(input.axisY||0,-1,1),d=Math.hypot(ax,ay)||1;this.aim=[ax/d,ay/d];}
      if(Math.hypot(b.vx,b.vy)>STOP_SPEED)this.moving=true;
      const wasMoving=this.moving;if(wasMoving)this.shotAge+=dt;
      const steps=Math.max(1,Math.ceil(dt*120));let ended=false;
      for(let i=0;i<steps;i++){
        const s=dt/steps,ox=b.x,oy=b.y;b.x+=b.vx*s;b.y+=b.vy*s;
        const sand=(c.sand||[]).some(r=>inRect(b.x,b.y,r));b.vx*=Math.pow(sand ? .018 : .28,s);b.vy*=Math.pow(sand ? .018 : .28,s);
        if(b.x<45||b.x>855){b.x=clamp(b.x,45,855);b.vx*=-.72;}if(b.y<45||b.y>555){b.y=clamp(b.y,45,555);b.vy*=-.72;}
        const solid=[...(c.walls||[]),...(c.gates||[]).map(g=>gateRect(g,this.time-dt+(i+1)*s))];
        for(const [x,y,w,h] of solid)if(b.x>x-RADIUS&&b.x<x+w+RADIUS&&b.y>y-RADIUS&&b.y<y+h+RADIUS){
          const dx=Math.min(Math.abs(b.x-x),Math.abs(b.x-(x+w))),dy=Math.min(Math.abs(b.y-y),Math.abs(b.y-(y+h)));if(dx<dy)b.vx*=-.76;else b.vy*=-.76;b.x=ox;b.y=oy;
        }
        for(const p of c.bumpers||[]){const dx=b.x-p.x,dy=b.y-p.y,d=Math.hypot(dx,dy),r=p.r+RADIUS;if(d<r){const nx=d>1e-8?dx/d:1,ny=d>1e-8?dy/d:0,dot=b.vx*nx+b.vy*ny;b.x=p.x+nx*(r+.05);b.y=p.y+ny*(r+.05);if(dot<0){b.vx-=1.8*dot*nx;b.vy-=1.8*dot*ny;}}}
        // A ramp pushes a rolling ball, never somebody waiting for their turn.
        if(wasMoving)for(const p of c.boosts||[])if(inRect(b.x,b.y,asRect(p))){const d=Math.hypot(p.dx,p.dy)||1;b.vx+=p.dx/d*p.strength*s;b.vy+=p.dy/d*p.strength*s;}
        const speed=Math.hypot(b.vx,b.vy);if(speed>640){b.vx*=640/speed;b.vy*=640/speed;}
        // Decks are true safe routes across water, not decorative fake bridges.
        const onBridge=(c.bridges||[]).some(p=>inRect(b.x,b.y,asRect(p)));
        if(!onBridge&&(c.water||[]).some(r=>inRect(b.x,b.y,r))){b.x=c.start[0]+(this.player%2)*18;b.y=c.start[1]+Math.floor(this.player/2)*17;b.vx=b.vy=0;b.strokes++;this.onSound('damage',this.player);ended=true;break;}
        if(Math.hypot(b.x-c.cup[0],b.y-c.cup[1])<17&&Math.hypot(b.vx,b.vy)<210){b.x=c.cup[0];b.y=c.cup[1];b.vx=b.vy=0;b.sunk=true;this.turns[this.player][this.hole]=b.strokes;this.onSound('collect',this.player);ended=true;break;}
      }
      if(ended||(wasMoving&&(Math.hypot(b.vx,b.vy)<=STOP_SPEED||this.shotAge>18))){b.vx=b.vy=0;this.moving=false;this.nextPlayer();}
    }
    nextPlayer(){
      this.turnId++;this.dragging=false;this.power=0;this.shotAge=0;this.moving=false;
      for(let offset=1;offset<=this.players;offset++){const next=(this.player+offset)%this.players;if(!this.balls[next].sunk){this.player=next;return;}}
      if(this.hole<this.courseCount-1){this.hole++;this.resetHole();}else this.finish();
    }
    finish(){
      if(!['playing','paused'].includes(this.phase))return false;this.phase='over';this.moving=false;this.balls.forEach(b=>{b.vx=b.vy=0;});
      const totals=this.turns.map(a=>a.reduce((s,n)=>s+(n||0),0)),low=Math.min(...totals),winners=totals.map((n,i)=>n===low?i:null).filter(n=>n!==null);this.result={score:Math.max(0,1000-low*20),strokes:totals,winner:winners.length===1?winners[0]:null,winners,holes:this.courseCount,players:this.players};this.onEnd(this.result);return true;
    }
    snapshot(){return {phase:this.phase,players:this.players,courseCount:this.courseCount,hole:this.hole,player:this.player,turnId:this.turnId,shotId:this.shotId,balls:this.balls.map(b=>({...b})),turns:this.turns.map(row=>[...row]),aim:[...this.aim],power:this.power,moving:this.moving,time:this.time,shotAge:this.shotAge,lastShot:this.lastShot?{...this.lastShot,aim:[...this.lastShot.aim]}:null,result:this.result?{...this.result,strokes:[...this.result.strokes],winners:[...this.result.winners]}:null};}
    applySnapshot(s){
      if(!s||!['menu','playing','paused','over'].includes(s.phase)||!Number.isInteger(s.players)||s.players<1||s.players>4||![3,6,9].includes(s.courseCount)||!Number.isInteger(s.hole)||s.hole<0||s.hole>=s.courseCount||!Number.isInteger(s.player)||s.player<0||s.player>=s.players||!Number.isSafeInteger(s.turnId)||s.turnId<0||!Array.isArray(s.balls)||s.balls.length!==s.players||!s.balls.every(b=>b&&['x','y','vx','vy','strokes'].every(k=>Number.isFinite(b[k]))&&typeof b.sunk==='boolean')||!Array.isArray(s.turns)||s.turns.length!==s.players||!s.turns.every(row=>Array.isArray(row)&&row.length<=s.courseCount&&row.every(n=>Number.isFinite(n)&&n>=0))||!Array.isArray(s.aim)||s.aim.length!==2||!s.aim.every(Number.isFinite)||!Number.isFinite(s.power)||!Number.isFinite(s.time)||typeof s.moving!=='boolean')return false;
      const shot=s.lastShot,r=s.roundResult||(typeof s.result==='object'?s.result:null);
      if(s.power<0||s.power>1||s.time<0||s.balls.some(b=>!Number.isInteger(b.strokes)||b.strokes<0)||shot&&(!Number.isSafeInteger(shot.id)||!Number.isInteger(shot.player)||shot.player<0||shot.player>=s.players||!Number.isInteger(shot.hole)||shot.hole<0||shot.hole>=s.courseCount||!Array.isArray(shot.aim)||shot.aim.length!==2||!shot.aim.every(Number.isFinite)||!Number.isFinite(shot.power)||shot.power<0||shot.power>1)||r&&(!Array.isArray(r.strokes)||r.strokes.length!==s.players||!r.strokes.every(n=>Number.isFinite(n)&&n>=0)||!Array.isArray(r.winners)||!r.winners.every(n=>Number.isInteger(n)&&n>=0&&n<s.players)))return false;
      for(const key of ['phase','players','courseCount','hole','player','turnId','power','time','moving'])this[key]=s[key];this.balls=s.balls.map(b=>({...b}));this.turns=s.turns.map(row=>[...row]);this.aim=[...s.aim];this.shotId=Number.isSafeInteger(s.shotId)?s.shotId:0;this.shotAge=Number.isFinite(s.shotAge)?s.shotAge:0;this.lastShot=shot?{...shot,aim:[...shot.aim]}:null;this.result=r?{...r,strokes:[...r.strokes],winners:[...r.winners]}:null;this.dragging=false;return true;
    }
  }
  return {Model,COURSES,gateRect,RADIUS,STOP_SPEED};
});
