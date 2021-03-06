const fs = require('fs');
const { Account } = require('@solana/web3.js');

let distribution = {}
let counter = 0;
console.log(new Date())
while (counter < 1000000) {
  counter++;
  if (!(counter % 10000)) console.log(counter);
  const account = new Account();
  const address = account.publicKey.toBase58();
  const prefix = address.substring(0, 4);
  distribution[prefix] = (distribution[prefix] || 0) + 1;
}
console.log(new Date())

fs.writeFileSync('./distribution.json', JSON.stringify(distribution, null, 2));