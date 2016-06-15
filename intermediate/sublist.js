"use strict";
function fromRtape(parentRtape, childRtapeStatic, slRef) {
    if (parentRtape.state.origin != 'record')
        throw nlapiCreateError('sublist', 'not implemented');
    var objRecord = parentRtape.state.record;
    var slName = parentRtape.meta.sublists[slRef];
    if (!slName)
        throw nlapiCreateError('sublist', "Sublist ref " + slRef + " not found.");
    var objSublist = {
        count: function () {
            return objRecord.getLineItemCount(slName);
        },
        value: function (field, line) {
            return objRecord.getLineItemValue(slName, field, line);
        },
        text: function (field, line) {
            return objRecord.getLineItemText(slName, field, line);
        },
        idFromLine: function (line) {
            return this.value(childRtapeStatic.idField, line);
        },
        lineFromId: function (id) {
            //não funciona direito
            //return objRecord.findLineItemValue(slName, childRtapeStatic.idField, id)
            var count = this.count();
            var out = -1;
            for (var it = 1; it <= count; it++) {
                var value = objSublist.value(childRtapeStatic.idField, it);
                if (value == id) {
                    out = it;
                    break;
                }
            }
            return out;
        }
    };
    return objSublist;
}
exports.fromRtape = fromRtape;
var dummy = null && fromRtape(0, 1, 2);
