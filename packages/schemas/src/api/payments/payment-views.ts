import { z } from "zod";

/** Esboço (E11-T03): o contrato real entra na E11-T04. */
export const paymentStatusSchema = z.never();
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export const paymentListItemSchema = z.never();
export type PaymentListItem = z.infer<typeof paymentListItemSchema>;
export const paymentResponse = z.never();
export type PaymentResponse = z.infer<typeof paymentResponse>;
export const paymentListQuery = z.never();
export type PaymentListQuery = z.infer<typeof paymentListQuery>;
export const paymentListResponse = z.never();
export type PaymentListResponse = z.infer<typeof paymentListResponse>;
