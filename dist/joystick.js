// Floating thumb origin: touch anywhere in the large pad, then drag to move.
// The SNES receives its normal eight directions; release always returns neutral.
export class Joystick {
  constructor(element,press,release){
    this.element=element;this.press=press;this.release=release;this.pointer=null;this.keys=new Set();
    element.onpointerdown=e=>{
      if(e.button!==0||this.pointer!==null)return;
      e.preventDefault();this.pointer=e.pointerId;this.origin={x:e.clientX,y:e.clientY};
      element.setPointerCapture(e.pointerId);element.classList.add('active');this.draw(0,0);
    };
    element.onpointermove=e=>{
      if(e.pointerId!==this.pointer)return;e.preventDefault();
      const dx=e.clientX-this.origin.x,dy=e.clientY-this.origin.y,d=Math.hypot(dx,dy),next=new Set();
      if(d>10){
        if(Math.abs(dx)>Math.abs(dy)*.4142)next.add(dx<0?'6':'7');
        if(Math.abs(dy)>Math.abs(dx)*.4142)next.add(dy<0?'4':'5');
      }
      for(const key of this.keys)if(!next.has(key))release(key,'joystick');
      for(const key of next)if(!this.keys.has(key))press(key,'joystick');
      this.keys=next;this.draw(dx,dy);
    };
    for(const type of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(type,e=>{if(e.pointerId===this.pointer)this.reset();});
    element.oncontextmenu=e=>e.preventDefault();
  }
  draw(dx,dy){
    const rect=this.element.getBoundingClientRect(),radius=rect.width*.24,d=Math.hypot(dx,dy),scale=d>radius?radius/d:1;
    this.element.style.setProperty('--stick-x',`${this.origin.x-rect.left+dx*scale}px`);
    this.element.style.setProperty('--stick-y',`${this.origin.y-rect.top+dy*scale}px`);
  }
  reset(){
    for(const key of this.keys)this.release(key,'joystick');
    this.keys.clear();this.pointer=null;this.element.classList.remove('active');
    this.element.style.removeProperty('--stick-x');this.element.style.removeProperty('--stick-y');
  }
}
