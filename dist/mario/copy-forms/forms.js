// Enemy IDs verified against Southbird's SMB3 US PRG1 disassembly.
// Movement and powers below are new designs for this runtime mod.
const forms = [];
const native = ['Small','Super','Fire','Raccoon','Frog','Tanooki','Hammer'];
const nativeTips = ['Classic small Mario.','Classic Super Mario.','X throws fireballs.','Run with X, then jump to fly; tap jump to flutter.','High hops and fast swimming.','Raccoon flight; Down + X turns to stone.','X throws hammers.'];
native.forEach((name,suit)=>forms.push({key:`mario-${suit}`,name:`${name} Mario`,category:'Mario',suit,art:'mario',color:['#ed513e','#ed513e','#fff0ce','#c88b4e','#78bf4e','#b6743f','#535c75'][suit],description:nativeTips[suit],ability:'Original power',motion:'Original NES physics'}));
forms.push({key:'shoe',name:'Shoe Mario',category:'Mario',suit:1,shoe:true,art:'mario',color:'#62bb64',description:'Ride Kuribo’s shoe. Hop across enemies and spikes.',ability:'Stomp',motion:'Springy shoe hops'});
forms.push({key:'star',name:'Star Mario',category:'Mario',suit:1,star:true,art:'mario',color:'#ffdb68',description:'A renewable Starman form. Contact defeats ordinary enemies.',ability:'Star contact',motion:'Original NES physics'});

