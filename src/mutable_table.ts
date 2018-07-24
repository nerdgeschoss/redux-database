import { Record, RecordIdentifying, OptionalID } from './util';
import { Table } from './table';
import { MutableDB } from '.';

export class MutableTable<T extends Record> {
  underlyingTable: Table<T>;
  db: MutableDB<any, any, any, any>;

  constructor(table: Table<T>, db: MutableDB<any, any, any, any>) {
    this.underlyingTable = table;
    this.db = db;
  }

  find(id: string): T | undefined {
    return this.underlyingTable.find(id);
  }

  get all(): T[] {
    return this.underlyingTable.all;
  }

  get first(): T | undefined {
    return this.underlyingTable.first;
  }

  get last(): T | undefined {
    return this.underlyingTable.last;
  }

  where(query: ((value: T) => boolean) | Partial<T>): T[] {
    return this.underlyingTable.where(query);
  }

  insert(records: OptionalID | OptionalID[]) {
    this.db.dispatch(this.underlyingTable.insert(records));
  }

  update(id: RecordIdentifying, values: Partial<T>) {
    this.db.dispatch(this.underlyingTable.update(id, values));
  }

  delete(id: RecordIdentifying) {
    this.db.dispatch(this.underlyingTable.delete(id));
  }
}
