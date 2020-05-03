# Redux Database

![Tests](https://github.com/nerdgeschoss/redux-database/workflows/Tests/badge.svg?branch=master)

Simple reducer based in-memory database with strong typings and immutable documents, with plugins for redux and react.

## Why do I need this?

Client side data normalization is hard. This library helps you to organize your state in a relational way, with queries
and joins as you would expect from an SQL based database. There is a storage adaper for redux or you can use it as a
standalone library (redux-database has no dependencies!).

If you wish to use this library with React, you can easily observe mutations on the state via subscriptions and hooks.

## Defining your state

Define your models (only requirement is a required string `id` on them) and a corresponding database schema. The `settings`
key is for key-value-based data (e.g. UI settings, session tokens, etc) while the `data` key is for relational table data.

```ts
interface Thing {
  id: string;
  name: string;
}

interface State {
  settings: {
    enableAwesomeThing: boolean;
  };
  data: {
    things: DataTable<Thing>;
  };
}
```

Create your initial state:

```ts
import { emptyTable } from 'redux-database';

const state: State = {
  settings: {
    enableAwesomeThing: true,
  },
  data: {
    things: emptyTable,
  },
};
```

## Reading Data

You can create a data snapshot from the state (and manage the state via redux or with the supplied `MutableDB`).

```ts
const db = new DB(state);
```

### Reading Key/Value Settings

Key-Value-Settings are type-safe. Typescript will tell if you if type an invalid key or use the wrong type.

```ts
db.get('enableAwesomeThing'); // true
```

### Reading Records

Records are organized in tables, referenced by their name. Again Typescript will tell if you mistyped anything.

```ts
const things = db.table('things'); // if things is not defined, you would get an error here
things.all; // returns Thing[]
things.find('12'); // find by id
things.where({ name: 'tool' }); // simple equality based where queries
things.where((thing) => thing.name.length == 4); // function based where queries
```

### Chainable Queries

If you prefer to work with the chainable query syntax, you modify search results during a query:

```ts
db
  .query('things')
  .where({ name: 'tool' })
  .select('name')
  .order({ name: 'desc' }).first; // returns { id: '12', name: 'tool' }
```

Queries allow embedding records from other table. Assuming there is a `userId` on `things` pointing to a `users` table:

```ts
// embed rows from `users`, selected by `userId` under the key `user`
db.query('things').embed('user', 'users', 'userId').first; // returns { id: '12', name: 'tool', user: { id: '1', name: 'User' } }
```

If there is an array of ids (e.g. `userIds`), there's a corresponding `embedMulti` method to embed collections of rows.

## Writing Data

Data is never written directly. Instead all writer methods return a redux action that can be handled by the included reducer.

### Writing Settings

```ts
store.dispatch(db.set('enableAwesomeThing', false));
```

### Writing Records

```ts
store.dispatch(things.insert({ name: 'New Thing' })); // ids get assigned automatically if not provided
store.dispatch(things.update('1', { name: 'New Name' })); // the first parameter could be an array instead for multi updates
store.dispatch(things.delete('1'));
```

Writing multiple records this way will update your UI multiple times - this can lead to performance problems, especially when updating and inserting huge amounts of data. For this you can use a transaction:

```ts
store.dispatch(
  db.transaction((dispatch) => {
    dispatch(things.insert({ name: 'First Thing' }));
    dispatch(things.insert({ name: 'Second Thing' }));
  })
);
```

This way there is only a single action dispatched to your redux store that encapsulates all the changes.

## Working with Contexts

Contexts work as a scratchpad to draft changes before you commit them to the main database. You can imagine them as a writable overlay over your database:

```ts
const draftDB = db.context('draft');
store.dispatch(draftDB.table('things').update('1', { name: 'Updated Thing' }));
// retrieve your state again from the store
db.table('things').first.name; // this is still 'First Thing'
draftDB.table('things').first.name; // this is updated to 'Updated Thing'
```

To get a list of everything that will be changed by the context, use the corresponding methods:

```ts
draftDB.table('things').changesFor('1'); // { deleted: false, inserted: false, changes: { name: 'Updated Thing' } }
draftDB.table('things').changes; // an array of change objects for every row that has changed
```

When you're done with changes, you can commit them to the main store:

```ts
store.dispatch(draftDB.commit());
```

You can also nest contexts and commit them to their parent context:

```ts
const draftDB = db.context('local').context('draft');
store.dispatch(draftDB.table('things').update('1', { name: 'Updated Thing' }));
store.dispatch(draftDB.commit());
// retrieve your state again from the store
db.table('things').first.name; // this is still 'First Thing'
draftDB.context('local').table('things').first.name; // this is now the value from the nested context
```

## Mutable Databases

As you've seen so far, `DB` always works on a snapshot of data, bringing it in line with Redux. Sometimes it's beneficial though to always have a getter for live data. This is where `MutableDB` comes in:

```ts
const db = new MutableDB(state);
db.set('enableAwesomeThing', false);
db.get('enableAwesomeThing'); // now is false

const things = db.table('things');
things.insert({ name: 'First Thing' });
things.where({ name: 'First Thing' }); // => retrieves your record
```

You can always get an immutable snapshot of the current state:

```ts
db.snapshot; // a DB instance of the current state
```

This database keeps the state internal and automatically uses the included reducer. If you have a Redux store (this is completely option), you can synchronize it with the `store` option:

```ts
import { store } from 'redux';
import { MutableDB, reducer } from 'redux-database';

const store = createStore(reducer(state), state);
const db = new MutableDB(state, { store }); // automatically synchronized with the store
```

This will automaticall keep the database instance in sync with your redux store and vice versa.

### Observing Changes

`MutableDB`s allow observing them for changes via subscriptions.

```ts
const observation = db.observe((snapshot) => snapshot.query(things).first);
observation.current; // always returns the current value
observation.subscribe((value) => console.log(value)); // Notifies if the result of the query has changed. This performs a deep equality check.
observation.query = (db) => db.query(things).last; // queries can be changed at runtime. This will also call all observers.
observation.cancel(); // to discard an observation once you're done
```

## React Integration

A full integration package with debugging tools is under development, until then you can simply integrate via hooks:

```ts
// define a hook to force a component to rerender:
export function useForceUpdate(): () => void {
  const [, updateState] = useState(true);
  return () => {
    updateState((state) => !state);
  };
}

// define a hook to use your database:
export function useDatabase<T>(query: (db: DB<State>) => T): T {
  const forceUpdate = useForceUpdate();
  const subscriptionRef = useRef<Subscription<State, T>>();
  if (!subscriptionRef.current) {
    subscriptionRef.current = mutableDB.observe(query);
    subscriptionRef.current.subscribe(() => forceUpdate());
  }
  subscriptionRef.current.query = query;
  useEffect(() => {
    return () => subscriptionRef.current.cancel();
  }, []);
  return subscriptionRef.current.current;
}
```

Now you can use this hook in your app to retrieve data and react will update your component if the data changes (and only, if it changes):

```ts
function ThingsList(): JSX.Element {
  const things = useDatabase(db => db.query('things').ordered(name: 'asc').all); // `things` is strongy typed here!
  return <div>{things.map(e => e.name).join()}</div>
}
```
