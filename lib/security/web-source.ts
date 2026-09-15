import 'server-only';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import ipaddr from 'ipaddr.js';
import {Agent,request} from 'undici';
import robotsParser from 'robots-parser';
import {load} from 'cheerio';
import {AppError} from '@/lib/errors';
export function allowedUrl(raw:string){const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||isIP(u.hostname.replace(/[\[\]]/g,''))||!u.hostname.includes('.'))throw new AppError('unsafe_source','Use a public HTTPS webpage.');
 if(/(^|\.)canlii\.org$/i.test(u.hostname)||(/(^|\.)bclaws\.gov\.bc\.ca$/i.test(u.hostname)&&decodeURIComponent(u.pathname).toLowerCase().includes('/civix/')))throw new AppError('source_restricted','This publisher requires a separately authorized ingestion route.');return u;}
export function publicAddress(ip:string){try{const addr=ipaddr.process(ip);return addr.range()==='unicast';}catch{return false;}}
async function safePage(raw:string,redirects=0,allowRedirects=true):Promise<{status:number;text:string;url:string}>{
 const u=allowedUrl(raw);const records=await lookup(u.hostname,{all:true,verbatim:true});if(!records.length||records.some(r=>!publicAddress(r.address)))throw new AppError('unsafe_source','This address is not a public website.');
 const dispatcher=new Agent({connect:{lookup:(_host,options,callback)=>{if(options.all)callback(null,records);else callback(null,records[0].address,records[0].family);}}});
 try{const r=await request(u,{dispatcher,method:'GET',headers:{'user-agent':'BylawIQBot/1.0','accept':'text/html,text/plain'},headersTimeout:15000,bodyTimeout:15000,signal:AbortSignal.timeout(20000)});
 if([301,302,303,307,308].includes(r.statusCode)){await r.body.dump();if(!allowRedirects)throw new AppError('source_redirect','This page redirects. Add its final URL so the publisher’s crawling rules can be checked before downloading it.');if(redirects>=3||!r.headers.location)throw new AppError('source_redirect','This page has too many redirects.');return safePage(new URL(String(r.headers.location),u).href,redirects+1);}
 const type=String(r.headers['content-type']||'');if(r.statusCode===200&&!/text\/(html|plain)/i.test(type)){await r.body.dump();throw new AppError('source_type','Upload documents through the document vault. Website sources must be HTML or text.');}
 let size=0;const chunks:Buffer[]=[];for await(const part of r.body){const b=Buffer.from(part);size+=b.length;if(size>2_000_000){r.body.destroy();throw new AppError('source_size','This page exceeds the 2 MB source limit.');}chunks.push(b);}return {status:r.statusCode,text:Buffer.concat(chunks).toString('utf8'),url:u.href};
 }finally{await dispatcher.close();}
}
export async function scrapePage(raw:string){const url=allowedUrl(raw);const robots=await safePage(new URL('/robots.txt',url).href);if(robots.status!==404&&robots.status!==200)throw new AppError('robots_unavailable','The publisher’s crawling rules could not be verified.');if(robots.status===200&&robotsParser(new URL('/robots.txt',url).href,robots.text).isAllowed(url.href,'BylawIQBot')===false)throw new AppError('robots_denied','This publisher does not allow automated access to this page.');
 const response=await safePage(url.href,0,false);
 if(response.status!==200)throw new AppError('source_unavailable','The page could not be downloaded.');const $=load(response.text);$('script,style,nav,footer,header,noscript,iframe,form').remove();return ($('main').text()||$('article').text()||$('body').text()).replace(/[ \t]+/g,' ').replace(/\n\s*\n\s*\n/g,'\n\n').trim();}
