export function stopQuestionAudio(){
  try{window.FairyAndroid?.stopSpeech?.();window.speechSynthesis?.cancel();}catch{}
}
export function speakQuestion(text,onError=()=>{}){
  stopQuestionAudio();
  try{
    if(window.FairyAndroid?.speak?.(text))return;
    if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){onError();return;}
    const utterance=new SpeechSynthesisUtterance(text);utterance.lang='en-US';utterance.rate=.85;
    utterance.onerror=e=>{if(!['interrupted','canceled'].includes(e.error))onError();};
    window.speechSynthesis.resume();window.speechSynthesis.speak(utterance);
  }catch{onError();}
}
export class QuestionView {
  constructor(answer,next){
    this.panel=document.getElementById('quiz-panel');this.question=null;this.pending=false;this.connected=true;
    this.choices=document.getElementById('quiz-choices');this.next=document.getElementById('quiz-next');
    this.listen=document.getElementById('quiz-listen');
    this.listen.onclick=()=>this.speak();
    this.next.onclick=()=>{if(!this.question||this.pending||!this.connected)return;this.pending=true;this.updateDisabled();next(this.question.token);};
    this.buttons=Array.from({length:3},(_,index)=>{
      const button=document.createElement('button');button.className='quiz-choice';
      button.onclick=()=>{if(!this.question||this.pending||!this.connected||this.question.phase!=='question')return;this.pending=true;this.updateDisabled();answer(this.question.token,index);};
      this.choices.append(button);return button;
    });
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stopQuestionAudio();else if(this.question)this.speak();});
  }
  speak(){
    if(!this.question||document.hidden)return;
    document.getElementById('quiz-audio-help').textContent='';
    speakQuestion(this.question.speech,()=>{document.getElementById('quiz-audio-help').textContent='Tap Hear again to play the question. You can also ask a grown-up to read the prompt below.';});
  }
  updateDisabled(){
    this.buttons.forEach(b=>b.disabled=this.pending||!this.connected||this.question?.phase!=='question');
    this.next.disabled=this.pending||!this.connected;
    document.getElementById('quiz-connection').textContent=this.connected?'':'Reconnecting to Dad. Your turn is saved.';
  }
  setConnected(value){if(this.connected!==value)this.pending=false;this.connected=value;this.updateDisabled();}
  render(question){
    if(!question){if(this.question)stopQuestionAudio();this.question=null;this.panel.hidden=true;return;}
    const changed=!this.question||question.token!==this.question.token||question.phase!==this.question.phase;
    this.question=question;this.panel.hidden=false;
    if(changed){
      this.pending=false;this.panel.dataset.player=question.role;this.panel.dataset.kind=question.kind;
      document.getElementById('quiz-turn').textContent=question.phase==='ready'?'Learning magic · JJ and Michelle':`${question.name}’s turn · ${question.number} of ${question.total}`;
      document.getElementById('quiz-title').textContent=question.phase==='ready'?'Get ready for questions':question.phase==='retry'?'Try again!':question.phase==='feedback'?(question.giant?'Team magic!':'You did it!'):question.kind==='math'?'A little number magic':question.kind==='word'?'Find the sight word':'Find the letter';
      document.getElementById('quiz-prompt').textContent=question.prompt;
      document.getElementById('quiz-feedback').textContent=question.feedback;
      document.getElementById('quiz-parent-prompt').textContent=question.speech;
      document.getElementById('quiz-parent-help').open=false;
      this.buttons.forEach((b,i)=>{b.textContent=question.choices[i];b.classList.toggle('correct',question.phase==='feedback'&&question.choices[i]===question.answer);});
      this.choices.hidden=question.phase==='ready';
      this.next.hidden=question.phase==='question';this.next.textContent=question.next;
      this.speak();
    }
    this.updateDisabled();
  }
}
