# Redux Database

Simple abstraction over redux to simplify relational data with strong typings.

## Defining your state

```ts
interface Thing {
  id: string;
  name: string;
}

interface State {
  settings: {
    enableAwesomeThing: boolean;
  },
  data: {
    things: DataTable<Thing>
  },
  types: {
    things: Thing
  }
}

const state: State = {
  settings: {
    enableAwesomeThing: true
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
}
```

## Reading Data

```ts
const db = new DB(state);
```

### Reading Key/Value Settings

```ts
db.get('enableAwesomeThing'); // true
```

### Reading Records

```ts
const things = db.table('things'); // if things is not defined, you would get an error here
things.all; // returns Thing[]
things.find('12'); // find by id
things.where({name: 'tool'}); // simple equality based where queries
things.where(thing => thing.name.length == 4); // function based where queries
```

## Writing Data

Data is never written directly. Instead all writer methods return a redux action that can be handled by the included reducer.

### Writing Settings

```ts
store.dispatch(db.set('enableAwesomeThing', false));
```

### Writing Records

```ts
store.dispatch(things.insert({name: 'New Thing'})); // ids get assigned automatically if not provided
store.dispatch(things.update('1', {name: 'New Name'})); // the first parameter could be an array instead for multi updates
store.dispatch(things.delete('1'));
```
