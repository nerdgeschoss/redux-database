import { StateDefining, ContextState } from './db';
import { DBAction } from './actions';
import { ContextChanges, DataTable } from './table';
import { byId, Record, except, extractParentContext } from './util';

function applyInContext<S, T>(
  state: S,
  context: string,
  field: string,
  handler: (changes: ContextChanges<T>) => ContextChanges<T>
): S {
  const contextContent = (state as any)._context || {};
  let changes: ContextChanges<any> = (contextContent[context] &&
    contextContent[context][field]) || { byId: {}, deletedIds: [], newIds: [] };
  changes = handler(changes);
  const currentContext = contextContent[context] || {};
  return {
    ...(state as any),
    _context: {
      ...contextContent,
      [context]: {
        ...currentContext,
        [field]: { ...currentContext[field], ...changes },
      },
    },
  };
}

export function reduce<State extends StateDefining>(
  state: State,
  action: DBAction
): State {
  switch (action.type) {
    case 'INSERT_RECORD': {
      const key = action.payload.key;
      const newIDs = action.payload.ids.filter(
        (id) => !state.data[key].ids.includes(id)
      );
      if (action.payload.context) {
        state = applyInContext(
          state,
          action.payload.context,
          key,
          (changes) => {
            return {
              ...changes,
              newIds: [...changes.newIds, ...newIDs],
              byId: { ...changes.byId, ...byId(action.payload.data) },
            };
          }
        );
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
    case 'UPSERT_RECORD': {
      const key = action.payload.key;
      const currentIds = new Set<string>(state.data[key].ids);
      const context = action.payload.context;
      const newRecords = action.payload.data.filter(
        (e) => !currentIds.has(e.id)
      );
      const existingRecords = action.payload.data.filter((e) =>
        currentIds.has(e.id)
      );
      state = reduce(state, {
        type: 'INSERT_RECORD',
        payload: {
          ids: newRecords.map((e) => e.id),
          key,
          context,
          data: newRecords,
        },
      });
      for (const record of existingRecords) {
        state = reduce(state, {
          type: 'UPDATE_RECORD',
          payload: {
            ids: [record.id],
            key,
            context,
            data: record,
          },
        });
      }
      break;
    }
    case 'DELETE_RECORD': {
      const key = action.payload.key;
      const ids = action.payload.ids;
      if (action.payload.context) {
        state = applyInContext(
          state,
          action.payload.context,
          key,
          (changes) => {
            return {
              ...changes,
              deletedIds: [...changes.deletedIds, ...ids],
            };
          }
        );
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
        state = applyInContext(
          state,
          action.payload.context,
          key,
          (changes) => {
            const updates: { [id: string]: Partial<Record> } = {};
            action.payload.ids.forEach(
              (e) =>
                (updates[e] = { ...changes.byId[e], ...action.payload.data })
            );
            return {
              ...changes,
              byId: { ...changes.byId, ...updates },
            };
          }
        );
      } else {
        const updatedId = action.payload.data['id'];
        const updates: { [id: string]: Record } = {};
        action.payload.ids.forEach(
          (e) =>
            (updates[updatedId || e] = {
              ...state.data[key].byId[e],
              ...action.payload.data,
            })
        );
        const dataSet: DataTable<Record> = {
          ...state.data[key],
          byId: { ...state.data[key].byId, ...updates },
        };
        if (updatedId !== undefined) {
          action.payload.ids.forEach((id) => {
            if (id === updatedId) {
              return;
            }
            delete dataSet.byId[id];
          });
          dataSet.ids = dataSet.ids.map((e) =>
            action.payload.ids.includes(e) ? updatedId : e
          );
        }
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
        const anyState = state as any;
        const context = anyState.context || {};
        const currentContext = context[action.payload.context] || {};
        state = {
          ...anyState,
          _context: { ...context, [action.payload.context]: currentContext },
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
      const context = action.payload.context;
      const tableToMerge = action.payload.table;
      const idsToMerge = action.payload.ids;
      const contextState = (state as any) as ContextState;
      const revertedState = (reduce(state, {
        type: 'REVERT_CONTEXT',
        payload: { context, table: tableToMerge, ids: idsToMerge },
      }) as any) as ContextState;
      const parentContext = extractParentContext(context);
      const changes: { [table: string]: ContextChanges<Record> } =
        (contextState._context && contextState._context[context]) || {};

      if (parentContext) {
        const parentContextChanges: {
          [table: string]: ContextChanges<Record>;
        } = { ...contextState._context![parentContext] };
        Object.keys(changes).forEach((table) => {
          if (tableToMerge && tableToMerge !== table) {
            return;
          }
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
          parentChange.newIds = [
            ...parentChange.newIds,
            ...change.newIds.filter(
              (e) => !idsToMerge || idsToMerge.includes(e)
            ),
          ];
          parentChange.deletedIds = [
            ...parentChange.deletedIds,
            ...change.deletedIds,
          ];
          Object.keys(change.byId).forEach((id) => {
            if (idsToMerge && !idsToMerge.includes(id)) {
              return;
            }
            parentChange.byId[id] = {
              ...parentChange.byId[id],
              ...change.byId[id],
            };
          });
        });
        state = {
          ...contextState,
          _context: {
            ...revertedState._context,
            [parentContext]: parentContextChanges,
          },
        } as any;
      } else {
        state = {
          ...contextState,
          data: { ...(contextState as any).data }, // create a new object so it's ok to modify it later
          _context: revertedState._context,
        } as any;
        Object.keys(changes).forEach((table) => {
          if (tableToMerge && tableToMerge !== table) {
            return;
          }
          const change = changes[table];
          const data = state.data[table] as DataTable<Record>;
          state.data[table] = {
            ids: data.ids
              .concat(
                change.newIds.filter(
                  (id) => !idsToMerge || idsToMerge.includes(id)
                )
              )
              .filter((id) => !change.deletedIds.includes(id)),
            byId: { ...data.byId },
          };
          Object.keys(change.byId).forEach((id) => {
            if (idsToMerge && !idsToMerge.includes(id)) {
              return;
            }
            state.data[table].byId[id] = {
              ...state.data[table].byId[id],
              ...change.byId[id],
            };
          });
        });
      }
      break;
    }
    case 'REVERT_CONTEXT': {
      const contextState = (state as any) as ContextState;
      const context = action.payload.context;
      const changes: { [table: string]: ContextChanges<Record> } =
        (contextState._context && contextState._context[context]) || {};
      const tableToRevert = action.payload.table;
      const idsToRevert = action.payload.ids;
      let contextUpdates:
        | { [table: string]: ContextChanges<Record> }
        | undefined;
      if (tableToRevert) {
        contextUpdates = { ...changes };
        if (idsToRevert) {
          const contextTableChange = contextUpdates[tableToRevert];
          const tableChanges: { [id: string]: Partial<Record> } = {};
          Object.keys(contextTableChange.byId).forEach((id) => {
            if (idsToRevert.includes(id)) {
              return;
            }
            tableChanges[id] = contextTableChange.byId[id];
          });
          contextUpdates[tableToRevert] = {
            byId: tableChanges,
            deletedIds: contextTableChange.deletedIds.filter(
              (id) => !idsToRevert.includes(id)
            ),
            newIds: contextTableChange.newIds.filter(
              (id) => !idsToRevert.includes(id)
            ),
          };
        } else {
          delete contextUpdates[tableToRevert];
        }
      }
      state = {
        ...contextState,
        _context: { ...contextState._context, [context]: contextUpdates },
      } as any;
      break;
    }
    case 'TRANSACTION': {
      action.payload.actions.forEach((a) => {
        state = reduce(state, a);
      });
      break;
    }
  }
  return state;
}

export function reducer<State extends StateDefining>(
  initialState: State
): (state: State | null | undefined, action: DBAction) => State {
  return (state, action) => {
    if (!state) {
      state = initialState;
    }
    return reduce(state, action);
  };
}
