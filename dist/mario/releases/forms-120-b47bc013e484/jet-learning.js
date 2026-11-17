import {LearningRound} from './learning.js';

export class FamilyLearning extends LearningRound {
  start({jet=false,...options}){
    if(!jet)return super.start(options);
    if(this.round||!options.playing||!options.tablet)return false;
    this.round={id:++this.sequence,rewardType:'jet',index:0,revision:0,missed:false,
      questions:['jj','jj','jj','michelle','michelle','michelle'].map(role=>this.deck.next(role)),results:[],phase:'ready'};
    return true;
  }
  reward(){
    if(this.round?.rewardType!=='jet')return super.reward();
    const earned=this.round.results.length===6;
    return {roles:earned?['jj','michelle']:[],giant:earned,type:'jet'};
  }
  snapshot(){
    if(this.round?.rewardType!=='jet')return super.snapshot();
    const r=this.round,s=super.snapshot(),last=r.index===5;
    if(r.phase==='ready')return {...s,prompt:'Jet challenge: three questions each!',speech:'Jet challenge! JJ answers three questions, then Michelle answers three. Keep trying until everyone finishes. Then Dad flies an invincible jet for the rest of the level!',feedback:'Dad flies. JJ aims blue lasers. Michelle aims pink lasers. Both can fire missiles.',total:6,next:'We are ready!'};
    if(r.phase==='retry'){s.feedback=`Try again, ${s.name}! You can still earn the jet.`;s.speech=`${s.feedback} ${r.questions[r.index].speech}`;}
    if(r.phase==='feedback'){
      s.correct=true;s.feedback=last?'Jet earned! Dad flies for the rest of the level. Aim your lasers and fire missiles!':`Great job, ${s.name}!`;
      s.speech=s.feedback;s.next=last?'Launch the jet!':r.questions[r.index+1].role==='jj'?'JJ next question':r.index===2?'Michelle next':'Michelle next question';
    }
    return s;
  }
}
