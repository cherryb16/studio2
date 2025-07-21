export type Trade = {
  id: string;
  instrument: string;
  date: string;
  entryPrice: number;
  exitPrice: number;
  position: 'long' | 'short';
  pnl: number;
  status: 'win' | 'loss' | 'breakeven';
};

export type JournalEntry = {
  id: string;
  date: string;
  title: string;
  notes: string;
  tradeId?: string;
};
