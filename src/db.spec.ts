import { DB, DataTable, reducer, DBAction } from '.';
import { expect } from 'chai';
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
  types: {
    things: Thing;
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
  types: {
    things: {} as Thing,
  },
};

let currentState = state;
let dbReducer = reducer(state);
let db = new DB(currentState);
function dispatch(action: DBAction) {
  currentState = dbReducer(currentState, action);
  db = new DB(currentState);
}
function reset() {
  currentState = state;
  db = new DB(currentState);
}

describe('settings', () => {
  beforeEach(reset);

  it('reads a setting', () => {
    expect(db.get('isChecked')).to.eq(true);
  });

  it('updates a setting', () => {
    dispatch(db.set('isChecked', false));
    expect(db.get('isChecked')).to.eq(false);
  });
});

describe('a table', () => {
  beforeEach(reset);

  it('inserts a record and generates an id', () => {
    dispatch(db.table('things').insert({ name: 'Thing' }));
    const thing = db.table('things').first;
    expect(thing).to.be;
    expect(thing!!.id).to.be;
  });

  it('finds an item', () => {
    dispatch(db.table('things').insert({ name: 'My Thing' }));
    const thing = db.table('things').where({ name: 'My Thing' })[0];
    expect(thing).to.be;
  });

  it('returns undefined if something cant be found', () => {
    expect(db.table('things').find('none-existing-id')).to.be.undefined;
  });

  it('upserts records', () => {
    const id = guid();
    dispatch(
      db.table('things').insert([{ id, name: 'Test' }, { name: 'Another' }])
    );
    dispatch(
      db.table('things').upsert([{ id, name: 'Updated' }, { name: 'Third' }])
    );
    expect(db.table('things').all.map(e => e.name)).to.eql([
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
    expect(db.table('things').find('1')).to.exist;
    expect(db.table('things').first!.id).to.eq('1');
  });

  describe('with context', () => {
    it('creates entries in a new context', () => {
      dispatch(
        db
          .context('context')
          .table('things')
          .insert({ name: 'My Thing' })
      );
      const thing = db.table('things').first;
      expect(thing).not.to.be;
      const contextThing = db.context('context').table('things').first;
      expect(contextThing).to.be;
      expect(db.context('another-context').table('things').first).not.to.be;
    });

    it('deletes things in a context', () => {
      const id = guid();
      dispatch(db.table('things').insert({ id, name: 'My Thing' }));
      dispatch(
        db
          .context('context')
          .table('things')
          .delete(id)
      );
      expect(db.table('things').first).to.be;
      expect(db.context('context').table('things').first).not.to.be;
    });

    it('updates things in a context', () => {
      const id = guid();
      dispatch(db.table('things').insert({ id, name: 'My Thing' }));
      dispatch(
        db
          .context('context')
          .table('things')
          .update(id, { name: 'Update' })
      );
      expect(db.table('things').first!.name).to.eq('My Thing');
      expect(db.context('context').table('things').first!.name).to.eq('Update');
    });

    it('keeps referential equality', () => {
      const id = guid();
      dispatch(db.table('things').insert({ id, name: 'My Thing' }));
      const thing = db.table('things').first;
      const sameThing = db.table('things').last;
      expect(thing).to.equal(sameThing);
    });

    describe('merging', () => {
      it('merges a context', () => {
        dispatch(
          db
            .context('context')
            .table('things')
            .insert({ name: 'Thing' })
        );
        dispatch(db.context('context').commit());
        expect(db.table('things').first!.name).to.eq('Thing');
      });

      it('merges a context to its parent', () => {
        dispatch(
          db
            .context('context')
            .context('nested')
            .table('things')
            .insert({ name: 'Thing' })
        );
        dispatch(
          db
            .context('context')
            .context('nested')
            .commit()
        );
        expect(db.table('things').first).not.to.exist;
        expect(db.context('context').table('things').first).to.exist;
        expect(db.context('context').table('things').first!.name).to.eq(
          'Thing'
        );
      });

      it('merges properties correctly', () => {
        const id = guid();
        dispatch(
          db
            .context('context')
            .table('things')
            .insert({ id, name: 'Hello' })
        );
        dispatch(
          db
            .context('context')
            .context('nested')
            .table('things')
            .update(id, { name: 'World' })
        );
        expect(
          db
            .context('context')
            .context('nested')
            .table('things').first!.name
        ).to.eq('World');
        expect(db.context('context').table('things').first!.name).to.eq(
          'Hello'
        );
      });

      it('commits by id', () => {
        const id = guid();
        dispatch(
          db
            .context('context')
            .table('things')
            .insert([{ id, name: 'Hello' }, { name: 'Another Object' }])
        );
        dispatch(
          db
            .context('context')
            .table('things')
            .commit(id)
        );
        expect(db.table('things').ids).to.eql([id]);
        expect(db.context('context').table('things').all).to.have.length(2);
      });

      it('reverts by id', () => {
        const id = guid();
        dispatch(
          db
            .context('context')
            .table('things')
            .insert({ id, name: 'Hello' })
        );
        expect(db.context('context').table('things').ids).to.eql([id]);
        dispatch(
          db
            .context('context')
            .table('things')
            .revert(id)
        );
        expect(db.context('context').table('things').ids).to.eql([]);
      });

      it('allows the nested context to see changes of the parent', () => {
        dispatch(
          db
            .context('context')
            .table('things')
            .insert({ name: 'Thing' })
        );
        expect(
          db
            .context('context')
            .context('nested')
            .table('things').first!.name
        ).to.eq('Thing');
      });
    });
    describe('change tracking', () => {
      it('shows the changes made to an object', () => {
        const id = guid();
        dispatch(
          db
            .context('context')
            .table('things')
            .insert({ id, name: 'Thing' })
        );
        const changesInRoot = db.table('things').changesFor(id);
        const changes = db
          .context('context')
          .table('things')
          .changesFor(id);
        expect(changesInRoot).not.to.exist;
        expect(changes).to.exist;
        expect(changes!.deleted).to.be.false;
        expect(changes!.inserted).to.be.true;
        expect(changes!.changes).to.exist;
        expect(changes!.changes!.name).to.eq('Thing');
      });

      it('lists all changes of the table', () => {
        const id = guid();
        dispatch(
          db
            .context('context')
            .table('things')
            .insert({ id, name: 'Thing' })
        );
        const changes = db.context('context').table('things').changes;
        expect(changes).to.have.length(1);
      });

      it('does not track changes in the root context', () => {
        dispatch(db.table('things').insert({ name: 'Thing' }));
        expect(db.table('things').changes).to.have.length(0);
        expect(db.context('context').table('things').changes).to.have.length(0);
      });

      it('knows about deleted records', () => {
        const id = guid();
        dispatch(db.table('things').insert({ id, name: 'Thing' }));
        dispatch(
          db
            .context('context')
            .table('things')
            .delete(id)
        );
        const changes = db.context('context').table('things').changes;
        expect(changes).to.have.length(1);
      });
    });
  });
});
