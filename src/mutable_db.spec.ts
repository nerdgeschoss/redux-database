import { MutableDB, DataTable } from '.';
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

let db = new MutableDB(state);

function reset() {
  db = new MutableDB(state);
}

describe('mutable settings', () => {
  beforeEach(reset);
  it('reads a setting', () => {
    expect(db.get('isChecked')).to.eq(true);
  });

  it('updates a setting', () => {
    db.set('isChecked', false);
    expect(db.get('isChecked')).to.eq(false);
  });
});

describe('mutable tables', () => {
  beforeEach(reset);

  it('inserts a record and generates an id', () => {
    db.table('things').insert({ name: 'Thing' });
    const thing = db.table('things').first;
    expect(thing).to.be;
    expect(thing!!.id).to.be;
  });

  it('finds an item', () => {
    db.table('things').insert({ name: 'My Thing' });
    const thing = db.table('things').where({ name: 'My Thing' });
    expect(thing).to.be;
  });

  it('updates the table in place', () => {
    const things = db.table('things');
    const originalCount = things.all.length;
    things.insert({ name: 'Additional Thing' });
    expect(things.all.length).to.eq(originalCount + 1);
  });

  it('has a list of ids per table', () => {
    const id = guid();
    const things = db.table('things');
    things.insert({ id, name: 'Additional Thing' });
    expect(things.ids).to.eql([id]);
  });

  it('displays changes to an object', () => {
    db.table('things').insert({ name: 'Thing' });
    const things = db.context('context').table('things');
    const id = guid();
    things.insert({ id, name: 'Thing!' });
    expect(things.changes).to.have.length(1);
    const changes = things.changesFor(id)!.changes!;
    expect(changes.name).to.eq('Thing!');
  });

  it('bundles updates in a transaction', () => {
    let timesInvoked = 0;
    db.subscribe(() => timesInvoked++);
    db.transaction((readCopy, dispatch) => {
      dispatch(readCopy.set('isChecked', true));
      dispatch(readCopy.set('isChecked', false));
    });
    expect(timesInvoked).to.eq(1);
  });
});
