(function(root){
 'use strict';
 const suits=['spades','hearts','diamonds','clubs'];
 const red=c=>c.suit==='hearts'||c.suit==='diamonds';
 function pack(){let cards=[];for(const suit of suits)for(let value=1;value<=13;value++)cards.push({value,suit,up:true});return cards}
 function shuffle(cards,r=Math.random){cards=cards.slice();for(let i=cards.length-1;i>0;i--){let j=Math.floor(r()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]]}return cards}
 const copy=x=>JSON.parse(JSON.stringify(x));
 class Base{
  constructor(){this.moves=0;this.history=[];this.last='Wähle eine Karte. Erlaubte Ziele werden hervorgehoben.';}
  save(){const state={};for(const k of Object.keys(this))if(k!=='history')state[k]=copy(this[k]);this.history.push(state);if(this.history.length>120)this.history.shift()}
  undo(){if(!this.history.length)return false;const prev=this.history.pop();for(const key of Object.keys(prev))this[key]=prev[key];this.last='Letzten Zug rückgängig gemacht.';return true}
 }
 class Classic extends Base{
  constructor(mode='klondike',random=Math.random){super();this.mode=mode;this.columns=Array.from({length:mode==='freecell'?8:7},()=>[]);this.foundations=suits.map(()=>[]);this.cells=Array.from({length:4},()=>[]);this.stock=[];this.waste=[];const cards=shuffle(pack(),random);if(mode==='freecell'){for(let i=0;cards.length;i++)this.columns[i%8].push(cards.pop())}else{for(let col=0;col<7;col++)for(let row=0;row<=col;row++){const c=cards.pop();c.up=row===col;this.columns[col].push(c)}this.stock=cards;this.stock.forEach(c=>c.up=false)}}
  get done(){return this.foundations.every(f=>f.length===13)}
  pile(ref){return ref.type==='column'?this.columns[ref.index]:ref.type==='foundation'?this.foundations[ref.index]:ref.type==='cell'?this.cells[ref.index]:ref.type==='waste'?this.waste:null}
  take(ref){const pile=this.pile(ref);if(!pile?.length)return null;const at=ref.type==='column'?ref.at:pile.length-1;if(!Number.isInteger(at)||at<0||at>=pile.length)return null;const cards=pile.slice(at);if(!cards[0].up)return null;if(ref.type!=='column'&&cards.length!==1)return null;for(let i=1;i<cards.length;i++)if(!cards[i].up||cards[i-1].value!==cards[i].value+1||red(cards[i-1])===red(cards[i]))return null;return cards}
  canMove(from,to){if(this.done||!from||!to||from.type===to.type&&from.index===to.index)return false;const cards=this.take(from),dest=this.pile(to);if(!cards||!dest)return false;const top=dest.at(-1),c=cards[0];if(to.type==='foundation')return cards.length===1&&c.suit===suits[to.index]&&c.value===dest.length+1;if(to.type==='cell')return this.mode==='freecell'&&dest.length===0&&cards.length===1;if(to.type!=='column')return false;if(top&&(!top.up||top.value!==c.value+1||red(top)===red(c)))return false;if(!top&&this.mode==='klondike'&&c.value!==13)return false;if(this.mode==='freecell'){const free=this.cells.filter(c=>!c.length).length,empty=this.columns.filter((c,i)=>!c.length&&i!==to.index).length;if(cards.length>(free+1)*2**empty)return false}return true}
  move(from,to){if(!this.canMove(from,to))return false;this.save();const source=this.pile(from),cards=this.take(from);source.splice(source.length-cards.length,cards.length);this.pile(to).push(...cards);if(from.type==='column'&&source.length)source.at(-1).up=true;this.moves++;this.last=to.type==='foundation'?'Karte abgelegt. Deine Ablage wächst.':'Karten verschoben.';return true}
  draw(){if(this.mode!=='klondike'||this.done||!this.stock.length&&!this.waste.length)return false;this.save();if(this.stock.length){let c=this.stock.pop();c.up=true;this.waste.push(c);this.last='Karte gezogen. Wähle sie aus, um ein Ziel zu sehen.'}else{this.stock=this.waste.reverse();this.stock.forEach(c=>c.up=false);this.waste=[];this.last='Nachziehstapel neu aufgedeckt. Unbegrenzte Durchgänge.'}this.moves++;return true}
  options(){const sources=[];this.columns.forEach((p,index)=>p.forEach((c,at)=>{if(c.up)sources.push({type:'column',index,at})}));this.cells.forEach((p,index)=>{if(p.length)sources.push({type:'cell',index})});if(this.waste.length)sources.push({type:'waste',index:0});const targets=[...this.foundations.map((_,index)=>({type:'foundation',index})),...this.columns.map((_,index)=>({type:'column',index})),...this.cells.map((_,index)=>({type:'cell',index}))];let best=null,score=-1;for(const from of sources)for(const to of targets){if(!this.canMove(from,to))continue;if(from.type==='column'&&from.at===0&&to.type==='column'&&!this.columns[to.index].length)continue;if(from.type==='cell'&&to.type==='cell')continue;const uncover=from.type==='column'&&from.at>0&&!this.columns[from.index][from.at-1].up;let rank=to.type==='foundation'?100:uncover?80:from.type==='cell'&&to.type==='column'?65:from.type==='waste'?55:to.type==='cell'?5:25;rank+=Math.min(12,this.take(from).length);if(rank>score){score=rank;best={from,to}}}return best}
  safeFoundation(){const sources=[];this.columns.forEach((p,index)=>{if(p.length)sources.push({type:'column',index,at:p.length-1})});this.cells.forEach((p,index)=>{if(p.length)sources.push({type:'cell',index})});if(this.waste.length)sources.push({type:'waste',index:0});for(const from of sources){const cards=this.take(from);if(!cards||cards.length!==1)continue;const c=cards[0],to={type:'foundation',index:suits.indexOf(c.suit)};if(!this.canMove(from,to))continue;const safe=c.value<=2||suits.every((s,i)=>s===c.suit||this.foundations[i].length>=(red({suit:s})!==red(c)?c.value-1:c.value-2));if(safe)return {from,to}}return null}

 }
 class Spider extends Base{
  constructor(random=Math.random){super();this.columns=Array.from({length:10},()=>[]);this.stock=[];this.completed=[];let cards=shuffle(Array.from({length:8},()=>pack().filter(c=>c.suit==='spades')).flat(),random);for(let i=0;i<10;i++)for(let n=0;n<(i<4?6:5);n++){const c=cards.pop();c.up=n===(i<4?5:4);this.columns[i].push(c)}this.stock=cards;}
  get done(){return this.completed.length===8}
  take(from){const p=this.columns[from.index];if(from.type!=='column'||!p||!Number.isInteger(from.at)||from.at<0||from.at>=p.length)return null;const cards=p.slice(from.at);if(!cards.every(c=>c.up))return null;for(let i=1;i<cards.length;i++)if(cards[i-1].value!==cards[i].value+1)return null;return cards}
  canMove(from,to){if(this.done||!from||!to||to.type!=='column'||from.index===to.index)return false;const cards=this.take(from),p=this.columns[to.index];return !!(cards&&p&&(!p.length||p.at(-1).value===cards[0].value+1))}
  clearRuns(){let cleared=true;while(cleared){cleared=false;for(const p of this.columns){if(p.length<13)continue;const run=p.slice(-13);if(run.every((c,i)=>c.up&&c.value===13-i)){this.completed.push(p.splice(-13));if(p.length)p.at(-1).up=true;cleared=true}}}}
  move(from,to){if(!this.canMove(from,to))return false;this.save();const cards=this.take(from),p=this.columns[from.index];p.splice(p.length-cards.length);this.columns[to.index].push(...cards);if(p.length)p.at(-1).up=true;const before=this.completed.length;this.clearRuns();this.moves++;this.last=this.completed.length>before?'Vollständige Reihe! König bis Ass wurde abgelegt.':'Reihe verschoben.';return true}
  draw(){if(this.done||this.stock.length<10||this.columns.some(c=>!c.length))return false;this.save();for(const p of this.columns){const c=this.stock.pop();c.up=true;p.push(c)}this.clearRuns();this.moves++;this.last='Zehn neue Karten – eine auf jede Spalte.';return true}
  options(){let best=null,score=-1;for(let index=0;index<10;index++)for(let at=0;at<this.columns[index].length;at++)for(let target=0;target<10;target++){const from={type:'column',index,at},to={type:'column',index:target};if(!this.canMove(from,to))continue;if(at===0&&!this.columns[target].length)continue;const reveal=at>0&&!this.columns[index][at-1].up,cards=this.take(from);let rank=(reveal?100:0)+(this.columns[target].length?30:0)+cards.length;if(rank>score){score=rank;best={from,to}}}return best}

 }
 class Golf extends Base{
  constructor(random=Math.random){super();const cards=shuffle(pack(),random);this.columns=Array.from({length:7},()=>Array.from({length:5},()=>cards.pop()));this.waste=[cards.pop()];this.stock=cards;this.removed=[];}
  get won(){return this.columns.every(c=>!c.length)}
  legal(index){const c=this.columns[index]?.at(-1);return !!c&&Math.abs(c.value-this.waste.at(-1).value)===1}
  get done(){return this.won||!this.stock.length&&!this.columns.some((_,i)=>this.legal(i))}
  play(index){if(this.done||!this.legal(index))return false;this.save();this.waste.push(this.columns[index].pop());this.moves++;this.last='Eine Karte weniger. Suche die nächste Nachbarzahl.';return true}
  draw(){if(this.done||!this.stock.length)return false;this.save();this.waste.push(this.stock.pop());this.moves++;this.last='Neue Ablagekarte gezogen.';return true}
 }
 class Pyramid extends Base{
  constructor(random=Math.random){super();let cards=shuffle(pack(),random);this.pyramid=Array.from({length:28},()=>cards.pop());this.stock=cards;this.waste=[];this.removed=[];}
  get won(){return this.pyramid.every(c=>c===null)}
  exposed(i){if(!Number.isInteger(i)||i<0||i>=28||!this.pyramid[i])return false;let row=0;while(i>=(row+1)*(row+2)/2)row++;if(row===6)return true;const pos=i-row*(row+1)/2,child=(row+1)*(row+2)/2+pos;return !this.pyramid[child]&&!this.pyramid[child+1]}
  card(ref){return ref.type==='pyramid'&&this.exposed(ref.index)?this.pyramid[ref.index]:ref.type==='waste'?this.waste.at(-1):null}
  available(){return [...this.pyramid.flatMap((c,index)=>this.exposed(index)?[{type:'pyramid',index}]:[]),...(this.waste.length?[{type:'waste',index:0}]:[])]}
  pair(a,b){const ca=this.card(a);if(!ca)return false;if(!b)return ca.value===13;if(a.type===b.type&&a.index===b.index)return false;const cb=this.card(b);return !!cb&&ca.value+cb.value===13}
  remove(ref){const c=this.card(ref);this.removed.push(c);if(ref.type==='pyramid')this.pyramid[ref.index]=null;else this.waste.pop()}
  play(a,b){if(this.won||!this.pair(a,b))return false;this.save();this.remove(a);if(b)this.remove(b);this.moves++;this.last=b?'13! Das Kartenpaar wurde entfernt.':'König entfernt – er zählt allein 13.';return true}
  draw(){if(this.won||!this.stock.length)return false;this.save();this.waste.push(this.stock.pop());this.moves++;this.last='Neue Karte aufgedeckt. Finde zusammen 13.';return true}
  options(){const a=this.available();for(let i=0;i<a.length;i++){if(this.pair(a[i],null))return {from:a[i],to:null};for(let j=i+1;j<a.length;j++)if(this.pair(a[i],a[j]))return {from:a[i],to:a[j]}}return null}
  get done(){return this.won||!this.stock.length&&!this.options()}
 }
 const api={suits,pack,shuffle,Classic,Spider,Golf,Pyramid};if(typeof module==='object'&&module.exports)module.exports=api;else root.SolitaireModels=api;
})(typeof window==='object'?window:globalThis);
