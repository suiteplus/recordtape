
//mod recordtape
var GLOBALS = this;
require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";
//instance identifier for logs
var INUMBER = Math.ceil(Math.random() * 1000);
var lastprofile;
function log(message) {
    var out = message;
    if (typeof message == "object")
        out = JSON.stringify(message);
    nlapiLogExecution("DEBUG", INUMBER + " console.log", out);
}
function profile(description) {
    if (lastprofile)
        nlapiLogExecution("DEBUG", INUMBER + " Profiling: " + description, Number(new Date()) - Number(lastprofile));
    lastprofile = new Date();
}
function logerror(txt) {
    var out = txt;
    if (typeof txt == "object")
        out = JSON.stringify(txt);
    nlapiLogExecution("ERROR", INUMBER + " console.error", out);
}
function debug() {
    var out = "";
    for (var it = 0; it < arguments.length; it++) {
        try {
            if (typeof arguments[it] == 'string')
                out += arguments[it] + "; ";
            else if (arguments[it] instanceof Error)
                out += arguments[it].message + " - " + arguments[it].stack + "; ";
            else
                out += JSON.stringify(arguments[it]);
        }
        catch (e) { }
    }
    nlapiLogExecution('DEBUG', 'debug', out);
}
if (typeof console === 'undefined' && typeof GLOBALS !== 'undefined') {
    GLOBALS.console = {};
    GLOBALS.console.log = log;
    GLOBALS.console.debug = debug;
    GLOBALS.console.profile = profile;
    GLOBALS.console.error = logerror;
}

},{}],2:[function(require,module,exports){
"use strict";
function search(opts, rtape, filters, columns) {
    opts = opts || {};
    columns = columns || [];
    filters = filters || [];
    filters = (!opts.noTransformFilters) ? transformFilters(filters) : filters;
    columns = (!opts.noTransformColumns) ? transformColumns(columns) : columns;
    function transformFilters(fs) {
        return fs.map(function (item, idx) {
            if (Array.isArray(item))
                return transformFilters(item);
            if (item == 'and' || item == 'or')
                return item;
            if (!idx) {
                if (~item.indexOf('.')) {
                    var split = item.split('.');
                    var p0 = rtape.meta.fld[split[0]];
                    if (!p0)
                        throw nlapiCreateError('transformFilters-2', "Field " + p0 + " not found");
                    return "p0." + split[1];
                }
                var out = rtape.meta.fld[item];
                if (!out)
                    throw nlapiCreateError('transformFilters-1', "Field " + item + " not found");
                return out;
            }
            else if (idx == 1 || idx == 2) {
                return item;
            }
        });
    }
    function transformColumns(columns) {
        return columns.map(function (coluna) {
            if (typeof coluna == "string") {
                var split = (coluna).split(".");
                if (split[1])
                    return new nlobjSearchColumn(split[1], split[0]);
                return new nlobjSearchColumn(split[0]);
            }
            else if (coluna instanceof nlobjSearchColumn) {
                return coluna;
            }
            else
                throw nlapiCreateError("transformColumns", "Invalid input");
        });
    }
    if (opts.allFields) {
        columns = [];
        for (var it in rtape.meta.fld) {
            columns.push(new nlobjSearchColumn(rtape.meta.fld[it]));
        }
    }
    var search = {
        get filters() {
            return filters;
        },
        get columns() {
            return columns;
        },
        run: function () {
            var f = filters.length ? filters : undefined;
            var c = columns.length ? columns : undefined;
            var out = (opts.big) ?
                (bigSearch(rtape.meta.code, f, c) || []) :
                (nlapiSearchRecord(rtape.meta.code, null, f, c) || []);
            return out.map(function (item) { return rtape.fromSearchResult(item); });
        },
        runRaw: function () {
            var f = filters.length ? filters : undefined;
            var c = columns.length ? columns : undefined;
            var out = (opts.big) ?
                (bigSearch(rtape.meta.code, f, c) || []) :
                (nlapiSearchRecord(rtape.meta.code, null, f, c) || []);
            return out;
        }
    };
    return search;
}
exports.search = search;
function bigSearch(recordtype, filters, columns) {
    var res = nlapiCreateSearch(recordtype, filters, columns).runSearch();
    var res_chunk, start_idx = 0, res_final = [];
    do {
        res_chunk = res.getResults(start_idx, start_idx + 1000) || [];
        res_final = res_final.concat(res_chunk);
        start_idx += 1000;
    } while (res_chunk.length);
    return res_final;
}
exports.bigSearch = bigSearch;
exports.big = bigSearch;
function searchCols(colunas) {
    return colunas.map(function (coluna) {
        if (typeof coluna == "string") {
            var split = coluna.split(".");
            if (split[1])
                return new nlobjSearchColumn(split[1], split[0]);
            return new nlobjSearchColumn(split[0]);
        }
        else if (coluna instanceof nlobjSearchColumn) {
            return coluna;
        }
        else
            throw nlapiCreateError("mapSearchCol", "Entrada inválida");
    });
}
exports.searchCols = searchCols;
exports.cols = searchCols;

},{}],3:[function(require,module,exports){
"use strict";
function fromRtape(parentRtape, childRtapeStatic, slname) {
    if (parentRtape.state.origin != 'record')
        throw nlapiCreateError('sublist', 'not implemented');
    var objRecord = parentRtape.state.record;
    return {
        count: function () {
            return objRecord.getLineItemCount(slname);
        },
        value: function (field, line) {
            return objRecord.getLineItemValue(slname, field, line);
        },
        text: function (field, line) {
            return objRecord.getLineItemText(slname, field, line);
        },
        idFromLine: function (line) {
            return this.value(childRtapeStatic.idField, line);
        },
        lineFromId: function (id) {
            return objRecord.findLineItemValue(slname, childRtapeStatic.idField, id);
        }
    };
}
exports.fromRtape = fromRtape;
var dummy = null && fromRtape(0, 1, 2);

},{}],"recordtape":[function(require,module,exports){
///<reference path="../typings/suitescript-1.0.d.ts"/>
///<reference path="../typings/index.d.ts"/>
"use strict";
require('./console-log');
var Search = require('./search');
var Sublist = require('./sublist');
//record cache
var _cache = {};
//which fields to preload
var __fieldConf = {};
//init
try {
    var conf = nlapiGetContext().getSetting('SCRIPT', 'custscript_fieldconf');
    __fieldConf = JSON.parse(conf) || {};
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
    var __customMethods = {};
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
                    throw console.error('Record.f recebeu parâmetro vazio.');
                if (!meta.fld[field]) {
                    throw console.error('Campo ' + field + ' não cadastrado.');
                }
                else {
                    field = meta.fld[field];
                }
                if (state.fieldCache[field])
                    return state.fieldCache[field];
                var fields = __fieldConf[meta.code] || [];
                var found = ~fields.indexOf(field);
                //se houver fieldconf, carregar todos os campos para o cache
                if (fields.length && found) {
                    fields.forEach(function (f) {
                        state.fieldCache[f] = state.callers.f(rec, f);
                    });
                    return state.fieldCache[field];
                }
                else {
                    __fieldConf[meta.code] = __fieldConf[meta.code] || [];
                    __fieldConf[meta.code].push(field);
                    state.fieldCache[field] = state.callers.f(rec, field);
                    return state.fieldCache[field];
                }
            },
            ftext: function (field) {
                if (!field)
                    throw console.error('Record.f recebeu parâmetro vazio.');
                if (!meta.fld[field]) {
                    throw console.error('Campo ' + field + ' não cadastrado.');
                }
                else {
                    field = meta.fld[field];
                }
                return state.callers.ftext(rec, field);
            },
            ftextraw: function (name) {
                var field = fldInverse()[name];
                if (!field)
                    throw nlapiCreateError('ftextraw', "Field " + name + " not fouund.");
                return rec.ftext(field);
            },
            fraw: function (name) {
                var field = fldInverse()[name];
                if (!field)
                    throw nlapiCreateError('fraw', "Field " + name + " not fouund.");
                return rec.f(field);
            },
            fjoin: function (src, field) {
                return rec.f(src + '.' + field);
            },
            fset: function (field, value) {
                if (Array.isArray(field))
                    throw console.error('fset não recebe array.');
                if (!meta.fld[field]) {
                    throw console.error('Campo ' + field + ' não cadastrado.');
                }
                else
                    field = meta.fld[field];
                state.fieldCache[field] = value;
                state.submitCache = state.submitCache || {};
                state.submitCache[field] = value;
                return rec;
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
            submit: function () {
                _cache[(meta.code + '|' + rec.id)] = rec;
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
                    if (field.substr(0, 'recmach'.length) == 'recmach')
                        field = field.substr('recmach'.length);
                    var res = nlapiSearchRecord(tgtclass.meta.code, null, [field, 'anyof', state.id], Search.cols(__fieldConf[tgtclass.meta.code] || [])) || [];
                    return res.map(function (r) {
                        return tgtclass.fromSearchResult(r);
                    });
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
        for (var it in __customMethods) {
            rec[it] = function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i - 0] = arguments[_i];
                }
                args = [rec].concat(args);
                return __customMethods[it].apply(rec, args);
            };
        }
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
        end: function () {
            var sid = nlapiGetContext().getScriptId();
            var did = 'customdeploy' + sid.substr('customscript'.length);
            var res = nlapiSearchRecord('scriptdeployment', null, ['scriptid', 'is', did]);
            var rec = nlapiLoadRecord('scriptdeployment', res[0].id);
            rec.setFieldValue('custscript_fieldconf', JSON.stringify(__fieldConf));
            nlapiSubmitRecord(rec);
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
        get code() { return meta.code; },
        get fld() { return meta.fld; },
        meta: meta,
        idField: meta.idField || 'id'
    };
    return Static;
}
exports.recordFactory = recordFactory;
var dummyStatic = null && recordFactory(1);
var _callers = {
    Id: {
        f: function (rec, field) { return nlapiLookupField(rec.meta.code, rec.id, field); },
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
        }
    },
    Record: {
        f: function (rec, field) {
            return rec.state.record.getFieldValue(field);
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
        }
    },
    Search: {
        f: function (rec, field) {
            var allcols = rec.state.result.getAllColumns() || [];
            if (~(allcols.map(function (c) { return c.getName(); })).indexOf(field)) {
                return rec.state.result.getValue(field);
            }
            return _callers.Id.f(rec, field);
        },
        ftext: function (rec, field) {
            var allcols = rec.state.result.getAllColumns() || [];
            if (~(allcols.map(function (c) { return c.getName(); })).indexOf(field)) {
                return rec.state.result.getText(field);
            }
            return _callers.Id.ftext(rec, field);
        },
        submit: function (rec) {
            return _callers.Id.submit(rec);
        }
    },
    RecordSublist: {
        f: function (rec, field) {
            return rec.state.objSublist.value(field, rec.state.line);
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

},{"./console-log":1,"./search":2,"./sublist":3}]},{},["recordtape"]);

GLOBALS['recordtape'] = require('recordtape');
