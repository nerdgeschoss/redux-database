export declare function guid(): string;
export interface Record {
    id: string;
}
export declare type RecordIdentifying = string | string[] | Record | Record[];
export interface DataTable<T> {
    byId: {
        [id: string]: T;
    };
    ids: string[];
}
export interface UpdateAction {
    type: 'UPDATE_RECORD';
    payload: {
        ids: string[];
        key: string;
        data: Partial<Record>;
    };
}
export interface InsertAction {
    type: 'INSERT_RECORD';
    payload: {
        ids: string[];
        key: string;
        data: Record[];
    };
}
export interface DeleteAction {
    type: 'DELETE_RECORD';
    payload: {
        key: string;
        ids: string[];
    };
}
export interface SettingsUpdateAction {
    type: 'SETTINGS_UPDATE';
    payload: {
        key: string;
        setting: any;
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
export declare class DB<Data, Setting, Types extends TypeLookup, S extends State<Data, Setting, Types>> {
    private state;
    constructor(state: S);
    get<K extends keyof S['settings']>(name: K): S['settings'][K];
    set<K extends keyof S['settings'], U extends S['settings'][K]>(name: K, value: U): SettingsUpdateAction;
    table<K extends keyof S['types']>(type: K): Table<S['types'][K]>;
}
export declare type OptionalID = {
    id?: string;
} & {
    [key: string]: any;
};
export declare class Table<T extends Record> {
    private data;
    private key;
    constructor(data: DataTable<T>, key: string);
    find(id: string): T | null;
    readonly all: T[];
    readonly first: T | null;
    readonly last: T | null;
    where(query: ((value: T) => boolean) | Partial<T>): T[];
    insert(records: OptionalID | OptionalID[]): InsertAction;
    update(id: RecordIdentifying, values: Partial<T>): UpdateAction;
    delete(id: RecordIdentifying): DeleteAction;
    private extractIds(object);
    private applyId(record);
}
export declare type DBAction = UpdateAction | DeleteAction | InsertAction | SettingsUpdateAction;
export declare function reducer<Setting, Data, Types extends TypeLookup, S extends State<Data, Setting, Types>>(initialState: S): (state: S, action: DBAction) => S;
