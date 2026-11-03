const PREFIX='jj-fairy-v1-';
const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const GUESTS=new Set(['jj','michelle']);
export function roomCode(){return Array.from(crypto.getRandomValues(new Uint8Array(8)),b=>ALPHABET[b%ALPHABET.length]).join('');}
export function normalizeCode(code){return String(code).replace(/[\s-]/g,'').toUpperCase();}
export function validCode(code){return /^[A-HJ-NP-Z2-9]{8}$/.test(code);}
export class Connection {
  constructor({role,code,onStatus,onData,onStream,onConnected,onDisconnected}){
    Object.assign(this,{role,code,onStatus,onData,onStream,onConnected,onDisconnected});
    this.closed=false;this.connection=null;this.call=null;this.stream=null;this.lastSeen=Date.now();this.guests=new Map();
  }
  has(role){return Boolean(this.guests.get(role)?.connection.open);}
  hostStatus(){
    const names=[this.has('jj')?'JJ':null,this.has('michelle')?'Michelle':null].filter(Boolean);
    this.onStatus(names.length?names.join(' + ')+' connected':'Waiting for JJ / Michelle');
  }
  start(){
    if(!window.Peer)throw new Error('The connection library did not load. Reload this page.');
    this.peer=new window.Peer(this.role==='dad'?PREFIX+this.code:undefined,{debug:0,config:{iceServers:[{urls:'stun:stun.l.google.com:19302'}]}});
    this.peer.on('open',()=>{if(this.role==='dad')this.hostStatus();else{this.onStatus('Connecting to Dad...');this.connect();}});
    this.peer.on('connection',c=>{if(this.role==='dad')this.bindHost(c);else c.close();});
    this.peer.on('call',call=>{
      if(this.role!=='jj'||call.peer!==PREFIX+this.code){call.close();return;}
      this.call?.close();this.call=call;call.on('stream',s=>this.onStream?.(s));call.on('error',()=>this.onStatus('Video interrupted. Reconnecting...'));call.answer();
    });
    this.peer.on('disconnected',()=>{if(!this.closed)setTimeout(()=>{if(!this.closed&&!this.peer.destroyed)this.peer.reconnect();},1800);});
    this.peer.on('error',err=>{
      const messages={'peer-unavailable':"Dad's code was not found. Check the code and keep his tab open.",'network':'Pairing service unavailable. Check internet and try again.','unavailable-id':'This code is in use. Tap Reconnect tablet for a new code.','browser-incompatible':'Please use up-to-date Android Chrome.','webrtc':'Could not connect directly. Use the same Wi-Fi without guest isolation or VPN.'};
      this.onStatus(messages[err.type]||`Connection failed: ${err.message}`,true);
    });
    this.timer=setInterval(()=>{
      if(this.role==='dad'){
        for(const guest of this.guests.values())if(guest.connection.open){this.send({type:'ping'},guest.role);if(Date.now()-guest.lastSeen>9000)guest.connection.close();}
      }else if(this.connection?.open){this.send({type:'ping'});if(Date.now()-this.lastSeen>9000)this.connection.close();}
      else if(!this.rejected&&this.peer?.open&&!this.connecting)this.connect();
    },2500);
    this.startTimeout=setTimeout(()=>{if(!this.peer?.open)this.onStatus('Pairing is taking too long. Check internet and try again.',true);},18000);
  }
  connect(){
    if(this.closed||this.rejected||this.connecting||!GUESTS.has(this.role))return;
    this.connecting=true;
    this.bindClient(this.peer.connect(PREFIX+this.code,{reliable:true,serialization:'json',metadata:{version:1,role:this.role}}));
    clearTimeout(this.connectTimeout);
    this.connectTimeout=setTimeout(()=>{if(!this.connection?.open){this.connection?.close();this.connecting=false;this.onStatus("Still trying. Check the code, same Wi-Fi, and Dad's open tab.",true);}},12000);
  }
  bindHost(connection){
    const role=connection.metadata?.role;
    if(connection.metadata?.version!==1||!GUESTS.has(role)){connection.close();return;}
    const old=this.guests.get(role);
    if(old&&old.connection.peer!==connection.peer){
      connection.on('open',()=>{connection.send({type:'role-busy',role});setTimeout(()=>connection.close(),150);});return;
    }
    const guest={role,connection,lastSeen:Date.now()};this.guests.set(role,guest);
    clearTimeout(old?.timeout);old?.connection.close();
    // Keep the existing JJ connection alias for video/audio and parent unlock.
    if(role==='jj')this.connection=connection;
    const current=()=>this.guests.get(role)===guest&&!this.closed;
    guest.timeout=setTimeout(()=>{if(current()&&!connection.open){this.guests.delete(role);connection.close();this.hostStatus();}},15000);
    connection.on('open',()=>{if(!current())return;clearTimeout(guest.timeout);guest.lastSeen=Date.now();this.hostStatus();this.onConnected?.(role);if(role==='jj')this.sendVideo();});
    connection.on('data',data=>{
      if(!current()||!data||typeof data!=='object')return;guest.lastSeen=Date.now();
      if(data.type==='ping'){this.send({type:'pong'},role);return;}if(data.type==='pong')return;
      this.onData?.(data,role);
    });
    connection.on('close',()=>{
      if(!current())return;clearTimeout(guest.timeout);this.guests.delete(role);
      if(role==='jj'){this.connection=null;this.call?.close();this.call=null;}
      this.hostStatus();this.onDisconnected?.(role);
    });
    connection.on('error',()=>{if(current())connection.close();});
  }
  bindClient(connection){
    const old=this.connection;this.connection=connection;old?.close();
    const current=()=>connection===this.connection&&!this.closed;
    connection.on('open',()=>{if(!current())return;this.connecting=false;clearTimeout(this.connectTimeout);this.lastSeen=Date.now();this.onStatus('Connected to Dad');this.onConnected?.();});
    connection.on('data',data=>{
      if(!current()||!data||typeof data!=='object')return;this.lastSeen=Date.now();
      if(data.type==='ping'){this.send({type:'pong'});return;}if(data.type==='pong')return;
      if(data.type==='role-busy'){this.rejected=true;this.onStatus('That player is already connected. Leave on the other device, then join again.',true);return;}
      this.onData?.(data);
    });
    connection.on('close',()=>{
      if(!current())return;this.connecting=false;this.call?.close();this.call=null;
      if(!this.rejected)this.onStatus('Connection lost. Reconnecting...');this.onDisconnected?.();
    });
    connection.on('error',()=>{if(current()){this.connecting=false;this.onStatus('Connection interrupted. Retrying...',true);}});
  }
  setStream(stream){this.stream=stream;this.sendVideo();}
  sendVideo(){
    if(this.role!=='dad'||!this.stream||!this.has('jj'))return;
    this.call?.close();this.call=this.peer.call(this.guests.get('jj').connection.peer,this.stream);
    this.call?.on('error',()=>this.onStatus('Video interrupted. Tap Reconnect tablet.',true));
  }
  send(data,role){
    const connections=this.role==='dad'?(role?[this.guests.get(role)?.connection]:[...this.guests.values()].map(g=>g.connection)):[this.connection];
    for(const c of connections)if(c?.open){try{c.send(data);}catch{}}
  }
  close(){
    this.closed=true;clearInterval(this.timer);clearTimeout(this.startTimeout);clearTimeout(this.connectTimeout);
    for(const g of this.guests.values()){clearTimeout(g.timeout);g.connection.close();}this.guests.clear();
    this.call?.close();this.connection?.close();this.peer?.destroy();
  }
}
