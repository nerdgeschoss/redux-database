import { DB } from './db';
import { StateDefining } from './db';
import { Table, DataTable } from './table';
import {
  Record,
  formatResultToTableData,
  orderBy,
  SortDescriptor,
  order,
  pick,
} from './util';

export class Query<
  State extends StateDefining,
  TableKey extends Extract<keyof State['data'], string>,
  OriginalRowType extends State['data'][TableKey]['byId']['someKey'],
  T extends Record
> {
  // @ts-ignore
  private readonly db: DB<State>;
  private readonly table: Table<T>;
  constructor(db: DB<State>, table: Table<T>) {
    this.db = db;
    this.table = table;
  }

  public get first(): T | undefined {
    return this.table.first;
  }

  public get last(): T | undefined {
    return this.table.last;
  }

  public get all(): T[] {
    return this.table.all;
  }

  public select<K extends keyof T>(
    ...fields: K[]
  ): Query<State, TableKey, OriginalRowType, Pick<T, K> & Record> {
    const results = this.all.map((object) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      return pick(object, 'id', ...fields);
    });
    return this.queryFromResults(results);
  }

  public where(
    query: ((value: T) => boolean) | Partial<T>
  ): Query<State, TableKey, OriginalRowType, T> {
    const results = this.table.where(query);
    return this.queryFromResults(results);
  }

  public orderBy(
    sortDescriptor: SortDescriptor<T>
  ): Query<State, TableKey, OriginalRowType, T> {
    const results = order(this.table.all, sortDescriptor);
    return this.queryFromResults(results);
  }

  // owner', 'users', 'ownerId'
  public embed<
    Key extends string,
    SecondaryTable extends Extract<keyof State['data'], string>,
    JoinKey extends keyof T
  >(
    key: Key,
    table: SecondaryTable,
    source: JoinKey
  ): Query<
    State,
    TableKey,
    OriginalRowType,
    T & { [Key]: State['data'][SecondaryTable]['byId']['any'] }
  > {
    const results = this.all.map((e) => ({
      ...e,
      [key]: this.db.table(table).find((e[source] as unknown) as string),
    }));
    return this.queryFromResults(results);
  }

  private queryFromResults<ResultType extends Record>(
    results: ResultType[]
  ): Query<State, TableKey, OriginalRowType, ResultType> {
    const table = new Table<ResultType>(
      formatResultToTableData(results),
      this.table.name
    );
    return new Query(this.db, table);
  }
}
