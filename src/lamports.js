const {
  Connection, Transaction, SystemProgram,
  sendAndConfirmTransaction,
} = require('@solana/web3.js');

const Tx = require('./core/tx');
const account = require('./account');


class Lamports extends Tx {
  constructor(nodeUrl) {
    super(nodeUrl);
  }

  _createConnection = () => {
    const connection = new Connection(this.nodeUrl, 'recent');
    return connection;
  }

  watch = (address, callback) => {
    if (!account.isAddress(address)) return callback('Invalid address', null);
    const publicKey = account.fromAddress(address);
    return this.connection.onAccountChange(publicKey, data => {
      if (!data) return callback('Cannot parse data', null);
      const { lamports } = data;
      return callback(null, lamports);
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

  transfer = (lamports, dstAddress, wallet) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(dstAddress)) return reject('Invalid destination address');

      let transaction = new Transaction();
      const dstPublicKey = account.fromAddress(dstAddress);

      return this._addRecentCommitment(transaction).then(txWithCommitment => {
        transaction = txWithCommitment;
        return wallet.getAccount();
      }).then(payerAddress => {
        const payerPublicKey = account.fromAddress(payerAddress);

        const instruction = SystemProgram.transfer({
          fromPubkey: payerPublicKey,
          toPubkey: dstPublicKey,
          lamports
        });
        transaction.add(instruction);
        transaction.feePayer = payerPublicKey;
        return wallet.sign(transaction);
      }).then(payerSig => {
        this._addSignature(transaction, payerSig);
        return this._sendTransaction(transaction);
      }).then(txId => {
        return resolve(txId);
      }).catch(er => {
        return reject(er);
      });
    });
  }
}

module.exports = Lamports;