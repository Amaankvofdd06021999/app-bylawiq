import {describe,it,expect} from 'vitest';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {pdfText} from '@/lib/ai/pdf-text';
import {structuralChunks} from '@/lib/ai/chunking';
async function twoPageBylaw(){
 const pdf=await PDFDocument.create();const font=await pdf.embedFont(StandardFonts.Helvetica);
 for(const lines of [['1 Definitions','In these bylaws, owner means the registered owner of a strata lot.'],['2 Pets','An owner may keep one dog or one cat in a strata lot.']]){const page=pdf.addPage([612,792]);lines.forEach((text,i)=>page.drawText(text,{x:50,y:720-i*20,font,size:12}));}
 return pdf.save();
}
describe('page numbers from PDF text',()=>{
 it('attributes a provision that starts on page 2 to page 2',async()=>{const sections=structuralChunks(await pdfText(await twoPageBylaw()));expect(sections.find(s=>s.sectionRef==='1')?.page).toBe(1);expect(sections.find(s=>s.sectionRef==='2')?.page).toBe(2);});
 it('keeps page markers out of quotable section text',async()=>{const sections=structuralChunks(await pdfText(await twoPageBylaw()));expect(sections.length).toBeGreaterThan(1);for(const s of sections){expect(s.content).not.toMatch(/--\s*\d+ of \d+\s*--/);expect(s.content).not.toContain('\f');}});
});
