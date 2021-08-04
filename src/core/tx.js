const nacl = require('tweetnacl');
const { Connection, Transaction, SystemProgram } = require('@solana/web3.js');
const account = require('../account');
const { DEFAULT_NODEURL } = require('../defaults');
const ParsedTransactionError = require('./txError');

class Tx {
  constructor(nodeUrl = DEFAULT_NODEURL) {
    this.nodeUrl = nodeUrl;
    this.connection = this._createConnection();
  }

  _createConnection = () => {
    const connection = new Connection(this.nodeUrl, 'recent');
    return connection;
  }

  _sendTransaction = async (transaction) => {
    const tx = transaction.serialize();
    const txId = await this.connection.sendRawTransaction(tx, { skipPreflight: true, commitment: 'recent' });
    const data = await this.connection.confirmTransaction(txId, 'recent');
    const { value: { err } } = data;
    if (err) throw new ParsedTransactionError(err);
    return txId;
  }

  _addRecentCommitment = async (transaction) => {
    const { blockhash } = await this.connection.getRecentBlockhash('recent');
    transaction.recentBlockhash = blockhash;
    return transaction;
  }

  _addSignature = (transaction, { publicKey, signature }) => {
    if (!transaction.feePayer) transaction.feePayer = publicKey;
    transaction._addSignature(publicKey, signature);
  }

  _selfSign = (transaction, account) => {
    if (!transaction || !transaction.feePayer) return null;
    if (!account || !account.secretKey) return null;
    const publicKey = account.publicKey;
    const signData = transaction.serializeMessage();
    const signature = nacl.sign.detached(signData, account.secretKey);
    return { publicKey, signature }
  }

  /**
   * _isReadyForRent
   * @param {*} newAccount 
   * @param {*} space 
   * @param {*} programId 
   * @returns bool
   *   true - not rented
   *   false - rented but not initialized
   */
  _isReadyForRent = async (newAccount, space, programId) => {
    const data = await this.connection.getAccountInfo(newAccount.publicKey);
    if (!data) return true;
    if (data.owner.equals(SystemProgram.programId)) return true;
    if (!data.owner.equals(programId)) throw new Error('Invalid program id');
    if (data.data.length !== space) throw new Error('Invalid data length');
    if (!data.data.every(e => !e)) throw new Error('Account was initilized');
    return false;
  }

  _rentAccount = async (wallet, newAccount, space, programId) => {
    // Get payer
    const payerAddress = await wallet.getAccount();
    const fromPubkey = account.fromAddress(payerAddress);
    // Validate account
    const notRented = await this._isReadyForRent(newAccount, space, programId);
    if (!notRented) return null;
    // Build tx
    let transaction = new Transaction();
    transaction = await this._addRecentCommitment(transaction);
    const lamports = await this.connection.getMinimumBalanceForRentExemption(space);
    const instruction = SystemProgram.createAccount({
      fromPubkey,
      newAccountPubkey: newAccount.publicKey,
      lamports,
      space,
      programId
    });
    transaction.add(instruction);
    transaction.feePayer = fromPubkey;
    // Sign tx
    const payerSig = await wallet.sign(transaction);
    this._addSignature(transaction, payerSig);
    const accSig = this._selfSign(transaction, newAccount);
    this._addSignature(transaction, accSig);
    // Send tx
    const txId = this._sendTransaction(transaction);
    return txId;
  }
}

module.exports = Tx;