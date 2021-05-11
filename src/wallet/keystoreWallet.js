const nacl = require('tweetnacl');

const account = require('../account');
const storage = require('./storage');
const WalletInterface = require('./walletInterface');


class KeystoreWallet extends WalletInterface {
  constructor(keystore, password) {
    super();

    this._setWallet(keystore, password);
  }

  _setWallet = (keystore, password) => {
    const acc = account.fromKeystore(keystore, password);
    const secretKey = Buffer.from(acc.secretKey).toString('hex');
    storage.set('WalletType', 'Keystore');
    storage.set('SecretKey', secretKey);
  }

  _getWallet = () => {
    const secretKey = storage.get('SecretKey');
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
        const confirmed = window.confirm('Please confirm to sign the traction!');
        if (!confirmed) return reject('User rejects to sign the transaction');
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

  _cetify = (msg) => {
    return new Promise((resolve, reject) => {
      try {
        const confirmed = window.confirm(`Please confirm to cetify the message! Message: ${msg}`);
        if (!confirmed) return reject('User rejects to certify the message');
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

module.exports = KeystoreWallet;