
//mod record
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
function initSearch(rtape) {
    rtape.search = function (filters, columns) {
        filters = transformFilters(filters);
        columns = transformColumns(columns);
        return nlapiSearchRecord(rtape.code, null, filters, columns);
    };
    function transformFilters(filters) {
        return filters.map(function (item, idx) {
            if (Array.isArray(item))
                return transformFilters(item);
            if (item == 'and' || item == 'or')
                return item;
            if (!idx) {
                if (~item.indexOf('.')) {
                    var split = item.split('.');
                    var p0 = rtape.fld[split[0]];
                    if (!p0)
                        throw nlapiCreateError('transformFilters-2', "Field " + p0 + " not found");
                    return "p0." + split[1];
                }
                var out = rtape.fld[item];
                if (!out)
                    throw nlapiCreateError('transformFilters-1', "Field " + item + " not found");
                return out;
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
}
exports.initSearch = initSearch;
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
//implementação parcial por enquanto
function fromRecord(objRecord, slname) {
    return {
        count: function () {
            return objRecord.getLineItemCount(this.name);
        },
        value: function (field, line) {
            return objRecord.getLineItemValue(this.name, field, line);
        }
    };
}
exports.fromRecord = fromRecord;

},{}],"record":[function(require,module,exports){
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
    nlapiLogExecution('', 'não carregou baseconf');
}
var _window;
exports.setWindow = function (wind) {
    _window = wind;
};
exports.factory = recordFactory;
function recordFactory(meta) {
    var __fldvals = (function () {
        var out = [];
        for (var it in meta.fld) {
            out.push(meta.fld[it]);
        }
        return out;
    })();
    var __sublists = meta.sublists || {};
    var __doCache = true;
    var __exposed = [];
    //_fieldCache : {} ,
    //_origin : null,
    //record : <nlobjRecord>null ,
    //_callers : <typeof _callers>null 
    function build(state) {
        //instance methods below
        state.fieldCache = state.fieldCache || {};
        state.submitCache = state.submitCache || {};
        var out = {
            f: function (field) {
                if (!field)
                    throw console.error('Record.f recebeu parâmetro vazio.');
                if (!meta.fld[field]) {
                    if (!__fldvals)
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
                        state.fieldCache[f] = state.callers.f(out, f);
                    });
                    return state.fieldCache[field];
                }
                else {
                    __fieldConf[meta.code] = __fieldConf[meta.code] || [];
                    __fieldConf[meta.code].push(field);
                    state.fieldCache[field] = state.callers.f(out, field);
                    return state.fieldCache[field];
                }
            },
            fjoin: function (src, field) {
                return out.f(src + '.' + field);
            },
            fset: function (field, value) {
                if (Array.isArray(field))
                    throw console.error('fset não recebe array.');
                if (!meta.fld[field]) {
                    if (!~__fldvals.indexOf(field))
                        throw console.error('Campo ' + field + ' não cadastrado.');
                }
                else
                    field = meta.fld[field];
                state.fieldCache[field] = value;
                state.submitCache = state.submitCache || {};
                state.submitCache[field] = value;
                return this;
            },
            json: function () {
                var that = this;
                var out = this._exposed.reduce(function (bef, field) {
                    bef[field] = that.f(field);
                    return bef;
                }, {});
                out.id = that.id;
                return out;
            },
            submit: function () {
                _cache[(meta.code + '|' + this.id)] = this;
                this._callers.submit(this);
                return this;
            },
            delete: function () {
                if (_cache[(meta.code + '|' + this.id)])
                    delete _cache[(meta.code + '|' + this.id)];
                return nlapiDeleteRecord(this.code, this.id);
            },
            sublist: function (name, clas) {
                if (this._origin == 'record') {
                    var sl = Sublist.fromRecord(this.record, name);
                    var out = [];
                    for (var it = 1; it <= sl.count(); it++) {
                        out.push(clas.fromRecordSublist(sl, sl.value('id', it)));
                    }
                    return out;
                }
                else {
                    var field = this.sublists[name] || name;
                    if (field.substr(0, 'recmach'.length) == 'recmach')
                        field = field.substr('recmach'.length);
                    var res = nlapiSearchRecord(clas.code, null, [field, 'anyof', this.id], Search.cols(__fieldConf[clas.code] || [])) || [];
                    return res.map(function (r) {
                        return clas.fromSearchResult(r);
                    });
                }
            },
            get id() { return Number(state.id); },
            state: state,
            meta: meta
        };
        return out;
    }
    var Static = {
        getCode: function (id) {
            return '';
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
            if (_cache[(meta.code + '|' + res.getId())])
                return _cache[(meta.code + '|' + res.getId())];
            var out = build({
                code: Static.getCode(res.getId()),
                origin: 'search',
                callers: _callers.Search,
                result: res,
                id: Number(res.getId()),
            });
            _cache[(meta.code + '|' + res.getId())] = out;
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
            var rec = nlapiLoadRecord('scriptdeployment', res[0].getId());
            rec.setFieldValue('custscript_fieldconf', JSON.stringify(__fieldConf));
            nlapiSubmitRecord(rec);
        }
    };
    /*
        Record.expose = function(fields) {
            (fields||[]).forEach( function(field) {
                if (!Record.fld[field]) throw nlapiCreateError('recordExpose', 'Campo ' + field + ' não está definido neste registro.' );
                Record._exposed.push(field);
                Object.defineProperty(Record, field , {
                    enumerable : false ,
                    get : function() {
                        return this.f(field);
                    } ,
                    set : function(value) {
                        return this.fset(field,value);
                    }
                })
            });
        }
    
        Record.exposeAll = function() {
            var fields = [];
            for (var it in Record.fld) {
                fields.push(it)
            }
            return Record.expose(fields);
        }
    
        return Record;
    */
}
exports.recordFactory = recordFactory;
var _callers = {
    Id: {
        f: function (rec, field) { return nlapiLookupField(rec.meta.code, rec.id, field); },
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
            if (~(rec.state.result.getAllColumns().map(function (c) { return c.getName(); }) || []).indexOf(field)) {
                return rec.state.result.getValue(field);
            }
            return _callers.Id.f(rec, field);
        },
        submit: function (rec) {
            return _callers.Id.submit(rec);
        }
    },
    RecordSublist: {
        f: function (rec, field) {
            return rec.state.objSublist.value(field, rec.state.line);
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
        submit: function (rec) {
            for (var it in rec.state.submitCache) {
                rec.state.window.nlapiSetFieldValue(it, rec.state.submitCache[it]);
            }
            rec.state.submitCache = {};
        }
    }
};
function build(methodsObj, stateObj) {
    var out = Object.create(methodsObj);
    for (var it in stateObj) {
        out[it] = stateObj[it];
    }
    return out;
}

},{"./console-log":1,"./search":2,"./sublist":3}]},{},["record"]);

GLOBALS['record'] = require('record');
