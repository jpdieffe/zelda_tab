// Prevent accidental exits during child play. Android app pinning is still
// needed to restrict system navigation; browser fullscreen is always escapable.
export class KidLock {
  constructor(onChange=()=>{}) {
    this.locked=false;this.onChange=onChange;this.timer=null;
    this.tablet=document.getElementById('tablet');
    this.unlockButton=document.getElementById('kid-unlock');
    this.restoreButton=document.getElementById('kid-fullscreen');
    this.systemStatus=document.getElementById('kid-system-status');
    this.systemButton=document.getElementById('kid-system-lock');
    this.systemButton.onclick=()=>window.FairyAndroid?.setLocked(true);
    if(window.FairyAndroid)document.querySelector('.tablet-app-download').hidden=true;
    setInterval(()=>this.updateSystemLock(),1000);
    document.getElementById('kid-lock').onclick=()=>this.lock();
    this.restoreButton.onclick=()=>this.fullscreen();
    const prevent=e=>e.preventDefault();
    for(const name of ['contextmenu','selectstart','dragstart'])this.tablet.addEventListener(name,prevent);
    for(const name of ['dblclick','wheel'])this.tablet.addEventListener(name,e=>{if(this.locked)e.preventDefault();},{passive:false});
    this.unlockButton.onpointerdown=e=>{
      if(e.button!==0||this.timer!==null)return;
      e.preventDefault();this.unlockButton.setPointerCapture(e.pointerId);this.beginHold();
    };
    for(const event of ['pointerup','pointercancel','lostpointercapture'])this.unlockButton.addEventListener(event,()=>this.cancelHold());
    this.unlockButton.onpointermove=e=>{
      const r=this.unlockButton.getBoundingClientRect();
      if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)this.cancelHold();
    };
    this.unlockButton.onkeydown=e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();if(!e.repeat)this.beginHold();}};
    this.unlockButton.onkeyup=()=>this.cancelHold();
    this.unlockButton.onblur=()=>this.cancelHold();
    window.addEventListener('blur',()=>this.cancelHold());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.cancelHold();});
    document.addEventListener('fullscreenchange',()=>this.updateFullscreen());
    window.addEventListener('popstate',()=>{
      // Keep a single same-page guard, replacing it after ordinary Back.
      // This is best effort: system navigation and repeated history jumps can
      // still leave a browser tab. Unlock removes the guard deliberately.
      if(this.locked&&!history.state?.fairyKidGuard)this.pushGuard();
    });
  }
  pushGuard(){history.pushState({...history.state,fairyKidGuard:true},'',location.href);}
  lock(){
    if(this.locked)return;
    this.locked=true;this.pushGuard();this.tablet.classList.add('kid-locked');
    window.FairyAndroid?.setLocked(true);this.updateSystemLock();
    this.onChange(true);this.fullscreen();
  }
  unlock(){
    if(!this.locked)return;
    this.locked=false;this.cancelHold();this.tablet.classList.remove('kid-locked');
    window.FairyAndroid?.setLocked(false);
    this.restoreButton.hidden=true;this.onChange(false);
    if(history.state?.fairyKidGuard)history.back();
  }
  beginHold(){
    if(!this.locked||this.timer!==null)return;
    this.unlockButton.classList.add('holding');this.unlockButton.textContent='Keep holding…';
    this.timer=setTimeout(()=>this.unlock(),3000);
  }
  cancelHold(){clearTimeout(this.timer);this.timer=null;this.unlockButton.classList.remove('holding');this.unlockButton.textContent='Hold 3 sec to unlock';}
  async fullscreen(){
    if(window.FairyAndroid){this.restoreButton.hidden=true;return;}
    try{
      if(!document.fullscreenElement&&!matchMedia('(display-mode: fullscreen)').matches)await document.documentElement.requestFullscreen({navigationUI:'hide'});
      try{await screen.orientation?.lock?.('landscape');}catch{}
    }catch{}
    this.updateFullscreen();
  }
  updateFullscreen(){this.restoreButton.hidden=!this.locked||Boolean(window.FairyAndroid)||Boolean(document.fullscreenElement)||matchMedia('(display-mode: fullscreen)').matches;}
  updateSystemLock(){
    if(!this.locked)return;
    const native=window.FairyAndroid,pinned=Boolean(native?.isPinned());
    this.systemStatus.textContent=native?(pinned?'Android buttons locked':'Accept Android’s pinning prompt'):'Kid lock on';
    this.systemButton.hidden=!native||pinned;
  }
}
