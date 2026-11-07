// Current deck from edu_games/weekly_agendas/heart-words.js: words introduced
// through October 26, 2026. Keep the curriculum here; no student data is sent.
export const SIGHT_WORDS=Object.freeze(['a','by','I','as','is','he','be','here','she','the','what','and','love','my','pretty','says','little','new','come','make','baby','father','mother']);
export const QUESTION_INTERVAL=60;
export const COMBAT_QUESTION_INTERVAL=30;
const LETTERS=Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
const NUMBERS=Array.from({length:11},(_,i)=>String(i));
export function shuffled(items,random=Math.random){
  const copy=[...items];for(let i=copy.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;
}
export function mathFacts(){
  const facts=[];
  for(let a=0;a<=10;a++)for(let b=0;b<=10;b++){
    if(a+b<=10)facts.push({a,b,operator:'+',answer:String(a+b)});
    if(a>=b)facts.push({a,b,operator:'−',answer:String(a-b)});
  }
  return facts;
}
export class QuestionDeck {
  constructor(random=Math.random){this.random=random;this.bags={};this.michelleTurns=0;}
  take(kind,items){if(!this.bags[kind]?.length)this.bags[kind]=shuffled(items,this.random);return this.bags[kind].pop();}
  choices(answer,pool){return shuffled([answer,...shuffled(pool.filter(v=>v!==answer),this.random).slice(0,2)],this.random);}
  next(role){
    if(role==='jj'){
      const answer=this.take('letters',LETTERS);
      return {role,kind:'letter',answer,choices:this.choices(answer,LETTERS),prompt:'Listen, then tap the letter.',speech:`JJ, find the letter ${answer}.`};
    }
    if(this.michelleTurns++%2===0){
      const fact=this.take('math',mathFacts()),{a,b,operator,answer}=fact;
      return {role,kind:'math',answer,choices:[...NUMBERS],prompt:`${a} ${operator} ${b} = ?`,speech:`Michelle, what is ${a} ${operator==='+'?'plus':'minus'} ${b}?`,...fact};
    }
    const answer=this.take('words',SIGHT_WORDS);
    return {role,kind:'word',answer,choices:this.choices(answer,SIGHT_WORDS),prompt:'Listen, then tap the word.',speech:`Michelle, find the word ${answer}.`};
  }
}
export class LearningRound {
  constructor(random=Math.random){this.deck=new QuestionDeck(random);this.elapsed=0;this.sequence=0;this.round=null;}
  tick(dt,{playing,tablet,enemies=false}){
    if(this.round||!playing||!tablet)return false;
    this.elapsed+=Math.max(0,dt);
    if(this.elapsed<(enemies?COMBAT_QUESTION_INTERVAL:QUESTION_INTERVAL))return false;
    this.elapsed=0;
    const roles=['jj','michelle'];
    this.round={id:++this.sequence,index:0,revision:0,missed:false,questions:roles.map(role=>this.deck.next(role)),results:[],phase:'ready'};
    return true;
  }
  answer(token,index){
    const r=this.round;if(!r||r.phase!=='question'||token!==this.token()||!Number.isInteger(index)||index<0||index>=r.questions[r.index].choices.length)return false;
    const q=r.questions[r.index];
    if(q.choices[index]!==q.answer){r.missed=true;r.phase='retry';}
    else{r.results.push({role:q.role,correct:!r.missed});r.phase='feedback';}
    r.revision++;return true;
  }
  token(){return this.round?`${this.round.id}:${this.round.index}:${this.round.revision}`:null;}
  reward(){
    const roles=this.round?.results.filter(r=>r.correct).map(r=>r.role)||[];
    return {roles,giant:roles.includes('jj')&&roles.includes('michelle')};
  }
  advance(token){
    const r=this.round;if(!r||!['ready','retry','feedback'].includes(r.phase)||token!==this.token())return null;
    r.revision++;
    if(r.phase==='ready'||r.phase==='retry'){r.phase='question';return {finished:false};}
    if(r.index+1<r.questions.length){r.index++;r.missed=false;r.phase='question';return {finished:false};}
    const reward=this.reward();this.round=null;return {finished:true,...reward};
  }
  skip(){this.round=null;this.elapsed=0;}
  snapshot(){
    const r=this.round;if(!r)return null;
    if(r.phase==='ready')return {token:this.token(),phase:'ready',role:'both',name:'JJ and Michelle',kind:'ready',prompt:'JJ and Michelle, take turns answering on the big tablet.',choices:[],speech:'Get ready for questions! JJ and Michelle, take turns answering on the big tablet. Tap We are ready to start.',feedback:'Get it right the first time to earn 20 seconds of lasers. You can always try again!',number:0,total:2,correct:null,answer:null,next:'We’re ready!',giant:false};
    const q=r.questions[r.index],last=r.index===r.questions.length-1,correct=r.results.at(-1)?.correct;
    const name=q.role==='jj'?'JJ':'Michelle',reward=this.reward();
    let feedback='',speech=q.speech;
    if(r.phase==='feedback'){
      feedback=correct?`Great job, ${name}!`:`You got it, ${name}! No laser bonus this time, but well done for trying again.`;
      if(last)feedback+=' '+(reward.giant?'Team magic! Two giant lasers for 20 seconds!':reward.roles.length?`${reward.roles[0]==='jj'?'JJ':'Michelle'} earned 20 seconds of laser blasts!`:'Keep practicing. More magic next time!');
      speech=feedback;
    }
    if(r.phase==='retry'){feedback=`Try again, ${name}! You can still find the answer. The laser bonus is for your first try.`;speech=`Try again, ${name}. ${q.speech}`;}
    return {token:this.token(),phase:r.phase,role:q.role,name,kind:q.kind,prompt:q.prompt,choices:q.choices,speech,feedback,
      number:r.index+1,total:r.questions.length,correct:r.phase==='feedback'?correct:r.phase==='retry'?false:null,
      answer:r.phase==='feedback'?q.answer:null,next:r.phase==='retry'?'Try again':last?(reward.roles.length?'Release the lasers!':'Back to the adventure'):'Michelle’s turn',
      giant:r.phase==='feedback'&&last&&reward.giant};
  }
}
