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

  _getAccount = async () => {
    const node = this._getNode();
    const re = await node.request({ method: 'sol_accounts' });
    const [acc] = re || [];
    if (!acc) throw new Error('There is no Solana account');
    return acc;
  }

  _sign = async (transaction) => {
    const node = this._getNode();
    const acc = await this.getAccount();
    transaction.feePayer = account.fromAddress(acc);
    let { publicKey, signature } = await node.request({ method: 'sol_sign', params: [transaction] });
    publicKey = account.fromAddress(publicKey);
    signature = bs58.decode(signature);
    return { publicKey, signature }
  }

  _certify = async (msg) => {
    const node = this._getNode();
    const data = await node.request({ method: 'sol_sign', params: [msg] });
    return data;
  }

  _verify = async (sig, msg = null) => {
    const addr = await this._getAccount();
    const data = await account.verify(addr, sig, msg);
    return data;
  }
}

module.exports = Coin98Wallet;