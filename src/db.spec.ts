import { DB, DataTable, reducer, DBAction } from '.';
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

let currentState = state;
let dbReducer = reducer(state);
let db = new DB(currentState);
function dispatch(action: DBAction) {
  currentState = dbReducer(currentState, action);
  db = new DB(currentState);
}

describe('settings', () => {
  it('reads a setting', () => {
    expect(db.get('isChecked')).to.eq(true);
  });

  it('updates a setting', () => {
    dispatch(db.set('isChecked', false));
    expect(db.get('isChecked')).to.eq(false);
  });
});

describe('tables', () => {
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
});
