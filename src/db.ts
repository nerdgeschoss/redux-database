export function guid(): string {
  function s4(): string {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }
  return [s4() + s4(), s4(), s4(), s4(), s4() + s4() + s4()].join('-');
}

type Diff<T extends string, U extends string> = (
  & { [P in T]: P }
  & { [P in U]: never }
  & { [x: string]: never }
)[T];

type Omit<T, K extends keyof T> = Pick<T, Diff<keyof T, K>>;

export interface Record {
  id: string
}

export type RecordIdentifying = string | string[] | Record | Record[];

export interface DataTable<T> {
  byId: {[id: string]: T}
  ids: string[]
}

export interface UpdateAction {
  type: 'UPDATE_RECORD',
  payload: {
    ids: string[],
    key: string,
    data: Partial<Record>
  }
}

export interface InsertAction {
  type: 'INSERT_RECORD',
  payload: {
    ids: string[],
    key: string,
    data: Record[]
  }
}

export interface DeleteAction {
  type: 'DELETE_RECORD',
  payload: {
    key: string,
    ids: string[]
  }
}

export interface SettingsUpdateAction {
  type: 'SETTINGS_UPDATE',
  payload: {
    key: string,
    setting: any
  }
}

export interface TypeLookup {
  [key: string]: Record
}

export interface State<Setting, Data, Types extends TypeLookup> {
  settings: Setting;
  data: Data;
  types: Types
}

export class DB<Data, Setting, Types extends TypeLookup, S extends State<Data, Setting, Types>> {
  private state: S;

  constructor(state: S) {
    this.state = state;
  }

  get<K extends keyof S['settings']>(name: K): S['settings'][K] {
    return this.state.settings[name];
  }

  set<K extends keyof S['settings'], U extends S['settings'][K]>(name: K, value: U): SettingsUpdateAction {
    return {
      type: 'SETTINGS_UPDATE',
      payload: {
        key: name,
        setting: value
      }
    }
  }

  table<K extends keyof S['types']>(type: K): Table<S['types'][K]> {
    return new Table((this.state.data as any)[type], type);
  }
}

export type OptionalID = {id?: string} & {[key: string]: any};

export class Table<T extends Record> {
  private data: DataTable<T>;
  private key: string;

  constructor(data: DataTable<T>, key: string) {
    this.data = data;
    this.key = key
  }

  find(id: string): T | null {
    return this.data.byId[id];
  }

  get all(): T[] {
    return this.data.ids.map(id => this.data.byId[id]);
  }

  get first(): T | null {
    return this.data.byId[this.data.ids[0]] || null
  }

  get last(): T | null {
    return this.data.byId[this.data.ids[this.data.ids.length - 1]] || null
  }

  where(query: ((value: T) => boolean) | Partial<T>): T[] {
    if(typeof(query) === 'function') {
      return this.all.filter(query);
    } else {
      return this.all.filter(e => {
        for(const key of Object.keys(query)) {
          if(e[key] != query[key]) {
            return false
          }
        }
        return true;
      });
    }
  }

  insert(records: OptionalID | OptionalID[]): InsertAction {
    const newRecords: OptionalID[] = records instanceof Array ? records : [records];
    const insertedRecords: T[] = newRecords.map(e => this.applyId(e));
    return {
      type: 'INSERT_RECORD',
      payload: {
        key: this.key,
        ids: insertedRecords.map(e => e.id),
        data: insertedRecords
      }
    }
  }

  update(id: RecordIdentifying, values: Partial<T>): UpdateAction {
    return {
      type: 'UPDATE_RECORD',
      payload: {
        key: this.key,
        ids: this.extractIds(id),
        data: values
      }
    }
  }

  delete(id: RecordIdentifying): DeleteAction {
    return {
      type: 'DELETE_RECORD',
      payload: {
        key: this.key,
        ids: this.extractIds(id)
      }
    }
  }

  private extractIds(object: RecordIdentifying): string[] {
    if(object === undefined) { throw('Trying to insert/update record which was not saved before') }
    let test: (string | Record)[];
    if(!(object instanceof Array)) {
      test = [object];
    } else {
      test = object;
    }
    return test.map(e => e['id'] || e);
  }

  private applyId(record: OptionalID): T {
    const copy = Object.assign({} as T, record);
    if(!copy.id) {
      copy.id = guid()
    }
    return copy;
  }
}

export type DBAction = UpdateAction | DeleteAction | InsertAction | SettingsUpdateAction;

function byId(records: Record[]): {[id: string]: Record}{
  const map = {};
  records.forEach(e => map[e.id] = e);
  return map;
}

function except(object: {[key: string]: any}, keys: string[]) {
  const newObject = {};
  Object.keys(object).forEach(key => {
    if(!keys.includes(key)) {
      newObject[key] = object[key];
    }
  });
  return newObject;
}

export function reducer<Setting, Data, Types extends TypeLookup, S extends State<Data, Setting, Types>>(initialState: S): (state: S, action: DBAction) => S {
  return (state, action) => {
    if(!state) { return initialState };
    switch(action.type) {
      case 'INSERT_RECORD': {
        const key = action.payload.key;
        const newIDs = action.payload.ids.filter(id => !state.data[key].ids.includes(id));
        const dataSet = {...state.data[key], byId: {...state.data[key].byId, ...byId(action.payload.data)}, ids: [...state.data[key].ids, ...newIDs] };
        return {...(state as any), data: {...(state.data as any), [key]: dataSet}};
      }
      case 'DELETE_RECORD': {
        const key = action.payload.key;
        const ids = action.payload.ids;
        const dataSet = {...state.data[key], byId: except(state.data[key].byId, ids), ids: state.data[key].ids.filter((e: string) => !ids.includes(e)) };
        return {...(state as any), data: {...(state.data as any), [key]: dataSet}};
      }
      case 'UPDATE_RECORD': {
        const key = action.payload.key;
        const updates: {[id: string]: Record} = {};
        action.payload.ids.forEach(e => updates[e] = {...state.data[key].byId[e], ...action.payload.data});
        const dataSet = {...state.data[key], byId: {...state.data[key].byId, ...updates}};
        return {...(state as any), data: {...(state.data as any), [key]: dataSet}};
      }
      case 'SETTINGS_UPDATE': {
        const key = action.payload.key;
        return {...(state as any), settings: {...(state.settings as any), [key]: action.payload.setting}};
      }
    }
  }
}