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
export declare class DB<Data, Setting, Types extends TypeLookup, S extends State<Data, Setting, Types>> {
    private state;
    private currentContext?;
    constructor(state: S, options?: {
        context?: string;
    });
    get<K extends keyof S["settings"]>(name: K): S["settings"][K];
    set<K extends keyof S["settings"], U extends S["settings"][K]>(name: K, value: U): SettingsUpdateAction;
    table<K extends keyof S["types"]>(type: K): Table<S["types"][K]>;
    context(context: string): DB<Data, Setting, Types, S>;
    transaction(execute: (dispatch: DBDispatch) => void): TransactionAction;
    commit(): CommitContextAction;
}
export declare type OptionalID = {
    id?: string;
} & {
    [key: string]: any;
};
export interface ContextChanges<T> {
    byId: {
        [id: string]: Partial<T>;
    };
    deletedIds: string[];
    newIds: string[];
}
export declare class Table<T extends Record> {
    private data;
    private key;
    private context?;
    private contextChanges?;
    constructor(data: DataTable<T>, key: string, options?: {
        context?: string;
        contextChanges?: ContextChanges<T>;
    });
    find(id: string): T | undefined;
    readonly all: T[];
    readonly first: T | undefined;
    readonly last: T | undefined;
    where(query: ((value: T) => boolean) | Partial<T>): T[];
    insert(records: OptionalID | OptionalID[]): InsertAction;
    update(id: RecordIdentifying, values: Partial<T>): UpdateAction;
    delete(id: RecordIdentifying): DeleteAction;
    private readonly ids;
    private extractIds(object);
    private applyId(record);
}
export declare type DBAction = UpdateAction | DeleteAction | InsertAction | SettingsUpdateAction | TransactionAction | CommitContextAction;
export declare type DBDispatch = (action: DBAction) => void;
export declare function reduce<Setting, Data, Types extends TypeLookup, S extends State<Data, Setting, Types>>(state: S, action: DBAction): S;
export declare function reducer<Setting, Data, Types extends TypeLookup, S extends State<Data, Setting, Types>>(initialState: S): (state: S, action: DBAction) => S;
