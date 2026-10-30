(function(root){
 'use strict';
 class Controls{
  constructor(){this.userMuted=false;this.userVolume=1;this.hostMuted=false;this.hostVolume=1;this.userPaused=false;this.hostPaused=false;this.dialogPaused=false;this.settingsPaused=false;}
  get muted(){return this.hostMuted||this.userMuted||this.volume===0}
  get volume(){return this.hostVolume*this.userVolume}
  get paused(){return this.hostPaused||this.userPaused||this.dialogPaused||this.settingsPaused}
  host(value={}){if(typeof value.muted==='boolean')this.hostMuted=value.muted;if(Number.isFinite(value.volume))this.hostVolume=Math.max(0,Math.min(1,value.volume))}
  volumeTo(value){if(Number.isFinite(value))this.userVolume=Math.max(0,Math.min(1,value))}
 }
 if(typeof module==='object'&&module.exports)module.exports=Controls;else root.RoyaleControls=Controls;
})(typeof window==='object'?window:globalThis);
