const {
  Connection, Transaction, TransactionInstruction,
  SystemProgram, sendAndConfirmTransaction,
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
      return this.connection.getBalance(account.fromAddress(address)).then(re => {
        return resolve(re);
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
        {
          skipPreflight: true,
          commitment: 'recent'
        }).then(txId => {
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
        { code: 3, amount }
      );
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
        {
          skipPreflight: true,
          commitment: 'recent'
        }).then(txId => {
          return resolve(txId);
        }).catch(er => {
          return reject(er);
        });
    });
  }

}

module.exports = SRC20;