const bs58 = require('bs58');

const account = require('../account');
const storage = require('./storage');
const WalletInterface = require('./walletInterface');


class Coin98Wallet extends WalletInterface {
  constructor() {
    super();

    this._setWallet();
  }

  _setWallet = () => {
    storage.set('WalletType', 'Coin98');
  }

  _getNode = () => {
    const { coin98 } = window;
    const { sol } = coin98 || {};
    if (!sol) throw new Error('Wallet is not connected');
    return sol;
  }

  _getAccount = () => {
    return new Promise((resolve, reject) => {
      const node = this._getNode();
      return node.request({ method: 'sol_accounts' }).then(([acc]) => {
        if (!acc) return reject('There is no Solana account');
        return resolve(acc);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  _sign = (transaction) => {
    return new Promise((resolve, reject) => {
      const node = this._getNode();
      return this.getAccount().then(acc => {
        transaction.feePayer = account.fromAddress(acc);
        return node.request({ method: 'sol_sign', params: [transaction] })
      }).then(({ publicKey, signature }) => {
        publicKey = account.fromAddress(publicKey);
        signature = bs58.decode(signature);
        return resolve({ publicKey, signature });
      }).catch(er => {
        return reject(er.message);
      });
    });
  }
}

module.exports = Coin98Wallet;