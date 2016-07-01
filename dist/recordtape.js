
//mod recordtape
var GLOBALS = this;
require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";
//instance identifier for logs
var INUMBER = Math.ceil(Math.random() * 1000);
var lastprofile, lastUsage;
var logcount = 1;
function log() {
    var message = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        message[_i - 0] = arguments[_i];
    }
    var o = '';
    message.forEach(function (m) {
        if (typeof m == "object")
            o += ' ' + JSON.stringify(m);
        else
            o += ' ' + m;
    });
    nlapiLogExecution("DEBUG", INUMBER + " console.log " + logcount++ + " " + String(o).substr(0, 15), o);
}
function profile(description) {
    var usg = nlapiGetContext().getRemainingUsage();
    if (!lastUsage)
        lastUsage = usg;
    if (lastprofile)
        nlapiLogExecution("DEBUG", INUMBER + " Profiling: " + description, "Time(ms): " + (Number(new Date()) - Number(lastprofile)) + " Usage:" + (lastUsage - usg));
    lastprofile = new Date();
    lastUsage = usg;
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
function $stackTrace(err) {
    err = err || {};
    if (!err['getStackTrace']) {
        return err['stack'] || '';
    }
    var stack = err.getStackTrace();
    var out = '';
    for (var it = 0; it < stack.length; it++) {
        out += stack[it] + ' -- ';
    }
    log(out);
    return out;
}
if (typeof console === 'undefined' && typeof GLOBALS !== 'undefined') {
    GLOBALS.console = {};
    GLOBALS.console.log = log;
    GLOBALS.console.debug = debug;
    GLOBALS.console.profile = profile;
    GLOBALS.console.error = logerror;
    GLOBALS.console.$stackTrace = $stackTrace;
}

},{}],2:[function(require,module,exports){
"use strict";
var Rtape = require('./recordtape');
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
                        throw nlapiCreateError('TRANSFORM_FILTERS_2', "Field " + p0 + " not found");
                    return "p0." + split[1];
                }
                var out = rtape.meta.fld[item];
                if (!out)
                    throw nlapiCreateError('TRANSFORM_FILTERS_1', "Field " + item + " not found");
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
                var src = rtape.meta.fld[split[0]];
                if (!src)
                    throw nlapiCreateError('SEARCH', "Field " + split[0] + " not found in mapping from " + rtape.meta.code);
                if (split[1]) {
                    return new nlobjSearchColumn(split[1], src);
                }
                return new nlobjSearchColumn(src);
            }
            else if (coluna instanceof nlobjSearchColumn) {
                return coluna;
            }
            else
                throw nlapiCreateError("transformColumns", "Invalid input");
        });
    }
    if (opts.allFields) {
        var fieldmap_1 = {};
        for (var it in rtape.meta.fld) {
            fieldmap_1[it] = true;
        }
        var inverse = rtape.fldInverse();
        Rtape.__fieldConf[rtape.meta.code] = Rtape.__fieldConf[rtape.meta.code] || [];
        Rtape.__fieldConf[rtape.meta.code].forEach(function (it) {
            var toset;
            if (it.indexOf('.') != -1) {
                var split = it.split('.');
                if (!inverse[split[0]])
                    throw nlapiCreateError('SEARCH_2', "Field " + split[0] + " not found in mapping from " + rtape.meta.code);
                toset = inverse[split[0]] + '.' + split[1];
            }
            else {
                toset = inverse[it];
                if (!toset)
                    throw nlapiCreateError('SEARCH_3', "Field " + it + " not found in mapping from " + rtape.meta.code);
            }
            fieldmap_1[toset] = true;
        });
        columns = [];
        for (var it in fieldmap_1) {
            columns.push(it);
        }
        columns = (!opts.noTransformColumns) ? transformColumns(columns) : columns;
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

},{"./recordtape":"recordtape"}],3:[function(require,module,exports){
"use strict";
function fromRtape(parentRtape, childRtapeStatic, slRef) {
    if (parentRtape.state.origin != 'record')
        throw nlapiCreateError('sublist', 'not implemented');
    var objRecord = parentRtape.state.record;
    var slName = parentRtape.meta.sublists[slRef];
    if (!slName)
        throw nlapiCreateError('sublist', "Sublist ref " + slRef + " not found.");
    var objSublist = {
        count: function () {
            return objRecord.getLineItemCount(slName);
        },
        value: function (field, line) {
            return objRecord.getLineItemValue(slName, field, line);
        },
        text: function (field, line) {
            return objRecord.getLineItemText(slName, field, line);
        },
        idFromLine: function (line) {
            return this.value(childRtapeStatic.idField, line);
        },
        lineFromId: function (id) {
            //não funciona direito
            //return objRecord.findLineItemValue(slName, childRtapeStatic.idField, id)
            var count = this.count();
            var out = -1;
            for (var it = 1; it <= count; it++) {
                var value = objSublist.value(childRtapeStatic.idField, it);
                if (value == id) {
                    out = it;
                    break;
                }
            }
            return out;
        }
    };
    return objSublist;
}
exports.fromRtape = fromRtape;
var dummy = null && fromRtape(0, 1, 2);

},{}],4:[function(require,module,exports){
///<reference path="../typings/suitescript-1.d.ts"/>
"use strict";
var NON_BINARY_FILETYPES = [
    'CSV',
    'HTMLDOC',
    'JAVASCRIPT',
    'MESSAGERFC',
    'PLAINTEXT',
    'POSTSCRIPT',
    'RTF',
    'SMS',
    'STYLESHEET',
    'XMLDOC'
];
var EXT_TYPES = {
    dwg: 'AUTOCAD',
    bmp: 'BMPIMAGE',
    csv: 'CSV',
    xls: 'EXCEL',
    swf: 'FLASH',
    gif: 'GIFIMAGE',
    gz: 'GZIP',
    htm: 'HTMLDOC',
    html: 'HTMLDOC',
    ico: 'ICON',
    js: 'JAVASCRIPT',
    jpg: 'JPGIMAGE',
    eml: 'MESSAGERFC',
    mp3: 'MP3',
    mpg: 'MPEGMOVIE',
    mpp: 'MSPROJECT',
    pdf: 'PDF',
    pjpeg: 'PJPGIMAGE',
    txt: 'PLAINTEXT',
    png: 'PNGIMAGE',
    ps: 'POSTSCRIPT',
    ppt: 'POWERPOINT',
    mov: 'QUICKTIME',
    rtf: 'RTF',
    sms: 'SMS',
    css: 'STYLESHEET',
    tiff: 'TIFFIMAGE',
    vsd: 'VISIO',
    doc: 'WORD',
    xml: 'XMLDOC',
    zip: 'ZIP'
};
//all folders with absolute path
function allFolders() {
    var _allFolders = bigSearch('folder', null, searchCols(['name', 'parent']));
    var allFolders = _allFolders.map(searchResToCollection);
    var foldersIdxParent = allFolders.reduce(function (bef, curr) {
        curr.parent = curr.parent || '_ROOT';
        bef[curr.parent] = bef[curr.parent] || [];
        bef[curr.parent].push(curr);
        return bef;
    }, {});
    foldersIdxParent['_ROOT'].forEach(function (item) {
        function swipe(f) {
            if (foldersIdxParent[f.id]) {
                foldersIdxParent[f.id].forEach(function (inner) {
                    inner.abspath = f.abspath + '/' + inner.name;
                    swipe(inner);
                });
            }
        }
        item.abspath = "/" + item.name;
        swipe(item);
    });
    return allFolders;
}
function _relativePath(src, relativeTo) {
    var o;
    //no backwards walking
    if (src.substr(0, relativeTo.length) == relativeTo) {
        o = src.substr(relativeTo.length);
    }
    else {
        // a / b / c1 / d1
        // a / b / d
        var s_src = src.split('/').filter(function (i) { return i == true; });
        var s_rel = relativeTo.split('/').filter(function (i) { return i == true; });
        var count = 0, walk = '';
        for (var x = 0; x < s_src.length; x++) {
            if (s_rel[x] == s_src[x])
                count++;
            else {
                walk += '/' + s_src[x];
            }
        }
        for (var x = 0; x < count; x++) {
            walk = '../' + walk;
        }
        o = walk;
    }
    return o || '.';
}
function pathInfo(pathIn, baseIn, createFolders) {
    if (baseIn === void 0) { baseIn = '/'; }
    if (createFolders === void 0) { createFolders = false; }
    if (pathIn.charAt(0) == '/') {
        pathIn = pathIn.substr(1);
        baseIn = '/';
    }
    if (baseIn.substr(-1) != '/')
        baseIn += '/';
    var absPath = (baseIn + pathIn)
        .replace(/[\\]/g, '/'); //windows fix
    var _split = absPath.split('/');
    var filename = _split[_split.length - 1];
    _split.length = _split.length - 1;
    var absBase = _split.join('/');
    var absBaseSplit = _split.slice(1);
    var hasWildcard = absBaseSplit.some(function (i) { return i == '**'; });
    var _ext = filename ? filename.split('.')[1] : null;
    var prevFolder = null;
    if (!hasWildcard) {
        absBaseSplit.forEach(function (folderName) {
            var filters = [
                ['name', 'is', folderName],
                'and',
                ['parent', 'anyof', (prevFolder || '@NONE@')]
            ];
            var res_folder = nlapiSearchRecord('folder', null, filters);
            if (!res_folder && !createFolders) {
                throw nlapiCreateError('FOLDER_NOT_FOUND', "Folder " + folderName + " not found!", true);
            }
            else if (!res_folder && createFolders) {
                var newFolderRec = nlapiCreateRecord('folder');
                newFolderRec.setFieldValue('name', folderName);
                newFolderRec.setFieldValue('parent', prevFolder);
                prevFolder = nlapiSubmitRecord(newFolderRec);
            }
            else {
                prevFolder = res_folder[0].getId();
            }
        });
        return {
            folderid: prevFolder,
            filename: filename ? filename : null,
            fileext: _ext,
            nsfileext: _ext ? EXT_TYPES[_ext] : null,
            pathabsolute: filename ? absPath : null,
            pathrelative: filename ? _relativePath(absPath, baseIn) : null,
            baseabsolute: absBase,
            baserelative: _relativePath(absBase, baseIn)
        };
    }
    else {
        var preWildcard_1 = '', postWildcard_1 = '', isAfter_1 = false;
        absBaseSplit.forEach(function (item) {
            if (item == '**')
                isAfter_1 = true;
            else if (isAfter_1)
                postWildcard_1 += '/' + item;
            else {
                preWildcard_1 += '/' + item;
            }
        });
        var found = allFolders().filter(function (folder) {
            var pre = !preWildcard_1.length || (folder.abspath.substr(0, preWildcard_1.length) == preWildcard_1);
            var post = !postWildcard_1.length || (folder.abspath.substr(-postWildcard_1.length) == postWildcard_1);
            return pre && post;
        }).map(function (folder) {
            var pabs = filename ? folder.abspath + '/' + filename : null;
            return {
                folderid: folder.id,
                pathabsolute: pabs,
                pathrelative: filename ? _relativePath(pabs, baseIn) : null,
                baseabsolute: folder.abspath,
                baserelative: _relativePath(folder.abspath, baseIn)
            };
        });
        return {
            filename: filename ? filename : null,
            fileext: _ext,
            nsfileext: _ext ? EXT_TYPES[_ext] : null,
            baseabsolute: preWildcard_1,
            baserelative: _relativePath(preWildcard_1, baseIn),
            tails: found
        };
    }
}
exports.pathInfo = pathInfo;
exports.save = saveFile;
function saveFile(path, contents) {
    var info = pathInfo(path, undefined, true);
    var file = nlapiCreateFile(info.filename, info.nsfileext || 'PLAINTEXT', contents);
    file.setFolder(String(info.folderid));
    return Number(nlapiSubmitFile(file));
}
exports.saveFile = saveFile;
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
function searchResToCollection(result) {
    var columns = result.getAllColumns() || [];
    var ret = columns.reduce(function (prev, curr) {
        var name, join;
        if (join = curr.getJoin()) {
            name = join + "." + curr.getName();
        }
        else {
            name = curr.getName();
        }
        prev[name] = result.getValue(curr);
        if (result.getText(curr))
            prev.textref[name] = result.getText(curr);
        return prev;
    }, { textref: {} });
    ret["id"] = result.getId();
    return ret;
}

},{}],"recordtape":[function(require,module,exports){
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

},{"./console-log":1,"./search":2,"./sublist":3,"netsuite-file":4}]},{},["recordtape"]);

GLOBALS['recordtape'] = require('recordtape');
