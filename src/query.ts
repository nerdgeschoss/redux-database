import { DB, RowKeyOf, RowType } from './db';
import { StateDefining } from './db';
import { Table } from './table';
import {
  Row,
  formatResultToTableData,
  SortDescriptor,
  order,
  pick,
  compact,
} from './util';

export class Query<
  State extends StateDefining,
  TableKey extends RowKeyOf<State>,
  T extends Row
> {
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

  public find(id: string): T | undefined {
    return this.table.find(id);
  }

  public get all(): T[] {
    return this.table.all;
  }

  public get length(): number {
    return this.table.ids.length;
  }

  public select<K extends keyof T>(
    ...fields: K[]
  ): Query<State, TableKey, Pick<T, K> & Row> {
    const results = this.all.map((object) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      return pick(object, 'id', ...fields);
    });
    return this.queryFromResults(results);
  }

  public where(
    query: ((value: T) => boolean) | Partial<T>
  ): Query<State, TableKey, T> {
    const results = this.table.where(query);
    return this.queryFromResults(results);
  }

  public limit(amount: number): Query<State, TableKey, T> {
    const results = this.all.slice(0, amount);
    return this.queryFromResults(results);
  }

  public offset(amount: number): Query<State, TableKey, T> {
    const results = this.all.slice(amount);
    return this.queryFromResults(results);
  }

  public orderBy(sortDescriptor: SortDescriptor<T>): Query<State, TableKey, T> {
    const results = order(this.table.all, sortDescriptor);
    return this.queryFromResults(results);
  }

  public embed<
    Key extends string,
    SecondaryTable extends RowKeyOf<State>,
    JoinKey extends keyof T,
    Embed = RowType<State, SecondaryTable>
  >(
    key: Key,
    table: SecondaryTable,
    source: JoinKey
  ): Query<
    State,
    TableKey,
    T & Record<Key, undefined extends T[JoinKey] ? Embed | undefined : Embed>
  > {
    const results = this.all.map((e) => {
      const embed = e[source]
        ? this.db.table(table).find((e[source] as unknown) as string)
        : undefined;
      return {
        ...e,
        [key]: embed,
      };
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.queryFromResults(results as any);
  }

  public embedMulti<
    Key extends string,
    SecondaryTable extends RowKeyOf<State>,
    JoinKey extends keyof T,
    Embed = RowType<State, SecondaryTable>
  >(
    key: Key,
    table: SecondaryTable,
    source: JoinKey
  ): Query<State, TableKey, T & Record<Key, Embed[]>> {
    const results = this.all.map((e) => {
      const ids = (e[source] || []) as string[];
      const embed = compact(ids.map((id) => this.db.table(table).find(id)));
      return {
        ...e,
        [key]: embed,
      };
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.queryFromResults(results as any);
  }

  private queryFromResults<ResultType extends Row>(
    results: ResultType[]
  ): Query<State, TableKey, ResultType> {
    const table = new Table<ResultType>(
      formatResultToTableData(results),
      this.table.name
    );
    return new Query(this.db, table);
  }
}
