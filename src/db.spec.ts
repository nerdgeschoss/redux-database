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
      expect(db.context('context').table('things').first!.name).to.eq('Thing');
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
      expect(db.context('context').table('things').first!.name).to.eq('Hello');
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
});
