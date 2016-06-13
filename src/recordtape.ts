///<reference path="../typings/suitescript-1.0.d.ts"/>
///<reference path="../typings/index.d.ts"/>

require('./console-log')
import Search = require('./search')
import Sublist = require('./sublist')

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
    nlapiLogExecution('','não carregou baseconf');
}

var _window;
export var setWindow = function(wind) {
    _window = wind;
};

interface FactoryMeta {
    code : string;
    fld : any;
    sublists? : any;
} 


interface internalState {
    origin : 'record'|'id'|'recordsublist'|'search'|'client';
    code : string
    callers : Caller
    fieldCache? : {}
    submitCache? : {}

    id? : number|void
    record? : nlobjRecord
    objSublist? : any
    line? : number
    result? : nlobjSearchResult ,
    window? : any
}


export interface tRecord {
    f(field:string) : string;
    fraw(field:string) : string;
    fjoin(src:string, field:string) : string;
    fset(src:string,field:string) : tRecord;
    put(src:any) : tRecord;
    json() : any;
    submit() : tRecord;
    delete() : void;
    sublist(name:string, clas:any) : tRecord[];

    id : number;
    state : internalState;
    meta : FactoryMeta;
    code : string;
    fld : any;
    getStatic() : RtapeStatic;
}

export var factory = recordFactory;
export function recordFactory(meta:FactoryMeta) {

    var __fldInverseMemo
    function fldInverse() {
        if (__fldInverseMemo) return __fldInverseMemo
        var out = {}
        for (var it in meta.fld) {
            out[meta.fld[it]] = it
        }
        __fldInverseMemo = out;
        return __fldInverseMemo
    }
    var __sublists = meta.sublists || {}
    var __doCache = true
    var __exposed = []
    var __customMethods = {}
    //_fieldCache : {} ,
    //_origin : null,
    //record : <nlobjRecord>null ,
    //_callers : <typeof _callers>null 
 

    function build(state:internalState) {
        //instance methods below

        state.fieldCache = state.fieldCache || {}
        state.submitCache = state.submitCache || {}

        var rec : tRecord = {

            f(field) {
                if (!field) throw console.error('Record.f recebeu parâmetro vazio.');
                if (!meta.fld[field]) {
                    throw console.error('Campo ' + field + ' não cadastrado.');
                } else {
                    field = meta.fld[field];
                }

                if (state.fieldCache[field]) return state.fieldCache[field];
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
            } ,


            fraw(name:string) {
                var field = fldInverse()[name]
                if (!field) throw nlapiCreateError('fraw', `Field ${name} not fouund.`)
                return rec.f(field)
            } ,

            fjoin(src,field) {
                return rec.f(src + '.' + field);
            } ,


            fset(field, value) {
                if (Array.isArray(field)) throw console.error('fset não recebe array.');
                if (!meta.fld[field]) {
                    throw console.error('Campo ' + field + ' não cadastrado.');
                } else field = meta.fld[field];
                state.fieldCache[field] = value;
                state.submitCache = state.submitCache || {};
                state.submitCache[field] = value;
                return rec;
            } ,


            put(data) {
                if (Array.isArray(data)) throw nlapiCreateError('RTAPE_PUT','Array not expected in rtape#put')
                for ( var it in data ) {
                    rec.fset(it, data[it])
                }
                return rec
            } ,


            json() {
                var jsout = __exposed.reduce( function(bef,field) {
                    bef[field] = rec.f(field);
                    return bef;
                }, {});
                jsout.id = rec.id;
                return jsout;
            } ,


            submit() {
                _cache[(meta.code + '|' + rec.id)] = rec;
                state.callers.submit(rec);
                return rec;
            } ,


            delete() {
                if (_cache[(meta.code + '|' + state.id)]) delete _cache[(meta.code + '|' + state.id)];
                return nlapiDeleteRecord(rec.meta.code, String(rec.id));
            } ,

            sublist(name:string,tgtclass:RtapeStatic) {
                if (!tgtclass) throw nlapiCreateError('sublist', 'Missing 2nd parameter.')
                if (state.origin == 'record') {
                    var sl = Sublist.fromRecord(state.record, name);
                    var out = [];
                    for (var it = 1; it <= sl.count(); it++) {
                        out.push(tgtclass.fromRecordSublist(sl, sl.value('id', it)));
                    }
                    return out;
                }
                else {
                    var field = meta.sublists[name];
                    if (!field) throw nlapiCreateError('sublist', `Unregistered sublist ${name}.`)
                    if (field.substr(0, 'recmach'.length) == 'recmach')
                        field = field.substr('recmach'.length);
                    var res = nlapiSearchRecord(tgtclass.meta.code, null, 
                        [field, 'anyof', state.id],
                        Search.cols(__fieldConf[tgtclass.meta.code] || [])) || [];
                    return res.map(function (r) {
                        return tgtclass.fromSearchResult(r);
                    });
                }
            } ,

            get id() { return Number(state.id) } ,
            get fld() { return meta.fld } ,
            get code() { return meta.code } ,
            getStatic() { return Static } ,
            state ,
            meta

        }

        __exposed.forEach( name => {
            Object.defineProperty(rec, name , {
                enumerable : false ,
                get() {
                    return rec.f(name)
                } ,
                set(value) {
                    return rec.fset(name, value)
                }
            })
        })

        for ( var it in __customMethods ) {
            rec[it] = (...args) => {
                args = [ rec, ...args ]
                return __customMethods[it].apply(rec, args)
            }
        }

        return rec
    }


    var Static = {
        getCode(id?:number) {
            return meta.code
        } ,


        create () : tRecord {
            return build({
                origin : 'record' ,
                code : meta.code ,
                record : nlapiCreateRecord(meta.code) ,
                callers : _callers.Record ,
                id : null 
            });
        } ,


        fromId ( id , opts? ) : tRecord {
            opts = opts || {};
            if (!opts.noCache && _cache[(meta.code + '|' + id)])
                return _cache[(meta.code + '|' + id)];
            var out = build({
                code : Static.getCode(id) ,
                id : Number(id) , 
                origin : 'id' ,
                callers : _callers.Id
            })
            _cache[(meta.code + '|' + id)] = out;
            return out
        },


        fromRecord (inp) : tRecord {
            var id = (typeof inp == 'object') ? inp.getId() : inp;
            if (_cache[(meta.code + '|' + id)]) return _cache[(meta.code + '|' + id)];
            //out.code = Record._getCode(id);
            var rec;
            if (typeof inp == 'number' || typeof inp == 'string') rec = nlapiLoadRecord(meta.code, inp);
            else rec = inp;
            var out = build({
                code : Static.getCode(id) ,
                origin : 'record' ,
                callers : _callers.Record ,
                record : rec
            })
            _cache[(meta.code + '|' + id)] = out;
            return out;
        } ,

        
        fromRecordSublist (sl,id) : tRecord {
            if (_cache[(meta.code + '|' + id)])
                return _cache[(meta.code + '|' + id)];
            var out = build({
                code : Static.getCode(id) ,
                objSublist : sl ,
                origin : 'recordsublist' ,
                id : Number(id) ,
                line : sl.lineFromId(Number(id)) ,
                callers : _callers.RecordSublist ,
            })
            _cache[(meta.code + '|' + id)] = out;
            return out;
        } ,


        fromSearchResult (res:nlobjSearchResult) : tRecord {
            if (_cache[meta.code + '|' + res.id])
                return _cache[meta.code + '|' + res.id];
            var out = build({
                code : Static.getCode(res.id) ,
                origin : 'search' ,
                callers : _callers.Search ,
                result : res ,
                id : Number(res.id) ,
            })
            _cache[meta.code + '|' + res.id] = out;
            return out;
        } ,


        fromCurrentClient(wind) : tRecord {
            var id = Number(nlapiGetRecordId());
            if (_cache[(meta.code + '|' + id)]) return _cache[(meta.code + '|' + id)];
            var out = build({
                code : Static.getCode(id) ,
                window : wind || _window || window ,
                origin : 'client' ,
                callers : _callers.Client ,
                id ,
                fieldCache : {}
            })
            _cache[meta.code + '|' + id] = out;
            return out;
        } ,


        search(arg1, arg2, arg3) {
            var opts:any, filters:any, columns:any
            if (Array.isArray(arg1)) {
                opts = {}
                filters = arg1
                columns = arg3
            } else {
                opts = arg1;
                filters = arg2
                columns = arg3
            }
            return Search.search(opts, Static, filters, columns)
        } ,


        curryf : function(field) {
            return function (id) {
                var inst = Static.fromId(id);
                return inst.f(field);
            };
        } ,


        end() {
            var sid = nlapiGetContext().getScriptId();
            var did = 'customdeploy' + sid.substr('customscript'.length);
            var res = nlapiSearchRecord('scriptdeployment', null, ['scriptid', 'is', did]);
            var rec = nlapiLoadRecord('scriptdeployment', res[0].id);
            rec.setFieldValue('custscript_fieldconf', JSON.stringify(__fieldConf));
            nlapiSubmitRecord(rec);
        } ,


        expose(fields) {
            (fields||[]).forEach( function(field) {
                if (!meta.fld[field]) throw nlapiCreateError('recordExpose', 'Campo ' + field + ' não está definido neste registro.' );
                __exposed.push(field);
            });
        } ,


        exposeAll() {
            var fields = [];
            for (var it in meta.fld) {
                fields.push(it)
            }
            return Static.expose(fields);
        } ,


        registerMethod( name:string , method ) {
            __customMethods[name] = method;
        } ,

        get code() { return meta.code } ,
        get fld() { return meta.fld } ,

        meta : meta 

    };

    return Static

}

