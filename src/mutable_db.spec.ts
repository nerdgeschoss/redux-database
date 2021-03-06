import { MutableDB, DataTable } from '.';
import { guid, emptyTable } from './util';

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
    things: emptyTable,
  },
};

let db = new MutableDB(state);

function reset(): void {
  db = new MutableDB(state);
}

describe('mutable tables', () => {
  describe('reading', () => {
    it('returns a static snapshot of the data', () => {
      const snapshot = db.snapshot;
      db.set('isChecked', false);
      expect(snapshot.get('isChecked')).toBeTruthy();
    });
  });

  describe('truncating and resetting', () => {
    it('truncates a table', () => {
      const things = db.table('things');
      things.insert({ name: 'Test' });
      expect(things.length).toEqual(1);
      things.truncate();
      expect(things.length).toEqual(0);
    });

    it('truncates the whole database', () => {
      const things = db.table('things');
      things.insert({ name: 'Test' });
      expect(things.length).toEqual(1);
      db.truncate();
      expect(things.length).toEqual(0);
    });

    it('resets the whole database', () => {
      const things = db.table('things');
      things.insert({ name: 'Test' });
      db.set('isChecked', false);
      db.reset();
      expect(things.length).toEqual(0);
      expect(db.get('isChecked')).toBeTruthy();
    });
  });

  describe('mutable settings', () => {
    beforeEach(reset);
    it('reads a setting', () => {
      expect(db.get('isChecked')).toBeTruthy();
    });

    it('updates a setting', () => {
      db.set('isChecked', false);
      expect(db.get('isChecked')).toBeFalsy();
    });
  });

  describe('subscribing', () => {
    it('subscribes to changes', () => {
      let timesInvoked = 0;
      db.subscribe(() => timesInvoked++);
      db.set('isChecked', false);
      db.set('isChecked', true);
      expect(timesInvoked).toEqual(2);
    });

    it('unsubscribes from changes', () => {
      let timesInvoked = 0;
      const unsubscribe = db.subscribe(() => timesInvoked++);
      db.set('isChecked', false);
      unsubscribe();
      db.set('isChecked', true);
      expect(timesInvoked).toEqual(1);
    });
  });

  describe('mutable tables', () => {
    beforeEach(reset);

    it('inserts a record and generates an id', () => {
      db.table('things').insert({ name: 'Thing' });
      const thing = db.table('things').first;
      expect(thing).toBeDefined();
      expect(thing!!.id).toBeDefined();
    });

    it('finds an item', () => {
      db.table('things').insert({ name: 'My Thing' });
      const thing = db.table('things').where({ name: 'My Thing' });
      expect(thing).toBeDefined();
    });

    it('updates the table in place', () => {
      const things = db.table('things');
      const originalCount = things.all.length;
      things.insert({ name: 'Additional Thing' });
      expect(things.all.length).toBe(originalCount + 1);
    });

    it('has a list of ids per table', () => {
      const id = guid();
      const things = db.table('things');
      things.insert({ id, name: 'Additional Thing' });
      expect(things.ids).toEqual([id]);
    });

    it('displays changes to an object', () => {
      db.table('things').insert({ name: 'Thing' });
      const things = db.context('context').table('things');
      const id = guid();
      things.insert({ id, name: 'Thing!' });
      expect(things.changes.length).toBe(1);
      const changes = things.changesFor(id)!.changes!;
      expect(changes.name).toBe('Thing!');
    });

    it('bundles updates in a transaction', () => {
      let timesInvoked = 0;
      db.subscribe(() => timesInvoked++);
      db.transaction((readCopy, dispatch) => {
        dispatch(readCopy.set('isChecked', true));
        dispatch(readCopy.set('isChecked', false));
      });
      expect(timesInvoked).toBe(1);
    });
  });
});
