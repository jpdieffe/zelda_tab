import assert from 'node:assert/strict';
export async function learningChecks({dad,jj,michelle,shot}){
  await dad.setViewportSize({width:900,height:430});
  await jj.evaluate(()=>{window.questionSpeech=[];speechSynthesis.speak=utterance=>questionSpeech.push(utterance.text);});
  await jj.locator('#kid-lock').click();
  const begin=async()=>{
    await dad.evaluate(()=>{testGame.learning.elapsed=59.99;});
    await jj.waitForFunction(()=>!document.getElementById('quiz-panel').hidden);
    assert.equal(await dad.evaluate(()=>testGame.paused),true);
    assert.equal(await jj.locator('#quiz-title').textContent(),'Get ready for questions');
    assert.equal(await jj.locator('#quiz-choices').isVisible(),false);
    assert.ok(await jj.evaluate(()=>questionSpeech.at(-1).startsWith('Get ready for questions')));
    await shot(jj,'quiz-get-ready.png');
    await jj.locator('#quiz-next').click();
    await jj.waitForFunction(()=>document.getElementById('quiz-next').hidden);
  };
  const answer=async correct=>{
    const index=await dad.evaluate(correct=>{const r=testGame.learning.round,q=r.questions[r.index];return q.choices.findIndex(v=>correct?v===q.answer:v!==q.answer);},correct);
    await jj.locator('.quiz-choice').nth(index).click();
    await jj.locator('#quiz-next').waitFor({state:'visible'});
  };
  const retry=async()=>{
    await answer(false);assert.match(await jj.locator('#quiz-title').textContent(),/Try again/);
    await jj.locator('#quiz-next').click();await jj.waitForFunction(()=>document.getElementById('quiz-next').hidden);
    await answer(true);assert.match(await jj.locator('#quiz-feedback').textContent(),/No laser bonus/);
  };
  // Duration is checked by unit tests; fast-forward earned time to exercise more rounds here.
  const expire=async()=>{await dad.evaluate(()=>{for(const t of Object.values(testGame.lasers.timers)){t.remaining=.01;t.giant=Math.min(t.giant,.01);}});await dad.waitForFunction(()=>!testGame.lasers.active);};
  const steer=async(role)=>{
    const rendered=()=>dad.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
    if(role==='jj'){
      const surface=await jj.locator('#tap-surface').boundingBox(),cdp=await jj.context().newCDPSession(jj);
      const point=(x,y)=>({id:1,x:surface.x+surface.width*x/256,y:surface.y+surface.height*y/224});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(230,160)]});
      await dad.waitForFunction(()=>testGame.lasers.aim.jj?.x>0);
      await rendered();
      const first=await dad.evaluate(()=>({...testGame.lasers.beams.find(b=>b.role==='jj').end}));
      await jj.waitForTimeout(40);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(70,80)]});
      await dad.waitForFunction(()=>testGame.lasers.aim.jj?.x<0);
      await rendered();
      const second=await dad.evaluate(()=>({...testGame.lasers.beams.find(b=>b.role==='jj').end}));
      assert.ok(Math.hypot(first.x-second.x,first.y-second.y)>5,'JJ touch drag visibly turns the beam');
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
    }else{
      const pad=await michelle.locator('#unicorn-pad').boundingBox(),x=pad.x+pad.width/2,y=pad.y+pad.height/2;
      await michelle.mouse.move(x,y);await michelle.mouse.down();await michelle.mouse.move(x+50,y-5);
      await dad.waitForFunction(()=>testGame.lasers.aim.michelle?.x>.9&&testGame.lasers.aim.michelle?.y<0);
      await rendered();
      const first=await dad.evaluate(()=>({...testGame.lasers.beams.find(b=>b.role==='michelle').end}));
      await michelle.mouse.move(x+50,y-18);
      await dad.waitForFunction(()=>testGame.lasers.aim.michelle?.y<-.3);
      await rendered();
      const second=await dad.evaluate(()=>({...testGame.lasers.beams.find(b=>b.role==='michelle').end}));
      assert.ok(Math.hypot(first.x-second.x,first.y-second.y)>1,'Small joystick turns visibly change the beam within one octant');
      await michelle.mouse.up();assert.equal(await dad.evaluate(()=>testGame.unicorn.inputY),0,'Joystick aims instead of walking');
    }
  };
  await begin();
  const token=await dad.evaluate(()=>testGame.learning.token());
  const frame=await dad.evaluate(()=>testGame.bridge.ram[0x1a]);await dad.waitForTimeout(200);
  assert.equal(await dad.evaluate(()=>testGame.bridge.ram[0x1a]),frame,'Emulator is frozen for questions');
  assert.match(await jj.locator('#quiz-turn').textContent(),/JJ/);assert.equal(await jj.locator('.quiz-choice').count(),3);
  assert.ok(await jj.evaluate(()=>questionSpeech.at(-1).startsWith('JJ, find the letter')),'Letter prompt is spoken');
  await shot(jj,'quiz-jj-letter.png');
  await michelle.evaluate(async token=>{const {game}=await import('/app.js');game.network.send({type:'quiz-answer',token,index:0});},token);
  await dad.waitForTimeout(100);assert.equal(await dad.evaluate(()=>testGame.learning.round.results.length),0,'Phone cannot answer on behalf of tablet');
  await answer(true);await jj.locator('#quiz-next').click();
  await jj.waitForFunction(()=>document.getElementById('quiz-turn').textContent.startsWith('Michelle'));
  assert.equal(await dad.evaluate(()=>testGame.learning.round.questions[1].kind),'math');
  assert.deepEqual(await jj.locator('.quiz-choice').allTextContents(),Array.from({length:11},(_,n)=>String(n)));
  assert.ok(await jj.locator('.quiz-choice').evaluateAll(buttons=>buttons.every(b=>{const r=b.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.bottom<=innerHeight;})),'Every number is visible and easy to tap');
  await shot(jj,'quiz-michelle-math.png');
  assert.ok(await jj.evaluate(()=>questionSpeech.some(text=>text.startsWith('Michelle, what is'))));
  await answer(true);assert.match(await jj.locator('#quiz-feedback').textContent(),/Two giant lasers/);
  await jj.locator('#quiz-next').click();await jj.locator('#quiz-panel').waitFor({state:'hidden'});
  await dad.waitForFunction(()=>testGame.lasers.active);
  assert.equal(await dad.evaluate(()=>testGame.lasers.giant),true);
  assert.ok(await dad.evaluate(()=>testGame.lasers.remaining>15&&testGame.lasers.remaining<=20));
  await steer('jj');await steer('michelle');
  await shot(jj,'quiz-team-lasers.png');
  await dad.locator('#pause').click();const remaining=await dad.evaluate(()=>testGame.lasers.remaining);
  await dad.waitForTimeout(250);assert.equal(await dad.evaluate(()=>testGame.lasers.remaining),remaining,'Manual pause preserves laser time');
  await dad.locator('#pause').click();await expire();
  await begin();
  await jj.evaluate(async()=>{const {game}=await import('/app.js');game.network.connection.close();});
  await dad.waitForFunction(()=>!testGame.network.has('jj'));
  const savedToken=await dad.evaluate(()=>testGame.learning.token());
  await dad.waitForFunction(()=>testGame.network.has('jj'),{},{timeout:15000});
  assert.equal(await dad.evaluate(()=>testGame.learning.token()),savedToken,'Reconnection restores the same pending question');
  await retry();await jj.locator('#quiz-next').click();
  await jj.waitForFunction(()=>document.getElementById('quiz-turn').textContent.startsWith('Michelle'));
  assert.equal(await dad.evaluate(()=>testGame.learning.round.questions[1].kind),'word');
  await shot(jj,'quiz-michelle-sight-word.png');
  await answer(true);await jj.locator('#quiz-next').click();
  await dad.waitForFunction(()=>testGame.lasers.active);
  assert.deepEqual(await dad.evaluate(()=>({roles:testGame.lasers.roles,giant:testGame.lasers.giant})),{roles:['michelle'],giant:false});
  await steer('michelle');await expire();
  await begin();await answer(true);await jj.locator('#quiz-next').click();
  await jj.waitForFunction(()=>document.getElementById('quiz-turn').textContent.startsWith('Michelle'));
  await retry();await jj.locator('#quiz-next').click();await dad.waitForFunction(()=>testGame.lasers.active);
  assert.deepEqual(await dad.evaluate(()=>testGame.lasers.roles),['jj']);await steer('jj');await expire();
  await begin();await dad.locator('#skip-questions').click();await jj.locator('#quiz-panel').waitFor({state:'hidden'});
  assert.equal(await dad.evaluate(()=>testGame.paused||testGame.lasers.active),false,'Parent skip resumes without awarding lasers');
  console.log('Ready screen, spoken prompts, retries without bonus, touch and analog steering for regular/giant lasers, 20-second rewards, pause, skip, and reconnection passed');
}
