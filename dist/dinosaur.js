export function drawDinosaur(ctx,actor,time){
  ctx.save();ctx.translate(actor.x,actor.y);ctx.scale(actor.aimX<0?-1:1,1);
  const scale=actor.dinosaurGiant?1.35:1;ctx.scale(scale,scale);ctx.shadowBlur=0;
  ctx.fillStyle='#061a2060';ctx.beginPath();ctx.ellipse(0,9,22,5,0,0,Math.PI*2);ctx.fill();
  const stride=Math.sin(time/90)*3;
  ctx.fillStyle=actor.enabled===undefined?'#56bb70':'#be87de';
  ctx.beginPath();ctx.moveTo(-11,0);ctx.lineTo(-31,-10);ctx.lineTo(-23,4);ctx.lineTo(-7,8);ctx.closePath();ctx.fill();
  ctx.fillRect(-14,-10,27,18);ctx.fillRect(4,-24,13,19);ctx.fillRect(9,-27,21,14);ctx.fillRect(11,-14,16,5);
  ctx.fillRect(-10,4,7,10+stride);ctx.fillRect(6,4,7,10-stride);ctx.fillRect(12,-4,8,4);
  ctx.fillStyle='#f4df91';ctx.fillRect(1,-5,10,10);ctx.fillRect(-11,12+stride,10,3);ctx.fillRect(5,12-stride,10,3);
  for(let x=-12;x<6;x+=7){ctx.beginPath();ctx.moveTo(x,-10);ctx.lineTo(x+3,-17);ctx.lineTo(x+6,-10);ctx.closePath();ctx.fill();}
  ctx.fillStyle='#fff8df';ctx.fillRect(19,-24,6,5);ctx.fillRect(18,-12,3,3);ctx.fillRect(24,-12,3,3);
  ctx.fillStyle='#202b36';ctx.fillRect(22,-23,2,3);ctx.fillRect(28,-19,2,2);ctx.restore();
}
