Note: Abandoned/unfinished.

# recordtape

"Recordtape" is a wrapper for Netsuite Suitescript (1.0) record types.

It aims at reducing keystrokes, provide structure and abstraction for simpler thinking.

### factory(opt)

Declare a record type.

```javascript
var Record = require('recordtape');
var meta = {
    code : 'transaction' ,
    fld : {
        location: 'location',
        entity: 'entity',
        amount: 'amount',
        subtotal: 'subtotal',
        discounttotal: 'discounttotal',
        meu_campo : 'custrecord_meu_campo'
    } , //opcional
    sublists: {
        'salesterm': 'recmachcustrecord_sp_salesterm_tranid_ls',
        'item': 'item'
    }    
};

var Transaction = Record.factory(meta);

```

### Creating

```javascript
var t1 = Transaction.fromId(23);
//DB calls will use lookupField
var t2 = Transaction.fromRecord(rec);
//DB calls will use this nlobjRecord
var t3 = Transaction.fromSearchResult(res);
//will use this result columns when possible, or falls back to lookupField
var t4 = Transaction.fromCurrentClient();
//calls client form API
var t5 = Transaction.create('invoice');
//new record. Parameter optional (used for record subtypes e.g. entity -> customer)
```

Records are cached by default. A subsequent call to a record with the same
ID and type will reuse the previous one.

### Reading

```javascript
//f stands for "field"
var myField = t1.f('my_field');
var name = t1.fjoin('entity','firstname');
var ibgec = _.compose(
    City.curryf('ibge_code'),
    Address.curryf('city'),
    Entity.curryf('address')
    )(t1.f('entity'))
```

Read fields are also cached.

Recordtape keeps a list of which fields are used for each script instance.
The next time you read from a new record, it fecthes all of these fields.   

To persist this list for subsequent script calls, use `recordtape.end()`.

```javascript
var f1 = r.f('field1')  //nlapiLookupField field1,field2 and field3 into cache
var f2 = r.f('field2')  //field2 is already in cache. Just get it
```

All of this caching thing has in mind that in Suitescript 
the database calls are always responsible for most of the processing time.  

Complete spec below (typescript interface):
```typescript
export interface tRecord {
    f(field:string) : string;
    fraw(field:string) : string;
    ftext(field:string) : string;
    ftextraw(field:string) : string;
    fjoin(src:string, field:string) : string;
    fset(name:string,value:string) : tRecord;
    fsetraw(src:string, value:string) : tRecord;
    put(src:any) : tRecord;
    json() : any;
    submit() : tRecord;
    delete() : void;
    sublist(name:string, clas:RtapeStatic) : tRecord[];

    id : number;
    state : internalState;
    meta : FactoryMeta;
    code : string;
    fld : any;
    getStatic() : RtapeStatic;
}
```

### Sublist

Representa um join 1-n e é executado usando busca ou sublist dependendo
do contexto utilizado.

```javascript
var terms = t1.sublist('salesterm', SalesTerm);
```

### Edição

```javascript
t1.fset('campo1', 1);
t1.put({ campo2 : 2 , campo3 : 3 })
t1.submit(); //necessário
t1.delete();
```


### Expose

Expõe campos como propriedades do objeto.

```javascript
Transaction.expose(['entity']);
Transaction.exposeAll();

var t1 = Transaction.fromId(123);
console.log(t1.entity);
var obj = t1.json();
```

`.json(c?:string[])` extrai os itens expostos para um objeto plano.

### Extendendo

Amarrar uma função a uma "classe".

```javascript
Transaction.searchAllVoid = function() {
    // ...
```

Amarrar uma função a uma "instância"

```javascript
Transaction.registerMethod('void' , function(transactionObject, date){
    //...

t.void(new Date());
```
O callback de `registerMethod` sempre recebe como primeiro argumento
a instância.

### Busca

`RecordtapeStatic.search([options],[filters],[columns])`
