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
