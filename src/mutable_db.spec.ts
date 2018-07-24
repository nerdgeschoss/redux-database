import { MutableDB, DataTable } from '.';
import { expect } from 'chai';

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

describe('mutable settings', () => {
  it('reads a setting', () => {
    expect(db.get('isChecked')).to.eq(true);
  });

  it('updates a setting', () => {
    db.set('isChecked', false);
    expect(db.get('isChecked')).to.eq(false);
  });
});

describe('mutable tables', () => {
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
});
