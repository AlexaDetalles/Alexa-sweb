import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCSV,parseProducts,sanitizeCart,cartTotal,cartSummary,cartMessage,imageURL,escapeHTML} from '../public/assets/core.mjs';
import {PREPARED_GIFTS} from '../public/assets/gifts.mjs';
const products=parseProducts(readFileSync(new URL('../public/assets/data/catalog.csv',import.meta.url),'utf8'));
test('CSV handles real quoted multiline descriptions and escaped quotes',()=>{
 assert.deepEqual(parseCSV('id,name,desc\r\n1,"Globo ""Te Amo""","Hola,\nmundo"'),[['id','name','desc'],['1','Globo "Te Amo"','Hola,\nmundo']]);
 assert.equal(products.length,111);assert.equal(products.filter(p=>p.available).length,111);
});
test('unified basket uses quantities, current prices and integer cents',()=>{
 const a=products[0],b=products[1],cart={[a.id]:2,[b.id]:1};
 assert.equal(cartTotal(cart,products),2*a.cents+b.cents);assert.match(cartMessage(cart,products),/2 × Valentino/);
 assert.deepEqual(sanitizeCart({a:-1,b:0,c:'2',d:100,e:1.5,f:2}),{f:2});
 assert.equal(cartMessage({x:1},products),null);
 assert.equal(cartMessage({x:1,[a.id]:1},products),null);
 assert.equal(cartMessage({[a.id]:1},[{...a,available:false}]),null);
});
test('made-to-order gifts remain selectable without pretending to cost zero',()=>{
 const all=[...products,...PREPARED_GIFTS],gift=PREPARED_GIFTS[0],p=products[0];
 assert.equal(PREPARED_GIFTS.filter(g=>g.group==='PAG').length,2);
 assert.equal(PREPARED_GIFTS.filter(g=>g.group==='PAGH').length,2);
 assert.equal(cartSummary({[gift.id]:2},all),'Por cotizar');
 assert.match(cartMessage({[gift.id]:2},all),/2 × Rosas & Chocolate/);
 assert.match(cartMessage({[gift.id]:2},all),/por cotizar/);
 assert.doesNotMatch(cartMessage({[gift.id]:2},all),/0\.00/);
 assert.equal(cartTotal({[gift.id]:2,[p.id]:1},all),p.cents);
 assert.match(cartSummary({[gift.id]:2,[p.id]:1},all),/regalos por cotizar/);
});
test('sheet content cannot inject HTML or active URLs',()=>{
 assert.equal(imageURL('javascript:alert(1)'),'/assets/images/no-photo.svg');
 assert.equal(imageURL('https://via.placeholder.com/x'),'/assets/images/no-photo.svg');
 assert.equal(imageURL('https://alexashop.cc/img/1.png'),'/assets/images/1.webp');
 assert.equal(escapeHTML('<img onerror="x">'),'&lt;img onerror=&quot;x&quot;&gt;');
 const p=parseProducts('ID,Nombre,Precio,Imagen,Stock,Categoría,Descripción\nx,<script>,-2,javascript:x,TRUE,HP,foo');assert.equal(p.length,0);
});

test('unknown remote images cannot track visitors through sheet changes',()=>{
 assert.equal(imageURL('https://tracking.example/visitor.gif'),'/assets/images/no-photo.svg');
 assert.equal(imageURL('https://alexashop.cc/img/999.png'),'/assets/images/no-photo.svg');
 assert.equal(imageURL('https://user:password@example.com/photo.jpg'),'/assets/images/no-photo.svg');
});
