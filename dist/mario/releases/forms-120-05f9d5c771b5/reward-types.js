export const REWARD_TYPES=['ambush','meteor','chomp','bullet'];
export function randomReward(random=Math.random){const roll=random();return roll<.5?'ambush':roll<.7?'meteor':roll<.9?'chomp':'bullet';}
export const POWERS={
  tankrocket:{radius:40,teamRadius:40,damage:24,teamDamage:24},
  tankheart:{radius:28,teamRadius:28,damage:16,teamDamage:16},
  tankcrush:{radius:26,teamRadius:26,damage:32,teamDamage:32},
  tanklaser:{radius:320,teamRadius:320,damage:8,teamDamage:8},
  laser:{name:'Lasers',seconds:20},
  missiles:{name:'Lock-on missiles',seconds:5,radius:10,teamRadius:16,damage:4,teamDamage:8},
  dinosaur:{name:'Dinosaur rampage',seconds:20,radius:20,teamRadius:30,damage:16,teamDamage:32},
  meteor:{name:'Meteor button',level:true,radius:60,teamRadius:90,damage:32,teamDamage:64},
  chomp:{name:'Swinging Chain Chomp',level:true},
  ambush:{name:'Koopa ambush'},
  bullet:{name:'Giant Bullet Bill',level:true},
};
export function rewardAnnouncement(type,giant){
  return ({laser:giant?'Two giant lasers for 20 seconds!':'20 seconds of laser blasts!',
    missiles:giant?'Super lock-on missiles for both of you for 5 seconds!':'5 seconds of lock-on missiles!',
    dinosaur:giant?'Two giant dinosaurs! Walk through walls and crush enemies for 20 seconds!':'A dinosaur rampage! Walk through walls and crush enemies for 20 seconds!',
    meteor:giant?'Meteor buttons for both of you! Launch giant meteors for the rest of the level!':'A Meteor button! Tap it to launch meteors for the rest of the level!',
    chomp:giant?'Chain Chomps for both of you! Tap your button to swing a Chomp on a chain for the rest of the level!':'A swinging Chain Chomp! Tap your button to swing it on a chain for the rest of the level!',
    ambush:'Oops! The magic went wrong! Twenty Koopas are coming from the right. Get ready!',
    bullet:'Rare reward! The whole family becomes a giant Bullet Bill! Dad steers. Tap Exit bullet whenever you want to change back!'})[type];
}
export function powerHint(power,role){
  if(!power)return '';
  if(POWERS[power.type]?.level)return `${POWERS[power.type].name} - rest of level - ${power.type==='bullet'?'Dad steers!':'Tap your power button!'}`;
  const action=power.type==='laser'?(role==='jj'?'Drag on the game to aim!':'Aim with your joystick!'):
    power.type==='dinosaur'?(role==='jj'?'Drag to stomp through walls!':'Use your joystick to stomp through walls!'):
    power.type==='missiles'?'Missiles lock on automatically!':'Meteor incoming!';
  return `${power.giant?'SUPER ':''}${POWERS[power.type].name} - ${Math.ceil(power.remaining)}s - ${action}`;
}
