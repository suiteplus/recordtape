"use strict";
function fromRtape(parentRtape, childRtapeStatic, slname) {
    if (parentRtape.state.origin != 'record')
        throw nlapiCreateError('sublist', 'not implemented');
    var objRecord = parentRtape.state.record;
    return {
        count: function () {
            return objRecord.getLineItemCount(slname);
        },
        value: function (field, line) {
            return objRecord.getLineItemValue(slname, field, line);
        },
        text: function (field, line) {
            return objRecord.getLineItemText(slname, field, line);
        },
        idFromLine: function (line) {
            return this.value(childRtapeStatic.idField, line);
        },
        lineFromId: function (id) {
            return objRecord.findLineItemValue(slname, childRtapeStatic.idField, id);
        }
    };
}
exports.fromRtape = fromRtape;
var dummy = null && fromRtape(0, 1, 2);
