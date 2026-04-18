import Dexie, { type EntityTable } from 'dexie';
import type { Transaction, Document, TaxSummary, ChatMessage, Insight } from '../types';

export const db = new Dexie('2ask') as Dexie & {
  transactions: EntityTable<Transaction, 'id'>;
  documents: EntityTable<Document, 'id'>;
  taxSummaries: EntityTable<TaxSummary, 'monthYear'>;
  chatMessages: EntityTable<ChatMessage, 'id'>;
  insights: EntityTable<Insight, 'id'>;
  gmailCache: EntityTable<{ messageId: string; processedAt: string }, 'messageId'>;
};

db.version(1).stores({
  transactions: 'id, monthYear, category, source, date, vendor, isTaxDeductible, documentType',
  documents: 'id, source, processedAt, gmailMessageId',
  taxSummaries: 'monthYear',
  chatMessages: 'id, timestamp',
  insights: 'id, type, createdAt',
  gmailCache: 'messageId',
});
