import { Row, RowIdentififying, RowInsertionList } from './util';
import { Table, ObjectChanges } from './table';
import { DBDispatch } from './actions';

export class MutableTable<T extends Row> {
  public underlyingTable: Table<T>;
  private dispatch: DBDispatch;

  constructor(table: Table<T>, dispatch: DBDispatch) {
    this.underlyingTable = table;
    this.dispatch = dispatch;
  }

  public find(id: string): T | undefined {
    return this.underlyingTable.find(id);
  }

  public get all(): T[] {
    return this.underlyingTable.all;
  }

  public get first(): T | undefined {
    return this.underlyingTable.first;
  }

  public get last(): T | undefined {
    return this.underlyingTable.last;
  }

  public get changes(): Array<ObjectChanges<T>> {
    return this.underlyingTable.changes;
  }

  public get ids(): string[] {
    return this.underlyingTable.ids;
  }

  public get length(): number {
    return this.ids.length;
  }

  public changesFor(id: string): ObjectChanges<T> | undefined {
    return this.underlyingTable.changesFor(id);
  }

  public where(query: ((value: T) => boolean) | Partial<T>): T[] {
    return this.underlyingTable.where(query);
  }

  public insert(records: RowInsertionList<T>): void {
    this.dispatch(this.underlyingTable.insert(records));
  }

  public upsert(records: RowInsertionList<T>): void {
    this.dispatch(this.underlyingTable.upsert(records));
  }

  public update(id: RowIdentififying, values: Partial<T>): void {
    this.dispatch(this.underlyingTable.update(id, values));
  }

  public delete(id: RowIdentififying): void {
    this.dispatch(this.underlyingTable.delete(id));
  }

  public commit(ids?: RowIdentififying): void {
    this.dispatch(this.underlyingTable.commit(ids));
  }

  public revert(ids?: RowIdentififying): void {
    this.dispatch(this.underlyingTable.revert(ids));
  }

  public truncate(): void {
    this.dispatch(this.underlyingTable.truncate());
  }
}
