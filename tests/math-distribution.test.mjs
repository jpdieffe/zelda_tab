import test from 'node:test';
import assert from 'node:assert/strict';
import {QuestionDeck as ZeldaDeck} from '../dist/learning.js';
import {QuestionDeck as MarioDeck} from '../dist/mario/learning.js';

for(const [game,Deck] of [['Zelda',ZeldaDeck],['Mario',MarioDeck]]){
  test(`${game}: zero appears in only every tenth math question, with varied facts and alternating word practice`,()=>{
    for(const random of [()=>0,()=>.999999,Math.random]){
      const deck=new Deck(random),positive=new Set(),zero=new Set();
      for(let i=0;i<420;i++){
        deck.next('jj');
        const q=deck.next('michelle');
        assert.equal(q.kind,'math');
        const usesZero=q.a===0||q.b===0||q.answer==='0';
        assert.equal(usesZero,i%10===9,`question ${i+1}: ${q.prompt}`);
        assert.equal(Number(q.answer),q.operator==='+'?q.a+q.b:q.a-q.b);
        assert.deepEqual(q.choices,Array.from({length:11},(_,n)=>String(n)));
        if(usesZero)zero.add(q.prompt);
        else if(i<100)positive.add(q.prompt);
        assert.equal(deck.next('michelle').kind,'word');
      }
      assert.equal(positive.size,90,'all positive facts appear before any repeats');
      assert.equal(zero.size,42,'occasional zero practice still covers every zero fact');
    }
  });
}
