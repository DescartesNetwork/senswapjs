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

  _certify = (msg) => {
    return new Promise((resolve, reject) => {
      const node = this._getNode();
      msg = bs58.encode(Buffer.from(msg, 'utf8'));
      return node.request({ method: 'sol_sign', params: [msg] }).then(({ publicKey, signature }) => {
        const address = publicKey;
        const sig = bs58.decode(signature).toString('hex');
        return resolve({ address, sig, msg });
      }).catch(er => {
        return reject(er);
      });
    });
  }

  _verify = (sig, msg = null) => {
    return new Promise((resolve, reject) => {
      return this._getAccount().then(addr => {
        if (msg) msg = bs58.encode(Buffer.from(msg, 'utf8'));
        return account.verify(addr, sig, msg);
      }).then(data => {
        if (typeof data === 'string') data = bs58.decode(data).toString('utf8');
        return resolve(data);
      }).catch(er => {
        return reject(er);
      });
    });
  }
}

module.exports = Coin98Wallet;