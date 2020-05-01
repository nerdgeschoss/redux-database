import { DB, DataTable, reducer, DBAction } from '.';
import { emptyTable } from './util';

interface Thing {
  id: string;
  name: string;
  age?: number;
  color?: string;
  ownerId: string;
}

interface User {
  id: string;
  name: string;
}

interface State {
  settings: {
    isChecked: boolean;
  };
  data: {
    things: DataTable<Thing>;
    users: DataTable<User>;
  };
}

const state: State = {
  settings: {
    isChecked: true,
  },
  data: {
    things: emptyTable,
    users: emptyTable,
  },
};

let currentState = state;
const dbReducer = reducer(state);
let db = new DB(currentState);
function dispatch(action: DBAction): void {
  currentState = dbReducer(currentState, action);
  db = new DB(currentState);
}
function reset(): void {
  currentState = state;
  db = new DB(currentState);
  dispatch(db.table('users').insert({ id: '10', name: 'John' }));
  dispatch(
    db.table('things').insert([
      { id: '1', name: 'Hello World', age: 20, color: 'red', ownerId: '10' },
      { id: '2', name: 'Last Entry', age: 5, ownerId: '10' },
    ])
  );
}

describe('chainable queries', () => {
  beforeEach(reset);

  it('gets a single entry from a query', () => {
    const thing = db.query('things').first;
    expect(thing?.name).toEqual('Hello World');
  });

  it('gets the last entry from a table', () => {
    const thing = db.query('things').last;
    expect(thing?.name).toEqual('Last Entry');
  });

  it('returns the whole collection', () => {
    expect(db.query('things').all.length).toEqual(2);
  });

  it('filters the result set', () => {
    const result = db.query('things').where((e) => e.name.includes('Entry'))
      .all;
    expect(result.length).toEqual(1);
    expect(result[0].name).toEqual('Last Entry');
  });

  describe('sorting results', () => {
    it('sorts by a single attribute', () => {
      expect(db.query('things').orderBy('name').first?.name).toEqual(
        'Hello World'
      );
    });

    it('sorts descending', () => {
      expect(db.query('things').orderBy({ name: 'desc' }).first?.name).toEqual(
        'Last Entry'
      );
    });
  });

  describe('selecting from results', () => {
    it('selects a subset of keys', () => {
      const ageMap = db.query('things').select('age', 'color').first;
      expect(ageMap).toEqual({
        id: '1',
        age: 20,
        color: 'red',
      });
    });
  });

  describe('joining results', () => {
    it('embeds required objects by key', () => {
      const thing = db.query('things').embed('owner', 'users', 'ownerId').first;
    });
  });
});
