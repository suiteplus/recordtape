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
