import { AppError } from '@/lib/errors';

/** Below this, a PDF has no usable text layer (a scan, or an image-only file). OCR is out of scope (decision D8). */
export const MIN_TEXT_LAYER_CHARS = 100;

export function assertTextLayer(text: string): void {
  if (text.trim().length < MIN_TEXT_LAYER_CHARS) {
    throw new AppError(
      'ocr_required',
      'This PDF has no readable text, so it looks like a scanned document. Scanned PDFs cannot be read yet. Upload a searchable PDF, or a DOCX, TXT or Markdown file.',
    );
  }
}
