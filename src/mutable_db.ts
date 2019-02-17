import { MutableTable } from './mutable_table';
import { DBDispatch, DBAction } from './actions';
import { State } from './db';
import { reducer, DB } from '.';
import { RecordIdentifying } from './util';

interface Store<Setting, S extends State<Setting>> {
  subscribe: (callback: () => void) => void;
  getState: () => S;
  dispatch: (action: any) => void;
}

export class MutableDB<Setting, S extends State<Setting>> {
  private state: S;
  private currentContext?: string;
  private reducer = reducer(this.state);
  private store?: Store<Setting, S>;
  private subscribers: (() => void)[] = [];
  private cachedTables: { [key: string]: MutableTable<any> } = {};

  private get readDB(): DB<Setting, S> {
    return new DB(this.state, { context: this.currentContext });
  }

  constructor(
    state: S,
    options: { context?: string; store?: Store<Setting, S> } = {}
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

  table<K extends Extract<keyof S['data'], string>>(
    type: K
  ): MutableTable<S['data'][K]['byId']['anyKey']> {
    if (this.cachedTables[type]) {
      return this.cachedTables[type];
    } else {
      this.cachedTables[type] = new MutableTable(
        this.readDB.table(type),
        this,
        this.dispatch.bind(this)
      );
    }
    return this.cachedTables[type];
  }

  context(context: string): MutableDB<Setting, S> {
    return new MutableDB(this.state, { context, store: this.store });
  }

  transaction(execute: (db: DB<Setting, S>, dispatch: DBDispatch) => void) {
    this.dispatch(
      this.readDB.transaction(dispatch => execute(this.readDB, dispatch))
    );
  }

  commit<K extends Extract<keyof S['data'], string>>(
    table?: K,
    ids?: RecordIdentifying
  ) {
    this.dispatch(this.readDB.commit(table, ids));
  }

  revert<K extends Extract<keyof S['data'], string>>(
    table?: K,
    ids?: RecordIdentifying
  ) {
    this.dispatch(this.readDB.revert(table, ids));
  }

  subscribe(callback: () => void) {
    this.subscribers.push(callback);
  }

  private dispatch(action: DBAction) {
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
      table.underlyingTable['contextChanges'] = this.readDB.table(type as any)[
        'contextChanges'
      ];
    });
    this.subscribers.forEach(e => e());
  }
}
