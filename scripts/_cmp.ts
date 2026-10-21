import { Resvg } from '@resvg/resvg-js';
const root='.';
const {cellSvg}=await import('./lib/board');
const now=()=>Number(process.hrtime.bigint())/1e6;
const seed=Number(process.argv[2]??321);
const {svg}=cellSvg({seed,opts:{anatomyEngine:'structured'} as never},340,420);
const t=now(); const r=new Resvg(svg).render(); const ms=now()-t;
(await import('fs')).writeFileSync(process.argv[3]!, r.pixels);
console.log(root,'raster',ms.toFixed(0),'ms','filters',(svg.match(/<filter /g)||[]).length);
