const {
  Connection, PublicKey, Transaction,
  SystemProgram, sendAndConfirmTransaction, SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} = require('@solana/web3.js');
const soproxABI = require('soprox-abi');

const account = require('./account');
const schema = require('./schema');

const DEFAULT_NODEURL = 'https://devnet.solana.com';
const DEFAULT_SWAP_PROGRAM_ADDRESS = 'Ha2iWsVt8Y749zcYnfe6do3gzrrEWppcp5GBw4QDuimS';
const DEFAULT_SPLT_PROGRAM_ADDRESS = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';


class Swap {
  constructor(
    swapProgramAddress = DEFAULT_SWAP_PROGRAM_ADDRESS,
    spltProgramAddress = DEFAULT_SPLT_PROGRAM_ADDRESS,
    nodeUrl = DEFAULT_NODEURL,
  ) {
    this.nodeUrl = nodeUrl;
    if (!account.isAddress(swapProgramAddress)) throw new Error('Invalid swap program address');
    if (!account.isAddress(spltProgramAddress)) throw new Error('Invalid SPL token program address');
    this.swapProgramId = account.fromAddress(swapProgramAddress);
    this.spltProgramId = account.fromAddress(spltProgramAddress);
    this.connection = this._createConnection();
  }

  _createConnection = () => {
    const connection = new Connection(this.nodeUrl, 'recent');
    return connection;
  }

  watchAndFetch = (callback) => {
    return this.watch((er, { type, accountId }) => {
      if (er) return callback(er, null);
      let getData = () => { }
      if (type === 'pool') getData = this.getPoolData;
      if (type === 'lpt') getData = this.getLPTData;
      return getData(accountId).then(data => {
        return callback(null, data);
      }).catch(er => {
        return callback(er, null);
      });
    });
  }

  watch = (callback) => {
    return this.connection.onProgramAccountChange(this.swapProgramId, ({ accountId, accountInfo: { data } }) => {
      const poolSpace = (new soproxABI.struct(schema.POOL_SCHEMA)).space;
      const lptSpace = (new soproxABI.struct(schema.LPT_SCHEMA)).space;
      let type = null;
      if (data.length === poolSpace) type = 'pool';
      if (data.length === lptSpace) type = 'lpt';
      if (!type) return callback('Unmatched type');
      return callback(null, { type, accountId });
    });
  }

