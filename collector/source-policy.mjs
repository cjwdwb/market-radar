// Explicit public macro source. This does not approve price history or a user universe.
export const FED = Object.freeze({
  source:'fed-board:monetary-v1', owner:'local-public-macro', universeVersion:'public-macro-v1',
  endpoint:'https://www.federalreserve.gov/feeds/press_monetary.xml',
  rights:'https://www.federalreserve.gov/disclaimer.htm',
  attribution:'Source: Board of Governors of the Federal Reserve System',
  start:Date.parse('2026-09-01T00:00:00Z'),
  asset:Object.freeze({id:'context:fed-monetary',market:'macro',venue:'FederalReserveBoard',providerId:'press_monetary',currency:'NA',adjustment:'not_applicable',role:'context'}),
  limits:Object.freeze({requests:3,pages:1,pageBytes:262144,bytes:262144,writes:50,durationMs:30000}),
});
export function isFedConfig(c){
  return c.identity==='reconstructed'&&c.source===FED.source&&c.owner===FED.owner&&c.universeVersion===FED.universeVersion&&c.from>=FED.start&&
    c.assets?.length===1&&Object.keys(c.assets[0]).length===Object.keys(FED.asset).length&&Object.entries(FED.asset).every(([k,v])=>c.assets[0][k]===v);
}
export function fedLink(value){return typeof value==='string'&&/^https:\/\/www\.federalreserve\.gov\/newsevents\/pressreleases\/monetary\d{8}[a-z]\.htm$/.test(value);}
