import {
  Row,
  extractParentContext,
  RowIdentififying,
  extractIds,
} from './util';
import { Table, DataTable, ContextChanges } from './table';
import {
  SettingsUpdateAction,
  TransactionAction,
  CommitContextAction,
  DBDispatch,
  DBAction,
  RevertContextAction,
  TruncateAction,
  ResetAction,
} from './actions';
import { Query } from './query';

export interface Data {
  [key: string]: DataTable<Row>;
}

export interface StateDefining {
  settings: { [key: string]: unknown };
  data: Data;
}

export interface ContextState {
  _context?: { [context: string]: { [table: string]: ContextChanges<Row> } };
}

export type RowKeyOf<T extends StateDefining> = Extract<
  keyof T['data'],
  string
>;

export type RowType<
  State extends StateDefining,
  Key extends RowKeyOf<State>
> = State['data'][Key]['byId']['someKey'];

export type SettingsKey<T extends StateDefining> = Extract<
  keyof T['settings'],
  string
>;

export type SettingsType<
  State extends StateDefining,
  Key extends SettingsKey<State>
> = State['settings'][Key];

/**
 * `DB` is a snapshot of your current database state. It helps you reading data via [[`get`]], [[`table`]] and [[`query`]].
 *
 * ```ts
 * const db = new DB(state);
 *
 * db.get('enableAwesomeThing'); // true
 *
 * const things = db.table('things'); // if things is not defined, you would get an error here
 * things.all; // returns Thing[]
 * things.find('12'); // find by id
 * things.where({ name: 'tool' }); // simple equality based where queries
 * things.where(thing => thing.name.length == 4); // function based where queries
 * ```
 *
 * @typeParam State The state type of your database schema.
 *
 */
export class DB<State extends StateDefining> {
  private state: State;
  private currentContext?: string;

  /**
   * Create a snapshot from the given state. Can either be used in conjunction with redux or implicitly
   * by calling `mutableDB.snapshot`.
   */
  constructor(state: State, options: { context?: string } = {}) {
    this.state = state;
    this.currentContext = options.context;
  }

