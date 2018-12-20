import { Record, RecordIdentifying, OptionalID } from './util';
import { Table, ObjectChanges } from './table';
import { MutableDB } from '.';
import { DBDispatch } from './actions';

export class MutableTable<T extends Record> {
  underlyingTable: Table<T>;
  db: MutableDB<any, any, any, any>;
  dispatch: DBDispatch;

  constructor(
    table: Table<T>,
    db: MutableDB<any, any, any, any>,
    dispatch: DBDispatch
  ) {
    this.underlyingTable = table;
    this.db = db;
    this.dispatch = dispatch;
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

  get changes(): ObjectChanges<T>[] {
    return this.underlyingTable.changes;
  }

  get ids(): string[] {
    return this.underlyingTable.ids;
  }

  changesFor(id: string): ObjectChanges<T> | undefined {
    return this.underlyingTable.changesFor(id);
  }

  where(query: ((value: T) => boolean) | Partial<T>): T[] {
    return this.underlyingTable.where(query);
  }

  insert(records: OptionalID | OptionalID[]) {
    this.dispatch(this.underlyingTable.insert(records));
  }

  update(id: RecordIdentifying, values: Partial<T>) {
    this.dispatch(this.underlyingTable.update(id, values));
  }

  delete(id: RecordIdentifying) {
    this.dispatch(this.underlyingTable.delete(id));
  }

  commit(ids?: RecordIdentifying) {
    this.underlyingTable.commit(ids);
  }

  revert(ids?: RecordIdentifying) {
    this.underlyingTable.revert(ids);
  }
}
