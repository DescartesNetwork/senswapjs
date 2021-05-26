class WalletInterface {
  constructor() {
    this._getAccount = null;
    this._sign = null;
  }

  isConnected = async () => {
    try {
      const account = await this.getAccount();
      if (!account) return false;
      return true;
    } catch (er) {
      console.warn(er);
      return false;
    }
  }

  getAccount = async () => {
    if (!this._getAccount) throw new Error('Wallet is not connected');
    const account = await this._getAccount();
    return account;
  }

  sign = async (transaction) => {
    if (!this._sign) throw new Error('Wallet is not connected');
    const re = await this._sign(transaction);
    return re;
  }

  certify = async (message) => {
    if (!this._certify) throw new Error('Wallet is not connected');
    const re = await this._certify(message);
    return re;
  }

  verify = async (signature, message = null) => {
    if (!this._verify) throw new Error('Wallet is not connected');
    const re = await this._verify(signature, message);
    return re;
  }
}

module.exports = WalletInterface;