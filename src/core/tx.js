const nacl = require('tweetnacl');
const { Connection, Transaction, SystemProgram } = require('@solana/web3.js');
const account = require('../account');

const DEFAULT_NODEURL = 'https://devnet.solana.com';

class Tx {
  constructor(nodeUrl = DEFAULT_NODEURL) {
    this.nodeUrl = nodeUrl;
    this.connection = this._createConnection();
  }

  _createConnection = () => {
    const connection = new Connection(this.nodeUrl, 'recent');
    return connection;
  }

  _sendTransaction = (transaction) => {
    return new Promise((resolve, reject) => {
      const tx = transaction.serialize();
      let txId = '';
      return this.connection.sendRawTransaction(tx, { skipPreflight: true, commitment: 'recent' }).then(signature => {
        txId = signature;
        return this.connection.confirmTransaction(txId, 'recent');
      }).then(re => {
        const { value: { err } } = re;
        if (err) return reject(err);
        return resolve(txId);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  _addRecentCommitment = (transaction) => {
    return new Promise((resolve, reject) => {
      return this.connection.getRecentBlockhash('recent').then(({ blockhash }) => {
        transaction.recentBlockhash = blockhash;
        return resolve(transaction);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  _addSignature = (transaction, { publicKey, signature }) => {
    if (!transaction.feePayer) transaction.feePayer = publicKey;
    transaction._addSignature(publicKey, signature);
  }

  _sign = (transaction, account) => {
    if (!transaction || !transaction.feePayer) return null;
    if (!account || !account.secretKey) return null;
    const publicKey = account.publicKey;
    const signData = transaction.serializeMessage();
    const signature = nacl.sign.detached(signData, account.secretKey);
    return { publicKey, signature }
  }

  _rentAccount = (wallet, newAccount, space, programId) => {
    return new Promise((resolve, reject) => {
      let transaction = new Transaction();
      let fromPubkey = null;
      return this._addRecentCommitment(transaction).then(txWithCommitment => {
        transaction = txWithCommitment;
        return wallet.getAccount();
      }).then(payerAddress => {
        fromPubkey = account.fromAddress(payerAddress);
        return this.connection.getMinimumBalanceForRentExemption(space);
      }).then(lamports => {
        const instruction = SystemProgram.createAccount({
          fromPubkey,
          newAccountPubkey: newAccount.publicKey,
          lamports,
          space,
          programId
        });
        transaction.add(instruction);
        transaction.feePayer = fromPubkey;
        return wallet.sign(transaction);
      }).then(payerSig => {
        this._addSignature(transaction, payerSig);
        const accSig = this._sign(transaction, newAccount);
        this._addSignature(transaction, accSig);
        return this._sendTransaction(transaction);
      }).then(txId => {
        return resolve(txId);
      }).catch(er => {
        return reject(er);
      });
    });
  }
}

module.exports = Tx;