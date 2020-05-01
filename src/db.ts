import {
  Record,
  extractParentContext,
  RecordIdentifying,
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
} from './actions';
import { Query } from './query';

export interface Data {
  [key: string]: DataTable<Record>;
}

export interface StateDefining {
  settings: { [key: string]: unknown };
  data: Data;
}

export interface ContextState {
  _context?: { [context: string]: { [table: string]: ContextChanges<Record> } };
}

export class DB<State extends StateDefining> {
  private state: State;
  private currentContext?: string;

  constructor(state: State, options: { context?: string } = {}) {
    this.state = state;
    this.currentContext = options.context;
  }

  public get<K extends Extract<keyof State['settings'], string>>(
    name: K
  ): State['settings'][K] {
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

  public set<
    K extends Extract<keyof State['settings'], string>,
    U extends State['settings'][K]
  >(name: K, value: U): SettingsUpdateAction {
    return {
      type: 'SETTINGS_UPDATE',
      payload: {
        context: this.currentContext,
        key: name,
        setting: value,
      },
    };
  }

  public table<K extends Extract<keyof State['data'], string>>(
    type: K
  ): Table<State['data'][K]['byId']['someKey']> {
    const contextChanges = this.currentContext
      ? this.changeSetsOfContext(type, this.currentContext)
      : undefined;

    return new Table(this.state.data[type], type, {
      context: this.currentContext,
      contextChanges,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
  }

  public query<Key extends Extract<keyof State['data'], string>>(
    type: Key
  ): Query<
    State,
    Key,
    State['data'][Key]['byId']['someKey'],
    State['data'][Key]['byId']['someKey']
  > {
    return new Query(this, this.table(type));
  }

  public context(context: string): DB<State> {
    const { currentContext } = this;
    if (currentContext) {
      context = currentContext + '.' + context;
    }
    return new DB(this.state, { context });
  }

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

  public commit<K extends Extract<keyof State['data'], string>>(
    table?: K,
    ids?: RecordIdentifying
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

  public revert<K extends Extract<keyof State['data'], string>>(
    table?: K,
    ids?: RecordIdentifying
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

  private changeSetsOfContext(
    table: string,
    context?: string
  ): Array<ContextChanges<Record>> {
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
