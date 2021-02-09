const {
  Connection, Account, Transaction,
  TransactionInstruction, SystemProgram, sendAndConfirmTransaction,
} = require('@solana/web3.js');
const soproxABI = require('soprox-abi');

const account = require('./account');
const schema = require('./schema');

const DEFAULT_NODEURL = 'https://devnet.solana.com';
const DEFAULT_PROGRAM_ADDRESS = 'JCbHuGZyQiC9abPpEHfs6W8evgumEYthpqqBsgDRewa8';


class SRC20 {
  constructor(nodeUrl = DEFAULT_NODEURL, programAddress = DEFAULT_PROGRAM_ADDRESS) {
    this.nodeUrl = nodeUrl;
    if (!account.isAddress(programAddress)) throw new Error('Invalid program address');
    this.programId = account.fromAddress(programAddress);
    this.connection = this._createConnection();
  }

  _createConnection = () => {
    const connection = new Connection(this.nodeUrl, 'recent');
    return connection;
  }

  getTokenData = (tokenAddress) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(tokenAddress)) return reject('Invalid token address');
      return this.connection.getAccountInfo(account.fromAddress(tokenAddress)).then(({ data }) => {
        if (!data) return reject(`Cannot read data of ${tokenAddress}`);
        const tokenLayout = new soproxABI.struct(schema.TOKEN_SCHEMA);
        tokenLayout.fromBuffer(data);
        const result = { address: tokenAddress, ...tokenLayout.value };
        return resolve(result);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  getAccountData = (accountAddress) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(accountAddress)) return reject('Invalid account address');
      let result = { address: accountAddress }
      return this.connection.getAccountInfo(account.fromAddress(accountAddress)).then(({ data: accountData }) => {
        if (!accountData) return reject(`Cannot read data of ${result.address}`);
        const accountLayout = new soproxABI.struct(schema.ACCOUNT_SCHEMA);
        accountLayout.fromBuffer(accountData);
        let token = { address: accountLayout.value.token }
        result = { ...result, ...accountLayout.value, token }
        return this.connection.getAccountInfo(account.fromAddress(result.token.address));
      }).then(({ data: tokenData }) => {
        if (!tokenData) return reject(`Cannot read data of ${result.token.address}`);
        const tokenLayout = new soproxABI.struct(schema.TOKEN_SCHEMA);
        tokenLayout.fromBuffer(tokenData);
        result.token = { ...result.token, ...tokenLayout.value }
        return resolve(result);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  getLamports = (address) => {
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

  newToken = (symbol, totalSupply, decimals, receiver, token, payer) => {
    return new Promise((resolve, reject) => {
      const receiverSpace = (new soproxABI.struct(schema.ACCOUNT_SCHEMA)).space;
      const tokenSpace = (new soproxABI.struct(schema.TOKEN_SCHEMA)).space;
      return this.connection.getMinimumBalanceForRentExemption(receiverSpace).then(lamports => {
        const instruction = SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: receiver.publicKey,
          lamports,
          space: receiverSpace,
          programId: this.programId,
        });
        const transaction = new Transaction();
        transaction.add(instruction);
        return sendAndConfirmTransaction(
          this.connection,
          transaction,
          [payer, receiver],
          { skipPreflight: true, commitment: 'recent' });
      }).then(re => {
        return this.connection.getMinimumBalanceForRentExemption(tokenSpace);
      }).then(lamports => {
        const instruction = SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: token.publicKey,
          lamports,
          space: tokenSpace,
          programId: this.programId,
        });
        const transaction = new Transaction();
        transaction.add(instruction);
        return sendAndConfirmTransaction(
          this.connection,
          transaction,
          [payer, token],
          { skipPreflight: true, commitment: 'recent' });
      }).then(re => {
        const layout = new soproxABI.struct(
          [
            { key: 'code', type: 'u8' },
            { key: 'symbol', type: '[char;4]' },
            { key: 'totalSupply', type: 'u64' },
            { key: 'decimals', type: 'u8' }
          ],
          { code: 0, symbol, totalSupply, decimals });
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payer.publicKey, isSigner: true, isWritable: false },
            { pubkey: token.publicKey, isSigner: true, isWritable: true },
            { pubkey: receiver.publicKey, isSigner: true, isWritable: true },
          ],
          programId: this.programId,
          data: layout.toBuffer()
        });
        const transaction = new Transaction();
        transaction.add(instruction);
        return sendAndConfirmTransaction(
          this.connection,
          transaction,
          [payer, token, receiver],
          { skipPreflight: true, commitment: 'recent' });
      }).then(txId => {
        return resolve(txId);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  newAccount = (newAccount, tokenAddress, payer) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(tokenAddress)) return reject('Invalid address');
      const tokenPublicKey = account.fromAddress(tokenAddress);
      const space = (new soproxABI.struct(schema.ACCOUNT_SCHEMA)).space;
      return this.connection.getMinimumBalanceForRentExemption(space).then(lamports => {
        const instruction = SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: newAccount.publicKey,
          lamports,
          space,
          programId: this.programId,
        });
        const transaction = new Transaction();
        transaction.add(instruction);
        return sendAndConfirmTransaction(
          this.connection,
          transaction,
          [payer, newAccount],
          { skipPreflight: true, commitment: 'recent' });
      }).then(_ => {
        const layout = new soproxABI.struct(
          [{ key: 'code', type: 'u8' }],
          { code: 1 });
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payer.publicKey, isSigner: true, isWritable: false },
            { pubkey: tokenPublicKey, isSigner: false, isWritable: false },
            { pubkey: newAccount.publicKey, isSigner: true, isWritable: true },
          ],
          programId: this.programId,
          data: layout.toBuffer()
        });
        const transaction = new Transaction();
        transaction.add(instruction);
        return sendAndConfirmTransaction(
          this.connection,
          transaction,
          [payer, newAccount],
          { skipPreflight: true, commitment: 'recent' });
      }).then(txId => {
        return resolve(txId);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  transferLamports = (lamports, dstAddress, payer) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(dstAddress)) return reject('Invalid destination address');
      const instruction = SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: account.fromAddress(dstAddress),
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

  transferTokens = (amount, tokenAddress, srcAddress, dstAddress, payer) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(tokenAddress)) return reject('Invalid token address');
      if (!account.isAddress(srcAddress)) return reject('Invalid source address');
      if (!account.isAddress(dstAddress)) return reject('Invalid destination address');
      const layout = new soproxABI.struct(
        [{ key: 'code', type: 'u8' }, { key: 'amount', type: 'u64' }],
        { code: 3, amount });
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: payer.publicKey, isSigner: true, isWritable: false },
          { pubkey: account.fromAddress(tokenAddress), isSigner: false, isWritable: false },
          { pubkey: account.fromAddress(srcAddress), isSigner: false, isWritable: true },
          { pubkey: account.fromAddress(dstAddress), isSigner: false, isWritable: true },
        ],
        programId: this.programId,
        data: layout.toBuffer()
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

module.exports = SRC20;