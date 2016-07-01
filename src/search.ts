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
                    if (!p0) throw nlapiCreateError('TRANSFORM_FILTERS_2',`Field ${p0} not found`)
                    return `p0.${split[1]}`
                }
                let out = rtape.meta.fld[item] 
                if (!out) throw nlapiCreateError('TRANSFORM_FILTERS_1',`Field ${item} not found`)
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
                let src = rtape.meta.fld[split[0]]
                if (!src) throw nlapiCreateError('SEARCH',`Field ${split[0]} not found in mapping from ${rtape.meta.code}`)
                if (split[1]) {
                    return new nlobjSearchColumn(split[1], src );
                }
                return new nlobjSearchColumn(src);
            } else if (coluna instanceof nlobjSearchColumn) {
                return coluna;
            }
            else throw nlapiCreateError("transformColumns", "Invalid input");
        })
    }

    if (opts.allFields) {
        let fieldmap = {};
        for ( let it in rtape.meta.fld ) {
            fieldmap[it] = true
        }
        var inverse = rtape.fldInverse()
        Rtape.__fieldConf[rtape.meta.code] = Rtape.__fieldConf[rtape.meta.code] || []
        Rtape.__fieldConf[rtape.meta.code].forEach( it => {
            let toset
            if (it.indexOf('.') != -1) {
                let split = it.split('.')
                if (!inverse[split[0]]) throw nlapiCreateError('SEARCH_2',`Field ${split[0]} not found in mapping from ${rtape.meta.code}`)
                toset = inverse[split[0]] + '.' + split[1]
            } else {
                toset = inverse[it]
                if (!toset) throw nlapiCreateError('SEARCH_3',`Field ${it} not found in mapping from ${rtape.meta.code}`)
            }
            fieldmap[ toset ] = true
        })
        columns = []
        for ( let it in fieldmap ) {
            columns.push(it)
        }
        columns = (!opts.noTransformColumns) ? transformColumns(columns) : columns;
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


 

