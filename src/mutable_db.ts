import { MutableTable } from './mutable_table';
import type { DBDispatch, DBAction } from './actions';
import { DB } from './db';
import type { StateDefining } from './db';
import type { RowIdentififying } from './util';
import { reducer as defaultReducer } from './reducer';
import type { Row } from './util';

interface Store<State extends StateDefining> {
  subscribe: (callback: () => void) => void;
  getState: () => State;
  dispatch: (action: DBAction) => void;
}

export class MutableDB<State extends StateDefining> {
  private state: State;
  private currentContext?: string;
  private reducer: (state: State, action: DBAction) => State;
  private store?: Store<State>;
  private subscribers: Array<() => void>;
  private cachedTables: { [key: string]: MutableTable<Row> };
  private get readDB(): DB<State> {
    return new DB(this.state, { context: this.currentContext });
  }
  constructor(
    state: State,
    options: { context?: string; store?: Store<State> } = {}
  ) {
    this.state = state;
    this.currentContext = options.context;
    this.store = options.store;
    this.reducer = defaultReducer(this.state);
    this.subscribers = [];
    this.cachedTables = {};
    if (options.store) {
      options.store.subscribe(() => {
        this.readState(this.store!.getState());
      });
    }
  }

  public get<K extends Extract<keyof State['settings'], string>>(
    name: K
  ): State['settings'][K] {
    return this.readDB.get(name);
  }

  public set<
    K extends Extract<keyof State['settings'], string>,
    U extends State['settings'][K]
  >(name: K, value: U): void {
    this.dispatch(this.readDB.set(name, value));
  }

  public table<K extends Extract<keyof State['data'], string>>(
    type: K
  ): MutableTable<State['data'][K]['byId']['anyKey']> {
    if (this.cachedTables[type]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return this.cachedTables[type] as any;
    } else {
      this.cachedTables[type] = new MutableTable(
        this.readDB.table(type),
        this.dispatch.bind(this)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ) as any;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.cachedTables[type] as any;
  }

  public context(context: string): MutableDB<State> {
    return new MutableDB(this.state, { context, store: this.store });
  }

  public transaction(
    execute: (db: DB<State>, dispatch: DBDispatch) => void
  ): void {
    this.dispatch(
      this.readDB.transaction((dispatch) => execute(this.readDB, dispatch))
    );
  }

  public commit<K extends Extract<keyof State['data'], string>>(
    table?: K,
    ids?: RowIdentififying
  ): void {
    this.dispatch(this.readDB.commit(table, ids));
  }

  public revert<K extends Extract<keyof State['data'], string>>(
    table?: K,
    ids?: RowIdentififying
  ): void {
    this.dispatch(this.readDB.revert(table, ids));
  }

  public subscribe(callback: () => void): void {
    this.subscribers.push(callback);
  }

  private dispatch(action: DBAction): void {
    if (this.store) {
      this.store.dispatch(action);
    } else {
      this.readState(this.reducer(this.state, action));
    }
  }

  private readState(state: State): void {
    this.state = state;
    Object.keys(this.cachedTables).forEach((type) => {
      const table = this.cachedTables[type];
      if (!table) {
        return;
      }
      table.underlyingTable['data'] = state.data[type];
      table.underlyingTable['contextChanges'] = this.readDB.table(
        type as Extract<keyof State['data'], string>
      )['contextChanges'];
    });
    this.subscribers.forEach((e) => e());
  }
}
