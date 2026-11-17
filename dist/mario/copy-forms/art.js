// All character art comes from the original ROM: CHR tiles, native OAM and palettes.
let library;
const surfaces=new WeakMap();
export function setSpriteLibrary(value){library=value;}
function surface(sprite){
  if(surfaces.has(sprite))return surfaces.get(sprite);
  const canvas=document.createElement('canvas');canvas.width=sprite.width;canvas.height=sprite.height;
  const c=canvas.getContext('2d'),image=c.createImageData(sprite.width,sprite.height);
  new Uint32Array(image.data.buffer).set(sprite.pixels);c.putImageData(image,0,0);surfaces.set(sprite,canvas);return canvas;
}
export function drawSprite(ctx,sprite,x,y,scale=1,facing=sprite?.facing,phase=false){
  if(!sprite)return;
  ctx.save();ctx.imageSmoothingEnabled=false;ctx.globalAlpha=phase?.45:1;
  ctx.translate(Math.round(x),Math.round(y));
  if(facing!==sprite.facing){ctx.translate(sprite.width*scale,0);ctx.scale(-1,1);}
  ctx.drawImage(surface(sprite),0,0,sprite.width*scale,sprite.height*scale);ctx.restore();
}
export function drawForm(ctx,form,x=0,y=0,size=32,tick=0,pose={}){
  const sprite=library?.image(form,tick,pose);if(!sprite)return;
  const scale=form.key==='enemy-5d'?Math.min(1,size/Math.max(sprite.width,sprite.height)):Math.max(1,Math.floor(size/Math.max(sprite.width,sprite.height)));
  drawSprite(ctx,sprite,x+(size-sprite.width*scale)/2,y+(size-sprite.height*scale)/2,scale,pose.facing??sprite.facing,pose.phase);
}

export function drawGame(ctx,game){
  const image=ctx.createImageData(256,240),out=new Uint32Array(image.data.buffer);
  for(let i=0;i<out.length;i++)out[i]=game.pixels[i]|0xff000000;
  ctx.putImageData(image,0,0);
  if(!game.inLevel)return;
  const p=game.position;ctx.save();ctx.beginPath();ctx.rect(0,0,256,208);ctx.clip();ctx.translate(-p.cameraX,-p.cameraY);
  if(game.custom&&game.nes.hideMario){
    const blink=game.m[0x552]&&game.frame%8<4;
    if(!blink&&game.form.key==='enemy-59'){
      const flame=game.sprites.fireSnake(game.frame,true,game.sprites.fireSnakePalette());
      for(const t of [...game.snakeTail].reverse())drawSprite(ctx,flame,t.x-flame.width/2,t.y+flame.top,1,t.facing);
    }
    if(!blink){const sprite=game.sprites.image(game.form,game.frame,game.spritePose);if(sprite)drawSprite(ctx,sprite,p.x+8-sprite.width/2,p.y+33-sprite.height,1,game.facing,game.phaseTime>0||(game.form.collapse&&game.form.enemyId!==0x3f&&(game.mask&32)));}
  }
  if(game.spikeBall){const b=game.spikeBall,sprite=game.sprites.spikeBall(game.frame);drawSprite(ctx,sprite,b.x-sprite.width/2,b.y-sprite.height/2);}
  for(const s of game.shots){
    if(s.kind==='spike-spit'){if(s.launched){const sprite=game.sprites.spikeSpitBall(game.frame,s.palette);drawSprite(ctx,sprite,s.x-sprite.width/2,s.y-sprite.height/2);}continue;}
    if(s.kind==='hammer'){const sprite=game.sprites.hammer(s.age,s.facing);drawSprite(ctx,sprite,s.x-sprite.width/2,s.y-sprite.height/2);continue;}
    if(s.kind==='fire-snake-flame'){const flame=game.sprites.fireSnake(game.frame,true,game.sprites.fireSnakePalette());drawSprite(ctx,flame,s.x-flame.width/2,s.y-flame.height/2);continue;}
    if(s.kind==='rings'){const sprite=game.sprites.bossRing(s.age);drawSprite(ctx,sprite,s.x-sprite.width/2,s.y-sprite.height/2);continue;}
    if(s.kind==='bone'){const sprite=game.sprites.bone(s.age,s.facing);drawSprite(ctx,sprite,s.x-sprite.width/2,s.y-sprite.height/2);continue;}
    if(s.kind==='micro-goomba'){const sprite=game.sprites.microGoomba();drawSprite(ctx,sprite,s.x-sprite.width/2,s.y-sprite.height/2,1,(s.age&8)?s.direction:-s.direction);continue;}
    if(s.kind==='spikeball'){const sprite=game.sprites.spikeBall(game.frame);drawSprite(ctx,sprite,s.x-sprite.width/2,s.y-sprite.height/2);continue;}
    if(s.kind==='boomerang'){
      const sprite=game.sprites.boomerang(s.age,s.facing);
      if(sprite)drawSprite(ctx,sprite,s.x-sprite.width/2,s.y-sprite.height/2);
      continue;
    }
    const x=Math.round(s.x),y=Math.round(s.y);ctx.fillStyle=s.kind==='copy'?'#4a9ab8':s.color;
    ctx.fillRect(x-3-Math.sign(s.vx)*3,y-2,6,5);ctx.fillStyle=s.kind==='copy'?'#88ffe6':'#ffcc79';ctx.fillRect(x-3,y-3,7,7);ctx.fillStyle='#fff8df';ctx.fillRect(x-1,y-2,3,4);
    if(s.kind==='copy'){ctx.fillStyle='#b7b4ff';ctx.fillRect(x-6,y+3,3,2);}
    if(s.kind==='wrench'){ctx.fillStyle='#cbd7e4';ctx.fillRect(x-5,y-4,9,3);ctx.fillStyle='#8d674a';ctx.fillRect(x-1,y-1,2,6);}
    if(s.returning){ctx.fillStyle=s.color;ctx.fillRect(x-4,y-4,3,8);ctx.fillRect(x-1,y+1,6,3);}
  }
  if(game.orbitTime>0){const c=game.center,sprite=game.sprites.rotoDisc(game.frame);for(const o of game.orbits())drawSprite(ctx,sprite,c.x+o.x-sprite.width/2,c.y+o.y-sprite.height/2);}
  for(const e of game.effects){ctx.globalAlpha=Math.min(1,e.life/10);ctx.fillStyle=e.color;ctx.strokeStyle=e.color;if(e.kind==='chip')ctx.fillRect(Math.round(e.x),Math.round(e.y),4,4);else{const r=e.radius*(1-e.life/e.max*.8);ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.x,e.y,r,0,Math.PI*2);ctx.stroke();for(let i=0;i<6;i++){const a=i*Math.PI/3+game.frame*.02;ctx.fillRect(Math.round(e.x+Math.cos(a)*r)-1,Math.round(e.y+Math.sin(a)*r)-1,2,2);}}}
  ctx.restore();
}
