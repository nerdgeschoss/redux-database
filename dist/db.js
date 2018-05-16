"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return [s4() + s4(), s4(), s4(), s4(), s4() + s4() + s4()].join("-");
}
exports.guid = guid;
var DB = /** @class */ (function () {
    function DB(state, options) {
        if (options === void 0) { options = {}; }
        this.state = state;
        this.currentContext = options.context;
    }
    DB.prototype.get = function (name) {
        var _state = this.state;
        if (this.currentContext &&
            _state._context &&
            _state._context[this.currentContext] &&
            _state._context[this.currentContext] &&
            _state._context[this.currentContext][name]) {
            return _state._context[this.currentContext][name];
        }
        return this.state.settings[name];
    };
    DB.prototype.set = function (name, value) {
        return {
            type: "SETTINGS_UPDATE",
            payload: {
                context: this.currentContext,
                key: name,
                setting: value
            }
        };
    };
    DB.prototype.table = function (type) {
        var _state = this.state;
        var contextChanges = this.currentContext &&
            _state._context &&
            _state._context[this.currentContext] &&
            _state._context[this.currentContext][type];
        return new Table(_state.data[type], type, {
            context: this.currentContext,
            contextChanges: contextChanges
        });
    };
    DB.prototype.context = function (context) {
        return new DB(this.state, { context: context });
    };
    DB.prototype.transaction = function (execute) {
        var actions = [];
        execute(function (action) { return actions.push(action); });
        return {
            type: "TRANSACTION",
            payload: {
                actions: actions
            }
        };
    };
    DB.prototype.commit = function () {
        var currentContext = this.currentContext;
        if (!currentContext) {
            throw "Called commit on a root context.";
        }
        return {
            type: "COMMIT_CONTEXT",
            payload: { context: currentContext }
        };
    };
    return DB;
}());
exports.DB = DB;
var Table = /** @class */ (function () {
    function Table(data, key, options) {
        if (options === void 0) { options = {}; }
        this.data = data;
        this.key = key;
        this.context = options.context;
        this.contextChanges = options.contextChanges;
    }
    Table.prototype.find = function (id) {
        if (this.contextChanges && this.contextChanges.deletedIds.includes(id)) {
            return undefined;
        }
        var changes = (this.contextChanges && this.contextChanges.byId[id]) || {};
        var object = this.data.byId[id];
        return Object.assign({}, object, changes);
    };
    Object.defineProperty(Table.prototype, "all", {
        get: function () {
            var _this = this;
            return this.ids.map(function (id) { return _this.find(id); });
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Table.prototype, "first", {
        get: function () {
            return this.find(this.ids[0]);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Table.prototype, "last", {
        get: function () {
            return this.find(this.ids[this.ids.length - 1]);
        },
        enumerable: true,
        configurable: true
    });
    Table.prototype.where = function (query) {
        if (typeof query === "function") {
            return this.all.filter(query);
        }
        else {
            return this.all.filter(function (e) {
                for (var _i = 0, _a = Object.keys(query); _i < _a.length; _i++) {
                    var key = _a[_i];
                    if (e[key] != query[key]) {
                        return false;
                    }
                }
                return true;
            });
        }
    };
    Table.prototype.insert = function (records) {
        var _this = this;
        var newRecords = records instanceof Array ? records : [records];
        var insertedRecords = newRecords.map(function (e) { return _this.applyId(e); });
        return {
            type: "INSERT_RECORD",
            payload: {
                key: this.key,
                context: this.context,
                ids: insertedRecords.map(function (e) { return e.id; }),
                data: insertedRecords
            }
        };
    };
    Table.prototype.update = function (id, values) {
        return {
            type: "UPDATE_RECORD",
            payload: {
                key: this.key,
                context: this.context,
                ids: this.extractIds(id),
                data: values
            }
        };
    };
    Table.prototype.delete = function (id) {
        return {
            type: "DELETE_RECORD",
            payload: {
                key: this.key,
                context: this.context,
                ids: this.extractIds(id)
            }
        };
    };
    Object.defineProperty(Table.prototype, "ids", {
        get: function () {
            var newIds = (this.contextChanges || { newIds: [] }).newIds;
            var deletedIds = (this.contextChanges || { deletedIds: [] })
                .deletedIds;
            return this.data.ids.concat(newIds).filter(function (id) { return !deletedIds.includes(id); });
        },
        enumerable: true,
        configurable: true
    });
    Table.prototype.extractIds = function (object) {
        if (object === undefined) {
            throw "Trying to insert/update record which was not saved before";
        }
        var test;
        if (!(object instanceof Array)) {
            test = [object];
        }
        else {
            test = object;
        }
        return test.map(function (e) { return e["id"] || e; });
    };
    Table.prototype.applyId = function (record) {
        var copy = Object.assign({}, record);
        if (!copy.id) {
            copy.id = guid();
        }
        return copy;
    };
    return Table;
}());
exports.Table = Table;
function byId(records) {
    var map = {};
    records.forEach(function (e) { return (map[e.id] = e); });
    return map;
}
function except(object, keys) {
    var newObject = {};
    Object.keys(object).forEach(function (key) {
        if (!keys.includes(key)) {
            newObject[key] = object[key];
        }
    });
    return newObject;
}
function applyInContext(state, context, field, handler) {
    var _context = state._context || {};
    var changes = (_context[context] &&
        _context[context][field]) || { byId: {}, deletedIds: [], newIds: [] };
    changes = handler(changes);
    var currentContext = _context[context] || {};
    return __assign({}, state, { _context: __assign({}, _context, (_a = {}, _a[context] = __assign({}, currentContext, (_b = {}, _b[field] = __assign({}, currentContext[field], changes), _b)), _a)) });
    var _a, _b;
}
function reduce(state, action) {
    switch (action.type) {
        case "INSERT_RECORD": {
            var key_1 = action.payload.key;
            var newIDs_1 = action.payload.ids.filter(function (id) { return !state.data[key_1].ids.includes(id); });
            if (action.payload.context) {
                state = applyInContext(state, action.payload.context, key_1, function (changes) {
                    return __assign({}, changes, { newIds: changes.newIds.concat(newIDs_1), byId: __assign({}, changes.byId, byId(action.payload.data)) });
                });
            }
            else {
                var dataSet = __assign({}, state.data[key_1], { byId: __assign({}, state.data[key_1].byId, byId(action.payload.data)), ids: state.data[key_1].ids.concat(newIDs_1) });
                state = __assign({}, state, { data: __assign({}, state.data, (_a = {}, _a[key_1] = dataSet, _a)) });
            }
            break;
        }
        case "DELETE_RECORD": {
            var key = action.payload.key;
            var ids_1 = action.payload.ids;
            if (action.payload.context) {
                state = applyInContext(state, action.payload.context, key, function (changes) {
                    return __assign({}, changes, { deletedIds: changes.deletedIds.concat(ids_1) });
                });
            }
            else {
                var dataSet = __assign({}, state.data[key], { byId: except(state.data[key].byId, ids_1), ids: state.data[key].ids.filter(function (e) { return !ids_1.includes(e); }) });
                state = __assign({}, state, { data: __assign({}, state.data, (_b = {}, _b[key] = dataSet, _b)) });
            }
            break;
        }
        case "UPDATE_RECORD": {
            var key_2 = action.payload.key;
            if (action.payload.context) {
                state = applyInContext(state, action.payload.context, key_2, function (changes) {
                    var updates = {};
                    action.payload.ids.forEach(function (e) { return (updates[e] = __assign({}, changes.byId[e], action.payload.data)); });
                    return __assign({}, changes, { byId: __assign({}, changes.byId, updates) });
                });
            }
            else {
                var updates_1 = {};
                action.payload.ids.forEach(function (e) {
                    return (updates_1[e] = __assign({}, state.data[key_2].byId[e], action.payload.data));
                });
                var dataSet = __assign({}, state.data[key_2], { byId: __assign({}, state.data[key_2].byId, updates_1) });
                state = __assign({}, state, { data: __assign({}, state.data, (_c = {}, _c[key_2] = dataSet, _c)) });
            }
            break;
        }
        case "SETTINGS_UPDATE": {
            var key = action.payload.key;
            if (action.payload.context) {
                var _state = state;
                var _context = _state._context || {};
                var currentContext = _context[action.payload.context] || {};
                state = __assign({}, _state, { _context: __assign({}, _context, (_d = {}, _d[action.payload.context] = currentContext, _d)) });
            }
            else {
                state = __assign({}, state, { settings: __assign({}, state.settings, (_e = {}, _e[key] = action.payload.setting, _e)) });
            }
            break;
        }
        case "COMMIT_CONTEXT": {
            var _state = state;
            var context = action.payload.context;
            var changes_1 = (_state._context && _state._context[context]) || {};
            state = __assign({}, _state, { data: __assign({}, _state.data), _context: except(_state._context, [context]) });
            Object.keys(changes_1).forEach(function (table) {
                var change = changes_1[table];
                var data = state.data[table];
                state.data[table] = {
                    ids: data.ids
                        .concat(change.newIds)
                        .filter(function (id) { return !change.deletedIds.includes(id); }),
                    byId: __assign({}, data.byId)
                };
                Object.keys(change.byId).forEach(function (id) {
                    state.data[table].byId[id] = __assign({}, state.data[table].byId[id], change.byId[id]);
                });
            });
            break;
        }
        case "TRANSACTION": {
            action.payload.actions.forEach(function (a) {
                state = reduce(state, a);
            });
            break;
        }
    }
    return state;
    var _a, _b, _c, _d, _e;
}
exports.reduce = reduce;
function reducer(initialState) {
    return function (state, action) {
        if (!state) {
            state = initialState;
        }
        return reduce(state, action);
    };
}
exports.reducer = reducer;
//# sourceMappingURL=db.js.map