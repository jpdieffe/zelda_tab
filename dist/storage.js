let database;
async function db(){
  if(!database)database=new Promise((resolve,reject)=>{
    const req=indexedDB.open('fairy-link',1);
    req.onupgradeneeded=()=>req.result.createObjectStore('game');
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  return database;
}
export async function get(key){const d=await db();return new Promise((resolve,reject)=>{const r=d.transaction('game').objectStore('game').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function put(key,value){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('game','readwrite');tx.objectStore('game').put(value,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Storage unavailable'));});}

// Rotate the old save and write the new one in ONE transaction. A full disk
// must leave the previous save intact. Keep both recent and daily checkpoints.
export async function saveAdventure(value,{force=false}={}){
  const d=await db();return new Promise((resolve,reject)=>{
    const tx=d.transaction('game','readwrite'),store=tx.objectStore('game'),old=store.get('save'),history=store.get('save-history');
    history.onsuccess=()=>{
      const previous=old.result,entries=Array.isArray(history.result)?history.result:[];
      if(previous){
        const newest=entries[0];
        if(force||!newest||previous.date-newest.date>=300000){
          const unique=[previous,...entries].filter((s,i,a)=>a.findIndex(t=>t.date===s.date)===i);
          const recent=unique.slice(0,12),days=new Set(recent.map(s=>new Date(s.date).toDateString()));
          for(const s of unique.slice(12)){const day=new Date(s.date).toDateString();if(!days.has(day)&&recent.length<20){recent.push(s);days.add(day);}}
          store.put(recent,'save-history');
        }
      }
      store.put(value,'save');
    };
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Storage unavailable'));
  });
}
export async function adventureBackups(){
  const [current,history,beforeRecovery,beforeRestore]=await Promise.all(['save','save-history','before-dungeon-recovery','before-restore'].map(get));
  return [current,...(Array.isArray(history)?history:[]),beforeRecovery,beforeRestore].filter(Boolean).filter((s,i,a)=>a.findIndex(t=>t.date===s.date)===i);
}
