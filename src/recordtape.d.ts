declare interface RecordMeta {
    fld : any;
    sublists? : any;
    code : string;
}

declare interface RecordOpts {
    noCache : boolean;
}


declare class Record {
    
    static meta : RecordMeta
    static code : string;
    static fld : any;
    static sublists : string;
    static expose( fields : string[] ) : void;
    static exposeAll() : void;
    
    meta : RecordMeta
    code : string;
    fld : any;
    sublists : string;
    
    doCache : boolean;
    
    static create(code?:string) : Record;
    static fromId(id:number, opts? : RecordOpts) : Record;
    static fromRecord(nlobjRecord:any) : Record;
    static fromRecordSublist(spmSublist:any, id:number) : Record;
    static fromSearchResult(nlobjSearchRes:any) : Record;
    static fromCurrentClient(window?:Window) : Record;
    
    static curryf(field:string) : string;
    
    static end();
    
    f(field:string) : string;
    fjoin(src:string,field:string) : string;
    fset(field:string,value:any) : Record;
    submit() : Record;
    delete() : void;
    sublist(name : string, clas:any) : Record[];
    
}


declare function factory(meta:RecordMeta) : typeof Record;

export {
    RecordMeta ,
    RecordOpts ,
    Record ,
    factory
}