var dummyStatic = null && recordFactory(<any>1)
export type RtapeStatic = typeof dummyStatic

interface Caller {
    f(rec:tRecord,field:string) : string;
    submit(rec:tRecord) : void;
}

var _callers = {
    Id: <Caller>{
        f: function (rec, field) { return nlapiLookupField(rec.meta.code, rec.id, field); },
        submit: function (rec) {
            var fields = [];
            var values = [];
            for ( var it in rec.state.submitCache) {
                fields.push(it);
                values.push(rec.state.submitCache[it]);
            }
            nlapiSubmitField(rec.meta.code, String(rec.id), fields, values);
            rec.state.submitCache = {};
        }
    },
    Record: <Caller>{
        f: function (rec, field) {
            return rec.state.record.getFieldValue(field);
        },
        submit: function (rec) {
            for ( var it in rec.state.submitCache) {
                rec.state.record.setFieldValue(it,rec.state.submitCache[it]);
            }
            rec.id = Number(nlapiSubmitRecord(rec.state.record));
            rec.state.submitCache = {};
        }
    },
    Search: <Caller>{
        f: function (rec, field) {
            var allcols = rec.state.result.getAllColumns() || [] 
            if (~(allcols.map( c => c.getName() )).indexOf(field)) {
                return rec.state.result.getValue(field);
            }
            return _callers.Id.f(rec, field);
        },
        submit: function (rec) {
            return _callers.Id.submit(rec);
        }
    },
    RecordSublist: <Caller>{
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
    Client : <Caller>{
        f: function (rec, field) {
            return rec.state.window.nlapiGetFieldValue(field);
        },
        submit: function (rec) {
            for ( var it in rec.state.submitCache) {
                rec.state.window.nlapiSetFieldValue(it,rec.state.submitCache[it]);
            }
            rec.state.submitCache = {};
        }
    }
};


function build<K,V>(methodsObj:K, stateObj:V) : K & V {
    var out = Object.create(methodsObj)
    for ( var it in stateObj ) {
        out[it] = stateObj[it]
    }
    return out;
}