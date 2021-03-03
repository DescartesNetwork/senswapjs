const {
  Connection, Transaction, SystemProgram,
  sendAndConfirmTransaction,
} = require('@solana/web3.js');

const account = require('./account');

const DEFAULT_NODEURL = 'https://devnet.solana.com';


class Lamports {
  constructor(nodeUrl = DEFAULT_NODEURL) {
    this.nodeUrl = nodeUrl;
    this.connection = this._createConnection();
  }

  _createConnection = () => {
    const connection = new Connection(this.nodeUrl, 'recent');
    return connection;
  }

  watch = (address, callback) => {
    if (!account.isAddress(address)) return reject('Invalid address');
    const publicKey = account.fromAddress(address);
    return this.connection.onAccountChange(publicKey, data => {
      console.log(data);
      const { accountId } = data;
      return this.get(accountId);
    }).then(lamports => {
      return callback(null, lamports);
    }).catch(er => {
      return callback('Cannot parse data', null);
    });
  }

  get = (address) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(address)) return reject('Invalid address');
      const publicKey = account.fromAddress(address);
      return this.connection.getBalance(publicKey).then(lamports => {
        return resolve(lamports);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  transfer = (lamports, dstAddress, payer) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(dstAddress)) return reject('Invalid destination address');
      const dstPublicKey = account.fromAddress(dstAddress);

      const instruction = SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: dstPublicKey,
        lamports
      });
      const transaction = new Transaction();
      transaction.add(instruction);
      return sendAndConfirmTransaction(
        this.connection,
        transaction,
        [payer],
        { skipPreflight: true, commitment: 'recent' }
      ).then(txId => {
        return resolve(txId);
      }).catch(er => {
        return reject(er);
      });
    });
  }
}

module.exports = Lamports;