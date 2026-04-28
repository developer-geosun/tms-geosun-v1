export type QuoteStatusContract =
  | 'draft'
  | 'sent'
  | 'superseded'
  | 'accepted'
  | 'rejected'
  | 'expired';

export interface QuoteContractDto {
  id: string;
  requestId: string;
  currency: string;
  totalAmount: number;
  transitDaysMin: number | null;
  transitDaysMax: number | null;
  validUntil: string | null;
  status: QuoteStatusContract;
  publicNote: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface CreateQuoteContractRequest {
  currency: string;
  totalAmount: number;
  transitDaysMin: number | null;
  transitDaysMax: number | null;
  validUntil: string | null;
  publicNote: string | null;
  internalNote: string | null;
}

