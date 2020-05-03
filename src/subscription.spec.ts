import { MutableDB, DataTable } from '.';
import { formatResultToTableData } from './util';
import { DB } from './db';

interface Thing {
  id: string;
  name: string;
}

interface State {
  settings: {
    isChecked: boolean;
  };
  data: {
    things: DataTable<Thing>;
  };
}

const state: State = {
  settings: {
    isChecked: true,
  },
  data: {
    things: formatResultToTableData([{ id: '1', name: 'Hello World' }]),
  },
};

let db = new MutableDB(state);

function reset(): void {
  db = new MutableDB(state);
}

describe('subscription', () => {
  beforeEach(reset);

  it('returns the current value', () => {
    const subscription = db.observe((db) => db.get('isChecked'));
    expect(subscription.current).toEqual(true);
  });

  it('updates the current value', () => {
    const subscription = db.observe((db) => db.get('isChecked'));
    db.set('isChecked', false);
    expect(subscription.current).toEqual(false);
  });

  it('can be canceled', () => {
    const subscription = db.observe((db) => db.get('isChecked'));
    subscription.cancel();
    db.set('isChecked', false);
    expect(subscription.current).toEqual(true);
  });

  it('notifies on subscribe and change', () => {
    const subscription = db.observe((db) => db.get('isChecked'));
    let value = null;
    subscription.subscribe((val) => (value = val));
    expect(value).toEqual(true);
    db.set('isChecked', false);
    expect(value).toEqual(false);
  });

  it("doesn't notify on same value", () => {
    const subscription = db.observe((db) => db.get('isChecked'));
    let invocations = 0;
    subscription.subscribe(() => invocations++);
    expect(invocations).toEqual(1);
    db.set('isChecked', true);
    expect(invocations).toEqual(1);
    db.set('isChecked', false);
    expect(invocations).toEqual(2);
  });

  it('allows updating the query', () => {
    const subscription = db.observe((db) => db.get('isChecked'));
    let invocations = 0;
    subscription.subscribe(() => invocations++);
    expect(invocations).toEqual(1);
    subscription.query = (db) => !db.get('isChecked');
    expect(subscription.current).toEqual(false);
    expect(invocations).toEqual(2);
  });

  it("doesn't trigger on assigning the same query", () => {
    function query(db: DB<State>): boolean {
      return db.get('isChecked');
    }
    const subscription = db.observe(query);
    let invocations = 0;
    subscription.subscribe(() => invocations++);
    expect(invocations).toEqual(1);
    subscription.query = query;
    expect(invocations).toEqual(1);
  });
});
