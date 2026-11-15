import { z } from "zod";

/** POST /attachments/upload-url (RFC-004). */
export const attachmentUploadUrlRequest = z.strictObject({
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(100),
  sizeBytes: z.int().positive(),
});

export type AttachmentUploadUrlRequest = z.infer<typeof attachmentUploadUrlRequest>;
