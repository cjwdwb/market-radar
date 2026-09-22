import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {MOTION_BOOTSTRAP,MOTION_CHANGE_EVENT,PREFERENCES_KEY,normalizeMotionPreference,resolveMotionPreference,startMotionPreference,applyMotionPreference,isMotionReduced} from '../lib/motion-preference.ts';

test('motion preference migration and explicit OS overrides are deterministic',()=>{
 for(const value of [undefined,null,false,{},'invalid'])assert.equal(normalizeMotionPreference(value),'system');
 for(const [preference,os,expected] of [['system',false,'normal'],['system',true,'reduced'],['normal',true,'normal'],['reduced',false,'reduced']])assert.equal(resolveMotionPreference(preference,os),expected);
});

function bootstrap({preference,os=false,raw,storageFail=false,sessionFail=false,seen=false}={}){
 const root={dataset:{}},timers=[],seenStore=new Map(seen?[['radar-brand-seen','1']]:[]),window=new EventTarget();
 vm.runInNewContext(MOTION_BOOTSTRAP,{document:{documentElement:root},window,location:{hash:''},
  matchMedia:()=>({matches:os}),setTimeout:fn=>timers.push(fn),
  localStorage:{getItem:key=>{assert.equal(key,PREFERENCES_KEY);if(storageFail)throw Error('blocked');return raw??JSON.stringify({motionPreference:preference});}},
  sessionStorage:{getItem:key=>{if(sessionFail)throw Error('blocked');return seenStore.get(key);},setItem:(key,value)=>{if(sessionFail)throw Error('blocked');seenStore.set(key,value);}}
 });return {root,timers,window};
}
test('pre-paint bootstrap uses the same preference matrix and is fail-open',()=>{
 for(const [preference,os,mode] of [['system',false,'normal'],['system',true,'reduced'],['normal',true,'normal'],['reduced',false,'reduced']]){
  const {root,timers}=bootstrap({preference,os});assert.equal(root.dataset.motion,mode);
  assert.equal(root.dataset.intro,mode==='normal'?'play':undefined);
  timers.forEach(fn=>fn());assert.equal(root.dataset.intro,undefined);
 }
 for(const options of [{storageFail:true},{sessionFail:true},{raw:'broken json'},{seen:true}])assert.equal(bootstrap(options).root.dataset.intro,undefined);
 assert.equal(bootstrap({raw:'{}',os:true}).root.dataset.motion,'reduced');
 assert.equal(bootstrap({preference:'bad',os:true}).root.dataset.motion,'reduced');
 const opening=bootstrap();opening.window.dispatchEvent(new Event('pointerdown'));assert.equal(opening.root.dataset.intro,undefined);
});

test('one runtime media listener handles live OS changes and retains explicit choices',()=>{
 const original={document:globalThis.document,window:globalThis.window,matchMedia:globalThis.matchMedia};
 const media=new EventTarget();media.matches=false;let subscriptions=0;
 const add=media.addEventListener.bind(media),remove=media.removeEventListener.bind(media);
 media.addEventListener=(...args)=>{subscriptions++;add(...args);};media.removeEventListener=(...args)=>{subscriptions--;remove(...args);};
 globalThis.document={documentElement:{dataset:{motionPreference:'system'}}};globalThis.window=new EventTarget();globalThis.matchMedia=()=>media;
 try{
  let changes=0;window.addEventListener(MOTION_CHANGE_EVENT,()=>changes++);
  const stop=startMotionPreference();assert.equal(subscriptions,1);assert.equal(isMotionReduced(),false);
  media.matches=true;media.dispatchEvent(new Event('change'));assert.equal(isMotionReduced(),true);
  applyMotionPreference('normal');assert.equal(isMotionReduced(),false);
  media.matches=false;media.dispatchEvent(new Event('change'));media.matches=true;media.dispatchEvent(new Event('change'));assert.equal(isMotionReduced(),false);
  applyMotionPreference('reduced');media.matches=false;media.dispatchEvent(new Event('change'));assert.equal(isMotionReduced(),true);
  assert.ok(changes>=6);stop();assert.equal(subscriptions,0);
 }finally{Object.assign(globalThis,original);}
});
