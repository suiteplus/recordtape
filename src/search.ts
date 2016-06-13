export function initSearch( rtape ) {

    rtape.search = function(filters, columns) {
        filters = transformFilters(filters)
        columns = transformColumns(columns);
        return nlapiSearchRecord(rtape.code, null, filters, columns)
    }


    function transformFilters(filters) {
        return filters.map( (item,idx) => {
            if (Array.isArray(item)) return transformFilters(item)
            if (item == 'and' || item == 'or') return item;
            if (!idx) {
                if (~item.indexOf('.')) {
                    let split = item.split('.')
                    let p0 = rtape.fld[split[0]]
                    if (!p0) throw nlapiCreateError('transformFilters-2',`Field ${p0} not found`)
                    return `p0.${split[1]}`
                }
                let out = rtape.fld[item] 
                if (!out) throw nlapiCreateError('transformFilters-1',`Field ${item} not found`)
                return out
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


 