const archetypes={
  goomba:{art:'goomba',color:'#be804a',category:'Ground',speed:26,jump:58,action:'stomp',power:27,motion:'Low, quick hops'},
  koopa:{art:'koopa',color:'#65b759',category:'Ground',speed:28,jump:64,action:'shell',shell:true,power:60,motion:'Balanced jump'},
  beetle:{art:'beetle',color:'#626f9d',category:'Ground',speed:24,jump:52,action:'shell',shell:true,power:64,motion:'Low armored hops'},
  spiny:{art:'spiny',color:'#d45342',category:'Ground',speed:22,jump:52,action:'spikes',power:32,motion:'Low hop with a spiked counterattack'},
  bro:{art:'bro',color:'#70b956',category:'Ground',speed:28,jump:76,action:'hammer',power:5,motion:'High tactical jumps'},
  plant:{art:'plant',color:'#d94d51',category:'Ground',speed:20,jump:48,action:'seed',power:4,motion:'Short rooted hops'},
  fish:{art:'fish',color:'#ee8854',category:'Water',speed:26,jump:70,swim:46,action:'water',power:5,motion:'Fast swimming; hold jump to rise underwater'},
  blooper:{art:'blooper',color:'#e7e4d4',category:'Water',speed:24,jump:68,swim:40,airJumps:1,action:'ink',power:42,motion:'Jet jump, plus one midair jump'},
  ghost:{art:'ghost',color:'#c7b7f3',category:'Castle',speed:26,jump:58,fly:28,action:'phase',power:90,motion:'Hold jump or Up to float; Down descends'},
  fire:{art:'flame',color:'#ff9a3c',category:'Castle',speed:30,jump:82,action:'fire',power:5,motion:'Tall, fiery leaps'},
  chomp:{art:'chomp',color:'#536583',category:'Ground',speed:32,jump:76,action:'bite',power:44,motion:'Long lunging jumps'},
  bullet:{art:'bullet',color:'#596876',category:'Air',speed:40,jump:58,fly:24,action:'dash',power:88,motion:'Powered flight; Up/jump rises, Down descends'},
  thwomp:{art:'thwomp',color:'#8ba2b0',category:'Castle',speed:16,jump:48,action:'slam',power:52,motion:'Heavy hop; special slams downward'},
  disc:{art:'disc',color:'#e49af4',category:'Castle',speed:28,jump:58,fly:28,action:'orbit',power:36,motion:'Hover with jump/Up; Down descends'},
  boss:{art:'boss',color:'#bdb65c',category:'Boss',speed:25,jump:74,action:'magic',power:5,motion:'High boss leap'},
};
function add(id,name,type,description,extra={}){
  const base=archetypes[type];
  forms.push({...base,key:`enemy-${id.toString(16)}`,enemyId:id,name:`${name} Mario`,family:type,description,...extra});
}
add(0x17,'Spiny Cheep','fish','Swim quickly and launch a piercing spine.',{art:'spinyfish',action:'needle',power:6});
add(0x18,'Bowser','boss','Breathe a wide cone of fire. Down + special makes a crushing stomp.',{color:'#d9a744',action:'dragon',power:7,jump:64,art:'bowser'});
add(0x29,'Spike','bro','X coughs up a spike ball and spits it straight ahead, just like the enemy. Hold X to keep spitting.',{art:'spike',action:'spitball',ability:'Spit spike ball',power:2,jump:62,cooldown:74});
add(0x2a,'Ptooie','plant','Up raises your spike ball; Down lowers it. It defeats enemies on contact. X launches it and grows another.',{action:'spikecontrol',ability:'Controlled spike ball',power:6,airJumps:1});
add(0x2b,'Shoe Goomba','goomba','Spring high in a green shoe and stomp nearby foes.',{art:'shoe',jump:92,power:40});
add(0x2d,'Boss Bass','fish','Lunge with a huge bite. Strong water speed and long leaps.',{action:'bite',power:56,swim:60,jump:88,scale:1.2});
add(0x2f,'Boo','ghost','Float freely. Special turns you intangible to enemy contact for a moment.');
add(0x30,'Shy Hot Foot','fire','Special hides your flame from enemies briefly.',{action:'phase',power:65,speed:34,jump:66});
add(0x31,'Stretch','ghost','Stretch a spectral strike upward.',{action:'upburst',power:60,fly:18});
add(0x32,'Ceiling Stretch','ghost','Stretch a spectral strike downward.',{action:'downburst',power:60,fly:22,color:'#ddd0ff'});
add(0x33,'Nipper','plant','Snap at enemies in front of you.',{color:'#f2ecda',action:'bite',power:30,jump:56});
add(0x39,'Hopping Nipper','plant','A springy double jump and a quick snapping bite.',{color:'#fff0c5',action:'bite',power:34,jump:82,airJumps:1});
add(0x3b,'Charging Cheep','fish','Dash forward through ordinary enemies.',{action:'dash',power:76,swim:52,jump:78});
add(0x3d,'Fire Nipper','plant','Spit a three-way fan of bouncing fire.',{color:'#f7ccab',action:'spreadfire',power:4,jump:50});
add(0x3f,'Dry Bones','koopa','Hold Down to collapse into the original bone pile; release to stand. X throws spinning bones, even while collapsed.',{art:'bones',color:'#d6d9ca',action:'bone',power:5,jump:60,collapse:true,shell:false});
add(0x40,'Buster Beetle','beetle','Throw ice blocks that smash ordinary bricks.',{color:'#4b99b2',action:'ice',power:6,jump:66});
add(0x42,'Pool Hopper','fish','Very high water-to-land leaps and a rising water shot.',{action:'upwater',jump:98,swim:44});
add(0x43,'Long Pool Hopper','fish','Fast long jumps and a flat water stream.',{speed:38,jump:80,power:7,color:'#f7b75b'});
add(0x45,'Hot Foot','fire','Sprint and leave a trail of little flames.',{action:'trail',speed:40,jump:70,power:4});
add(0x46,'Spike-ball Piranha','plant','Lob three spike balls at different heights.',{action:'tripleball',power:4,jump:46});
add(0x48,'Baby Cheep','fish','Tiny fast swim bursts and two extra jumps.',{speed:34,swim:54,jump:48,airJumps:2,power:3,scale:.8});
add(0x4b,'Boom Boom','boss','Punch a wide area with a shockwave.',{action:'stomp',power:58,speed:32,jump:88,color:'#dd9951'});
add(0x4c,'Winged Boom Boom','boss','Fly and dive into a ground-shaking slam.',{action:'slam',power:54,fly:38,winged:true,color:'#e4b46c'});
add(0x4f,'Unchained Chomp','chomp','Your mouth eats most enemies on contact. X lunges forward; you also get an extra jump. Dodge fireballs and projectiles.',{power:64,speed:40,airJumps:1});
add(0x50,'Lit Bob-omb','goomba','A short-fuse blast clears enemies and ordinary bricks.',{art:'bomb',action:'blast',power:44,jump:68,color:'#dc8052',cooldown:70});
add(0x51,'Twin Roto-disc','disc','Two protective discs orbit in the same direction.',{orbits:2,power:32});
add(0x53,'Ceiling Podoboo','fire','Fly downward in a burning dive. Lava and enemy flames cannot hurt you; lava bounces you back up.',{fireproof:true,action:'dive',fly:20,power:84,color:'#ffbe64'});
add(0x55,'Bob-omb','goomba','Detonate a large blast without hurting yourself.',{art:'bomb',action:'blast',power:56,color:'#384d73',jump:58,cooldown:110});
add(0x56,'Left Piranha','plant','Spit a fast seed to your left.',{action:'leftseed',power:7,jump:50});
add(0x57,'Right Piranha','plant','Spit a fast seed to your right.',{action:'rightseed',power:7,jump:54,color:'#f17a72'});
add(0x58,'Fire Chomp','chomp','Your mouth eats most enemies on contact. Float and use X to fire three fireballs. Enemy fireballs and projectiles still hurt.',{action:'triplefire',fly:28,power:4,color:'#f5a34b'});
add(0x59,'Fire Snake','fire','Four little flames follow your path with a delay, including jumps and turns. X scatters extra flames behind you.',{action:'trail',jump:104,power:5,airJumps:1});
add(0x5a,'Roto-disc','disc','A fire disc circles you and hits nearby foes.',{orbits:1,power:40});
add(0x5b,'Reverse Roto-disc','disc','A faster disc circles counterclockwise.',{orbits:1,power:32,reverse:true,color:'#86d9f4'});
add(0x5d,'Tornado','ghost','Spin and fly freely, immune to enemies, projectiles, lava, crushing and time-outs. Falling into a pit still kills you. X unleashes a rising gust.',{art:'tornado',color:'#d5e4d1',action:'gust',power:55,fly:44,speed:38,invulnerable:true,fireproof:true});
add(0x5e,'Crossing Roto-discs','disc','Two wide discs orbit in opposite directions.',{orbits:2,power:45,reverse:true,color:'#f6b6e4'});
add(0x5f,'Vertical Roto-discs','disc','Three close discs guard you while you climb.',{orbits:3,power:26,fly:38,color:'#c1a4ff'});
add(0x60,'Reverse Twin Discs','disc','Two fast reverse discs sweep nearby enemies.',{orbits:2,power:35,reverse:true,orbitSpeed:.16,color:'#91c7f0'});
add(0x61,'Blooper Nanny','blooper','Send two little squid helpers forward.',{action:'helpers',power:4,airJumps:2});
add(0x62,'Blooper','blooper','An ink cloud knocks out nearby ordinary enemies.');
add(0x63,'Big Bertha','fish','Spit a speedy baby fish. Powerful underwater movement.',{action:'helper',power:7,swim:58,color:'#e88a99'});
add(0x64,'Water Hopper','fish','A powerful vertical jet and a water shot.',{action:'upwater',jump:94,swim:48});
add(0x67,'Lava Lotus','plant','Release four drifting fire seeds.',{category:'Water',action:'lotus',power:3,swim:32,jump:62,color:'#da9bea'});
add(0x68,'Twirling Buzzy','beetle','Hold jump to glide; special spins through nearby enemies.',{action:'spin',power:34,glide:true,jump:70});
add(0x69,'Twirling Spiny','spiny','Glide on the way down, then spin your spikes.',{action:'spin',power:40,glide:true,jump:66});
add(0x6a,'Scatter Blooper','blooper','Shoot three squid helpers in a fan.',{action:'helpers3',power:5,swim:48});
add(0x6b,'Piledriver Goomba','goomba','Jump high, then smash down in a brick costume.',{art:'brick',action:'slam',power:40,jump:90,speed:22});
add(0x6c,'Green Koopa','koopa','Down tucks into your shell. Left or Right launches a slide that breaks bricks, hits question blocks and bounces off walls. Jump stands up with a short skid, without hopping. X also launches your shell.');
add(0x6d,'Red Koopa','koopa','A faster shell slide with a higher jump.',{color:'#d95a51',jump:72,power:68});
add(0x6e,'Hopping Paratroopa','koopa','Triple jump, or tuck into a sliding shell.',{category:'Air',winged:true,airJumps:2,jump:80,power:58});
add(0x6f,'Red Paratroopa','koopa','Fly vertically with jump/Up. Down descends while airborne; press Down on the ground to tuck into your shell.',{category:'Air',winged:true,fly:36,color:'#d85c56',power:62});
add(0x70,'Buzzy Beetle','beetle','Duck and slide in a hard shell. Special starts an armored dash.');
add(0x71,'Spiny','spiny','Special bursts spikes around you. A low, sturdy jump.');
add(0x72,'Goomba','goomba','Other Goombas cannot hurt you. Special makes a small stomp shockwave.');
add(0x73,'Paragoomba','goomba','Triple bounce: tap jump for a ground jump and two more bounces in midair. Landing resets all three. X makes a shockwave; Goombas are friendly.',{category:'Air',winged:true,airJumps:2,jump:72,power:32});
add(0x74,'Micro-dropping Paragoomba','goomba','Tap jump to flap upward; hold jump or Up to fly. X drops two Micro-Goombas that land, walk and attack enemies.',{category:'Air',winged:true,fly:36,jump:72,flap:true,action:'drophelpers',power:3,color:'#d3a363'});
add(0x76,'Jumping Cheep','fish','Leap high and shoot diagonally rising bubbles.',{action:'upwater',jump:100,power:6});
add(0x77,'Green Cheep','fish','Precise, fast swimming with a long-range water shot.',{color:'#68c788',swim:62,power:7,jump:64});
add(0x78,'Bullet Bill','bullet','Your front destroys enemies, bosses and incoming projectiles on contact. X dashes forward. Protect your back.',{frontStrike:true});
add(0x79,'Homing Bill','bullet','Your front destroys enemies, bosses and incoming projectiles on contact. X fires a homing bullet. Protect your back.',{frontStrike:true,action:'homing',power:5,fly:30,color:'#bf6370'});
add(0x7a,'Giant Green Koopa','koopa','A heavy shell crushes foes and ordinary bricks.',{scale:1.2,power:76,jump:56,speed:23,breaks:true});
add(0x7b,'Giant Red Koopa','koopa','A stronger shell dash with a higher giant hop.',{scale:1.2,power:82,jump:64,color:'#e56d5b',breaks:true});
add(0x7c,'Giant Goomba','goomba','Heavy jumps and a huge ground shockwave. Goombas are friendly.',{scale:1.25,power:56,jump:70,speed:22});
add(0x7d,'Giant Green Piranha','plant','Spit a large seed that breaks ordinary bricks.',{scale:1.2,color:'#6ab765',action:'heavyseed',power:6,jump:54});
add(0x7e,'Giant Paratroopa','koopa','A high double jump and a crushing giant shell.',{scale:1.2,winged:true,airJumps:1,power:78,jump:90,breaks:true});
add(0x7f,'Giant Red Piranha','plant','Three large fire seeds spread forward.',{scale:1.2,action:'heavyspread',power:5,jump:58});
add(0x80,'Green Paratroopa','koopa','Fast horizontal flight plus shell sliding.',{category:'Air',winged:true,fly:28,speed:40,power:70});
add(0x81,'Hammer Bro','bro','X throws the enemy\'s full-size spinning hammers in their original arc, passing through scenery. Hold X to keep throwing.');
add(0x82,'Boomerang Bro','bro','Throw a boomerang that returns and hits along both paths.',{action:'boomerang',power:5,color:'#76a3dd',jump:70});
add(0x83,'Lakitu','ghost','Ride a cloud and drop spiny eggs.',{art:'lakitu',category:'Air',action:'egg',power:4,fly:38,color:'#d6e6c7',speed:34});
add(0x84,'Spiny Egg','spiny','Roll forward in a spiky dash and bounce twice.',{art:'egg',action:'dash',power:66,airJumps:1,jump:60});
add(0x85,'Rolling Spiny Egg','spiny','A low, very fast rolling dash.',{art:'egg',action:'dash',power:90,jump:40,speed:38,color:'#e9bba1'});
add(0x86,'Sledge Bro','bro','Ground-pound to shake enemies and break bricks.',{action:'slam',power:64,scale:1.2,jump:60,speed:20});
add(0x87,'Fire Bro','bro','Rapid bouncing fireballs with a high jump.',{action:'fire',power:6,color:'#d96250',jump:82,cooldown:16});
add(0x88,'Orange Cheep','fish','Extra-fast swimming and a bouncing water shot.',{swim:68,speed:34,jump:74,color:'#f5a54a'});
add(0x89,'Chain Chomp','chomp','Your mouth eats most enemies on contact. Face your target; X lunges forward. Dodge fireballs and projectiles.');
add(0x8a,'Thwomp','thwomp','Leap, then special slams down and shatters ordinary bricks.');
add(0x8b,'Left Thwomp','thwomp','Special crushes left through foes and ordinary bricks.',{action:'leftdash',power:82,jump:52});
add(0x8c,'Right Thwomp','thwomp','Special crushes right through foes and ordinary bricks.',{action:'rightdash',power:82,jump:56,color:'#9bb4b5'});
add(0x8d,'Rising Thwomp','thwomp','Special launches a crushing upward surge.',{action:'rise',power:90,jump:58});
add(0x8e,'Diagonal Thwomp','thwomp','Special dashes diagonally up and forward.',{action:'diagonal',power:70,jump:50});
add(0x8f,'Diving Thwomp','thwomp','Special dives diagonally down and forward.',{action:'dive',power:78,jump:62});
add(0x9d,'Upward Burner','fire','Shoot a vertical fire column and rocket upward.',{action:'rise',power:84,jump:86,art:'burner'});
add(0x9e,'Podoboo','fire','Very high fire jumps and a bouncing fireball. Lava and enemy flames cannot hurt you; lava bounces you back up.',{fireproof:true,jump:112,airJumps:1,power:6});
add(0x9f,'Para-Beetle','beetle','Continuous flight with a protective shell spin.',{category:'Air',winged:true,fly:34,action:'spin',power:38,color:'#d4564f'});
add(0xa0,'Green Piranha','plant','Spit quick green seeds.',{color:'#77ba60',power:6});
add(0xa1,'Ceiling Green Piranha','plant','Shoot green seeds downward while gliding.',{color:'#77ba60',action:'downseed',glide:true,jump:60});
add(0xa2,'Red Piranha','plant','Bite farther with a higher hop.',{action:'bite',power:42,jump:64});
add(0xa3,'Ceiling Red Piranha','plant','A downward bite and a slow-fall jump.',{action:'downburst',power:44,glide:true,jump:66});
add(0xa4,'Green Fire Piranha','plant','Shoot a fast aimed fireball.',{action:'fire',power:7,color:'#69b854',jump:52});
add(0xa5,'Ceiling Fire Piranha','plant','Spit two downward fireballs while gliding.',{action:'downfire',power:5,color:'#70ba70',glide:true});
add(0xa6,'Venus Fire Trap','plant','Aim a three-way fan of flame.',{action:'spreadfire',power:6,jump:58});
add(0xa7,'Ceiling Venus','plant','Float down and rain three fireballs.',{action:'rainfire',power:5,glide:true,jump:62});
add(0xac,'Left Burner','fire','A strong fire jet shoots to the left.',{action:'leftfire',power:9,art:'burner',jump:76});
add(0xad,'Rocky Wrench','bro','Throw a spinning wrench; hold Down to hide safely.',{art:'wrench',action:'wrench',power:7,collapse:true,color:'#ae8a60',jump:62});
add(0xaf,'Angry Sun','fire','Touch enemies, bosses and hostile projectiles to burn them up. Fire and lava cannot hurt you. X shoots a three-way fan of fire.',{art:'sun',category:'Air',fly:42,speed:40,action:'spreadfire',power:6,color:'#ffd763',jump:90,sunTouch:true,fireproof:true});
add(0xb0,'Giant Cannonball','bullet','A massive crushing dash breaks ordinary bricks.',{art:'cannon',action:'dash',power:100,scale:1.2,breaks:true,fly:18,jump:48});
add(0xb1,'Right Burner','fire','A strong fire jet shoots to the right.',{action:'rightfire',power:9,art:'burner',jump:80});
add(0xb2,'Ceiling Burner','fire','Hover, then release a downward jet of fire.',{action:'downfire',power:8,art:'burner',fly:24});

