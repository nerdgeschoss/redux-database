import { Record } from './util';
import { Table } from './table';
import {
  SettingsUpdateAction,
  TransactionAction,
  CommitContextAction,
  DBDispatch,
  DBAction,
} from './actions';

export interface TypeLookup {
  [key: string]: Record;
}

export interface State<Setting, Data, Types extends TypeLookup> {
  settings: Setting;
  data: Data;
  types: Types;
}

export class DB<
  Data,
  Setting,
  Types extends TypeLookup,
  S extends State<Data, Setting, Types>
> {
  private state: S;
  private currentContext?: string;

  constructor(state: S, options: { context?: string } = {}) {
    this.state = state;
    this.currentContext = options.context;
  }

  get<K extends Extract<keyof S['settings'], string>>(
    name: K
  ): S['settings'][K] {
    const _state = this.state as any;
    if (
      this.currentContext &&
      _state._context &&
      _state._context[this.currentContext] &&
      _state._context[this.currentContext] &&
      _state._context[this.currentContext][name]
    ) {
      return _state._context[this.currentContext][name];
    }
    return this.state.settings[name];
  }

  set<
    K extends Extract<keyof S['settings'], string>,
    U extends S['settings'][K]
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

  table<K extends Extract<keyof S['types'], string>>(
    type: K
  ): Table<S['types'][K]> {
    const _state = this.state as any;
    const contextChanges =
      this.currentContext &&
      _state._context &&
      _state._context[this.currentContext] &&
      _state._context[this.currentContext][type];
    return new Table(_state.data[type], type, {
      context: this.currentContext,
      contextChanges,
    });
  }

  context(context: string): DB<Data, Setting, Types, S> {
    return new DB(this.state, { context });
  }

  transaction(execute: (dispatch: DBDispatch) => void): TransactionAction {
    const actions: DBAction[] = [];
    execute(action => actions.push(action));
    return {
      type: 'TRANSACTION',
      payload: {
        actions,
      },
    };
  }

  commit(): CommitContextAction {
    const { currentContext } = this;
    if (!currentContext) {
      throw 'Called commit on a root context.';
    }
    return {
      type: 'COMMIT_CONTEXT',
      payload: { context: currentContext },
    };
  }
}
