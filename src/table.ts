import {
  Record,
  RecordIdentifying,
  OptionalID,
  applyId,
  extractIds,
  flatten,
} from './util';
import { InsertAction, UpdateAction, DeleteAction } from './actions';

export interface DataTable<T> {
  byId: { [id: string]: T };
  ids: string[];
}

export interface ContextChanges<T> {
  byId: { [id: string]: Partial<T> };
  deletedIds: string[];
  newIds: string[];
}

export class Table<T extends Record> {
  private data: DataTable<T>;
  private key: string;
  private context?: string;
  private contextChanges?: ContextChanges<T>[];

  constructor(
    data: DataTable<T>,
    key: string,
    options: { context?: string; contextChanges?: ContextChanges<T>[] } = {}
  ) {
    this.data = data;
    this.key = key;
    this.context = options.context;
    this.contextChanges = options.contextChanges;
  }

  find(id: string): T | undefined {
    if (this.contextChanges) {
      for (const changeSet of this.contextChanges) {
        if (changeSet.deletedIds.includes(id)) {
          return;
        }
      }
    }
    const changes =
      this.contextChanges && this.contextChanges.map(e => e.byId[id]);
    const object = this.data.byId[id];
    return changes ? Object.assign({}, object, ...changes) : object;
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
    if (typeof query === 'function') {
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
    const insertedRecords: T[] = newRecords.map(e => applyId(e));
    return {
      type: 'INSERT_RECORD',
      payload: {
        key: this.key,
        context: this.context,
        ids: insertedRecords.map(e => e.id),
        data: insertedRecords,
      },
    };
  }

  update(id: RecordIdentifying, values: Partial<T>): UpdateAction {
    return {
      type: 'UPDATE_RECORD',
      payload: {
        key: this.key,
        context: this.context,
        ids: extractIds(id),
        data: values,
      },
    };
  }

  delete(id: RecordIdentifying): DeleteAction {
    return {
      type: 'DELETE_RECORD',
      payload: {
        key: this.key,
        context: this.context,
        ids: extractIds(id),
      },
    };
  }

  private get ids(): string[] {
    const newIds = flatten((this.contextChanges || []).map(e => e.newIds));
    const deletedIds = flatten(
      (this.contextChanges || []).map(e => e.deletedIds)
    );
    return this.data.ids.concat(newIds).filter(id => !deletedIds.includes(id));
  }
}