const koopalings=[
  ['Larry','#65bb93','rings',5,76],['Morton','#c0b6ae','slam',66,62],
  ['Wendy','#ec8fa3','rings',5,82],['Iggy','#9ed374','spreadmagic',5,90],
  ['Roy','#d38dc7','stomp',70,66],['Lemmy','#efcd6d','balls',4,96],
  ['Ludwig','#8499e4','spreadmagic',7,72],
];
koopalings.forEach(([name,color,action,power,jump],world)=>add(0x0e,name,'boss',({Larry:'Shoot bouncing boss rings.',Morton:'Slam down with a wide earthquake.',Wendy:'Throw bouncing magic rings.',Iggy:'Fire three magic bolts and jump high.',Roy:'Shake the floor with a powerful shockwave.',Lemmy:'Throw bouncing circus balls; jump again in midair.',Ludwig:'Launch a fast three-bolt magic volley.'})[name],{key:`koopaling-${world}`,world,color,action,power,jump,airJumps:world===5?1:0}));
forms.push({...archetypes.goomba,key:'micro-goomba',name:'Micro Goomba Mario',family:'goomba',category:'Air',art:'goomba',color:'#e9c476',scale:.75,jump:48,airJumps:3,action:'drophelpers',power:2,description:'Tiny triple air hops and a pair of little Goomba helpers.',motion:'Three extra midair hops',specialId:6});
forms.push({...archetypes.blooper,key:'blooper-baby',name:'Baby Blooper Mario',family:'blooper',category:'Water',art:'blooper',scale:.75,color:'#f4efe5',swim:58,jump:52,airJumps:2,action:'water',power:4,description:'Quick swimming, two air hops, and a water dart.',motion:'Two midair jet hops',specialId:20});
// These enemies live in the tile map, not the eight regular actor slots.
forms.push({...archetypes.plant,key:'muncher',name:'Muncher Mario',family:'plant',tileEnemy:true,color:'#454b63',jump:44,action:'bite',power:46,description:'A black plant costume with a long snapping bite and low hops.'});
forms.push({...archetypes.blooper,key:'jelectro',name:'Jelectro Mario',family:'blooper',tileEnemy:true,art:'jelly',color:'#97deed',swim:54,jump:60,action:'shock',power:48,description:'Swim quickly and release an electric shock around you.'});
forms.push({...archetypes.plant,key:'frozen-muncher',name:'Frozen Muncher Mario',family:'plant',tileEnemy:true,color:'#99d9ee',jump:50,action:'ice',power:7,description:'Throw a hard ice block that breaks ordinary bricks.'});

