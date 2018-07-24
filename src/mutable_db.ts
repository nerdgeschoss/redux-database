import { MutableTable } from './mutable_table';
import { DBDispatch, DBAction } from './actions';
import { TypeLookup, State } from './db';
import { reducer, DB } from '.';

interface Store<
  Data,
  Setting,
  Types extends TypeLookup,
  S extends State<Data, Setting, Types>
> {
  subscribe: (callback: () => void) => void;
  getState: () => S;
  dispatch: (action: any) => void;
}

export class MutableDB<
  Data,
  Setting,
  Types extends TypeLookup,
  S extends State<Data, Setting, Types>
> {
  private state: S;
  private currentContext?: string;
  private reducer = reducer(this.state);
  private store?: Store<Data, Setting, Types, S>;
  private subscribers: (() => void)[] = [];
  private cachedTables: { [key: string]: MutableTable<any> } = {};

  private get readDB(): DB<Data, Setting, Types, S> {
    return new DB(this.state, { context: this.currentContext });
  }

  constructor(
    state: S,
    options: { context?: string; store?: Store<Data, Setting, Types, S> } = {}
  ) {
    this.state = state;
    this.currentContext = options.context;
    this.store = options.store;
    if (options.store) {
      options.store.subscribe(() => {
        this.readState(this.store!.getState());
      });
    }
  }

  get<K extends Extract<keyof S['settings'], string>>(
    name: K
  ): S['settings'][K] {
    return this.readDB.get(name);
  }

  set<
    K extends Extract<keyof S['settings'], string>,
    U extends S['settings'][K]
  >(name: K, value: U) {
    this.dispatch(this.readDB.set(name, value));
  }

  table<K extends Extract<keyof S['types'], string>>(
    type: K
  ): MutableTable<S['types'][K]> {
    if (this.cachedTables[type]) {
      return this.cachedTables[type];
    } else {
      this.cachedTables[type] = new MutableTable(this.readDB.table(type), this);
    }
    return this.cachedTables[type];
  }

  context(context: string): MutableDB<Data, Setting, Types, S> {
    return new MutableDB(this.state, { context, store: this.store });
  }

  transaction(execute: (dispatch: DBDispatch) => void) {
    this.dispatch(this.readDB.transaction(execute));
  }

  commit() {
    this.dispatch(this.readDB.commit());
  }

  subscribe(callback: () => void) {
    this.subscribers.push(callback);
  }

  dispatch(action: DBAction) {
    if (this.store) {
      this.store.dispatch(action);
    } else {
      this.readState(this.reducer(this.state, action));
    }
  }

  private readState(state: S) {
    this.state = state;
    Object.keys(this.cachedTables).forEach(type => {
      const table = this.cachedTables[type];
      if (!table) {
        return;
      }
      table.underlyingTable['data'] = state.data[type];
    });
    this.subscribers.forEach(e => e());
  }
}