  getPoolData = (poolAddress) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(poolAddress)) return reject('Invalid pool address');
      const poolPublicKey = account.fromAddress(poolAddress);

      let result = { address: poolAddress }
      return this.connection.getAccountInfo(poolPublicKey).then(re => {
        if (!re) return reject('Uninitialized pool');
        const { data: poolData } = re;
        if (!poolData) return reject(`Cannot read data of ${result.address}`);
        const poolLayout = new soproxABI.struct(schema.POOL_SCHEMA);
        if (poolData.length !== poolLayout.space) return reject('Unmatched buffer length');
        poolLayout.fromBuffer(poolData);
        let treasury = { address: poolLayout.value.treasury };
        let mint = { address: poolLayout.value.mint };
        result = { ...result, ...poolLayout.value, treasury, mint };
        return this.connection.getAccountInfo(account.fromAddress(result.mint.address));
      }).then(re => {
        if (!re) return reject('Uninitialized mint');
        const { data: mintData } = re;
        if (!mintData) return reject(`Cannot read data of ${result.mint.address}`);
        const mintLayout = new soproxABI.struct(schema.MINT_SCHEMA);
        if (mintData.length !== mintLayout.space) return reject('Unmatched buffer length');
        mintLayout.fromBuffer(mintData);
        result.mint = { ...result.mint, ...mintLayout.value };
        return this.connection.getAccountInfo(account.fromAddress(result.treasury.address));
      }).then(re => {
        if (!re) return reject('Uninitialized account');
        const { data: treasuryData } = re;
        if (!treasuryData) return reject(`Cannot read data of ${result.treasury.address}`);
        const treasuryLayout = new soproxABI.struct(schema.ACCOUNT_SCHEMA);
        if (treasuryData.length !== treasuryLayout.space) return reject('Unmatched buffer length');
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
      if (!account.isAddress(lptAddress)) return reject('Invalid LPT address');
      const lptPublicKey = account.fromAddress(lptAddress);

      let result = { address: lptAddress }
      return this.connection.getAccountInfo(lptPublicKey).then(re => {
        if (!re) return reject('Uninitialized lpt');
        const { data: lptData } = re;
        if (!lptData) return reject(`Cannot read data of ${result.address}`);
        const lptLayout = new soproxABI.struct(schema.LPT_SCHEMA);
        if (lptData.length !== lptLayout.space) return reject('Unmatched buffer length');
        lptLayout.fromBuffer(lptData);
        const pool = { address: lptLayout.value.pool }
        result = { ...result, ...lptLayout.value, pool }
        return this.getPoolData(result.pool.address);
      }).then(poolData => {
        result.pool = { ...result.pool, ...poolData }
        return resolve(result);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  initializePool = (reserve, value, srcAddress, mintAddress, pool, treasury, lpt, payer) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(srcAddress)) return reject('Invalid source address');
      if (!account.isAddress(mintAddress)) return reject('Invalid mint address');
      const srcPublicKey = account.fromAddress(srcAddress);
      const mintPublicKey = account.fromAddress(mintAddress);

      const poolSpace = (new soproxABI.struct(schema.POOL_SCHEMA)).space;
      const treasurySpace = (new soproxABI.struct(schema.ACCOUNT_SCHEMA)).space;
      const lptSpace = (new soproxABI.struct(schema.LPT_SCHEMA)).space;

      return this.connection.getMinimumBalanceForRentExemption(poolSpace).then(lamports => {
        const instruction = SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: pool.publicKey,
          lamports,
          space: poolSpace,
          programId: this.swapProgramId,
        });
        const transaction = new Transaction();
        transaction.add(instruction);
        return sendAndConfirmTransaction(
          this.connection,
          transaction,
          [payer, pool],
          { skipPreflight: true, commitment: 'recent' });
      }).then(re => {
        return this.connection.getMinimumBalanceForRentExemption(treasurySpace);
      }).then(lamports => {
        const instruction = SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: treasury.publicKey,
          lamports,
          space: treasurySpace,
          programId: this.spltProgramId,
        });
        const transaction = new Transaction();
        transaction.add(instruction);
        return sendAndConfirmTransaction(
          this.connection,
          transaction,
          [payer, treasury],
          { skipPreflight: true, commitment: 'recent' });
      }).then(re => {
        return this.connection.getMinimumBalanceForRentExemption(lptSpace);
      }).then(lamports => {
        const instruction = SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: lpt.publicKey,
          lamports,
          space: lptSpace,
          programId: this.swapProgramId,
        });
        const transaction = new Transaction();
        transaction.add(instruction);
        return sendAndConfirmTransaction(
          this.connection,
          transaction,
          [payer, lpt],
          { skipPreflight: true, commitment: 'recent' });
      }).then(re => {
        const seed = [pool.publicKey.toBuffer()];
        return PublicKey.createProgramAddress(seed, this.swapProgramId);
      }).then(treasurerPublicKey => {
        const layout = new soproxABI.struct(
          [
            { key: 'code', type: 'u8' },
            { key: 'reserve', type: 'u64' },
            { key: 'lpt', type: 'u64' },
          ],
          { code: 0, reserve, lpt: value }
        );
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payer.publicKey, isSigner: true, isWritable: false },
            { pubkey: pool.publicKey, isSigner: true, isWritable: true },
            { pubkey: treasury.publicKey, isSigner: true, isWritable: true },
            { pubkey: lpt.publicKey, isSigner: true, isWritable: true },
            { pubkey: srcPublicKey, isSigner: false, isWritable: true },
            { pubkey: mintPublicKey, isSigner: false, isWritable: false },
            { pubkey: treasurerPublicKey, isSigner: false, isWritable: false },
            { pubkey: this.spltProgramId, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
          ],
          programId: this.swapProgramId,
          data: layout.toBuffer()
        });
        const transaction = new Transaction();
        transaction.add(instruction);
        return sendAndConfirmTransaction(
          this.connection,
          transaction,
          [payer, pool, treasury, lpt],
          { skipPreflight: true, commitment: 'recent' });
      }).then(txId => {
        return resolve(txId);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  initializeLPT = (lpt, poolAddress, payer) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(poolAddress)) return reject('Invalid pool address');
      const poolPublicKey = account.fromAddress(poolAddress);

      const lptSpace = (new soproxABI.struct(schema.LPT_SCHEMA)).space;
      return this.connection.getMinimumBalanceForRentExemption(lptSpace).then(lamports => {
        const instruction = SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: lpt.publicKey,
          lamports,
          space: lptSpace,
          programId: this.swapProgramId,
        });
        const transaction = new Transaction();
        transaction.add(instruction);
        return sendAndConfirmTransaction(
          this.connection,
          transaction,
          [payer, lpt],
          { skipPreflight: true, commitment: 'recent' });
      }).then(txId => {
        const layout = new soproxABI.struct(
          [{ key: 'code', type: 'u8' }],
          { code: 1 }
        );
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payer.publicKey, isSigner: true, isWritable: false },
            { pubkey: poolPublicKey, isSigner: false, isWritable: false },
            { pubkey: lpt.publicKey, isSigner: true, isWritable: true },
          ],
          programId: this.swapProgramId,
          data: layout.toBuffer()
        });
        const transaction = new Transaction();
        transaction.add(instruction);
        return sendAndConfirmTransaction(
          this.connection,
          transaction,
          [payer, lpt],
          { skipPreflight: true, commitment: 'recent' });
      }).then(txId => {
        return resolve(txId);
      }).catch(er => {
        return reject(er);
      })
    });
  }

  addLiquidity = (reserve, poolAddress, treasuryAddress, lptAddress, srcAddress, payer) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(poolAddress)) return reject('Invalid pool address');
      if (!account.isAddress(treasuryAddress)) return reject('Invalid treasury address');
      if (!account.isAddress(lptAddress)) return reject('Invalid lpt address');
      if (!account.isAddress(srcAddress)) return reject('Invalid source address');

      const poolPublicKey = account.fromAddress(poolAddress);
      const treasuryPublicKey = account.fromAddress(treasuryAddress);
      const lptPublicKey = account.fromAddress(lptAddress);
      const srcPublicKey = account.fromAddress(srcAddress);

      const layout = new soproxABI.struct(
        [{ key: 'code', type: 'u8' }, { key: 'reserve', type: 'u64' }],
        { code: 2, reserve }
      );
      const seed = [poolPublicKey.toBuffer()];
      return PublicKey.createProgramAddress(seed, this.swapProgramId).then(treasurerPublicKey => {
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payer.publicKey, isSigner: true, isWritable: false },
            { pubkey: poolPublicKey, isSigner: false, isWritable: true },
            { pubkey: treasuryPublicKey, isSigner: false, isWritable: true },
            { pubkey: lptPublicKey, isSigner: false, isWritable: true },
            { pubkey: srcPublicKey, isSigner: false, isWritable: true },
            { pubkey: this.spltProgramId, isSigner: false, isWritable: false },
          ],
          programId: this.swapProgramId,
          data: layout.toBuffer()
        });
        const transaction = new Transaction();
        transaction.add(instruction);
        return sendAndConfirmTransaction(
          this.connection,
          transaction,
          [payer],
          { skipPreflight: true, commitment: 'recent' });
      }).then(txId => {
        return resolve(txId);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  removeLiquidity = (lpt, poolAddress, treasuryAddress, lptAddress, dstAddress, payer) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(poolAddress)) return reject('Invalid pool address');
      if (!account.isAddress(treasuryAddress)) return reject('Invalid treasury address');
      if (!account.isAddress(lptAddress)) return reject('Invalid lpt address');
      if (!account.isAddress(dstAddress)) return reject('Invalid destination address');

      const poolPublicKey = account.fromAddress(poolAddress);
      const treasuryPublicKey = account.fromAddress(treasuryAddress);
      const lptPublicKey = account.fromAddress(lptAddress);
      const dstPublicKey = account.fromAddress(dstAddress);
      const layout = new soproxABI.struct(
        [{ key: 'code', type: 'u8' }, { key: 'lpt', type: 'u64' }],
        { code: 3, lpt }
      );
      const seed = [poolPublicKey.toBuffer()];
      return PublicKey.createProgramAddress(seed, this.swapProgramId).then(treasurerPublicKey => {
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payer.publicKey, isSigner: true, isWritable: false },
            { pubkey: poolPublicKey, isSigner: false, isWritable: true },
            { pubkey: treasuryPublicKey, isSigner: false, isWritable: true },
            { pubkey: lptPublicKey, isSigner: false, isWritable: true },
            { pubkey: dstPublicKey, isSigner: false, isWritable: true },
            { pubkey: treasurerPublicKey, isSigner: false, isWritable: false },
            { pubkey: this.spltProgramId, isSigner: false, isWritable: false },
          ],
          programId: this.swapProgramId,
          data: layout.toBuffer()
        });
        const transaction = new Transaction();
        transaction.add(instruction);
        return sendAndConfirmTransaction(
          this.connection,
          transaction,
          [payer],
          { skipPreflight: true, commitment: 'recent' });
      }).then(txId => {
        return resolve(txId);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  swap = (
    amount,
    bidPoolAddress,
    bidTreasuryAddress,
    srcAddress,
    askPoolAddress,
    askTreasuryAddress,
    dstAddress,
    payer,
  ) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(bidPoolAddress)) return reject('Invalid bid pool address');
      if (!account.isAddress(bidTreasuryAddress)) return reject('Invalid bid treasury address');
      if (!account.isAddress(srcAddress)) return reject('Invalid source address');
      if (!account.isAddress(askPoolAddress)) return reject('Invalid ask pool address');
      if (!account.isAddress(askTreasuryAddress)) return reject('Invalid ask treasury address');
      if (!account.isAddress(dstAddress)) return reject('Invalid destination address');
      const bidPoolPublicKey = account.fromAddress(bidPoolAddress);
      const bidTreasuryPublicKey = account.fromAddress(bidTreasuryAddress);
      const srcPublicKey = account.fromAddress(srcAddress);
      const askPoolPublicKey = account.fromAddress(askPoolAddress);
      const askTreasuryPublicKey = account.fromAddress(askTreasuryAddress);
      const dstPublicKey = account.fromAddress(dstAddress);

      const layout = new soproxABI.struct(
        [{ key: 'code', type: 'u8' }, { key: 'amount', type: 'u64' }],
        { code: 4, amount }
      );
      const seed = [askPoolPublicKey.toBuffer()];
      return PublicKey.createProgramAddress(seed, this.swapProgramId).then(askTreasurerPublicKey => {
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payer.publicKey, isSigner: true, isWritable: false },
            { pubkey: bidPoolPublicKey, isSigner: false, isWritable: true },
            { pubkey: bidTreasuryPublicKey, isSigner: false, isWritable: true },
            { pubkey: srcPublicKey, isSigner: false, isWritable: true },
            { pubkey: askPoolPublicKey, isSigner: false, isWritable: true },
            { pubkey: askTreasuryPublicKey, isSigner: false, isWritable: true },
            { pubkey: dstPublicKey, isSigner: false, isWritable: true },
            { pubkey: askTreasurerPublicKey, isSigner: false, isWritable: false },
            { pubkey: this.spltProgramId, isSigner: false, isWritable: false },
          ],
          programId: this.swapProgramId,
          data: layout.toBuffer()
        });
        const transaction = new Transaction();
        transaction.add(instruction);
        return sendAndConfirmTransaction(
          this.connection,
          transaction,
          [payer],
          { skipPreflight: true, commitment: 'recent', });
      }).then(txId => {
        return resolve(txId);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  transfer = (lpt, srcLPTAddress, dstLPTAddress, payer) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(srcLPTAddress)) return reject('Invalid source LPT address');
      if (!account.isAddress(dstLPTAddress)) return reject('Invalid destination LPT address');
      const srcLPTPublicKey = account.fromAddress(srcLPTAddress);
      const dstLPTPublicKey = account.fromAddress(dstLPTAddress);

      const layout = new soproxABI.struct(
        [{ key: 'code', type: 'u8' }, { key: 'lpt', type: 'u64' }],
        { code: 5, lpt }
      );
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: payer.publicKey, isSigner: true, isWritable: false },
          { pubkey: srcLPTPublicKey, isSigner: false, isWritable: true },
          { pubkey: dstLPTPublicKey, isSigner: false, isWritable: true },
        ],
        programId: this.swapProgramId,
        data: layout.toBuffer()
      });
      const transaction = new Transaction();
      transaction.add(instruction);
      return sendAndConfirmTransaction(
        this.connection,
        transaction,
        [payer],
        { skipPreflight: true, commitment: 'recent' }).then(txId => {
          return resolve(txId);
        }).catch(er => {
          return reject(er);
        });
    });
  }

}

module.exports = Swap;