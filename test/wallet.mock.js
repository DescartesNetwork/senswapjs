const nacl = require('tweetnacl');
const { fromSecretKey } = require('../dist');


class Wallet {
  constructor(secretKey) {
    this.payer = fromSecretKey(secretKey);
  }

  getAccount = async () => {
    const address = this.payer.publicKey.toBase58();
    return address;
  }

  sign = async (transaction) => {
    const signData = transaction.serializeMessage();
    const publicKey = this.payer.publicKey;
    const signature = nacl.sign.detached(signData, this.payer.secretKey);
    return { publicKey, signature };
  }
}

module.exports = Wallet;