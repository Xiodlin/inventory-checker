import { DatabaseSync } from 'node:sqlite';
import type { SqlConnection, SqlDatabase, SqlValue } from '@inventory-checker/core';

export class DesktopDatabase implements SqlDatabase {
  private readonly database: DatabaseSync;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly connection: SqlConnection;
  constructor(path: string) {
    this.database = new DatabaseSync(path);
    this.connection = {
      exec: async sql => { this.database.exec(sql); },
      run: async (sql, params = []) => { this.database.prepare(sql).run(...params); },
      all: async <T>(sql: string, params: SqlValue[] = []) => this.database.prepare(sql).all(...params) as T[],
    };
  }
  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work);
    this.queue = result.then(() => undefined, () => undefined);
    return result;
  }
  exec(sql: string) { return this.serialize(() => this.connection.exec(sql)); }
  run(sql: string, params?: SqlValue[]) { return this.serialize(() => this.connection.run(sql, params)); }
  all<T>(sql: string, params?: SqlValue[]) { return this.serialize(() => this.connection.all<T>(sql, params)); }
  transaction<T>(work: (connection: SqlConnection) => Promise<T>): Promise<T> {
    return this.serialize(async () => {
      await this.connection.exec('BEGIN IMMEDIATE');
      try {
        const result = await work(this.connection);
        await this.connection.exec('COMMIT');
        return result;
      } catch (error) {
        await this.connection.exec('ROLLBACK');
        throw error;
      }
    });
  }
  async close() { await this.queue; this.database.close(); }
}
