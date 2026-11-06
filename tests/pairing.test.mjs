import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Connection,roomCode,validCode} from '../dist/network.js';

test('two-letter code selection skips every attempted code',()=>{
  const tried=new Set();
  for(let i=0;i<24*24;i++){
    const code=roomCode(tried);assert.equal(validCode(code),true);assert.equal(tried.has(code),false);tried.add(code);
  }
  assert.throws(()=>roomCode(tried),/No free room codes/);
});

test('an occupied host code is replaced automatically and only the reserved code is displayed',()=>{
  const previous=globalThis.window,peers=[],shown=[],statuses=[];
  class Peer extends EventEmitter{
    constructor(id){super();this.id=id;this.open=false;peers.push(this);}
    destroy(){this.destroyed=true;this.emit('disconnected');}
  }
  globalThis.window={Peer};
  const host=new Connection({role:'dad',code:'AB',onCode:code=>shown.push(code),onStatus:message=>statuses.push(message)});
  try{
    host.start();const first=host.peer;first.emit('error',{type:'unavailable-id'});
    assert.equal(first.destroyed,true);assert.notEqual(host.code,'AB');assert.equal(shown.length,0);
    const second=host.peer;assert.equal(second.id,'jj-fairy-v1-'+host.code);
    second.open=true;second.emit('open');assert.deepEqual(shown,[host.code]);
    assert.equal(statuses.at(-1),'Waiting for JJ / Michelle');
    first.emit('open');first.emit('error',{type:'unavailable-id'});
    assert.equal(host.peer,second);assert.equal(peers.length,2);assert.equal(shown.length,1);
  }finally{host.close();globalThis.window=previous;}
});
