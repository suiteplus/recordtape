//implementação parcial por enquanto
import rtape = require('./recordtape')

export function fromRtape(parentRtape:rtape.tRecord, childRtapeStatic:any, slRef:string) {

    if (parentRtape.state.origin != 'record') throw nlapiCreateError('sublist', 'not implemented')

    var objRecord = parentRtape.state.record
    var slName = parentRtape.meta.sublists[slRef]
    if (!slName) throw nlapiCreateError('sublist', `Sublist ref ${slRef} not found.`)

    var objSublist = {
        count() : number {
            return objRecord.getLineItemCount(slName)
        } ,

        value(field:string, line:number) : string {
            return objRecord.getLineItemValue(slName,field,line)
        } ,

        text(field:string, line:number) : string {
            return objRecord.getLineItemText(slName,field,line)
        } ,

        idFromLine(line) {
            return this.value(childRtapeStatic.idField, line)
        } ,

        lineFromId(id) {
            //não funciona direito
            //return objRecord.findLineItemValue(slName, childRtapeStatic.idField, id)
            var count = this.count();
            var out = -1;
            for ( var it = 1 ; it <= count ; it++ ) {
                let value = objSublist.value(childRtapeStatic.idField, it)
                if (value == id) {
                    out = it;
                    break
                }
            }
            return out;
        }
    }

    return objSublist

}

var dummy = null && fromRtape(<any>0,<any>1,<any>2)
export type tSublist = typeof dummy;