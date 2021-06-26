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
    return await this._getAccount();
  }

  sign = async (transaction) => {
    if (!this._sign) throw new Error('Wallet is not connected');
    return await this._sign(transaction);
  }

  certify = async (message) => {
    if (!this._certify) throw new Error('Wallet is not connected');
    return await this._certify(message);
  }

  verify = async (signature, message = null) => {
    if (!this._verify) throw new Error('Wallet is not connected');
    return await this._verify(signature, message);
  }

  disconnect = async () => {
    if (!this._disconnect) throw new Error('Wallet is not connected');
    return await this._disconnect();
  }
}

module.exports = WalletInterface;