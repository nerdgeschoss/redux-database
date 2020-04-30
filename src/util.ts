export type OptionalID = { id?: string } & { [key: string]: unknown };

export interface Record {
  id: string;
}

export type RecordIdentifying = string | string[] | Record | Record[];

export function guid(): string {
  function s4(): string {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return [s4() + s4(), s4(), s4(), s4(), s4() + s4() + s4()].join('-');
}

export function byId(records: Record[]): { [id: string]: Record } {
  const map = {};
  records.forEach((e) => (map[e.id] = e));
  return map;
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

export function extractIds(object: RecordIdentifying): string[] {
  if (object === undefined) {
    throw new Error(
      'Trying to insert/update record which was not saved before'
    );
  }
  let test: Array<string | Record>;
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
