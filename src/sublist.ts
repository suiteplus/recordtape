//implementação parcial por enquanto
import rtape = require('./recordtape')

export function fromRtape(parentRtape:rtape.tRecord, childRtapeStatic:any, slname:string) {

    if (parentRtape.state.origin != 'record') throw nlapiCreateError('sublist', 'not implemented')

    var objRecord = parentRtape.state.record

    return {
        count() : number {
            return objRecord.getLineItemCount(slname)
        } ,

        value(field:string, line:number) : string {
            return objRecord.getLineItemValue(slname,field,line)
        } ,

        text(field:string, line:number) : string {
            return objRecord.getLineItemText(slname,field,line)
        } ,

        idFromLine(line) {
            return this.value(childRtapeStatic.idField, line)
        } ,

        lineFromId(id) {
            return objRecord.findLineItemValue(slname, childRtapeStatic.idField, id)
        }
    }

}

var dummy = null && fromRtape(<any>0,<any>1,<any>2)
export type tSublist = typeof dummy;