  /**
   * Get the value from the key-value store.
   *
   * @param name A key of your key-value schema
   * @returns the value of the supplied key, `undefined` if no value is set yet
   * @category Key-Value Storage
   */
  public get<K extends SettingsKey<State>>(name: K): SettingsType<State, K> {
    const anyState = this.state as ContextState;
    if (
      this.currentContext &&
      anyState._context &&
      anyState._context[this.currentContext] &&
      anyState._context[this.currentContext][name]
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return anyState._context[this.currentContext][name] as any;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.state.settings[name] as any;
  }

  /**
   * Set a value in your key-value storage. This action does not mutate your state but returns an action
   * to be dispatched.
   *
   * @param name The key to update.
   * @param value The value to set for this key.
   * @returns {SettingsUpdateAction} Send this value to your dispatch function.
   * @category Key-Value Storage
   */
  public set<K extends SettingsKey<State>, U extends SettingsType<State, K>>(
    name: K,
    value: U
  ): SettingsUpdateAction {
    return {
      type: 'SETTINGS_UPDATE',
      payload: {
        context: this.currentContext,
        key: name,
        setting: value,
      },
    };
  }

  /**
   * Retrieve an immutable table by name. If you plan to compose a complex query, use [[`query`]] instead.
   *
   * ```ts
   * const things = db.table('things');
   * things.first
   * ```
   *
   * @param {K} type The name of the table to retrieve
   * @returns {Table<RowType<State, K>>} An immutable [[`Table`]] instance.
   * @category Table Storage
   */
  public table<K extends RowKeyOf<State>>(type: K): Table<RowType<State, K>> {
    const contextChanges = this.currentContext
      ? this.changeSetsOfContext(type, this.currentContext)
      : undefined;

    return new Table(this.state.data[type], type, {
      context: this.currentContext,
      contextChanges,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
  }

  /**
   * Start a composable query. Queries allow chaining together different queries, joins and transformations.
   *
   * ```ts
   * const things = db.query('things').where({name: 'tool'}).embed('user', 'users', 'userId).order({name: 'desc'}).all;
   * ```
   *
   * @param {Key} type Name of the table to start the query on.
   * @returns {Query<State, Key, RowType<State, Key>>}
   * @category Table Storage
   */
  public query<Key extends RowKeyOf<State>>(
    type: Key
  ): Query<State, Key, RowType<State, Key>> {
    return new Query(this, this.table(type));
  }

  /**
   * Access a named context.
   *
   * ```ts
   * const draftDB = db.context('draft');
   * store.dispatch(draftDB.table('things').update('1', { name: 'Updated Thing' }));
   * // retrieve your state again from the store
   * db.table('things').first.name; // this is still 'First Thing'
   * draftDB.table('things').first.name; // this is updated to 'Updated Thing'
   * ```
   *
   * @param {string} context
   * @returns {DB<State>}
   * @category Context
   */
  public context(context: string): DB<State> {
    const { currentContext } = this;
    if (currentContext) {
      context = currentContext + '.' + context;
    }
    return new DB(this.state, { context });
  }

  /**
   * Start a transaction to group updates. This is mostly used to prevent rerenders if you're planning
   * to update multiple values and tables.
   *
   * ```ts
   * store.dispatch(
   *   db.transaction(dispatch => {
   *     dispatch(things.insert({ name: 'First Thing' }));
   *     dispatch(things.insert({ name: 'Second Thing' }));
   *   })
   * );
   * ```
   *
   * @param {(dispatch: DBDispatch) => void} execute Your execution function
   * @returns {TransactionAction} The action that you should send to your reducer.
   * @category Transactions
   */
  public transaction(
    execute: (dispatch: DBDispatch) => void
  ): TransactionAction {
    const actions: DBAction[] = [];
    execute((action) => actions.push(action));
    return {
      type: 'TRANSACTION',
      payload: {
        actions,
      },
    };
  }

  /**
   * Commit changes in a context to its parent. You can either commit individual ids, full tables
   * or the whole context.
   *
   * @param {K} [table] required if row-ids are given
   * @param {RowIdentififying} [ids]
   * @returns {CommitContextAction}
   * @category Context
   */
  public commit<K extends RowKeyOf<State>>(
    table?: K,
    ids?: RowIdentififying
  ): CommitContextAction {
    const { currentContext } = this;
    if (!currentContext) {
      throw new Error('Called commit on a root context.');
    }
    return {
      type: 'COMMIT_CONTEXT',
      payload: {
        context: currentContext,
        table,
        ids: ids ? extractIds(ids) : undefined,
      },
    };
  }

  /**
   * Revert changes in a context. You can either revert individual ids, full tables
   * or the whole context.
   *
   * @param {K} [table] required if ids are given
   * @param {RowIdentififying} [ids]
   * @returns {RevertContextAction}
   * @category Context
   */
  public revert<K extends RowKeyOf<State>>(
    table?: K,
    ids?: RowIdentififying
  ): RevertContextAction {
    const { currentContext } = this;
    if (!currentContext) {
      throw new Error('Called commit on a root context.');
    }
    return {
      type: 'REVERT_CONTEXT',
      payload: {
        context: currentContext,
        table,
        ids: ids ? extractIds(ids) : undefined,
      },
    };
  }

  /**
   * Truncates all tables. After this action, all tables are empty. This will not change settings.
   * If you would like to reset settings instead, use [[reset]].
   *
   * @category Reset
   */
  public truncate(): TruncateAction {
    return {
      type: 'TRUNCATE',
      payload: {
        type: 'database',
      },
    };
  }

  /**
   * Resets the given type back to the initial state. If you want to have empty tables, use
   * [[truncate]] instead.
   *
   * - `all`: Reset settings and tables back to initial state.
   * - `tables`: Reset tables, but keeps current settings.
   * - `settings`: Reset settings, but keeps all tables.
   *
   * @category Reset
   */
  public reset(type: 'all' | 'tables' | 'settings' = 'all'): ResetAction {
    return {
      type: 'RESET',
      payload: {
        type: type,
      },
    };
  }

  private changeSetsOfContext(
    table: string,
    context?: string
  ): Array<ContextChanges<Row>> {
    const anyState = this.state as ContextState;
    if (!context) {
      return [];
    }
    if (
      !anyState._context ||
      !anyState._context[context] ||
      !anyState._context[context][table]
    ) {
      return this.changeSetsOfContext(table, extractParentContext(context));
    }
    return [
      ...this.changeSetsOfContext(table, extractParentContext(context)),
      anyState._context[context][table],
    ];
  }
}
