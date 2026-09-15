export type Section={heading:string;sectionRef:string;content:string;page:number};
/** Preserves headingless numeric provisions. No dependence on an HTML table of contents. */
export function structuralChunks(text:string):Section[]{
 const normalized=text.replaceAll('\r\n','\n').replace(/\0/g,'').trim();if(!normalized)return [];
 const sections:Section[]=[];let current:Section={heading:'Document introduction',sectionRef:'',content:'',page:1};let page=1;
 for(const line of normalized.split('\n')){
  if(line.includes('\f'))page++;
  const match=line.match(/^\s*(?:(?:Section|Bylaw|Rule|Part)\s+)?(\d+(?:\.\d+)*(?:\([a-z0-9]+\))?)\s*[.\-–—:]?\s+(.{0,140})$/i);
  if(match&&current.content.trim()){sections.push({...current,content:current.content.trim()});current={heading:line.trim(),sectionRef:match[1],content:'',page};}
  else if(match){current.heading=line.trim();current.sectionRef=match[1];current.page=page;}
  current.content+=line+'\n';
 }
 if(current.content.trim())sections.push({...current,content:current.content.trim()});
 return sections.flatMap(s=>{if(s.content.length<=5000)return [s];const result:Section[]=[];let buffer='';for(const paragraph of s.content.split(/\n\s*\n/)){if(buffer.length+paragraph.length>5000&&buffer){result.push({...s,content:buffer.trim()});buffer='';}if(paragraph.length>5000){for(let i=0;i<paragraph.length;i+=4500)result.push({...s,content:paragraph.slice(i,i+4500)});}else buffer+=paragraph+'\n\n';}if(buffer.trim())result.push({...s,content:buffer.trim()});return result;});
}
export function contextualText(title:string,effectiveDate:string|null,section:Section){return '['+title+' · effective '+(effectiveDate||'unverified')+']\n['+section.heading+']\n'+section.content;}
