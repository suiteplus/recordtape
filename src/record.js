/*global window*/

var nsm = require('sp-netsuite-modules');
var Base = nsm.Base;

//enum recordSource
//opcoes id record search recordsublist

var _callers = {
    Id: {
        f: function (rec, field) { return nlapiLookupField(rec.code, rec.id, field); },
        submit: function (rec) {
            var fields = [];
            var values = [];
            for ( var it in rec._submitCache) {
                fields.push(it);
                values.push(rec._submitCache[it]);
            }
            nlapiSubmitField(rec.code, rec.id, fields, values);
            rec._submitCache = {};
        }
    },
    Record: {
        f: function (rec, field) {
            return rec.record.getFieldValue(field);
        },
        submit: function (rec) {
            for ( var it in rec._submitCache) {
                rec.record.setFieldValue(it,rec._submitCache[it]);
            }
            rec.id = nlapiSubmitRecord(rec.record);
            rec._submitCache = {};
        }
    },
    Search: {
        f: function (rec, field) {
            if (~(rec.result.getAllColumns() || []).indexOf(field)) {
                return rec.result.getValue(field);
            }
            return _callers.Id.f(rec, field);
        },
        submit: function (rec) {
            return _callers.Id.submit(rec);
        }
    },
    RecordSublist: {
        f: function (rec, field) {
            return rec.objSublist.value(field, rec._line);
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
    Client : {
        f: function (rec, field) {
            return rec.window.nlapiGetFieldValue(field);
        },
        submit: function (rec) {
            for ( var it in rec._submitCache) {
                rec.window.nlapiSetFieldValue(it,rec._submitCache[it]);
            }
            rec._submitCache = {};
        }
    }
};

//record cache
var _cache = {};
//which fields to preload
var _fieldConf = {};

//init
try {
    var conf = nlapiGetContext().getSetting('SCRIPT', 'custscript_nf2_fieldconf');
    _fieldConf = JSON.parse(conf) || {};
}
catch (e) { 
    Base.log('não carregou baseconf');
}

var _window;
exports.setWindow = function(wind) {
    _window = wind;
};

exports.factory = recordFactory;
exports.recordFactory = recordFactory;
function recordFactory(meta) {

    var Record = {
        meta : meta ,
        code : meta.code ,
        fld : meta.fld ,
        _fldvals : (function(){
            var out = [];
            for (var it in meta.fld) {
                out.push(meta.fld[it]);
            }
            return out;
        })() ,
        sublists : meta.sublists || {} ,
        doCache : true ,
        _fieldCache : null ,
        _origin : null,
        _exposed : [],
        create : function(code) {
            var out = Object.create(Record);
            out._origin = 'record';
            out.code = code || out.code;
            out.record = nlapiCreateRecord(out.code);
            out._callers = _callers.Record;
            out._fieldCache = {};
            return out;            
        } ,
        fromId : function( id , opts ) {
            opts = opts || {};
            if (!opts.noCache && _cache[(Record.code + '|' + id)])
                return _cache[(Record.code + '|' + id)];
            var out = Object.create(Record);
            out.code = Record._getCode(id);
            out.id = Number(id);
            out._origin = 'id';
            out._callers = _callers.Id;
            out._fieldCache = {};
            _cache[(Record.code + '|' + id)] = out;
            return out;
        },
        fromRecord : function(inp) {
            var id = (typeof inp == 'object') ? inp.getId() : inp;
            if (_cache[(Record.code + '|' + id)]) return _cache[(Record.code + '|' + id)];
            var out = Object.create(Record);
            out.code = Record._getCode(id);
            var rec;
            if (typeof inp == 'number' || typeof inp == 'string')
                rec = nlapiLoadRecord(out.code, inp);
            else
                rec = inp;
            out.id = Number(id);
            out._origin = 'record';
            out._callers = _callers.Record;
            out._fieldCache = {};
            out.record = rec;
            _cache[(Record.code + '|' + id)] = out;
            return out;
        } ,
        fromRecordSublist : function(sl,id) {
            if (_cache[(Record.code + '|' + id)])
                return _cache[(Record.code + '|' + id)];
            var out = Object.create(Record);
            out.code = Record._getCode(id);
            out.objSublist = sl;
            out._origin = 'recordsublist';
            out.id = Number(id);
            out._line = out.objSublist.lineFromId(Number(id));
            out._callers = _callers.RecordSublist;
            out._fieldCache = {};
            _cache[(Record.code + '|' + out.id)] = out;
            return out;
        } ,
        fromSearchResult : function(res) {
            if (_cache[(Record.code + '|' + res.getId())])
                return _cache[(Record.code + '|' + res.getId())];
            var out = Object.create(Record);
            out.code = Record._getCode(res.getId());
            out._origin = 'search';
            out._callers = _callers.Search;
            out.result = res;
            out.id = Number(res.getId());
            out._fieldCache = {};
            _cache[(Record.code + '|' + res.getId())] = out;
            return out;
        } ,
        fromCurrentClient : function(wind) {
            var id = Number(nlapiGetRecordId());
            if (_cache[(Record.code + '|' + id)])
                return _cache[(Record.code + '|' + id)];
            var out = Object.create(Record);
            out.code = Record._getCode(id);
            out.window = wind || _window || window;
            out._origin = 'client';
            out._callers = _callers.Client;
            out.id = id;
            out._fieldCache = {};
            _cache[Record.code + '|' + id] = out;
            return out;
        } ,
        curryf : function(field) {
            return function (id) {
                var inst = Record.fromId(id);
                return inst.f(field);
            };
        } ,
        end : function() {
            var sid = nlapiGetContext().getScriptId();
            var did = 'customdeploy' + sid.substr('customscript'.length);
            var res = nlapiSearchRecord('scriptdeployment', null, ['scriptid', 'is', did]);
            var rec = nlapiLoadRecord('scriptdeployment', res[0].getId());
            rec.setFieldValue('custscript_nf2_fieldconf', JSON.stringify(_fieldConf));
            nlapiSubmitRecord(rec);
        } ,
        _getCode : function() {
            return meta.code;
        } ,
        //instance methods below
        f : function(field) {
            if (!field) throw Base.error('Record.f recebeu parâmetro vazio.');
            if (!this.fld[field]) {
                if (!~this._fldvals)
                    throw Base.error('Campo ' + field + ' não cadastrado.');
            }else field = this.fld[field];
            var _this = this;
            nsm.Base.log('f() ' + field);
            if (this._fieldCache[field]) return this._fieldCache[field];
            var fields = _fieldConf[Record.code] || [];
            var found = ~fields.indexOf(field);
            //se houver fieldconf, carregar todos os campos para o cache
            if (fields.length && found) {
                fields.forEach(function (f) {
                    _this._fieldCache[f] = _this._callers.f(_this, f);
                });
                return this._fieldCache[field];
            }
            else {
                _fieldConf[Record.code] = _fieldConf[Record.code] || [];
                _fieldConf[Record.code].push(field);
                this._fieldCache[field] = this._callers.f(this, field);
                return this._fieldCache[field];
            }            
        } ,

        fjoin : function(src,field) {
            return this.f(src + '.' + field);
        } ,

        fset : function(field, value) {
            var _this = this;
            if (Array.isArray(field)) throw Base.error('fset não recebe array.');
            if (!_this.fld[field]) {
                if (!~_this._fldvals.indexOf(field))
                    throw Base.error('Campo ' + field + ' não cadastrado.');
            } else field = _this.fld[field];
            _this._fieldCache[field] = value;
            _this._submitCache = _this._submitCache || {};
            _this._submitCache[field] = value;
            return this;
        } ,

        json : function() {
            var that = this;
            return this._exposed.reduce( function(bef,field) {
                bef[field] = field;
                return bef;
            }, {});
        } ,

        submit : function() {
            _cache[(Record.code + '|' + this.id)] = this;
            this._callers.submit(this);
            return this;
        } ,

        delete : function() {
            if (_cache[(Record.code + '|' + this.id)]) delete _cache[(Record.code + '|' + this.id)];
            return nlapiDeleteRecord(this.code, this.id);
        } ,

        sublist : function(name,clas) {
            if (this._origin == 'record') {
                var sl = new nsm.Record.Sublist(this.record, name);
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
                var res = nlapiSearchRecord(clas.code, null, [field, 'anyof', this.id], nsm.Search.searchCols(_fieldConf[clas.code] || [])) || [];
                return res.map(function (r) {
                    return clas.fromSearchResult(r);
                });
            }
        }

    };

    Record.expose = function(fields) {
        (fields||[]).forEach( function(field) {
            if (!Record.fld[field]) throw nsm.error('Record.expose: campo ' + field + ' não está definido neste registro.' );
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

}
