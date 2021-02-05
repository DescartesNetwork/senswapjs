const {
  Account, Connection, PublicKey, Transaction,
  LAMPORTS_PER_SOL, SystemProgram, sendAndConfirmTransaction,
  TransactionInstruction,
} = require('@solana/web3.js');
const soproxABI = require('soprox-abi');

const account = require('./account');
const schema = require('./schema');

const DEFAULT_NODEURL = 'https://devnet.solana.com';
const DEFAULT_PROGRAM_ADDRESS = '23Y2WwZY149zE7tcXrQA46Zfj3zvkkibHn3xCZ4qJBgi';


class Swap {
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

  getPoolData = (poolAddress) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(poolAddress)) return reject('Invalid address');
      let result = { address: poolAddress }
      return this.connection.getAccountInfo(account.fromAddress(poolAddress)).then(({ data: poolData }) => {
        if (!poolData) return reject(`Cannot read data of ${result.address}`);
        const poolLayout = new soproxABI.struct(schema.POOL_SCHEMA);
        poolLayout.fromBuffer(poolData);
        let treasury = { address: poolLayout.value.treasury };
        let token = { address: poolLayout.value.token };
        result = { ...result, ...poolLayout.value, treasury, token };
        return this.connection.getAccountInfo(account.fromAddress(result.token.address));
      }).then(({ data: tokenData }) => {
        if (!tokenData) return reject(`Cannot read data of ${result.token.address}`);
        const tokenLayout = new soproxABI.struct(schema.TOKEN_SCHEMA);
        tokenLayout.fromBuffer(tokenData);
        result.token = { ...result.token, ...tokenLayout.value };
        return this.connection.getAccountInfo(account.fromAddress(result.treasury.address));
      }).then(({ data: treasuryData }) => {
        if (!treasuryData) return reject(`Cannot read data of ${result.treasury.address}`);
        const treasuryLayout = new soproxABI.struct(schema.ACCOUNT_SCHEMA);
        treasuryLayout.fromBuffer(treasuryData);
        result.treasury = { ...result.treasury, ...treasuryLayout.value };
        return resolve(result);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  getLPTData = (lptAddress) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(lptAddress)) return reject('Invalid address');
      let result = { address: lptAddress }
      return this.connection.getAccountInfo(account.fromAddress(lptAddress)).then(({ data: lptData }) => {
        if (!lptData) return reject(`Cannot read data of ${result.address}`);
        const lptLayout = new soproxABI.struct(schema.LPT_SCHEMA);
        lptLayout.fromBuffer(lptData);
        let pool = { address: lptLayout.value.pool }
        result = { ...result, ...lptLayout.value, pool }
        return this.connection.getAccountInfo(account.fromAddress(result.pool.address));
      }).then(({ data: poolData }) => {
        if (!poolData) return reject(`Cannot read data of ${result.pool.address}`);
        const poolLayout = new soproxABI.struct(schema.POOL_SCHEMA);
        poolLayout.fromBuffer(poolData);
        let treasury = { address: poolLayout.value.treasury }
        let token = { address: poolLayout.value.token }
        result.pool = { ...result.pool, ...poolLayout.value, treasury, token }
        return this.connection.getAccountInfo(account.fromAddress(result.pool.token.address));
      }).then(({ data: tokenData }) => {
        if (!tokenData) return reject(`Cannot read data of ${result.pool.token.address}`);
        const tokenLayout = new soproxABI.struct(schema.TOKEN_SCHEMA);
        tokenLayout.fromBuffer(tokenData);
        result.pool.token = { ...result.pool.token, ...tokenLayout.value }
        return this.connection.getAccountInfo(account.fromAddress(result.pool.treasury.address));
      }).then(({ data: treasuryData }) => {
        if (!treasuryData) return reject(`Cannot read data of ${result.pool.treasury.address}`);
        const treasuryLayout = new soproxABI.struct(schema.ACCOUNT_SCHEMA);
        treasuryLayout.fromBuffer(treasuryData);
        result.pool.treasury = { ...result.pool.treasury, ...treasuryLayout.value }
        return resolve(result);
      }).catch(er => {
        return reject(er);
      });
    });
  }

}

module.exports = Swap;