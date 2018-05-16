import { DB, DataTable, reducer } from ".";
import { expect } from "chai";

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
    isChecked: true
  },
  data: {
    things: {
      byId: {},
      ids: []
    }
  },
  types: {
    things: {} as Thing
  }
};

describe("settings", () => {
  const db = new DB(state);

  it("reads a setting", () => {
    expect(db.get("isChecked")).to.eq(true);
  });

  it("updates a setting", () => {
    const dispatch = reducer(state);
    const newState = dispatch(state, db.set("isChecked", false));
    expect(new DB(newState).get("isChecked")).to.eq(false);
  });
});
