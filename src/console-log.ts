declare var GLOBALS;

//instance identifier for logs
var INUMBER = Math.ceil(Math.random() * 1000);
var lastprofile : Date, lastUsage:number;
var logcount = 1

function log(...message) {
    var o = ''
    message.forEach( m => {
        if ( typeof m == "object" ) o += ' ' + JSON.stringify(m);
        else o += ' ' + m
    })
    nlapiLogExecution("DEBUG",`${INUMBER} console.log ${logcount++} ${String(o).substr(0,15)}` , o);
}

function profile(description?:string) {
    var usg = nlapiGetContext().getRemainingUsage()
    if (!lastUsage) lastUsage = usg
    if (lastprofile)
        nlapiLogExecution("DEBUG",`${INUMBER} Profiling: ${description}` ,
            `Time(ms): ${Number(new Date()) - Number(lastprofile)} Usage:${lastUsage - usg}`
        );
    lastprofile = new Date();
    lastUsage = usg
}

function logerror(txt) {
    var out = txt;
    if ( typeof txt == "object" ) out = JSON.stringify(txt);
    nlapiLogExecution("ERROR",`${INUMBER} console.error` , out);
}

function debug() {
    var out = "";

    for ( var it = 0; it < arguments.length ; it++ ) {
        try {
            if (typeof arguments[it] == 'string') out += arguments[it] + "; ";
            else if (arguments[it] instanceof Error) out += arguments[it].message + " - " + arguments[it].stack + "; ";
            else out += JSON.stringify(arguments[it]);
        }catch(e){}
    }

    nlapiLogExecution('DEBUG','debug',out);
}


function $stackTrace(err : nlobjError|Error) : string {
    err = <any>err || <any>{}
    if (!err['getStackTrace'] ) {
        return err['stack'] || '';
    }
    var stack = (<any>err).getStackTrace();
    var out = '';
    for ( var it = 0; it < stack.length; it++) {
        out += stack[it] + ' -- ';
    }
    log(out)
    return out;
}


if (typeof console === 'undefined' && typeof GLOBALS !== 'undefined') {
    GLOBALS.console = <any>{};
    GLOBALS.console.log = log;
    GLOBALS.console.debug = debug;
    GLOBALS.console.profile = profile;
    GLOBALS.console.error = logerror;
    GLOBALS.console.$stackTrace = $stackTrace
}

export {}