"use strict";
//implementação parcial por enquanto
function fromRecord(objRecord, slname) {
    return {
        count: function () {
            return objRecord.getLineItemCount(this.name);
        },
        value: function (field, line) {
            return objRecord.getLineItemValue(this.name, field, line);
        }
    };
}
exports.fromRecord = fromRecord;
