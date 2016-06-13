import Rtape = require('./recordtape')

export interface searchOpts {
    //do not transform search filters and columns if false
    noTransformFilters? : boolean;
    noTransformColumns? : boolean;
    //perform big search
    big? : boolean;
    allFields? : boolean;
}

export function search( opts:searchOpts, rtape:Rtape.RtapeStatic, filters:(string|number)[],
        columns:(string|nlobjSearchColumn)[] ) {

    opts = opts || {};
    columns = columns || [];
    filters = filters || [];
    filters = (!opts.noTransformFilters) ? transformFilters(filters) : filters;
    columns = (!opts.noTransformColumns) ? transformColumns(columns) : columns;

    function transformFilters(fs) {
        return fs.map( (item,idx) => {
            if (Array.isArray(item)) return transformFilters(item)
            if (item == 'and' || item == 'or') return item;
            if (!idx) {
                if (~item.indexOf('.')) {
                    let split = item.split('.')
                    let p0 = rtape.meta.fld[split[0]]
                    if (!p0) throw nlapiCreateError('transformFilters-2',`Field ${p0} not found`)
                    return `p0.${split[1]}`
                }
                let out = rtape.meta.fld[item] 
                if (!out) throw nlapiCreateError('transformFilters-1',`Field ${item} not found`)
                return out
            } else if (idx == 1 || idx == 2) {
                return item
            }

        })
    }


    function transformColumns(columns) {
        return columns.map( coluna => {
            if (typeof coluna == "string") {
                var split = (coluna).split(".");
                if (split[1]) return new nlobjSearchColumn(split[1], split[0]);
                return new nlobjSearchColumn(split[0]);
            } else if (coluna instanceof nlobjSearchColumn) {
                return coluna;
            }
            else throw nlapiCreateError("transformColumns", "Invalid input");
        })
    }

    if (opts.allFields) {
        columns = []
        for ( var it in rtape.meta.fld ) {
            columns.push( new nlobjSearchColumn(rtape.meta.fld[it]) )
        }
    }

    var search = {
        get filters() { 
            return filters
        } ,
        get columns() {
            return columns
        } ,
        run() : Rtape.tRecord[] {
            var f:any = filters.length ? filters : undefined
            var c:any = columns.length ? columns : undefined
            var out = (opts.big) ?
                (bigSearch(rtape.meta.code, f, c) || []) :
                (nlapiSearchRecord(rtape.meta.code, null, f, c) || [])
            return out.map( item => rtape.fromSearchResult(item) )
        } ,
        runRaw() : nlobjSearchResult[] {
            var f:any = filters.length ? filters : undefined
            var c:any = columns.length ? columns : undefined
            var out = (opts.big) ?
                (bigSearch(rtape.meta.code, f, c) || []) :
                (nlapiSearchRecord(rtape.meta.code, null, f, c) || [])
            return out;
        }
    }

    return search

}



export function bigSearch( recordtype : string , filters : any , columns : nlobjSearchColumn[] ) : nlobjSearchResult[] {

    var res = nlapiCreateSearch(recordtype, filters, columns).runSearch();

    var res_chunk, start_idx = 0 , res_final = [];
    do {
        res_chunk = res.getResults(start_idx, start_idx + 1000) || [];
        res_final = res_final.concat(res_chunk);
        start_idx += 1000;
    } while (res_chunk.length);

    return res_final;
}
export var big = bigSearch;



export function searchCols( colunas : (string|nlobjSearchColumn)[] ) : nlobjSearchColumn[] {
    return colunas.map( coluna => {
        if (typeof coluna == "string") {
            var split = (<string>coluna).split(".");
            if (split[1]) return new nlobjSearchColumn(split[1], split[0]);
            return new nlobjSearchColumn(split[0]);
        } else if (<any>coluna instanceof nlobjSearchColumn) {
            return <any>coluna;
        }
        else throw nlapiCreateError("mapSearchCol", "Entrada inválida");
    })
}
export var cols = searchCols;


 

