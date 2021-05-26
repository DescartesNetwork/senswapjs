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

  _getAccount = async () => {
    const acc = this._getWallet();
    if (!acc || !acc.publicKey) throw new Error('No account');
    const address = acc.publicKey.toBase58();
    return address;
  }

  _sign = async (tx) => {
    const acc = this._getWallet();
    const signData = tx.serializeMessage();
    const publicKey = acc.publicKey;
    const signature = nacl.sign.detached(signData, acc.secretKey);
    return { publicKey, signature }
  }

  _certify = async (msg) => {
    const secretKey = storage.get('SecretKey');
    const data = account.sign(msg, secretKey);
    return { ...data }
  }

  _verify = async (sig, msg = null) => {
    const acc = this._getWallet();
    const addr = acc.publicKey.toBase58();
    const data = account.verify(addr, sig, msg);
    return data;
  }
}

module.exports = RawWallet;