import { DB, DataTable, reducer, DBAction } from '.';
import { guid } from './util';

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
    things: {
      byId: {},
      ids: [],
    },
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
}

describe('settings', () => {
  beforeEach(reset);

  it('reads a setting', () => {
    expect(db.get('isChecked')).toBe(true);
  });

  it('updates a setting', () => {
    dispatch(db.set('isChecked', false));
    expect(db.get('isChecked')).toBe(false);
  });
});

describe('a table', () => {
  beforeEach(reset);

  it('inserts a record and generates an id', () => {
    dispatch(db.table('things').insert({ name: 'Thing' }));
    const thing = db.table('things').first;
    expect(thing).toBeDefined();
    expect(thing!!.id).toBeDefined();
  });

  it('finds an item', () => {
    dispatch(db.table('things').insert({ name: 'My Thing' }));
    const thing = db.table('things').where({ name: 'My Thing' })[0];
    expect(thing).toBeDefined();
  });

  it('returns undefined if something cant be found', () => {
    expect(db.table('things').find('none-existing-id')).toBeUndefined();
  });

  it('upserts records', () => {
    const id = guid();
    dispatch(
      db.table('things').insert([{ id, name: 'Test' }, { name: 'Another' }])
    );
    dispatch(
      db.table('things').upsert([{ id, name: 'Updated' }, { name: 'Third' }])
    );
    expect(db.table('things').all.map((e) => e.name)).toEqual([
      'Updated',
      'Another',
      'Third',
    ]);
  });

  it('can update record ids', () => {
    const id = guid();
    const things = db.table('things');
    dispatch(things.insert({ id, name: 'Test' }));
    dispatch(things.update(id, { id: '1' }));
    expect(db.table('things').find('1')).toBeDefined();
    expect(db.table('things').first!.id).toBe('1');
  });

  it('counts elements', () => {
    dispatch(db.table('things').insert({ name: 'Test' }));
    expect(db.table('things').length).toEqual(1);
  });

  it('truncates a table', () => {
    dispatch(db.table('things').insert({ name: 'Test' }));
    dispatch(db.table('things').truncate());
    expect(db.table('things').length).toEqual(0);
  });

  it('truncates all tables', () => {
    dispatch(db.table('things').insert({ name: 'Test' }));
    dispatch(db.truncate());
    expect(db.table('things').length).toEqual(0);
  });

  describe('resetting to initial state', () => {
    it('resets a table', () => {
      dispatch(db.table('things').insert({ name: 'Test' }));
      dispatch(db.table('things').reset());
      expect(db.table('things').length).toEqual(0);
    });

    it('resets all tables', () => {
      dispatch(db.table('things').insert({ name: 'Test' }));
      dispatch(db.set('isChecked', false));
      dispatch(db.reset('tables'));
      expect(db.table('things').length).toEqual(0);
      expect(db.get('isChecked')).toBeFalsy();
    });

    it('resets settings', () => {
      dispatch(db.table('things').insert({ name: 'Test' }));
      dispatch(db.set('isChecked', false));
      dispatch(db.reset('settings'));
      expect(db.table('things').length).toEqual(1);
      expect(db.get('isChecked')).toBeTruthy();
    });

    it('resets everything', () => {
      dispatch(db.table('things').insert({ name: 'Test' }));
      dispatch(db.set('isChecked', false));
      dispatch(db.reset());
      expect(db.table('things').length).toEqual(0);
      expect(db.get('isChecked')).toBeTruthy();
    });
  });

  describe('with context', () => {
    it('creates entries in a new context', () => {
      dispatch(
        db.context('context').table('things').insert({ name: 'My Thing' })
      );
      const thing = db.table('things').first;
      expect(thing).not.toBeDefined();
      const contextThing = db.context('context').table('things').first;
      expect(contextThing).toBeDefined();
      expect(
        db.context('another-context').table('things').first
      ).not.toBeDefined();
    });

    it('deletes things in a context', () => {
      const id = guid();
      dispatch(db.table('things').insert({ id, name: 'My Thing' }));
      dispatch(db.context('context').table('things').delete(id));
      expect(db.table('things').first).toBeDefined();
      expect(db.context('context').table('things').first).not.toBeDefined();
    });

    it('updates things in a context', () => {
      const id = guid();
      dispatch(db.table('things').insert({ id, name: 'My Thing' }));
      dispatch(
        db.context('context').table('things').update(id, { name: 'Update' })
      );
      expect(db.table('things').first!.name).toBe('My Thing');
      expect(db.context('context').table('things').first!.name).toBe('Update');
    });

    it('keeps referential equality', () => {
      const id = guid();
      dispatch(db.table('things').insert({ id, name: 'My Thing' }));
      const thing = db.table('things').first;
      const sameThing = db.table('things').last;
      expect(thing).toBe(sameThing);
    });

    describe('merging', () => {
      it('merges a context', () => {
        dispatch(
          db.context('context').table('things').insert({ name: 'Thing' })
        );
        dispatch(db.context('context').commit());
        expect(db.table('things').first!.name).toBe('Thing');
      });

      it('merges a context to its parent', () => {
        dispatch(
          db
            .context('context')
            .context('nested')
            .table('things')
            .insert({ name: 'Thing' })
        );
        dispatch(db.context('context').context('nested').commit());
        expect(db.table('things').first).toBeUndefined();
        expect(db.context('context').table('things').first).toBeDefined();
        expect(db.context('context').table('things').first!.name).toBe('Thing');
      });

      it('merges properties correctly', () => {
        const id = guid();
        dispatch(
          db.context('context').table('things').insert({ id, name: 'Hello' })
        );
        dispatch(
          db
            .context('context')
            .context('nested')
            .table('things')
            .update(id, { name: 'World' })
        );
        expect(
          db.context('context').context('nested').table('things').first!.name
        ).toBe('World');
        expect(db.context('context').table('things').first!.name).toBe('Hello');
      });

      it('commits by id', () => {
        const id = guid();
        dispatch(
          db
            .context('context')
            .table('things')
            .insert([{ id, name: 'Hello' }, { name: 'Another Object' }])
        );
        dispatch(db.context('context').table('things').commit(id));
        expect(db.table('things').ids).toEqual([id]);
        expect(db.context('context').table('things').all.length).toBe(2);
      });

      it('reverts by id', () => {
        const id = guid();
        dispatch(
          db.context('context').table('things').insert({ id, name: 'Hello' })
        );
        expect(db.context('context').table('things').ids).toEqual([id]);
        dispatch(db.context('context').table('things').revert(id));
        expect(db.context('context').table('things').ids).toEqual([]);
      });

      it('allows the nested context to see changes of the parent', () => {
        dispatch(
          db.context('context').table('things').insert({ name: 'Thing' })
        );
        expect(
          db.context('context').context('nested').table('things').first!.name
        ).toBe('Thing');
      });
    });
    describe('change tracking', () => {
      it('shows the changes made to an object', () => {
        const id = guid();
        dispatch(
          db.context('context').table('things').insert({ id, name: 'Thing' })
        );
        const changesInRoot = db.table('things').changesFor(id);
        const changes = db.context('context').table('things').changesFor(id);
        expect(changesInRoot).toBeUndefined();
        expect(changes).toBeDefined();
        expect(changes!.deleted).toBeFalsy();
        expect(changes!.inserted).toBeTruthy();
        expect(changes!.changes).toBeDefined();
        expect(changes!.changes!.name).toBe('Thing');
      });

      it('lists all changes of the table', () => {
        const id = guid();
        dispatch(
          db.context('context').table('things').insert({ id, name: 'Thing' })
        );
        const changes = db.context('context').table('things').changes;
        expect(changes.length).toBe(1);
      });

      it('does not track changes in the root context', () => {
        dispatch(db.table('things').insert({ name: 'Thing' }));
        expect(db.table('things').changes.length).toBe(0);
        expect(db.context('context').table('things').changes.length).toBe(0);
      });

      it('knows about deleted records', () => {
        const id = guid();
        dispatch(db.table('things').insert({ id, name: 'Thing' }));
        dispatch(db.context('context').table('things').delete(id));
        const changes = db.context('context').table('things').changes;
        expect(changes.length).toBe(1);
      });
    });
  });
});
