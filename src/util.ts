export type OptionalID = { id?: string } & { [key: string]: any };

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
  return [s4() + s4(), s4(), s4(), s4(), s4() + s4() + s4()].join("-");
}

export function byId(records: Record[]): { [id: string]: Record } {
  const map = {};
  records.forEach(e => (map[e.id] = e));
  return map;
}

export function except(object: { [key: string]: any }, keys: string[]) {
  const newObject = {};
  Object.keys(object).forEach(key => {
    if (!keys.includes(key)) {
      newObject[key] = object[key];
    }
  });
  return newObject;
}

export function extractIds(object: RecordIdentifying): string[] {
  if (object === undefined) {
    throw "Trying to insert/update record which was not saved before";
  }
  let test: (string | Record)[];
  if (!(object instanceof Array)) {
    test = [object];
  } else {
    test = object;
  }
  return test.map(e => e["id"] || e);
}

export function applyId<T>(record: OptionalID): T {
  const copy = Object.assign({} as T, record);
  if (!copy.id) {
    copy.id = guid();
  }
  return copy;
}
