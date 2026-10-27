import { SQLiteDatabase } from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Transaction {
  id: string;
  delta: number;
  date: string;
  note?: string;
  audioUri?: string;
  completed?: boolean;
  exchangerId?: string;
  exchangerName?: string;
  splitGroupId?: string;
  splitTotal?: number;
  splitParticipants?: string[];
}

export interface Exchanger {
  id: string;
  name: string;
  balance: number;
  note?: string;
  pinned?: boolean;
  history?: Transaction[];
}

const MYSELF_ID = 'default-myself-001';

export const INITIAL_EXCHANGERS: Exchanger[] = [
  { id: MYSELF_ID, name: 'ME', balance: 0, history: [] }
];

export const initDB = async (db: SQLiteDatabase) => {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS exchangers (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      balance REAL NOT NULL,
      note TEXT,
      pinned INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY NOT NULL,
      exchangerId TEXT NOT NULL,
      delta REAL NOT NULL,
      date TEXT NOT NULL,
      note TEXT,
      audioUri TEXT,
      completed INTEGER DEFAULT 0,
      splitGroupId TEXT,
      splitTotal REAL,
      splitParticipants TEXT,
      FOREIGN KEY (exchangerId) REFERENCES exchangers (id) ON DELETE CASCADE
    );
  `);
  try {
    await db.execAsync('ALTER TABLE transactions ADD COLUMN splitGroupId TEXT;');
  } catch {}
  try {
    await db.execAsync('ALTER TABLE transactions ADD COLUMN splitTotal REAL;');
  } catch {}
  try {
    await db.runAsync(
      'INSERT OR IGNORE INTO exchangers (id, name, balance, note, pinned) VALUES (?, ?, ?, ?, ?)',
      [MYSELF_ID, 'ME', 0, null, 0]
    );
  } catch {}
};

export const migrateFromAsyncStorage = async (db: SQLiteDatabase) => {
  const saved = await AsyncStorage.getItem('exchangers');
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as Exchanger[];
      // Insert into SQLite
      for (const e of parsed) {
        await db.runAsync(
          'INSERT OR IGNORE INTO exchangers (id, name, balance, note, pinned) VALUES (?, ?, ?, ?, ?)',
          [e.id, e.name, e.balance || 0, e.note || null, e.pinned ? 1 : 0]
        );
        if (e.history && e.history.length > 0) {
          for (const t of e.history) {
            await db.runAsync(
              'INSERT OR IGNORE INTO transactions (id, exchangerId, delta, date, note, audioUri, completed) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [t.id, e.id, t.delta, t.date, t.note || null, t.audioUri || null, t.completed ? 1 : 0]
            );
          }
        }
      }
      // Migration complete, remove the key so it doesn't run again
      await AsyncStorage.removeItem('exchangers');
    } catch (err) {
      console.error('Migration failed:', err);
    }
  } else {
    // If no exchangers exist in DB either, seed it
    const existing = await db.getAllAsync('SELECT id FROM exchangers LIMIT 1');
    if (existing.length === 0) {
      for (const e of INITIAL_EXCHANGERS) {
        await db.runAsync(
          'INSERT OR IGNORE INTO exchangers (id, name, balance, note, pinned) VALUES (?, ?, ?, ?, ?)',
          [e.id, e.name, e.balance || 0, e.note || null, e.pinned ? 1 : 0]
        );
      }
    }
  }
};

export const fetchAllExchangers = async (db: SQLiteDatabase): Promise<Exchanger[]> => {
  const exchangersRows = await db.getAllAsync<any>('SELECT * FROM exchangers');
  const transactionsRows = await db.getAllAsync<any>('SELECT * FROM transactions ORDER BY date DESC');

  return exchangersRows.map(row => {
    const history = transactionsRows
      .filter(t => t.exchangerId === row.id)
      .map(t => {
        let participants: string[] | undefined = undefined;
        if (t.splitParticipants) {
          try {
            participants = JSON.parse(t.splitParticipants);
          } catch {}
        }
        return {
          id: t.id,
          delta: t.delta,
          date: t.date,
          note: t.note,
          audioUri: t.audioUri,
          completed: t.completed === 1,
          exchangerId: row.id,
          exchangerName: row.name,
          splitGroupId: t.splitGroupId || undefined,
          splitTotal: t.splitTotal || undefined,
          splitParticipants: participants
        };
      });
    
    return {
      id: row.id,
      name: row.name,
      balance: row.balance,
      note: row.note,
      pinned: row.pinned === 1,
      history
    };
  });
};

export const addTransactionDB = async (db: SQLiteDatabase, tx: Transaction, exchangerId: string, newBalance: number) => {
  try {
    await db.runAsync(
      'INSERT INTO transactions (id, exchangerId, delta, date, note, audioUri, completed, splitGroupId, splitTotal, splitParticipants) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        tx.id,
        exchangerId,
        tx.delta,
        tx.date,
        tx.note || null,
        tx.audioUri || null,
        tx.completed ? 1 : 0,
        tx.splitGroupId || null,
        tx.splitTotal || null,
        tx.splitParticipants ? JSON.stringify(tx.splitParticipants) : null
      ]
    );
  } catch {
    await db.runAsync(
      'INSERT INTO transactions (id, exchangerId, delta, date, note, audioUri, completed) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [tx.id, exchangerId, tx.delta, tx.date, tx.note || null, tx.audioUri || null, tx.completed ? 1 : 0]
    );
  }
  await db.runAsync(
    'UPDATE exchangers SET balance = ?, note = ? WHERE id = ?',
    [newBalance, tx.note || null, exchangerId]
  );
};

export const updateTransactionCompletionDB = async (db: SQLiteDatabase, txId: string, exchangerId: string, completed: boolean, newBalance: number) => {
  await db.runAsync('UPDATE transactions SET completed = ? WHERE id = ?', [completed ? 1 : 0, txId]);
  await db.runAsync('UPDATE exchangers SET balance = ? WHERE id = ?', [newBalance, exchangerId]);
};

export const deleteTransactionDB = async (db: SQLiteDatabase, txId: string, exchangerId: string, newBalance: number) => {
  await db.runAsync('DELETE FROM transactions WHERE id = ?', [txId]);
  await db.runAsync('UPDATE exchangers SET balance = ? WHERE id = ?', [newBalance, exchangerId]);
};

export const addExchangerDB = async (db: SQLiteDatabase, exchanger: Exchanger) => {
  await db.runAsync(
    'INSERT INTO exchangers (id, name, balance, note, pinned) VALUES (?, ?, ?, ?, ?)',
    [exchanger.id, exchanger.name, exchanger.balance || 0, exchanger.note || null, exchanger.pinned ? 1 : 0]
  );
};

export const deleteExchangerDB = async (db: SQLiteDatabase, exchangerId: string) => {
  await db.runAsync('DELETE FROM exchangers WHERE id = ?', [exchangerId]);
};

export const clearAllTransactionsDB = async (db: SQLiteDatabase, exchangerId: string) => {
  await db.runAsync('DELETE FROM transactions WHERE exchangerId = ?', [exchangerId]);
  await db.runAsync('UPDATE exchangers SET balance = 0, note = NULL WHERE id = ?', [exchangerId]);
};

export const togglePinExchangerDB = async (db: SQLiteDatabase, exchangerId: string, pinned: boolean) => {
  await db.runAsync('UPDATE exchangers SET pinned = ? WHERE id = ?', [pinned ? 1 : 0, exchangerId]);
};

export const renameExchangerDB = async (db: SQLiteDatabase, exchangerId: string, newName: string) => {
  await db.runAsync('UPDATE exchangers SET name = ? WHERE id = ?', [newName, exchangerId]);
};

export const resetBalanceDB = async (db: SQLiteDatabase, exchangerId: string) => {
  await db.runAsync('UPDATE transactions SET completed = 1 WHERE exchangerId = ?', [exchangerId]);
  await db.runAsync('UPDATE exchangers SET balance = 0, note = NULL WHERE id = ?', [exchangerId]);
};

export const wipeEntireDB = async (db: SQLiteDatabase) => {
  await db.runAsync('DELETE FROM transactions');
  await db.runAsync('DELETE FROM exchangers');
  for (const e of INITIAL_EXCHANGERS) {
    await db.runAsync(
      'INSERT INTO exchangers (id, name, balance, note, pinned) VALUES (?, ?, ?, ?, ?)',
      [e.id, e.name, e.balance || 0, e.note || null, e.pinned ? 1 : 0]
    );
  }
};
