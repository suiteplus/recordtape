//implementação parcial por enquanto
export function fromRecord(objRecord:nlobjRecord, slname:string) {

    return {
        count() : number {
            return objRecord.getLineItemCount(this.name)
        } ,

        value(field:string, line:number) : string {
            return objRecord.getLineItemValue(this.name,field,line)
        }
    }

}