# recordtape

"Recordtape" é um wrapper para registros (record types) do Suitescript.

### factory(opt)

Define um tipo de registro.

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

Transaction.metadeDoSubtotal = function() {
    
    return Number(this.f('subtotal')) / 2;

}

```

### Obtendo

```javascript
var t1 = Transaction.fromId(23);
//chamadas de leitura usarão preferencialmente o lookupField
var t2 = Transaction.fromRecord(rec);
//recebe nlobjRecord ou número, força o uso de nlobjRecord
var t3 = Transaction.fromSearchResult(res);
//recebe nlobjSearchResult
var t4 = Transaction.fromCurrentClient();
//tenta buscar dados do formulário atual usando API de Client
var t5 = Transaction.create('invoice');
//novo registro
```

Por padrão os registros são "cacheados", ou seja, uma chamada subsequente
a um registro de mesmo tipo e ID trará o anteriormente usado.

### Leitura

```javascript
//f de "field". Aceita os campos/nomes mapeados na declaração
//do registro ou os IDs dos campos.
var meuCampo = t1.f('meu_campo');
var nome = t1.fjoin('entity','firstname');
var ibgec = _.compose(
    City.curryf('ibge_code'),
    Address.curryf('city'),
    Entity.curryf('address')
    )(t1.f('entity'))
```

É efetuado cache na leitura dos campos.
A lista de campos que são utilizados em um script são persistidos,
e em execuções subsequentes todos os campos são lidos em uma chamada e
posteriormente lidos do cache. Ex:

```javascript
var f1 = r.f('campo1') //nlapiLookupField campo1,campo2 e campo3
var f2 = r.f('campo2')  //campo2 já foi lido acima, apenas retorna
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
t1.submit(); //necessário
```