import { Row } from './util';

export interface UpdateAction {
  type: 'UPDATE_RECORD';
  payload: {
    ids: string[];
    key: string;
    context?: string;
    data: Partial<Row>;
  };
}

export interface InsertAction {
  type: 'INSERT_RECORD';
  payload: {
    ids: string[];
    key: string;
    context?: string;
    data: Row[];
  };
}

export interface UpsertAction {
  type: 'UPSERT_RECORD';
  payload: {
    ids: string[];
    key: string;
    context?: string;
    data: Row[];
  };
}

export interface DeleteAction {
  type: 'DELETE_RECORD';
  payload: {
    key: string;
    context?: string;
    ids: string[];
  };
}

export interface SettingsUpdateAction {
  type: 'SETTINGS_UPDATE';
  payload: {
    key: string;
    context?: string;
    setting: unknown;
  };
}

export interface CommitContextAction {
  type: 'COMMIT_CONTEXT';
  payload: {
    context: string;
    table?: string;
    ids?: string[];
  };
}

export interface RevertContextAction {
  type: 'REVERT_CONTEXT';
  payload: {
    context: string;
    table?: string;
    ids?: string[];
  };
}

export interface TransactionAction {
  type: 'TRANSACTION';
  payload: {
    actions: DBAction[];
  };
}

export type DBAction =
  | UpdateAction
  | DeleteAction
  | InsertAction
  | UpsertAction
  | SettingsUpdateAction
  | TransactionAction
  | RevertContextAction
  | CommitContextAction;

export type DBDispatch = (action: DBAction) => void;
