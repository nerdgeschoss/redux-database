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
    function DB(state) {
        this.state = state;
    }
    DB.prototype.get = function (name) {
        return this.state.settings[name];
    };
    DB.prototype.set = function (name, value) {
        return {
            type: "SETTINGS_UPDATE",
            payload: {
                key: name,
                setting: value
            }
        };
    };
    DB.prototype.table = function (type) {
        return new Table(this.state.data[type], type);
    };
    return DB;
}());
exports.DB = DB;
var Table = /** @class */ (function () {
    function Table(data, key) {
        this.data = data;
        this.key = key;
    }
    Table.prototype.find = function (id) {
        return this.data.byId[id];
    };
    Object.defineProperty(Table.prototype, "all", {
        get: function () {
            var _this = this;
            return this.data.ids.map(function (id) { return _this.data.byId[id]; });
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Table.prototype, "first", {
        get: function () {
            return this.data.byId[this.data.ids[0]] || null;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Table.prototype, "last", {
        get: function () {
            return this.data.byId[this.data.ids[this.data.ids.length - 1]] || null;
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
                ids: this.extractIds(id)
            }
        };
    };
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
function reducer(initialState) {
    return function (state, action) {
        if (!state) {
            return initialState;
        }
        switch (action.type) {
            case "INSERT_RECORD": {
                var key_1 = action.payload.key;
                var newIDs = action.payload.ids.filter(function (id) { return !state.data[key_1].ids.includes(id); });
                var dataSet = __assign({}, state.data[key_1], { byId: __assign({}, state.data[key_1].byId, byId(action.payload.data)), ids: state.data[key_1].ids.concat(newIDs) });
                return __assign({}, state, { data: __assign({}, state.data, (_a = {}, _a[key_1] = dataSet, _a)) });
            }
            case "DELETE_RECORD": {
                var key = action.payload.key;
                var ids_1 = action.payload.ids;
                var dataSet = __assign({}, state.data[key], { byId: except(state.data[key].byId, ids_1), ids: state.data[key].ids.filter(function (e) { return !ids_1.includes(e); }) });
                return __assign({}, state, { data: __assign({}, state.data, (_b = {}, _b[key] = dataSet, _b)) });
            }
            case "UPDATE_RECORD": {
                var key_2 = action.payload.key;
                var updates_1 = {};
                action.payload.ids.forEach(function (e) {
                    return (updates_1[e] = __assign({}, state.data[key_2].byId[e], action.payload.data));
                });
                var dataSet = __assign({}, state.data[key_2], { byId: __assign({}, state.data[key_2].byId, updates_1) });
                return __assign({}, state, { data: __assign({}, state.data, (_c = {}, _c[key_2] = dataSet, _c)) });
            }
            case "SETTINGS_UPDATE": {
                var key = action.payload.key;
                return __assign({}, state, { settings: __assign({}, state.settings, (_d = {}, _d[key] = action.payload.setting, _d)) });
            }
        }
        var _a, _b, _c, _d;
    };
}
exports.reducer = reducer;
//# sourceMappingURL=db.js.map