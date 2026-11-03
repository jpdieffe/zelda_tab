const PREFIX='jj-fairy-v1-';
const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function roomCode(){return Array.from(crypto.getRandomValues(new Uint8Array(8)),b=>ALPHABET[b%ALPHABET.length]).join('');}
export function normalizeCode(code){return String(code).replace(/[\s-]/g,'').toUpperCase();}
export function validCode(code){return /^[A-HJ-NP-Z2-9]{8}$/.test(code);}
export class Connection {
  constructor({role,code,onStatus,onData,onStream,onConnected,onDisconnected}) {
    Object.assign(this,{role,code,onStatus,onData,onStream,onConnected,onDisconnected});
    this.closed=false;this.connection=null;this.call=null;this.stream=null;this.lastSeen=Date.now();
  }
  start(){
    if(!window.Peer)throw new Error('The connection library did not load. Reload this page.');
    // No TURN relay: same-Wi-Fi media/data use a direct WebRTC connection.
    this.peer=new window.Peer(this.role==='dad'?PREFIX+this.code:undefined,{debug:0,config:{iceServers:[{urls:'stun:stun.l.google.com:19302'}]}});
    this.peer.on('open',()=>{this.onStatus(this.role==='dad'?'Waiting for JJ':'Connecting to Dad…');if(this.role==='jj')this.connect();});
    this.peer.on('connection',c=>{
      if(this.role!=='dad'||(this.connection?.open&&this.connection.peer!==c.peer)){c.close();return;}
      this.bind(c);
    });
    this.peer.on('call',call=>{
      if(this.role!=='jj'||call.peer!==PREFIX+this.code){call.close();return;}
      this.call?.close();this.call=call;call.on('stream',stream=>this.onStream?.(stream));call.on('error',()=>this.onStatus('Video interrupted. Reconnecting…'));call.answer();
    });
    this.peer.on('disconnected',()=>{
      if(!this.closed)setTimeout(()=>{if(!this.closed&&!this.peer.destroyed)this.peer.reconnect();},1800);
    });
    this.peer.on('error',err=>{
      const messages={'peer-unavailable':'Dad’s code was not found. Check the code and keep his tab open.','network':'Pairing service unavailable. Check internet and try again.','unavailable-id':'This code is in use. Tap Reconnect tablet for a new code.','browser-incompatible':'Please open this page in up-to-date Android Chrome.','webrtc':'Could not connect directly. Check that both devices use the same Wi-Fi, without guest isolation or VPN.'};
      this.onStatus(messages[err.type]||`Connection failed: ${err.message}`,true);
    });
    this.timer=setInterval(()=>{
      if(this.connection?.open){
        this.send({type:'ping'});
        if(Date.now()-this.lastSeen>9000)this.connection.close();
      }else if(this.role==='jj'&&this.peer?.open&&!this.connecting)this.connect();
    },2500);
    this.startTimeout=setTimeout(()=>{if(!this.peer?.open)this.onStatus('Pairing is taking too long. Check internet, then try again.',true);},18000);
  }
  connect(){
    if(this.closed||this.connecting)return;
    this.connecting=true;
    this.bind(this.peer.connect(PREFIX+this.code,{reliable:true,serialization:'json',metadata:{version:1,role:'jj'}}));
    clearTimeout(this.connectTimeout);
    this.connectTimeout=setTimeout(()=>{if(!this.connection?.open){this.connection?.close();this.connecting=false;this.onStatus('Still trying. Check the code, same Wi-Fi, and Dad’s open tab.',true);}},12000);
  }
  bind(connection){
    if(this.role==='dad'&&(connection.metadata?.version!==1||connection.metadata?.role!=='jj')){connection.close();return;}
    const old=this.connection;this.connection=connection;
    if(old&&old!==connection)old.close();
    connection.on('open',()=>{
      if(this.closed||connection!==this.connection)return;
      this.connecting=false;clearTimeout(this.connectTimeout);this.lastSeen=Date.now();
      this.onStatus(this.role==='dad'?'JJ is connected':'Connected to Dad');
      this.onConnected?.();if(this.role==='dad')this.sendVideo();
    });
    connection.on('data',data=>{
      if(connection!==this.connection||!data||typeof data!=='object')return;
      this.lastSeen=Date.now();
      if(data.type==='ping'){this.send({type:'pong'});return;}
      if(data.type==='pong')return;
      this.onData?.(data);
    });
    connection.on('close',()=>{
      if(connection!==this.connection)return;
      this.connecting=false;this.call?.close();this.call=null;
      if(!this.closed){this.onStatus(this.role==='dad'?'JJ disconnected — waiting':'Connection lost. Reconnecting…');this.onDisconnected?.();}
    });
    connection.on('error',()=>{if(connection===this.connection){this.connecting=false;this.onStatus('Connection interrupted. Retrying…',true);}});
  }
  setStream(stream){this.stream=stream;this.sendVideo();}
  sendVideo(){
    if(this.role!=='dad'||!this.stream||!this.connection?.open)return;
    this.call?.close();this.call=this.peer.call(this.connection.peer,this.stream);
    this.call?.on('error',()=>this.onStatus('Video interrupted. Tap Reconnect tablet.',true));
  }
  send(data){if(this.connection?.open){try{this.connection.send(data);}catch{}}}
  close(){this.closed=true;clearInterval(this.timer);clearTimeout(this.startTimeout);clearTimeout(this.connectTimeout);this.call?.close();this.connection?.close();this.peer?.destroy();}
}
