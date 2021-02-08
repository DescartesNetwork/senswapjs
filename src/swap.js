const {
  Account, Connection, PublicKey, Transaction,
  LAMPORTS_PER_SOL, SystemProgram, sendAndConfirmTransaction,
  TransactionInstruction,
} = require('@solana/web3.js');
const soproxABI = require('soprox-abi');

const account = require('./account');
const schema = require('./schema');

const DEFAULT_NODEURL = 'https://devnet.solana.com';
const DEFAULT_SWAP_PROGRAM_ADDRESS = '23Y2WwZY149zE7tcXrQA46Zfj3zvkkibHn3xCZ4qJBgi';
const DEFAULT_TOKEN_PROGRAM_ADDRESS = 'JCbHuGZyQiC9abPpEHfs6W8evgumEYthpqqBsgDRewa8';


class Swap {
  constructor(
    nodeUrl = DEFAULT_NODEURL,
    swapProgramAddress = DEFAULT_SWAP_PROGRAM_ADDRESS,
    tokenProgramAddress = DEFAULT_TOKEN_PROGRAM_ADDRESS
  ) {
    this.nodeUrl = nodeUrl;
    if (!account.isAddress(swapProgramAddress)) throw new Error('Invalid swap program address');
    if (!account.isAddress(tokenProgramAddress)) throw new Error('Invalid token program address');
    this.swapProgramId = account.fromAddress(swapProgramAddress);
    this.tokenProgramId = account.fromAddress(tokenProgramAddress);
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

  newLPT = (payer) => {
    return new Promise((resolve, reject) => {
      let lpt = new Account();
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
        return resolve({ lpt, txId });
      }).catch(er => {
        return reject(er);
      });
    });
  }

  newPool = (reserve, value, srcAddress, tokenAddress, payer) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(srcAddress)) return reject('Invalid source address');
      if (!account.isAddress(tokenAddress)) return reject('Invalid token address');

      const srcPublicKey = account.fromAddress(srcAddress);
      const tokenPublicKey = account.fromAddress(tokenAddress);

      let pool = null;
      let treasury = new Account();
      let lpt = new Account();
      const poolSpace = (new soproxABI.struct(schema.POOL_SCHEMA)).space;
      const treasurySpace = (new soproxABI.struct(schema.ACCOUNT_SCHEMA)).space;
      const lptSpace = (new soproxABI.struct(schema.LPT_SCHEMA)).space;
      return account.createStrictAccount(this.swapProgramId).then(re => {
        pool = re;
        return this.connection.getMinimumBalanceForRentExemption(poolSpace)
      }).then(lamports => {
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
      }).then(_ => {
        return this.connection.getMinimumBalanceForRentExemption(treasurySpace);
      }).then(lamports => {
        const instruction = SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: treasury.publicKey,
          lamports,
          space: treasurySpace,
          programId: this.tokenProgramId,
        });
        const transaction = new Transaction();
        transaction.add(instruction);
        return sendAndConfirmTransaction(
          this.connection,
          transaction,
          [payer, treasury],
          { skipPreflight: true, commitment: 'recent' });
      }).then(_ => {
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
      }).then(_ => {
        const seed = [pool.publicKey.toBuffer()];
        return PublicKey.createProgramAddress(seed, this.swapProgramId);
      }).then(tokenOwnerPublicKey => {
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
            { pubkey: tokenPublicKey, isSigner: false, isWritable: false },
            { pubkey: tokenOwnerPublicKey, isSigner: false, isWritable: false },
            { pubkey: this.tokenProgramId, isSigner: false, isWritable: false },
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
        return resolve({ pool, treasury, lpt, txId });
      }).catch(er => {
        return reject(er);
      });
    });
  }

  addLiquidityWithNewLPT = (reserve, poolAddress, treasuryAddress, lptAccount, srcAddress, tokenAddress, payer) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(poolAddress)) return reject('Invalid pool address');
      if (!account.isAddress(treasuryAddress)) return reject('Invalid treasury address');
      if (!account.isAddress(srcAddress)) return reject('Invalid source address');
      if (!account.isAddress(tokenAddress)) return reject('Invalid token address');

      const poolPublicKey = account.fromAddress(poolAddress);
      const treasuryPublicKey = account.fromAddress(treasuryAddress);
      const srcPublicKey = account.fromAddress(srcAddress);
      const tokenPublicKey = account.fromAddress(tokenAddress);

      const layout = new soproxABI.struct(
        [{ key: 'code', type: 'u8' }, { key: 'reserve', type: 'u64' }],
        { code: 1, reserve }
      );
      const seed = [poolPublicKey.toBuffer()];
      return PublicKey.createProgramAddress(seed, this.swapProgramId).then(tokenOwnerPublicKey => {
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payer.publicKey, isSigner: true, isWritable: false },
            { pubkey: poolPublicKey, isSigner: false, isWritable: true },
            { pubkey: treasuryPublicKey, isSigner: false, isWritable: true },
            { pubkey: lptAccount.publicKey, isSigner: true, isWritable: true },
            { pubkey: srcPublicKey, isSigner: false, isWritable: true },
            { pubkey: tokenPublicKey, isSigner: false, isWritable: false },
            { pubkey: tokenOwnerPublicKey, isSigner: false, isWritable: false },
            { pubkey: this.tokenProgramId, isSigner: false, isWritable: false },
          ],
          programId: this.swapProgramId,
          data: layout.toBuffer()
        });
        const transaction = new Transaction();
        transaction.add(instruction);
        return sendAndConfirmTransaction(
          this.connection,
          transaction,
          [payer, lptAccount],
          { skipPreflight: true, commitment: 'recent' });
      }).then(txId => {
        return resolve({ txId });
      }).catch(er => {
        return reject(er);
      });;
    });
  }

  addLiquidity = (reserve, poolAddress, treasuryAddress, lptAddress, srcAddress, tokenAddress, payer) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(poolAddress)) return reject('Invalid pool address');
      if (!account.isAddress(treasuryAddress)) return reject('Invalid treasury address');
      if (!account.isAddress(lptAddress)) return reject('Invalid lpt address');
      if (!account.isAddress(srcAddress)) return reject('Invalid source address');
      if (!account.isAddress(tokenAddress)) return reject('Invalid token address');

      const poolPublicKey = account.fromAddress(poolAddress);
      const treasuryPublicKey = account.fromAddress(treasuryAddress);
      const lptPublicKey = account.fromAddress(lptAddress);
      const srcPublicKey = account.fromAddress(srcAddress);
      const tokenPublicKey = account.fromAddress(tokenAddress);

      const layout = new soproxABI.struct(
        [{ key: 'code', type: 'u8' }, { key: 'reserve', type: 'u64' }],
        { code: 1, reserve }
      );
      const seed = [poolPublicKey.toBuffer()];
      return PublicKey.createProgramAddress(seed, this.swapProgramId).then(tokenOwnerPublicKey => {
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payer.publicKey, isSigner: true, isWritable: false },
            { pubkey: poolPublicKey, isSigner: false, isWritable: true },
            { pubkey: treasuryPublicKey, isSigner: false, isWritable: true },
            { pubkey: lptPublicKey, isSigner: false, isWritable: true },
            { pubkey: srcPublicKey, isSigner: false, isWritable: true },
            { pubkey: tokenPublicKey, isSigner: false, isWritable: false },
            { pubkey: tokenOwnerPublicKey, isSigner: false, isWritable: false },
            { pubkey: this.tokenProgramId, isSigner: false, isWritable: false },
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
      }).then(re => {
        return resolve(re);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  removeLiquidity = (lpt, poolAddress, treasuryAddress, lptAddress, dstAddress, tokenAddress, payer) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(poolAddress)) return reject('Invalid pool address');
      if (!account.isAddress(treasuryAddress)) return reject('Invalid treasury address');
      if (!account.isAddress(lptAddress)) return reject('Invalid lpt address');
      if (!account.isAddress(dstAddress)) return reject('Invalid destination address');
      if (!account.isAddress(tokenAddress)) return reject('Invalid token address');

      const poolPublicKey = account.fromAddress(poolAddress);
      const treasuryPublicKey = account.fromAddress(treasuryAddress);
      const lptPublicKey = account.fromAddress(lptAddress);
      const dstPublicKey = account.fromAddress(dstAddress);
      const tokenPublicKey = account.fromAddress(tokenAddress);
      const layout = new soproxABI.struct(
        [
          { key: 'code', type: 'u8' },
          { key: 'lpt', type: 'u64' },
        ],
        { code: 2, lpt }
      );
      const seed = [poolPublicKey.toBuffer()];
      return PublicKey.createProgramAddress(seed, this.swapProgramId).then(tokenOwnerPublicKey => {
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payer.publicKey, isSigner: true, isWritable: false },
            { pubkey: poolPublicKey, isSigner: false, isWritable: true },
            { pubkey: treasuryPublicKey, isSigner: false, isWritable: true },
            { pubkey: lptPublicKey, isSigner: false, isWritable: true },
            { pubkey: dstPublicKey, isSigner: false, isWritable: true },
            { pubkey: tokenPublicKey, isSigner: false, isWritable: false },
            { pubkey: tokenOwnerPublicKey, isSigner: false, isWritable: false },
            { pubkey: this.tokenProgramId, isSigner: false, isWritable: false },
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
      }).then(re => {
        return resolve(re);
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
    bidTokenAddress,
    askPoolAddress,
    askTreasuryAddress,
    dstAddress,
    askTokenAddress,
    payer,
  ) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(bidPoolAddress)) return reject('Invalid bid pool address');
      if (!account.isAddress(bidTreasuryAddress)) return reject('Invalid bid treasury address');
      if (!account.isAddress(srcAddress)) return reject('Invalid source address');
      if (!account.isAddress(bidTokenAddress)) return reject('Invalid bid token address');
      if (!account.isAddress(askPoolAddress)) return reject('Invalid ask pool address');
      if (!account.isAddress(askTreasuryAddress)) return reject('Invalid ask treasury address');
      if (!account.isAddress(dstAddress)) return reject('Invalid destination address');
      if (!account.isAddress(askTokenAddress)) return reject('Invalid ask token address');

      const bidPoolPublicKey = account.fromAddress(bidPoolAddress);
      const bidTreasuryPublicKey = account.fromAddress(bidTreasuryAddress);
      const srcPublicKey = account.fromAddress(srcAddress);
      const bidTokenPublicKey = account.fromAddress(bidTokenAddress);
      const askPoolPublicKey = account.fromAddress(askPoolAddress);
      const askTreasuryPublicKey = account.fromAddress(askTreasuryAddress);
      const dstPublicKey = account.fromAddress(dstAddress);
      const askTokenPublicKey = account.fromAddress(askTokenAddress);

      const layout = new soproxABI.struct(
        [{ key: 'code', type: 'u8' }, { key: 'amount', type: 'u64' }],
        { code: 3, amount }
      );
      const seed = [askPoolPublicKey.toBuffer()];
      return PublicKey.createProgramAddress(seed, this.swapProgramId).then(askTokenOwnerPublicKey => {
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payer.publicKey, isSigner: true, isWritable: false },
            { pubkey: bidPoolPublicKey, isSigner: false, isWritable: true },
            { pubkey: bidTreasuryPublicKey, isSigner: false, isWritable: true },
            { pubkey: srcPublicKey, isSigner: false, isWritable: true },
            { pubkey: bidTokenPublicKey, isSigner: false, isWritable: false },
            { pubkey: askPoolPublicKey, isSigner: false, isWritable: true },
            { pubkey: askTreasuryPublicKey, isSigner: false, isWritable: true },
            { pubkey: dstPublicKey, isSigner: false, isWritable: true },
            { pubkey: askTokenPublicKey, isSigner: false, isWritable: false },
            { pubkey: askTokenOwnerPublicKey, isSigner: false, isWritable: false },
            { pubkey: this.tokenProgramId, isSigner: false, isWritable: false },
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
      }).then(re => {
        return resolve(re);
      }).catch(er => {
        return reject(er);
      });
    });
  }

}

module.exports = Swap;