const actionNames={shell:'Shell dash',stomp:'Shockwave',hammer:'Hammer toss',spikes:'Spike burst',seed:'Seed shot',water:'Water shot',ink:'Ink cloud',phase:'Vanish',upburst:'Upward strike',downburst:'Downward strike',fire:'Fireball',bite:'Lunging bite',dash:'Power dash',slam:'Ground pound',orbit:'Orbiting discs',magic:'Wand bolt',dragon:'Fire breath / Down: slam',ball:'Spike ball',upball:'Updraft ball',needle:'Piercing spine',spreadfire:'Fire fan',bone:'Bone toss',ice:'Ice block',upwater:'Rising water',trail:'Fire trail',tripleball:'Triple spike ball',blast:'Explosion',dive:'Power dive',leftseed:'Left seed',rightseed:'Right seed',triplefire:'Fire chain',gust:'Cyclone',helpers:'Squid duo',helper:'Baby fish',helpers3:'Squid fan',lotus:'Fire blossom',spin:'Shell spin',drophelpers:'Drop helpers',homing:'Homing shot',heavyseed:'Heavy seed',heavyspread:'Heavy fire fan',boomerang:'Boomerang',egg:'Spiny egg',leftdash:'Crush left',rightdash:'Crush right',rise:'Rocket rise',diagonal:'Diagonal crush',downseed:'Seed drop',downfire:'Fire drop',rainfire:'Fire rain',leftfire:'Left fire jet',rightfire:'Right fire jet',wrench:'Wrench toss',rings:'Magic ring',spreadmagic:'Magic fan',balls:'Bouncing balls'};
actionNames.shock='Electric pulse';
actionNames.drophelpers='Drop Micro-Goombas';
for(const form of forms){
  if(form.key==='koopaling-0'){form.shell=true;form.shellSpeed=48;form.description='X shoots bouncing boss rings. Down tucks into your original boss shell; direction starts sliding, walls bounce, and jump stands up with a short skid.';}
  if(form.family==='disc')form.description+=' Your body and X discs destroy enemies, bosses, bricks and physical weapons. The Sun, fireballs, magic and lasers survive.';
  if([0x56,0x57,0x7d,0x7f,0xa0,0xa1,0xa2,0xa3,0xa4,0xa5,0xa6,0xa7].includes(form.enemyId)){
    form.extendable=true;
    form.plantAxis=[0x56,0x57].includes(form.enemyId)?'x':'y';
    form.plantInverted=[0xa1,0xa3,0xa5,0xa7].includes(form.enemyId);
  }
  form.ability??=actionNames[form.action];form.cooldown??=form.action==='phase'?150:form.action==='orbit'?120:form.action==='slam'?55:32;
  if(form.suit===undefined){
    if(form.fly)form.motion='Hold jump / Up to fly; Down to descend';
    else if(form.airJumps)form.motion=`${form.airJumps} extra midair ${form.airJumps===1?'jump':'jumps'}${form.swim?' · fast swimming':''}`;
    else if(form.glide)form.motion='Hold jump while falling to glide';
    if(form.flap)form.motion='Tap jump to flap; hold jump / Up to fly; Down descends';
    if(form.shell)form.motion+=(form.winged?'; Down descends in the air, a fresh Down on the ground tucks':'; Down tucks')+', direction launches; shells break bricks and hit ? blocks; jump exits with a short skid';
    if(form.extendable)form.motion+='; Up extends, Down retracts';
    if(form.action==='spikecontrol')form.motion+='; Up / Down controls ball height';
  }
}
export const FORMS=Object.freeze(forms.map(Object.freeze));
export const BY_KEY=new Map(FORMS.map(f=>[f.key,f]));
export const CATEGORIES=['All','Mario','Ground','Air','Water','Castle','Boss'];
export function enemyForm(id,world=0){return id===0x0e?BY_KEY.get(`koopaling-${Math.max(0,Math.min(6,world))}`):FORMS.find(f=>f.enemyId===id);}
export function specialForm(id){return FORMS.find(f=>f.specialId===id);}
export function tileForm(tileset,value){
  if(value===0x66||(tileset===5&&[0xc0,0xc2].includes(value)))return BY_KEY.get('muncher');
  if([4,6,12].includes(tileset)&&value===0xf4)return BY_KEY.get('jelectro');
  if(tileset===12&&value===0x56)return BY_KEY.get('frozen-muncher');
}
