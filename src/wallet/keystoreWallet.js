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

  _getAccount = async () => {
    const acc = this._getWallet();
    if (!acc || !acc.publicKey) throw new Error('No account');
    const address = acc.publicKey.toBase58();
    return address;
  }

  _sign = async (tx) => {
    const confirmed = window.confirm('Please confirm to sign the traction!');
    if (!confirmed) throw new Error('User rejects to sign the transaction');
    const acc = this._getWallet();
    const signData = tx.serializeMessage();
    const publicKey = acc.publicKey;
    const signature = nacl.sign.detached(signData, acc.secretKey);
    return { publicKey, signature }
  }

  _certify = async (msg) => {
    const confirmed = window.confirm(`Please confirm to certify the message! Message: ${msg}`);
    if (!confirmed) throw new Error('User rejects to certify the message');
    const secretKey = storage.get('SecretKey');
    const data = account.sign(msg, secretKey);
    return { ...data };
  }

  _verify = async (sig, msg = null) => {
    const acc = this._getWallet();
    const addr = acc.publicKey.toBase58();
    const data = account.verify(addr, sig, msg);
    return data;
  }

  _disconnect = async () => {
    storage.clear('WalletType');
    storage.clear('SecretKey');
  }
}

module.exports = KeystoreWallet;