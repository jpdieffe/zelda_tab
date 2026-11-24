export const REWARD_TYPES=['laser','missiles','dinosaur','meteor','lightning','fireballs','shockwave'];
export const POWERS={
  tankrocket:{radius:40,teamRadius:40,damage:24,teamDamage:24},
  tankheart:{radius:28,teamRadius:28,damage:16,teamDamage:16},
  tankcrush:{radius:26,teamRadius:26,damage:32,teamDamage:32},
  tanklaser:{radius:320,teamRadius:320,damage:8,teamDamage:8},
  lightning:{name:'Lightning storm',seconds:15,radius:18,teamRadius:26,damage:8,teamDamage:16},
  fireballs:{name:'Fireball orbit',seconds:20,radius:12,teamRadius:18,damage:8,teamDamage:16},
  shockwave:{name:'Rainbow shockwaves',seconds:15,radius:64,teamRadius:96,damage:8,teamDamage:16},
  laser:{name:'Lasers',seconds:20},
  missiles:{name:'Lock-on missiles',seconds:5,radius:10,teamRadius:16,damage:4,teamDamage:8},
  dinosaur:{name:'Dinosaur rampage',seconds:20,radius:20,teamRadius:30,damage:16,teamDamage:32},
  meteor:{name:'Meteor smash',seconds:2,radius:60,teamRadius:90,damage:32,teamDamage:64},
};
export function rewardAnnouncement(type,giant){
  return ({lightning:giant?'Two super lightning storms! Zap nearby enemies for 15 seconds!':'Lightning storm! Zap nearby enemies for 15 seconds!',
    fireballs:giant?'Five fireballs orbit each of you for 20 seconds!':'Three fireballs orbit you for 20 seconds!',
    shockwave:giant?'Giant rainbow shockwaves pulse around both of you for 15 seconds!':'Rainbow shockwaves pulse around you for 15 seconds!',
    laser:giant?'Two giant lasers for 20 seconds!':'20 seconds of laser blasts!',
    missiles:giant?'Super lock-on missiles for both of you for 5 seconds!':'5 seconds of lock-on missiles!',
    dinosaur:giant?'Two giant dinosaurs! Walk through walls and crush enemies for 20 seconds!':'A dinosaur rampage! Walk through walls and crush enemies for 20 seconds!',
    meteor:giant?'Two giant meteors! Smash enemies near both of you!':'A giant meteor! Smash enemies near you!'})[type];
}
export function powerHint(power,role){
  if(!power)return '';
  const action=power.type==='laser'?(role==='jj'?'Drag on the game to aim!':'Hold arrows to aim!'):
    power.type==='dinosaur'?(role==='jj'?'Drag to stomp through walls!':'Hold arrows to stomp through walls!'):
    power.type==='missiles'?'Missiles lock on automatically!':power.type==='lightning'?'Lightning zaps nearby baddies!':power.type==='fireballs'?'Move your orbiting fireballs into baddies!':power.type==='shockwave'?'Move close to blast baddies!':'Meteor incoming!';
  return `${power.giant?'SUPER ':''}${POWERS[power.type].name} - ${Math.ceil(power.remaining)}s - ${action}`;
}
