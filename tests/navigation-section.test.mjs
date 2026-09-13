import test from 'node:test';
import assert from 'node:assert/strict';
import { activeSection } from '../lib/navigation-section.ts';

test('parallel sidebar does not override chart or watchlist navigation',()=>{
  const sections=[{id:'price-chart',top:90,bottom:900},{id:'watchlist',top:925,bottom:1700},{id:'price-alerts',top:90,bottom:550}];
  assert.equal(activeSection(sections,'',400,1000,false),'price-chart');
  assert.equal(activeSection(sections,'price-chart',400,1000,false),'price-chart');
  assert.equal(activeSection(sections,'price-alerts',400,1000,false),'price-alerts');
  const scrolled=sections.map(s=>({...s,top:s.top-850,bottom:s.bottom-850}));
  assert.equal(activeSection(scrolled,'price-chart',1250,1000,false),'watchlist');
});
test('stacked mobile alerts and top/bottom anchors stay accurate',()=>{
  const sections=[{id:'price-chart',top:-1500,bottom:-700},{id:'watchlist',top:-680,bottom:90},{id:'price-alerts',top:110,bottom:500}];
  assert.equal(activeSection(sections,'',2000,844,false),'price-alerts');
  assert.equal(activeSection(sections,'price-alerts',2000,844,true),'price-alerts');
  assert.equal(activeSection(sections,'price-alerts',0,844,false),'overview');
});
