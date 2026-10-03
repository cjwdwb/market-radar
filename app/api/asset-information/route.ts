import publication from '../../../data/published/official-information.json' with {type:'json'};
import {parseOfficialView} from '../../../lib/information/official.mjs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
let prepared:ReturnType<typeof parseOfficialView>|undefined;
export async function GET(request:Request){
 if(new URL(request.url).search)return Response.json({error:'此入口只读取已发布项目资料。'},{status:400,headers});
 try{return Response.json(await(prepared??=parseOfficialView(JSON.stringify(publication),Date.now())),{headers});}
 catch{prepared=undefined;return Response.json({error:'项目资料暂不可用，行情仍可使用。'},{status:503,headers});}
}
