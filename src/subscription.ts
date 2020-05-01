import type { StateDefining, DB } from './db';
import { MutableDB } from './mutable_db';
import { removeByValue, deepEqual } from './util';

type QueryDescriptor<State extends StateDefining, Value> = (
  db: DB<State>
) => Value;

export class Subscription<State extends StateDefining, Value> {
  private readonly db: MutableDB<State>;
  private _query: QueryDescriptor<State, Value>;
  private _current: Value;
  private unsubscribe: () => void;
  private subscribers: Array<(value: Value) => void>;

  constructor(db: MutableDB<State>, query: QueryDescriptor<State, Value>) {
    this.db = db;
    this._query = query;
    this.subscribers = [];
    this._current = query(db.snapshot);
    this.unsubscribe = db.subscribe(() => this.trigger());
  }

  public get query(): QueryDescriptor<State, Value> {
    return this._query;
  }

  public set query(query: QueryDescriptor<State, Value>) {
    // when assigning the same instance of query, skip notifications (this happens e.g. in React
    // when assining a query on each render)
    if (this._query !== query) {
      this._query = query;
      this.trigger();
    }
  }

  public get current(): Value {
    return this._current;
  }

  public subscribe(callback: (value: Value) => void): () => void {
    this.subscribers.push(callback);
    callback(this._current);
    return () => {
      removeByValue(this.subscribers, callback);
    };
  }

  public cancel(): void {
    this.unsubscribe();
    this.subscribers = [];
  }

  private trigger(): void {
    const newValue = this._query(this.db.snapshot);
    if (!deepEqual(this.current, newValue)) {
      this._current = newValue;
      this.subscribers.forEach((e) => e(newValue));
    }
  }
}
