export function guid(): string {
  function s4(): string {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return [s4() + s4(), s4(), s4(), s4(), s4() + s4() + s4()].join("-");
}

type Diff<T extends string, U extends string> = ({ [P in T]: P } &
  { [P in U]: never } & { [x: string]: never })[T];

type Omit<T, K extends keyof T> = Pick<T, Diff<keyof T, K>>;

export interface Record {
  id: string;
}

export type RecordIdentifying = string | string[] | Record | Record[];

export interface DataTable<T> {
  byId: { [id: string]: T };
  ids: string[];
}

export interface UpdateAction {
  type: "UPDATE_RECORD";
  payload: {
    ids: string[];
    key: string;
    context?: string;
    data: Partial<Record>;
  };
}

export interface InsertAction {
  type: "INSERT_RECORD";
  payload: {
    ids: string[];
    key: string;
    context?: string;
    data: Record[];
  };
}

export interface DeleteAction {
  type: "DELETE_RECORD";
  payload: {
    key: string;
    context?: string;
    ids: string[];
  };
}

export interface SettingsUpdateAction {
  type: "SETTINGS_UPDATE";
  payload: {
    key: string;
    context?: string;
    setting: any;
  };
}

export interface CommitContextAction {
  type: "COMMIT_CONTEXT";
  payload: {
    context: string;
  };
}

export interface TransactionAction {
  type: "TRANSACTION";
  payload: {
    actions: DBAction[];
  };
}

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

  get<K extends keyof S["settings"]>(name: K): S["settings"][K] {
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

  set<K extends keyof S["settings"], U extends S["settings"][K]>(
    name: K,
    value: U
  ): SettingsUpdateAction {
    return {
      type: "SETTINGS_UPDATE",
      payload: {
        context: this.currentContext,
        key: name,
        setting: value
      }
    };
  }

  table<K extends keyof S["types"]>(type: K): Table<S["types"][K]> {
    const _state = this.state as any;
    const contextChanges =
      this.currentContext &&
      _state._context &&
      _state._context[this.currentContext] &&
      _state._context[this.currentContext][type];
    return new Table(_state.data[type], type, {
      context: this.currentContext,
      contextChanges
    });
  }

  context(context: string): DB<Data, Setting, Types, S> {
    return new DB(this.state, { context });
  }

  transaction(execute: (dispatch: DBDispatch) => void): TransactionAction {
    const actions: DBAction[] = [];
    execute(action => actions.push(action));
    return {
      type: "TRANSACTION",
      payload: {
        actions
      }
    };
  }

  commit(): CommitContextAction {
    const { currentContext } = this;
    if (!currentContext) {
      throw "Called commit on a root context.";
    }
    return {
      type: "COMMIT_CONTEXT",
      payload: { context: currentContext }
    };
  }
}

export type OptionalID = { id?: string } & { [key: string]: any };

export interface ContextChanges<T> {
  byId: { [id: string]: Partial<T> };
  deletedIds: string[];
  newIds: string[];
}

export class Table<T extends Record> {
  private data: DataTable<T>;
  private key: string;
  private context?: string;
  private contextChanges?: ContextChanges<T>;

  constructor(
    data: DataTable<T>,
    key: string,
    options: { context?: string; contextChanges?: ContextChanges<T> } = {}
  ) {
    this.data = data;
    this.key = key;
    this.context = options.context;
    this.contextChanges = options.contextChanges;
  }

  find(id: string): T | undefined {
    if (this.contextChanges && this.contextChanges.deletedIds.includes(id)) {
      return undefined;
    }
    const changes = (this.contextChanges && this.contextChanges.byId[id]) || {};
    const object = this.data.byId[id];
    return Object.assign({}, object, changes);
  }

  get all(): T[] {
    return this.ids.map(id => this.find(id)!);
  }

  get first(): T | undefined {
    return this.find(this.ids[0]);
  }

  get last(): T | undefined {
    return this.find(this.ids[this.ids.length - 1]);
  }

  where(query: ((value: T) => boolean) | Partial<T>): T[] {
    if (typeof query === "function") {
      return this.all.filter(query);
    } else {
      return this.all.filter(e => {
        for (const key of Object.keys(query)) {
          if (e[key] != query[key]) {
            return false;
          }
        }
        return true;
      });
    }
  }

  insert(records: OptionalID | OptionalID[]): InsertAction {
    const newRecords: OptionalID[] =
      records instanceof Array ? records : [records];
    const insertedRecords: T[] = newRecords.map(e => this.applyId(e));
    return {
      type: "INSERT_RECORD",
      payload: {
        key: this.key,
        context: this.context,
        ids: insertedRecords.map(e => e.id),
        data: insertedRecords
      }
    };
  }

  update(id: RecordIdentifying, values: Partial<T>): UpdateAction {
    return {
      type: "UPDATE_RECORD",
      payload: {
        key: this.key,
        context: this.context,
        ids: this.extractIds(id),
        data: values
      }
    };
  }

  delete(id: RecordIdentifying): DeleteAction {
    return {
      type: "DELETE_RECORD",
      payload: {
        key: this.key,
        context: this.context,
        ids: this.extractIds(id)
      }
    };
  }

  private get ids(): string[] {
    const newIds = (this.contextChanges || { newIds: [] }).newIds as string[];
    const deletedIds = (this.contextChanges || { deletedIds: [] })
      .deletedIds as string[];
    return this.data.ids.concat(newIds).filter(id => !deletedIds.includes(id));
  }

  private extractIds(object: RecordIdentifying): string[] {
    if (object === undefined) {
      throw "Trying to insert/update record which was not saved before";
    }
    let test: (string | Record)[];
    if (!(object instanceof Array)) {
      test = [object];
    } else {
      test = object;
    }
    return test.map(e => e["id"] || e);
  }

  private applyId(record: OptionalID): T {
    const copy = Object.assign({} as T, record);
    if (!copy.id) {
      copy.id = guid();
    }
    return copy;
  }
}

export type DBAction =
  | UpdateAction
  | DeleteAction
  | InsertAction
  | SettingsUpdateAction
  | TransactionAction
  | CommitContextAction;

export type DBDispatch = (action: DBAction) => void;

function byId(records: Record[]): { [id: string]: Record } {
  const map = {};
  records.forEach(e => (map[e.id] = e));
  return map;
}

function except(object: { [key: string]: any }, keys: string[]) {
  const newObject = {};
  Object.keys(object).forEach(key => {
    if (!keys.includes(key)) {
      newObject[key] = object[key];
    }
  });
  return newObject;
}

function applyInContext<S, T>(
  state: S,
  context: string,
  field: string,
  handler: (changes: ContextChanges<T>) => ContextChanges<T>
): S {
  const _context = (state as any)._context || {};
  let changes: ContextChanges<any> = (_context[context] &&
    _context[context][field]) || { byId: {}, deletedIds: [], newIds: [] };
  changes = handler(changes);
  const currentContext = _context[context] || {};
  return {
    ...(state as any),
    _context: {
      ..._context,
      [context]: {
        ...currentContext,
        [field]: { ...currentContext[field], ...changes }
      }
    }
  };
}

export function reduce<
  Setting,
  Data,
  Types extends TypeLookup,
  S extends State<Data, Setting, Types>
>(state: S, action: DBAction): S {
  switch (action.type) {
    case "INSERT_RECORD": {
      const key = action.payload.key;
      const newIDs = action.payload.ids.filter(
        id => !state.data[key].ids.includes(id)
      );
      if (action.payload.context) {
        state = applyInContext(state, action.payload.context, key, changes => {
          return {
            ...changes,
            newIds: [...changes.newIds, ...newIDs],
            byId: { ...changes.byId, ...byId(action.payload.data) }
          };
        });
      } else {
        const dataSet = {
          ...state.data[key],
          byId: { ...state.data[key].byId, ...byId(action.payload.data) },
          ids: [...state.data[key].ids, ...newIDs]
        };
        state = {
          ...(state as any),
          data: { ...(state.data as any), [key]: dataSet }
        };
      }
      break;
    }
    case "DELETE_RECORD": {
      const key = action.payload.key;
      const ids = action.payload.ids;
      if (action.payload.context) {
        state = applyInContext(state, action.payload.context, key, changes => {
          return {
            ...changes,
            deletedIds: [...changes.deletedIds, ...ids]
          };
        });
      } else {
        const dataSet = {
          ...state.data[key],
          byId: except(state.data[key].byId, ids),
          ids: state.data[key].ids.filter((e: string) => !ids.includes(e))
        };
        state = {
          ...(state as any),
          data: { ...(state.data as any), [key]: dataSet }
        };
      }
      break;
    }
    case "UPDATE_RECORD": {
      const key = action.payload.key;
      if (action.payload.context) {
        state = applyInContext(state, action.payload.context, key, changes => {
          const updates: { [id: string]: Partial<Record> } = {};
          action.payload.ids.forEach(
            e => (updates[e] = { ...changes.byId[e], ...action.payload.data })
          );
          return {
            ...changes,
            byId: { ...changes.byId, ...updates }
          };
        });
      } else {
        const updates: { [id: string]: Record } = {};
        action.payload.ids.forEach(
          e =>
            (updates[e] = {
              ...state.data[key].byId[e],
              ...action.payload.data
            })
        );
        const dataSet = {
          ...state.data[key],
          byId: { ...state.data[key].byId, ...updates }
        };
        state = {
          ...(state as any),
          data: { ...(state.data as any), [key]: dataSet }
        };
      }
      break;
    }
    case "SETTINGS_UPDATE": {
      const key = action.payload.key;
      if (action.payload.context) {
        const _state = state as any;
        const _context = _state._context || {};
        const currentContext = _context[action.payload.context] || {};
        state = {
          ..._state,
          _context: { ..._context, [action.payload.context]: currentContext }
        };
      } else {
        state = {
          ...(state as any),
          settings: {
            ...(state.settings as any),
            [key]: action.payload.setting
          }
        };
      }
      break;
    }
    case "COMMIT_CONTEXT": {
      const _state = state as any;
      const context = action.payload.context;
      const changes = (_state._context && _state._context[context]) || {};
      state = {
        ..._state,
        data: { ..._state.data }, // create a new object so it's ok to modify it later
        _context: except(_state._context, [context])
      };
      Object.keys(changes).forEach(table => {
        const change: ContextChanges<Record> = changes[table];
        const data = state.data[table] as DataTable<Record>;
        state.data[table] = {
          ids: data.ids
            .concat(change.newIds)
            .filter(id => !change.deletedIds.includes(id)),
          byId: { ...data.byId }
        };
        Object.keys(change.byId).forEach(id => {
          state.data[table].byId[id] = {
            ...state.data[table].byId[id],
            ...change.byId[id]
          };
        });
      });
      break;
    }
    case "TRANSACTION": {
      action.payload.actions.forEach(a => {
        state = reduce(state, a);
      });
      break;
    }
  }
  return state;
}

export function reducer<
  Setting,
  Data,
  Types extends TypeLookup,
  S extends State<Data, Setting, Types>
>(initialState: S): (state: S, action: DBAction) => S {
  return (state, action) => {
    if (!state) {
      state = initialState;
    }
    return reduce(state, action);
  };
}
