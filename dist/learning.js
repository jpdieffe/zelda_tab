// Current deck from edu_games/weekly_agendas/heart-words.js: words introduced
// through October 26, 2026. Keep the curriculum here; no student data is sent.
export const SIGHT_WORDS=Object.freeze(['a','by','I','as','is','he','be','here','she','the','what','and','love','my','pretty','says','little','new','come','make','baby','father','mother']);
export const QUESTION_INTERVAL=120;
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
      return {role,kind:'math',answer,choices:this.choices(answer,NUMBERS),prompt:`${a} ${operator} ${b} = ?`,speech:`Michelle, what is ${a} ${operator==='+'?'plus':'minus'} ${b}?`,...fact};
    }
    const answer=this.take('words',SIGHT_WORDS);
    return {role,kind:'word',answer,choices:this.choices(answer,SIGHT_WORDS),prompt:'Listen, then tap the word.',speech:`Michelle, find the word ${answer}.`};
  }
}
export class LearningRound {
  constructor(random=Math.random){this.deck=new QuestionDeck(random);this.elapsed=0;this.sequence=0;this.round=null;}
  tick(dt,{playing,tablet,reward=false}){
    if(this.round||!playing||!tablet||reward)return false;
    this.elapsed+=Math.max(0,dt);
    if(this.elapsed<QUESTION_INTERVAL)return false;
    this.elapsed=0;
    const roles=['jj','michelle'];
    this.round={id:++this.sequence,index:0,questions:roles.map(role=>this.deck.next(role)),results:[],phase:'question'};
    return true;
  }
  answer(token,index){
    const r=this.round;if(!r||r.phase!=='question'||token!==this.token()||!Number.isInteger(index)||index<0||index>2)return false;
    const q=r.questions[r.index];r.results.push({role:q.role,correct:q.choices[index]===q.answer});r.phase='feedback';return true;
  }
  token(){return this.round?`${this.round.id}:${this.round.index}`:null;}
  reward(){
    const roles=this.round?.results.filter(r=>r.correct).map(r=>r.role)||[];
    return {roles,giant:roles.includes('jj')&&roles.includes('michelle')};
  }
  advance(token){
    const r=this.round;if(!r||r.phase!=='feedback'||token!==this.token())return null;
    if(r.index+1<r.questions.length){r.index++;r.phase='question';return {finished:false};}
    const reward=this.reward();this.round=null;return {finished:true,...reward};
  }
  skip(){this.round=null;this.elapsed=0;}
  snapshot(){
    const r=this.round;if(!r)return null;
    const q=r.questions[r.index],last=r.index===r.questions.length-1,correct=r.results.at(-1)?.correct;
    const name=q.role==='jj'?'JJ':'Michelle',reward=this.reward();
    let feedback='',speech=q.speech;
    if(r.phase==='feedback'){
      feedback=correct?`Great job, ${name}!`:`Good try, ${name}. The answer is ${q.answer}.`;
      if(last)feedback+=' '+(reward.giant?'Team magic! Two giant lasers!':reward.roles.length?`${reward.roles[0]==='jj'?'JJ':'Michelle'} earned five seconds of laser blasts!`:'Keep practicing. More magic next time!');
      speech=feedback;
    }
    return {token:this.token(),phase:r.phase,role:q.role,name,kind:q.kind,prompt:q.prompt,choices:q.choices,speech,feedback,
      number:r.index+1,total:r.questions.length,correct:r.phase==='feedback'?correct:null,
      answer:r.phase==='feedback'?q.answer:null,next:last?(reward.roles.length?'Release the lasers!':'Back to the adventure'):'Michelle’s turn',
      giant:last&&reward.giant};
  }
}
