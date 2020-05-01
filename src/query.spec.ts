import { DB, DataTable } from '.';
import { formatResultToTableData } from './util';
import { MutableDB } from './mutable_db';

interface Thing {
  id: string;
  name: string;
  age?: number;
  color?: string;
  ownerId: string;
  revisedById?: string;
}

interface User {
  id: string;
  name: string;
  favoriteThingIds?: string[];
}

interface State {
  settings: {};
  data: {
    things: DataTable<Thing>;
    users: DataTable<User>;
  };
}

const state: State = {
  settings: {},
  data: {
    things: formatResultToTableData([
      {
        id: '1',
        name: 'Hello World',
        age: 20,
        color: 'red',
        ownerId: '10',
        revisedById: '20',
      },
      { id: '2', name: 'Last Entry', age: 5, ownerId: '20' },
    ]),
    users: formatResultToTableData([
      { id: '10', name: 'John', favoriteThingIds: ['1', '2'] },
      { id: '20', name: 'Jack' },
    ]),
  },
};

const db = new DB(state);
const mutableDB = new MutableDB(state);

describe('chainable queries', () => {
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
      const thing = db.query('things').embed('owner', 'users', 'ownerId')
        .first!;
      expect(thing.owner.name).toEqual('John');
    });

    it('embeds optional objects by key', () => {
      const thing = db.query('things').embed('revisor', 'users', 'revisedById')
        .all;
      expect(thing[0].revisor?.name).toEqual('Jack');
      expect(thing[1].revisor).toBeUndefined();
    });

    it('embeds collections of objects by key', () => {
      const users = db
        .query('users')
        .embedMulti('favoriteThings', 'things', 'favoriteThingIds').all;
      expect(users[0].favoriteThings.length).toEqual(2);
      expect(users[1].favoriteThings.length).toEqual(0);
    });
  });

  describe('on mutable data', () => {
    it('returns the same query interface', () => {
      expect(mutableDB.query('users').select('id').first).toEqual({ id: '10' });
    });
  });
});
