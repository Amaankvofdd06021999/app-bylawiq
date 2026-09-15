import 'server-only';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {Document,Packer,Paragraph,TextRun,Header,Footer,HeadingLevel} from 'docx';
import {DISCLAIMER} from '@/lib/constants';
const clean=(s:string)=>s.replace(/[^\x20-\x7E\n]/g,c=>({'’':"'",'‘':"'",'“':'"','”':'"','—':' - ','–':' - ','·':' / ','…':'...'}[c]||'?'));
export async function exportPdf(title:string,body:string,building:string,status:string,letterhead=''){
 const pdf=await PDFDocument.create();const font=await pdf.embedFont(StandardFonts.Helvetica);const bold=await pdf.embedFont(StandardFonts.HelveticaBold);let page=pdf.addPage([612,792]);let y=726;let pageNumber=1;
 const footer=()=>{page.drawLine({start:{x:45,y:72},end:{x:567,y:72},thickness:.5,color:rgb(.8,.82,.85)});page.drawText('Drafted with BylawIQ / '+new Date().toISOString().slice(0,10)+' / '+status.toUpperCase()+' / Page '+pageNumber,{x:45,y:57,font,size:8,color:rgb(.4,.45,.5)});page.drawText(clean(DISCLAIMER).slice(0,122),{x:45,y:43,font,size:6.6,color:rgb(.4,.45,.5)});page.drawText(clean(DISCLAIMER).slice(122),{x:45,y:33,font,size:6.6,color:rgb(.4,.45,.5)});};
 const line=(text:string,size=11,strong=false)=>{if(y<100){footer();page=pdf.addPage([612,792]);pageNumber++;y=725;}page.drawText(clean(text),{x:45,y,font:strong?bold:font,size,color:rgb(.12,.17,.23)});y-=size*1.65;};
 const wrap=(value:string,size=11,strong=false)=>{for(const para of clean(value).split('\n')){let current='';for(const word of para.split(' ')){if((strong?bold:font).widthOfTextAtSize(current+' '+word,size)>510&&current){line(current,size,strong);current=word;}else current+=(current?' ':'')+word;}line(current,size,strong);}};
 wrap(letterhead||building,11,true);y-=15;wrap(title,21,true);y-=15;wrap('Status: '+status+' / Building: '+building,9);y-=20;wrap(body);footer();return pdf.save();
}
export async function exportDocx(title:string,body:string,building:string,status:string,letterhead=''){
 const doc=new Document({sections:[{headers:{default:new Header({children:[new Paragraph(letterhead||building)]})},footers:{default:new Footer({children:[new Paragraph({children:[new TextRun({text:'Drafted with BylawIQ · '+new Date().toISOString().slice(0,10)+' · '+status.toUpperCase(),size:16})]}),new Paragraph({children:[new TextRun({text:DISCLAIMER,size:14})]})]})},children:[new Paragraph({text:title,heading:HeadingLevel.TITLE}),new Paragraph({text:building,spacing:{after:300}}),...body.split('\n').map(line=>new Paragraph({text:line,spacing:{after:160}}))]}]});return Packer.toBuffer(doc);
}
