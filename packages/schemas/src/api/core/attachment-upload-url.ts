import { z } from "zod";

/** Tipos aceitos (decisão do Joel, 2026-11-15): PDF e imagens, incluindo HEIC/HEIF das câmeras do iPhone. */
export const attachmentContentTypeSchema = z.enum([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
export type AttachmentContentType = z.infer<typeof attachmentContentTypeSchema>;

/** Tamanho máximo de um anexo: 10 MiB. */
export const maxAttachmentBytes = 10 * 1024 * 1024;

/** POST /attachments/upload-url (RFC-004). */
export const attachmentUploadUrlRequest = z.strictObject({
  fileName: z.string().trim().min(1).max(255),
  contentType: attachmentContentTypeSchema,
  sizeBytes: z.int().positive().max(maxAttachmentBytes),
});

export type AttachmentUploadUrlRequest = z.infer<typeof attachmentUploadUrlRequest>;
