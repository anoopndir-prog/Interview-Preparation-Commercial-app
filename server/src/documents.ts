import type Anthropic from '@anthropic-ai/sdk';
import mammoth from 'mammoth';

import { badRequest } from './errors.js';

type ContentBlock = Anthropic.Beta.BetaContentBlockParam;

const IMAGE_TYPES: Record<string, 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};

const extensionOf = (name: string) => name.toLowerCase().split('.').pop() ?? '';

/**
 * Turns an uploaded resume/JD (PDF, DOCX, image or text) into Claude content blocks.
 * PDFs and images go to Claude natively so scanned documents and photos of printed
 * JDs work too; DOCX is converted to text first because Claude doesn't read it directly.
 */
export async function fileToContent(
  label: 'RESUME' | 'JOB DESCRIPTION',
  file: { originalname: string; mimetype: string; buffer: Buffer },
): Promise<ContentBlock[]> {
  const ext = extensionOf(file.originalname);
  const mime = file.mimetype;
  const header: ContentBlock = { type: 'text', text: `<${label}> (file: ${file.originalname})` };
  const footer: ContentBlock = { type: 'text', text: `</${label}>` };

  if (mime === 'application/pdf' || ext === 'pdf') {
    return [
      header,
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: file.buffer.toString('base64') },
      },
      footer,
    ];
  }

  const imageType = IMAGE_TYPES[ext] ?? Object.values(IMAGE_TYPES).find((t) => t === mime);
  if (imageType) {
    return [
      header,
      { type: 'image', source: { type: 'base64', media_type: imageType, data: file.buffer.toString('base64') } },
      footer,
    ];
  }

  if (ext === 'docx' || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const { value } = await mammoth.extractRawText({ buffer: file.buffer });
    if (!value.trim()) throw badRequest(`${file.originalname} looks empty`);
    return [textBlock(label, value)];
  }

  if (ext === 'txt' || ext === 'md' || mime.startsWith('text/')) {
    return [textBlock(label, file.buffer.toString('utf8'))];
  }

  if (ext === 'heic' || ext === 'heif') {
    throw badRequest('HEIC photos are not supported yet — please upload a JPG or PNG');
  }
  if (ext === 'doc') {
    throw badRequest('Old .doc files are not supported — please save as .docx or PDF');
  }
  throw badRequest(`Unsupported file type: ${file.originalname}. Use PDF, DOCX, JPG, PNG or TXT.`);
}

export function textBlock(label: 'RESUME' | 'JOB DESCRIPTION', text: string): ContentBlock {
  return { type: 'text', text: `<${label}>\n${text.trim()}\n</${label}>` };
}
