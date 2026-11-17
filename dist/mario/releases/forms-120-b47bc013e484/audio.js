export class GameAudio {
  constructor({audible=true}={}){
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!Context)return;
    this.context=new Context({sampleRate:44100});
    this.destination=this.context.createMediaStreamDestination();
    this.gain=this.context.createGain();this.gain.gain.value=audible?1:0;this.gain.connect(this.context.destination);
    this.samples=new Float32Array(2048);this.offset=0;
    this.ready=this.context.audioWorklet?this.context.audioWorklet.addModule(new URL('./audio-worklet.js',import.meta.url)).then(()=>{
      this.node=new AudioWorkletNode(this.context,'mario-audio',{outputChannelCount:[2]});
      this.node.connect(this.gain);this.node.connect(this.destination);
    }).catch(()=>this.fallback()):Promise.resolve(this.fallback());
    this.resume();
  }
  fallback(){
    // LAN HTTP pages lack AudioWorklet; keep local phone play audible too.
    this.ring=new Float32Array(65536);this.read=0;this.write=0;
    this.node=this.context.createScriptProcessor(2048,0,2);
    this.node.onaudioprocess=event=>{const left=event.outputBuffer.getChannelData(0),right=event.outputBuffer.getChannelData(1);for(let i=0;i<left.length;i++){const value=this.read<this.write?this.ring[this.read++&65535]:0;left[i]=right[i]=value;}};
    this.node.connect(this.gain);this.node.connect(this.destination);
  }
  push(left,right){if(!this.node||this.context.state!=='running')return;if(this.ring){this.ring[this.write++&65535]=(left+right)/2;if(this.write-this.read>16384)this.read=this.write-4096;return;}this.samples[this.offset++]=(left+right)/2;if(this.offset===this.samples.length){this.node.port.postMessage(this.samples,[this.samples.buffer]);this.samples=new Float32Array(2048);this.offset=0;}}
  resume(){this.context?.resume().catch(()=>{});}
  close(){this.node?.disconnect();this.context?.close().catch(()=>{});}
}
