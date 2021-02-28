const { Account } = require('@solana/web3.js');

const prefix = process.argv[2];
let counter = 0;
while (true) {
  console.log(counter++);
  const account = new Account();
  const address = account.publicKey.toBase58();
  if (!prefix || address.substring(0, prefix.length) == prefix) {
    console.log(address);
    console.log(Buffer.from(account.secretKey).toString('hex'));
    break;
  }
}