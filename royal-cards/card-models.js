(function(root){
 'use strict';
 const suits=['spades','hearts','diamonds','clubs'],ranks=['ace','2','3','4','5','6','7','8','9','10','jack','queen','king'];
 function shuffle(cards,random=Math.random){const result=cards.slice();for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]]}return result}
 function deck(){return suits.flatMap(suit=>ranks.map(rank=>({rank,suit})))}
 class Memory{
  constructor(random=Math.random){const chosen=shuffle(deck(),random).slice(0,8);this.cards=shuffle(chosen.flatMap((c,pair)=>[{...c,pair},{...c,pair}]),random);this.open=[];this.matched=new Set();this.moves=0;this.done=false;this.waiting=false;}
  flip(i){if(this.done||this.waiting||!Number.isInteger(i)||i<0||i>=16||this.matched.has(i)||this.open.includes(i))return false;this.open.push(i);if(this.open.length===2){this.moves++;const [a,b]=this.open;if(this.cards[a].pair===this.cards[b].pair){this.matched.add(a);this.matched.add(b);this.open=[];this.done=this.matched.size===16;}else this.waiting=true;}return true;}
  conceal(){if(this.waiting){this.waiting=false;this.open=[];}}
 }
 class Mau{
  constructor(random=Math.random){this.random=random;this.pile=shuffle(deck(),random);this.hands=[[],[]];for(let n=0;n<5;n++)for(let p=0;p<2;p++)this.hands[p].push(this.pile.pop());let first=this.pile.findIndex(c=>!['7','8','jack'].includes(c.rank));this.discard=[this.pile.splice(first,1)[0]];this.suit=this.discard[0].suit;this.turn=0;this.drawn=null;this.winner=null;this.last='Du beginnst.';}
  playable(card){const top=this.discard[this.discard.length-1];return card.rank==='jack'||card.rank===top.rank||card.suit===this.suit;}
  legal(p,i){return this.winner===null&&this.turn===p&&i>=0&&i<this.hands[p].length&&(this.drawn===null||this.drawn===i)&&this.playable(this.hands[p][i]);}
  take(p){if(!this.pile.length&&this.discard.length>1){const top=this.discard.pop();this.pile=shuffle(this.discard,this.random);this.discard=[top]}if(this.pile.length)this.hands[p].push(this.pile.pop());}
  play(p,i,wish){if(!this.legal(p,i))return false;const card=this.hands[p][i];if(card.rank==='jack'&&!suits.includes(wish))return false;this.hands[p].splice(i,1);this.discard.push(card);this.suit=card.rank==='jack'?wish:card.suit;this.drawn=null;if(!this.hands[p].length){this.winner=p;this.last=p===0?'Mau-Mau! Du gewinnst.':'Der Computer gewinnt.';return true}const other=1-p;if(card.rank==='7'){this.take(other);this.take(other);this.turn=p;this.last='Sieben: Gegner zieht zwei und setzt aus.';}else if(card.rank==='8'){this.turn=p;this.last='Acht: Gegner setzt aus.';}else{this.turn=other;this.last=card.rank==='jack'?'Neue Wunschfarbe gewählt.':this.hands[p].length===1?'Mau! Nur noch eine Karte.':'Karte abgelegt.';}return true;}
  draw(p){if(this.winner!==null||this.turn!==p||this.drawn!==null)return false;const n=this.hands[p].length;this.take(p);if(this.hands[p].length>n&&this.playable(this.hands[p][n])){this.drawn=n;this.last='Gezogene Karte passt: ausspielen oder passen.';}else{this.turn=1-p;this.last='Karte gezogen. Der Gegner ist am Zug.';}return true;}
  pass(p){if(this.turn!==p||this.drawn===null||this.winner!==null)return false;this.drawn=null;this.turn=1-p;this.last='Du passt.';return true;}
  bot(){if(this.turn!==1||this.winner!==null)return false;let i=this.hands[1].findIndex((c,i)=>this.legal(1,i));if(i<0){this.draw(1);if(this.turn!==1)return true;i=this.drawn;}if(i===null||i<0){this.pass(1);return true}const counts=suits.map(suit=>this.hands[1].filter(c=>c.suit===suit).length),wish=suits[counts.indexOf(Math.max(...counts))];return this.play(1,i,wish);}
 }
 const api={suits,ranks,shuffle,deck,Memory,Mau};if(typeof module==='object'&&module.exports)module.exports=api;else root.CardModels=api;
})(typeof window==='object'?window:globalThis);
