export type FedViewRecord={id:string;title:string;url:string;publishedAt:number;publicationPrecision:'minute'|'second';firstReceivedAt:number;versionReceivedAt:number;version:number;contentHash:string};
export type FedView={format:'fed-monetary-view-v1';source:string;attribution:string;rightsUrl:string;identity:'reconstructed';vintage:'current';readRevision:number;exportedAt:number;range:{from:number;cutoff:number};coverage:{status:'endpoint_snapshot';expectedCount:null;limitation:string};records:readonly FedViewRecord[];viewId:string};
export const VIEW_LIMIT:number;
export const SOURCE:string;
export const ATTRIBUTION:string;
export const RIGHTS:string;
export function viewDigest(value:unknown):Promise<string>;
export function parseFedView(text:string,now:number):Promise<FedView>;
export function queryFedView(view:FedView,query:{from:number;to:number;page?:number}):{viewId:string;readRevision:number;total:number;page:number;pages:number;records:FedViewRecord[]};
