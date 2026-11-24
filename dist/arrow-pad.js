// Each held arrow contributes a direction; two fingers can move diagonally.
export class ArrowPad{
  constructor(element,onChange){
    this.element=element;this.onChange=onChange;this.held=new Map();this.vector={x:0,y:0};
    for(const button of element.querySelectorAll('[data-direction]')){
      button.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();button.setPointerCapture(e.pointerId);this.held.set(e.pointerId,button.dataset.direction);this.update();};
      const up=e=>{this.held.delete(e.pointerId);this.update();};
      button.onpointerup=up;button.onpointercancel=up;button.onlostpointercapture=up;
      button.onkeydown=e=>{if(!['Enter',' '].includes(e.key))return;e.preventDefault();this.held.set('key:'+button.dataset.direction,button.dataset.direction);this.update();};
      button.onkeyup=e=>{if(!['Enter',' '].includes(e.key))return;e.preventDefault();this.held.delete('key:'+button.dataset.direction);this.update();};
      button.onblur=()=>{this.held.delete('key:'+button.dataset.direction);this.update();};
    }
    element.oncontextmenu=e=>e.preventDefault();
  }
  update(){
    const keys=new Set(this.held.values()),x=Number(keys.has('right'))-Number(keys.has('left')),y=Number(keys.has('down'))-Number(keys.has('up')),d=Math.hypot(x,y)||1;
    this.vector={x:x/d,y:y/d};
    for(const button of this.element.querySelectorAll('[data-direction]')){const pressed=keys.has(button.dataset.direction);button.classList.toggle('pressed',pressed);button.setAttribute('aria-pressed',String(pressed));}
    this.onChange(this.vector);
  }
  reset(){this.held.clear();this.update();}
}
