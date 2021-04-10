const nacl = require('tweetnacl');
const { fromSecretKey } = require('../dist');


class Wallet {
  constructor(secretKey) {
    this.payer = fromSecretKey(secretKey);
  }

  getAccount = () => {
    return new Promise((resolve, reject) => {
      const address = this.payer.publicKey.toBase58();
      return resolve(address);
    });
  }

  sign = (transaction) => {
    return new Promise((resolve, reject) => {
      const signData = transaction.serializeMessage();
      const publicKey = this.payer.publicKey;
      const signature = nacl.sign.detached(signData, this.payer.secretKey);
      return resolve({ publicKey, signature });
    });
  }
}

module.exports = Wallet;