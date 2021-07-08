const { Transaction, SystemProgram } = require('@solana/web3.js');

const Tx = require('./core/tx');
const account = require('./account');


class Lamports extends Tx {
  constructor(nodeUrl) {
    super(nodeUrl);
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

  get = async (address) => {
    if (!account.isAddress(address)) throw new Error('Invalid address');
    const publicKey = account.fromAddress(address);
    const lamports = await this.connection.getBalance(publicKey);
    return lamports;
  }

  transfer = async (lamports, dstAddress, wallet) => {
    if (!account.isAddress(dstAddress)) throw new Error('Invalid destination address');
    const dstPublicKey = account.fromAddress(dstAddress);
    // Get payer
    const payerAddress = await wallet.getAccount();
    const payerPublicKey = account.fromAddress(payerAddress);
    // Build tx
    let transaction = new Transaction();
    transaction = await this._addRecentCommitment(transaction);
    const instruction = SystemProgram.transfer({
      fromPubkey: payerPublicKey,
      toPubkey: dstPublicKey,
      lamports: lamports.toString()
    });
    transaction.add(instruction);
    transaction.feePayer = payerPublicKey;
    // Sign tx
    const payerSig = await wallet.sign(transaction);
    this._addSignature(transaction, payerSig);
    // Send tx
    const txId = await this._sendTransaction(transaction);
    return txId;
  }
}

module.exports = Lamports;