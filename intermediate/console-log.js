"use strict";
//instance identifier for logs
var INUMBER = Math.ceil(Math.random() * 1000);
var lastprofile;
var logcount = 1;
function log() {
    var message = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        message[_i - 0] = arguments[_i];
    }
    var o = '';
    message.forEach(function (m) {
        if (typeof m == "object")
            o += ' ' + JSON.stringify(m);
        else
            o += ' ' + m;
    });
    nlapiLogExecution("DEBUG", INUMBER + " console.log " + o, logcount++);
}
function profile(description) {
    if (lastprofile)
        nlapiLogExecution("DEBUG", INUMBER + " Profiling: " + description, Number(new Date()) - Number(lastprofile));
    lastprofile = new Date();
}
function logerror(txt) {
    var out = txt;
    if (typeof txt == "object")
        out = JSON.stringify(txt);
    nlapiLogExecution("ERROR", INUMBER + " console.error", out);
}
function debug() {
    var out = "";
    for (var it = 0; it < arguments.length; it++) {
        try {
            if (typeof arguments[it] == 'string')
                out += arguments[it] + "; ";
            else if (arguments[it] instanceof Error)
                out += arguments[it].message + " - " + arguments[it].stack + "; ";
            else
                out += JSON.stringify(arguments[it]);
        }
        catch (e) { }
    }
    nlapiLogExecution('DEBUG', 'debug', out);
}
if (typeof console === 'undefined' && typeof GLOBALS !== 'undefined') {
    GLOBALS.console = {};
    GLOBALS.console.log = log;
    GLOBALS.console.debug = debug;
    GLOBALS.console.profile = profile;
    GLOBALS.console.error = logerror;
}
