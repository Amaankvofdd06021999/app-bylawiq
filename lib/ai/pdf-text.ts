import {PDFParse} from 'pdf-parse';
/** Extracts the text layer of a PDF for structural chunking. Page breaks are form feeds, which structuralChunks counts;
 * the parser's default "-- 1 of N --" marker is text, so it was never counted and leaked into quotable sections. */
export async function pdfText(bytes:Uint8Array):Promise<string>{const parser=new PDFParse({data:bytes});try{return (await parser.getText({pageJoiner:'\f'})).text;}finally{await parser.destroy();}}
