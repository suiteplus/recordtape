///<reference path="../typings/suitescript-1.0.d.ts"/>
///<reference path="../typings/index.d.ts"/>
"use strict";
require('./console-log');
var Search = require('./search');
var Sublist = require('./sublist');
var File = require('netsuite-file');
//record cache
var _cache = {};
//which fields to preload
exports.__fieldConf = {};
//init
try {
    var conf = nlapiLoadFile('SuiteScripts/fieldconf.json').getValue();
    exports.__fieldConf = JSON.parse(conf) || {};
}
catch (e) {
    console.error('ERROR', 'não carregou baseconf');
}
var _window;
exports.setWindow = function (wind) {
    _window = wind;
};
exports.factory = recordFactory;
function recordFactory(meta) {
    meta.fld = meta.fld || {};
    meta.sublists = meta.sublists || {};
    meta.fld.externalid = 'externalid';
    meta.fld.internalid = 'internalid';
    meta.unique = meta.unique || {};
    var __fldInverseMemo;
    function fldInverse() {
        if (__fldInverseMemo)
            return __fldInverseMemo;
        var out = {};
        for (var it in meta.fld) {
            out[meta.fld[it]] = it;
        }
        __fldInverseMemo = out;
        return __fldInverseMemo;
    }
    var __sublists = meta.sublists || {};
    var __doCache = true;
    var __exposed = [];
    var __customMethods = __preRegisterMethod[meta.code] || {};
    if (__preRegisterMethod[meta.code])
        delete __preRegisterMethod[meta.code];
    //_fieldCache : {} ,
    //_origin : null,
    //record : <nlobjRecord>null ,
    //_callers : <typeof _callers>null 
    function build(state) {
        //instance methods below
        state.fieldCache = state.fieldCache || {};
        state.submitCache = state.submitCache || {};
        var rec = {
            f: function (field) {
                if (!field)
                    throw nlapiCreateError('RTAPE_F1', 'Record.f recebeu parâmetro vazio.');
                if (!meta.fld[field]) {
                    throw nlapiCreateError('RTAPE_F2', 'Campo ' + field + ' não cadastrado.');
                }
                else {
                    field = meta.fld[field];
                }
                if (state.fieldCache[field])
                    return state.fieldCache[field];
                var fields = exports.__fieldConf[meta.code] || [];
                var found = ~fields.indexOf(field);
                //se houver fieldconf, carregar todos os campos para o cache
                if (fields.length && found) {
                    var resp = state.callers.fs(rec, fields);
                    for (var it_1 in resp) {
                        state.fieldCache[it_1] = resp[it_1];
                    }
                    return state.fieldCache[field];
                }
                else {
                    exports.__fieldConf[meta.code] = exports.__fieldConf[meta.code] || [];
                    exports.__fieldConf[meta.code].push(field);
                    state.fieldCache[field] = state.callers.f(rec, field);
                    return state.fieldCache[field];
                }
            },
            ftext: function (field) {
                if (!field)
                    throw nlapiCreateError('RTAPE_FTEXT1', 'Record.ftext recebeu parâmetro vazio.');
                if (!meta.fld[field]) {
                    throw nlapiCreateError('RTAPE_FTEXT2', 'Campo ' + field + ' não cadastrado.');
                }
                else {
                    field = meta.fld[field];
                }
                return state.callers.ftext(rec, field);
            },
            ftextraw: function (name) {
                var field = fldInverse()[name];
                if (!field)
                    throw nlapiCreateError('RTAPE_FTEXTRAW', "Field " + name + " not found.");
                return rec.ftext(field);
            },
            fraw: function (name) {
                var field = fldInverse()[name];
                if (!field)
                    throw nlapiCreateError('fraw', "Field " + name + " not found.");
                return rec.f(field);
            },
            fjoin: function (field, field2) {
                if (!field)
                    throw nlapiCreateError('RTAPE_FJOIN1', 'Record.fjoin recebeu parâmetro vazio.');
                if (!meta.fld[field]) {
                    throw nlapiCreateError('RTAPE_FJOIN2', 'Campo ' + field + ' não cadastrado.');
                }
                else {
                    field = meta.fld[field];
                }
                if (state.fieldCache[field + '.' + field2])
                    return state.fieldCache[field + '.' + field2];
                var fields = exports.__fieldConf[meta.code] || [];
                var found = ~fields.indexOf(field + '.' + field2);
                //se houver fieldconf, carregar todos os campos para o cache
                if (fields.length && found) {
                    var resp = state.callers.fs(rec, fields);
                    for (var it_2 in resp) {
                        state.fieldCache[it_2] = resp[it_2];
                    }
                    return state.fieldCache[field + '.' + field2];
                }
                else {
                    exports.__fieldConf[meta.code] = exports.__fieldConf[meta.code] || [];
                    exports.__fieldConf[meta.code].push(field + '.' + field2);
                    state.fieldCache[field + '.' + field2] = state.callers.f(rec, field + '.' + field2);
                    return state.fieldCache[field + '.' + field2];
                }
            },
            fset: function (field, value) {
                if (Array.isArray(field))
                    throw nlapiCreateError('RTAPE_FSET1', 'fset não recebe array.');
                if (!meta.fld[field]) {
                    throw nlapiCreateError('RTAPE_FSET2', 'Campo ' + field + ' não cadastrado.');
                }
                else
                    field = meta.fld[field];
                state.fieldCache[field] = value;
                state.submitCache = state.submitCache || {};
                state.submitCache[field] = value;
                return rec;
            },
            fsetraw: function (name, value) {
                var field = fldInverse()[name];
                if (!field)
                    throw nlapiCreateError('fraw', "Field " + name + " not found.");
                return rec.fset(field, value);
            },
            put: function (data) {
                if (Array.isArray(data))
                    throw nlapiCreateError('RTAPE_PUT', 'Array not expected in rtape#put');
                for (var it in data) {
                    rec.fset(it, data[it]);
                }
                return rec;
            },
            json: function () {
                var jsout = __exposed.reduce(function (bef, field) {
                    bef[field] = rec.f(field);
                    return bef;
                }, {});
                jsout.id = rec.id;
                return jsout;
            },
            submit: function (opts) {
                _cache[(meta.code + '|' + rec.id)] = rec;
                if (rec.id === null && !opts.noUniqueCheck) {
                    for (var it_3 in meta.unique) {
                        var fields = meta.unique[it_3];
                        var anyempty = fields.some(function (f) {
                            return !state.fieldCache[f];
                        });
                        if (anyempty)
                            continue;
                        var _expr = fields.map(function (f) {
                            return [f, 'anyof', state.fieldCache[f]];
                        });
                        var expr = [];
                        for (var it2 = 0; it2 < _expr.length; it2++) {
                            expr.push(_expr[it2]);
                            if (Number(it2) < _expr.length - 1)
                                expr.push('and');
                        }
                        var search = Static.search(expr).run();
                        if (search.length)
                            throw nlapiCreateError('RTAPE_CONSTRAINT', "Record create constraint failed " +
                                ("for key " + JSON.stringify(fields) + " when attempting to save " + JSON.stringify(state.fieldCache)));
                    }
                }
                state.callers.submit(rec);
                return rec;
            },
            delete: function () {
                if (_cache[(meta.code + '|' + state.id)])
                    delete _cache[(meta.code + '|' + state.id)];
                return nlapiDeleteRecord(rec.meta.code, String(rec.id));
            },
            sublist: function (name, tgtclass) {
                if (!tgtclass) {
                    throw nlapiCreateError('sublist', 'Missing 2nd parameter.');
                }
                var field = meta.sublists[name];
                if (!field)
                    throw nlapiCreateError('sublist', "Unregistered sublist " + name + ".");
                if (state.origin == 'record') {
                    var out = [];
                    var wrap = Sublist.fromRtape(rec, tgtclass, name);
                    for (var it = 1; it <= wrap.count(); it++) {
                        var item = tgtclass.fromRecordSublist(wrap, wrap.idFromLine(it));
                        out.push(item);
                    }
                    return out;
                }
                else {
                    if (field.substr(0, 'recmach'.length) == 'recmach') {
                        field = field.substr('recmach'.length);
                    }
                    field = tgtclass.fldInverse()[field];
                    var res = tgtclass.search({ allFields: true, big: true }, [field, 'anyof', state.id]);
                    return res.run();
                }
            },
            get id() { return Number(state.id); },
            get fld() { return meta.fld; },
            get code() { return meta.code; },
            getStatic: function () { return Static; },
            state: state,
            meta: meta
        };
        __exposed.forEach(function (name) {
            Object.defineProperty(rec, name, {
                enumerable: false,
                get: function () {
                    return rec.f(name);
                },
                set: function (value) {
                    return rec.fset(name, value);
                }
            });
        });
        var _items = [];
        for (var it in __customMethods) {
            _items.push(it);
        }
        _items.forEach(function (it) {
            rec[it] = function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i - 0] = arguments[_i];
                }
                args = [rec].concat(args);
                return __customMethods[it].apply(rec, args);
            };
        });
        return rec;
    }
    var Static = {
        getCode: function (id) {
            return meta.code;
        },
        create: function () {
            return build({
                origin: 'record',
                code: meta.code,
                record: nlapiCreateRecord(meta.code),
                callers: _callers.Record,
                id: null
            });
        },
        fromId: function (id, opts) {
            opts = opts || {};
            if (!opts.noCache && _cache[(meta.code + '|' + id)])
                return _cache[(meta.code + '|' + id)];
            var out = build({
                code: Static.getCode(id),
                id: Number(id),
                origin: 'id',
                callers: _callers.Id
            });
            _cache[(meta.code + '|' + id)] = out;
            return out;
        },
        fromRecord: function (inp) {
            var id = (typeof inp == 'object') ? inp.getId() : inp;
            if (_cache[(meta.code + '|' + id)])
                return _cache[(meta.code + '|' + id)];
            //out.code = Record._getCode(id);
            var rec;
            if (typeof inp == 'number' || typeof inp == 'string')
                rec = nlapiLoadRecord(meta.code, inp);
            else
                rec = inp;
            var out = build({
                code: Static.getCode(id),
                origin: 'record',
                callers: _callers.Record,
                record: rec
            });
            _cache[(meta.code + '|' + id)] = out;
            return out;
        },
        fromRecordSublist: function (sl, id) {
            if (_cache[(meta.code + '|' + id)])
                return _cache[(meta.code + '|' + id)];
            var out = build({
                code: Static.getCode(id),
                objSublist: sl,
                origin: 'recordsublist',
                id: Number(id),
                line: sl.lineFromId(Number(id)),
                callers: _callers.RecordSublist,
            });
            _cache[(meta.code + '|' + id)] = out;
            return out;
        },
        fromSearchResult: function (res) {
            if (_cache[meta.code + '|' + res.id])
                return _cache[meta.code + '|' + res.id];
            var out = build({
                code: Static.getCode(res.id),
                origin: 'search',
                callers: _callers.Search,
                result: res,
                id: Number(res.id),
            });
            _cache[meta.code + '|' + res.id] = out;
            return out;
        },
        fromCurrentClient: function (wind) {
            var id = Number(nlapiGetRecordId());
            if (_cache[(meta.code + '|' + id)])
                return _cache[(meta.code + '|' + id)];
            var out = build({
                code: Static.getCode(id),
                window: wind || _window || window,
                origin: 'client',
                callers: _callers.Client,
                id: id,
                fieldCache: {}
            });
            _cache[meta.code + '|' + id] = out;
            return out;
        },
        search: function (arg1, arg2, arg3) {
            var opts, filters, columns;
            if (Array.isArray(arg1)) {
                opts = {};
                filters = arg1;
                columns = arg3;
            }
            else {
                opts = arg1;
                filters = arg2;
                columns = arg3;
            }
            return Search.search(opts, Static, filters, columns);
        },
        curryf: function (field) {
            return function (id) {
                var inst = Static.fromId(id);
                return inst.f(field);
            };
        },
        expose: function (fields) {
            (fields || []).forEach(function (field) {
                if (!meta.fld[field])
                    throw nlapiCreateError('recordExpose', 'Campo ' + field + ' não está definido neste registro.');
                __exposed.push(field);
            });
        },
        exposeAll: function () {
            var fields = [];
            for (var it in meta.fld) {
                fields.push(it);
            }
            return Static.expose(fields);
        },
        registerMethod: function (name, method) {
            __customMethods[name] = method;
        },
        get customMethods() { return __customMethods; },
        get code() { return meta.code; },
        get fld() { return meta.fld; },
        fldInverse: fldInverse,
        meta: meta,
        idField: meta.idField || 'id'
    };
    __moduleCache[meta.code] = Static;
    return Static;
}
exports.recordFactory = recordFactory;
var dummyStatic = null && recordFactory(1);
var __moduleCache = {};
var __preRegisterMethod = {};
function module(code) {
    if (__moduleCache[code])
        return __moduleCache[code];
    __preRegisterMethod[code] = {};
    var Stub = {
        stub: true,
        registerMethod: function (name, method) {
            __preRegisterMethod[code][name] = method;
        },
        get code() { return code; },
    };
    __moduleCache[code] = Stub;
    return __moduleCache[code];
}
exports.module = module;
var _callers = {
    Id: {
        f: function (rec, field) {
            //console.log('id lookup', field) 
            return nlapiLookupField(rec.meta.code, rec.id, field);
        },
        fs: function (rec, fields) {
            //console.log('id fs', fields)
            return nlapiLookupField(rec.meta.code, rec.id, fields);
        },
        ftext: function (rec, field) {
            throw nlapiCreateError('ftext', 'not implemented');
        },
        submit: function (rec) {
            var fields = [];
            var values = [];
            for (var it in rec.state.submitCache) {
                fields.push(it);
                values.push(rec.state.submitCache[it]);
            }
            nlapiSubmitField(rec.meta.code, String(rec.id), fields, values);
            rec.state.submitCache = {};
            //console.log('id submit')
        }
    },
    Record: {
        f: function (rec, field) {
            return rec.state.record.getFieldValue(field);
        },
        fs: function (rec, fields) {
            return fields.reduce(function (bef, curr) {
                bef[curr] = rec.state.record.getFieldValue(curr);
                return bef;
            }, {});
        },
        ftext: function (rec, field) {
            return rec.state.record.getFieldText(field);
        },
        submit: function (rec) {
            for (var it in rec.state.submitCache) {
                rec.state.record.setFieldValue(it, rec.state.submitCache[it]);
            }
            rec.id = Number(nlapiSubmitRecord(rec.state.record));
            rec.state.submitCache = {};
            //console.log('rec submit')
        }
    },
    Search: {
        f: function (rec, field) {
            //console.log('search f')
            var cs = rec.state.result.getAllColumns() || [];
            var allcols = cs
                .map(function (c) {
                if (c.getJoin())
                    return c.getJoin() + '.' + c.getName();
                return c.getName();
            });
            var idx = allcols.indexOf(field);
            if (~idx) {
                return rec.state.result.getValue(cs[idx]);
            }
            return _callers.Id.f(rec, field);
        },
        fs: function (rec, fields) {
            var cs = rec.state.result.getAllColumns() || [];
            var allcols = cs
                .map(function (c) {
                if (c.getJoin())
                    return c.getJoin() + '.' + c.getName();
                return c.getName();
            });
            var found = [], notFound = [];
            fields.forEach(function (field) {
                var idx = allcols.indexOf(field);
                if (idx != -1)
                    found.push({
                        id: field,
                        obj: cs[idx],
                    });
                else
                    notFound.push({
                        id: field,
                        obj: cs[idx]
                    });
            });
            var out = {};
            found.forEach(function (column) {
                out[column.id] = rec.state.result.getValue(column.obj);
            });
            if (notFound.length) {
                var _lookup = nlapiLookupField(rec.code, rec.id, notFound.map(function (x) { return x.id; }));
                for (var it in _lookup) {
                    out[it] = _lookup[it];
                }
            }
            if (notFound.length) {
                console.log('search fs', notFound.length, rec.meta.code);
            }
            return out;
        },
        ftext: function (rec, field) {
            var allcols = rec.state.result.getAllColumns() || [];
            if (~(allcols.map(function (c) { return c.getName(); })).indexOf(field)) {
                return rec.state.result.getText(field);
            }
            return _callers.Id.ftext(rec, field);
        },
        submit: function (rec) {
            //console.log('search submit')
            return _callers.Id.submit(rec);
        }
    },
    RecordSublist: {
        f: function (rec, field) {
            return rec.state.objSublist.value(field, rec.state.line);
        },
        fs: function (rec, fields) {
            return fields.reduce(function (bef, curr) {
                bef[curr] = rec.state.objSublist.value(curr, rec.state.line);
                return bef;
            }, {});
        },
        ftext: function (rec, field) {
            return rec.state.objSublist.text(field, rec.state.line);
        },
        submit: function () {
            throw 'Não implementado';
            /*
            if (!Array.isArray(fields)) {
                fields = [fields];
                values = [values];
            }
            var l = fields.length;
            for (var it = 0; it < l; it++) {
                rec.objSublist.setValue(fields[it], rec._line, values[it]);
            }
            */
        }
    },
    Client: {
        f: function (rec, field) {
            return rec.state.window.nlapiGetFieldValue(field);
        },
        fs: function (rec, fields) {
            return fields.reduce(function (bef, curr) {
                bef[curr] = rec.state.window.nlapiGetFieldValue(curr);
                return bef;
            }, {});
        },
        ftext: function (rec, field) {
            return rec.state.window.nlapiGetFieldText(field);
        },
        submit: function (rec) {
            for (var it in rec.state.submitCache) {
                rec.state.window.nlapiSetFieldValue(it, rec.state.submitCache[it]);
            }
            rec.state.submitCache = {};
        }
    }
};
function end() {
    try {
        File.saveFile('/SuiteScripts/fieldconf.json', JSON.stringify(exports.__fieldConf));
    }
    catch (e) { }
}
exports.end = end;
