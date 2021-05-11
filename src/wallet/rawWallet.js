const nacl = require('tweetnacl');

const account = require('../account');
const WalletInterface = require('./walletInterface');


/**
 * Raw wallet is for server side
 * It removed storage and browser popup
 */
class RawWallet extends WalletInterface {
  constructor(secretKey) {
    super();

    this.secretKey = secretKey;
  }

  _getWallet = () => {
    const secretKey = this.secretKey;
    const acc = account.fromSecretKey(secretKey);
    return acc;
  }

  _getAccount = () => {
    return new Promise((resolve, reject) => {
      const acc = this._getWallet();
      if (!acc || !acc.publicKey) return reject('No account');
      const address = acc.publicKey.toBase58();
      return resolve(address);
    });
  }

  _sign = (tx) => {
    return new Promise((resolve, reject) => {
      try {
        const acc = this._getWallet();
        const signData = tx.serializeMessage();
        const publicKey = acc.publicKey;
        const signature = nacl.sign.detached(signData, acc.secretKey);
        return resolve({ publicKey, signature });
      } catch (er) {
        return reject(er);
      }
    });
  }

  _certify = (msg) => {
    return new Promise((resolve, reject) => {
      try {
        const secretKey = storage.get('SecretKey');
        const data = account.sign(msg, secretKey);
        return resolve({ ...data });
      } catch (er) {
        return reject(er);
      }
    });
  }

  _verify = (sig, msg = null) => {
    return new Promise((resolve, reject) => {
      try {
        const acc = this._getWallet();
        const addr = acc.publicKey.toBase58();
        const data = account.verify(addr, sig, msg);
        return resolve(data);
      } catch (er) {
        return reject(er);
      }
    });
  }
}

module.exports = RawWallet;