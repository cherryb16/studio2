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

export type UserData = {
  uid: string;
  email: string | null; // Allow email to be null
  firstName: string;
  lastName: string;
  dob: number; // timestamp
  createdAt: number; // timestamp
  snaptradeUserID?: string; // Placeholder
  snaptradeUserSecret?: string; // Placeholder
  tradingExperience: string;
};
