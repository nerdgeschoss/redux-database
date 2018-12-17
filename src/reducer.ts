import { State, TypeLookup } from './db';
import { DBAction } from './actions';
import { ContextChanges, DataTable } from './table';
import { byId, Record, except, extractParentContext } from './util';

function applyInContext<S, T>(
  state: S,
  context: string,
  field: string,
  handler: (changes: ContextChanges<T>) => ContextChanges<T>
): S {
  const _context = (state as any)._context || {};
  let changes: ContextChanges<any> = (_context[context] &&
    _context[context][field]) || { byId: {}, deletedIds: [], newIds: [] };
  changes = handler(changes);
  const currentContext = _context[context] || {};
  return {
    ...(state as any),
    _context: {
      ..._context,
      [context]: {
        ...currentContext,
        [field]: { ...currentContext[field], ...changes },
      },
    },
  };
}

export function reduce<
  Setting,
  Data,
  Types extends TypeLookup,
  S extends State<Data, Setting, Types>
>(state: S, action: DBAction): S {
  switch (action.type) {
    case 'INSERT_RECORD': {
      const key = action.payload.key;
      const newIDs = action.payload.ids.filter(
        id => !state.data[key].ids.includes(id)
      );
      if (action.payload.context) {
        state = applyInContext(state, action.payload.context, key, changes => {
          return {
            ...changes,
            newIds: [...changes.newIds, ...newIDs],
            byId: { ...changes.byId, ...byId(action.payload.data) },
          };
        });
      } else {
        const dataSet = {
          ...state.data[key],
          byId: { ...state.data[key].byId, ...byId(action.payload.data) },
          ids: [...state.data[key].ids, ...newIDs],
        };
        state = {
          ...(state as any),
          data: { ...(state.data as any), [key]: dataSet },
        };
      }
      break;
    }
    case 'DELETE_RECORD': {
      const key = action.payload.key;
      const ids = action.payload.ids;
      if (action.payload.context) {
        state = applyInContext(state, action.payload.context, key, changes => {
          return {
            ...changes,
            deletedIds: [...changes.deletedIds, ...ids],
          };
        });
      } else {
        const dataSet = {
          ...state.data[key],
          byId: except(state.data[key].byId, ids),
          ids: state.data[key].ids.filter((e: string) => !ids.includes(e)),
        };
        state = {
          ...(state as any),
          data: { ...(state.data as any), [key]: dataSet },
        };
      }
      break;
    }
    case 'UPDATE_RECORD': {
      const key = action.payload.key;
      if (action.payload.context) {
        state = applyInContext(state, action.payload.context, key, changes => {
          const updates: { [id: string]: Partial<Record> } = {};
          action.payload.ids.forEach(
            e => (updates[e] = { ...changes.byId[e], ...action.payload.data })
          );
          return {
            ...changes,
            byId: { ...changes.byId, ...updates },
          };
        });
      } else {
        const updates: { [id: string]: Record } = {};
        action.payload.ids.forEach(
          e =>
            (updates[e] = {
              ...state.data[key].byId[e],
              ...action.payload.data,
            })
        );
        const dataSet = {
          ...state.data[key],
          byId: { ...state.data[key].byId, ...updates },
        };
        state = {
          ...(state as any),
          data: { ...(state.data as any), [key]: dataSet },
        };
      }
      break;
    }
    case 'SETTINGS_UPDATE': {
      const key = action.payload.key;
      if (action.payload.context) {
        const _state = state as any;
        const _context = _state._context || {};
        const currentContext = _context[action.payload.context] || {};
        state = {
          ..._state,
          _context: { ..._context, [action.payload.context]: currentContext },
        };
      } else {
        state = {
          ...(state as any),
          settings: {
            ...(state.settings as any),
            [key]: action.payload.setting,
          },
        };
      }
      break;
    }
    case 'COMMIT_CONTEXT': {
      const _state = state as any;
      const context = action.payload.context;
      const parentContext = extractParentContext(context);
      const changes: { [table: string]: ContextChanges<Record> } =
        (_state._context && _state._context[context]) || {};
      if (parentContext) {
        const parentContextChanges: {
          [table: string]: ContextChanges<Record>;
        } = { ..._state._context[parentContext] };
        Object.keys(changes).forEach(table => {
          const change = changes[table];
          if (!parentContextChanges[table]) {
            Object.assign(parentContextChanges, {
              [table]: {
                byId: {},
                newIds: [],
                deletedIds: [],
              },
            });
          }
          const parentChange = parentContextChanges[table];
          parentChange.newIds = [...parentChange.newIds, ...change.newIds];
          parentChange.deletedIds = [
            ...parentChange.deletedIds,
            ...change.deletedIds,
          ];
          Object.keys(change.byId).forEach(id => {
            parentChange.byId[id] = {
              ...parentChange.byId[id],
              ...change.byId[id],
            };
          });
        });
        state = {
          ..._state,
          _context: {
            ..._state._context,
            [parentContext]: parentContextChanges,
          },
        };
      } else {
        state = {
          ..._state,
          data: { ..._state.data }, // create a new object so it's ok to modify it later
          _context: except(_state._context, [context]),
        };
        Object.keys(changes).forEach(table => {
          const change = changes[table];
          const data = state.data[table] as DataTable<Record>;
          state.data[table] = {
            ids: data.ids
              .concat(change.newIds)
              .filter(id => !change.deletedIds.includes(id)),
            byId: { ...data.byId },
          };
          Object.keys(change.byId).forEach(id => {
            state.data[table].byId[id] = {
              ...state.data[table].byId[id],
              ...change.byId[id],
            };
          });
        });
      }
      break;
    }
    case 'TRANSACTION': {
      action.payload.actions.forEach(a => {
        state = reduce(state, a);
      });
      break;
    }
  }
  return state;
}

export function reducer<
  Setting,
  Data,
  Types extends TypeLookup,
  S extends State<Data, Setting, Types>
>(initialState: S): (state: S | null | undefined, action: DBAction) => S {
  return (state, action) => {
    if (!state) {
      state = initialState;
    }
    return reduce(state, action);
  };
}
