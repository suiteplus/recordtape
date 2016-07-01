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
