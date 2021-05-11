class WalletInterface {
  constructor() {
    this._getAccount = null;
    this._sign = null;
  }

  isConnected = () => {
    return new Promise((resolve, _reject) => {
      return this.getAccount().then(account => {
        if (!account) return resolve(false);
        return resolve(true);
      }).catch(er => {
        console.warn(er);
        return resolve(false);
      });
    });
  }

  getAccount = () => {
    return new Promise((resolve, reject) => {
      if (!this._getAccount) return reject('Wallet is not connected');
      return this._getAccount().then(account => {
        return resolve(account);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  sign = (transaction) => {
    return new Promise((resolve, reject) => {
      if (!this._sign) return reject('Wallet is not connected');
      return this._sign(transaction).then(re => {
        return resolve(re);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  certify = (message) => {
    return new Promise((resolve, reject) => {
      if (!this._certify) return reject('Wallet is not connected');
      return this._certify(message).then(re => {
        return resolve(re);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  verify = (signature, message = null) => {
    return new Promise((resolve, reject) => {
      if (!this._verify) return reject('Wallet is not connected');
      return this._verify(signature, message).then(re => {
        return resolve(re);
      }).catch(er => {
        return reject(er);
      });
    });
  }
}

module.exports = WalletInterface;