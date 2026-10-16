import { PDFParse } from 'pdf-parse';
import { AppError } from '@/lib/errors';

/** Extracts the text layer of a PDF for structural chunking. Page breaks are form feeds, which structuralChunks counts;
 * the parser's default "-- 1 of N --" marker is text, so it was never counted and leaked into quotable sections.
 * A file the parser cannot read is reported as unreadable with a message the user can act on, never with parser internals. */
export async function pdfText(bytes: Uint8Array): Promise<string> {
  const parser = new PDFParse({ data: bytes });
  try {
    return (await parser.getText({ pageJoiner: '\f' })).text;
  } catch {
    throw new AppError(
      'pdf_unreadable',
      'This PDF could not be read. If it is a scanned document, scanned PDFs cannot be read yet. Upload a searchable PDF, or a DOCX, TXT or Markdown file.',
    );
  } finally {
    await parser.destroy();
  }
}
