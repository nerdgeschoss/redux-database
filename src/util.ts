import { DataTable } from './table';

export type OptionalID = { id?: string };
export type InsertRecord<T extends Row> = { id?: string } & Omit<T, 'id'>;
export type RowInsertionList<T extends Row> =
  | InsertRecord<T>
  | Array<InsertRecord<T>>;

export interface Row {
  id: string;
}

export type RowIdentififying = string | string[] | Row | Row[];

export const emptyTable = Object.freeze({
  byId: {},
  ids: [],
});

export function guid(): string {
  function s4(): string {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return [s4() + s4(), s4(), s4(), s4(), s4() + s4() + s4()].join('-');
}

export function byId(records: Row[]): { [id: string]: Row } {
  const map = {};
  records.forEach((e) => (map[e.id] = e));
  return map;
}

export function pick<T extends {}, K extends keyof T>(
  obj: T,
  ...keys: K[]
): Pick<T, K> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ret: any = {};
  keys.forEach((key) => {
    ret[key] = obj[key];
  });
  return ret;
}

export function except<T extends {}, Key extends [...(keyof T)[]]>(
  object: T,
  keys: Key[]
): { [K2 in Exclude<keyof T, Key[number]>]: T[K2] } {
  const newObject = {} as {
    [K in keyof typeof object]: typeof object[K];
  };
  let key: keyof typeof object;
  for (key in object) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!keys.includes(key as any)) {
      newObject[key] = object[key];
    }
  }
  return newObject;
}

export function extractIds(object: RowIdentififying): string[] {
  if (object === undefined) {
    throw new Error(
      'Trying to insert/update record which was not saved before'
    );
  }
  let test: Array<string | Row>;
  if (!(object instanceof Array)) {
    test = [object];
  } else {
    test = object;
  }
  return test.map((e) => e['id'] || e);
}

export function applyId<T>(record: OptionalID): T {
  const copy = Object.assign({} as T, record);
  if (!copy.id) {
    copy.id = guid();
  }
  return copy;
}

export function extractParentContext(context: string): string | undefined {
  const index = context.lastIndexOf('.');
  if (index > 1) {
    return context.substr(0, index);
  }
  return;
}

export function flatten<T>(items: T[][]): T[] {
  return items.reduce((array, item) => array.concat(item), []);
}

export function compact<T>(items: Array<T | undefined>): T[] {
  return items.filter((e) => e !== undefined) as T[];
}

export function formatResultToTableData<RowType extends Row>(
  results: RowType[]
): DataTable<RowType> {
  const ids: string[] = [];
  const byId = {};
  for (const result of results) {
    ids.push(result.id);
    byId[result.id] = result;
  }
  return {
    ids,
    byId,
  };
}

export function orderBy<T extends {}, Key extends keyof T>(
  elements: T[],
  key: Key,
  order: 'asc' | 'desc' = 'asc'
): T[] {
  return elements.concat().sort((a, b) => {
    if (!a.hasOwnProperty(key) || !b.hasOwnProperty(key)) {
      return 0;
    }
    const varA = a[key];
    const varB = b[key];

    let comparison = 0;
    if (varA > varB) {
      comparison = 1;
    } else if (varA < varB) {
      comparison = -1;
    }
    return order === 'desc' ? comparison * -1 : comparison;
  });
}

type SimpleSortDescriptor<T> = keyof T;

type DetailedSortDescriptor<T> = {
  [P in keyof T]?: 'asc' | 'desc';
};

export type SortDescriptor<T> =
  | SimpleSortDescriptor<T>
  | DetailedSortDescriptor<T>;

export function order<T extends {}>(
  elements: T[],
  sortDescriptor: SortDescriptor<T>
): T[] {
  if (typeof sortDescriptor === 'string') {
    elements = orderBy(elements, sortDescriptor);
  } else {
    Object.keys(sortDescriptor).forEach((key) => {
      elements = orderBy(elements, key as keyof T, sortDescriptor[key]);
    });
  }
  return elements;
}
