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
