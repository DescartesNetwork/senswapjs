const {
  Connection, PublicKey, Transaction,
  SystemProgram, sendAndConfirmTransaction, SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} = require('@solana/web3.js');
const soproxABI = require('soprox-abi');

const account = require('./account');
const schema = require('./schema');

const DEFAULT_NODEURL = 'https://devnet.solana.com';
const DEFAULT_SWAP_PROGRAM_ADDRESS = 'GpaAjyw3yx9neiCrsv569T1LNzxDAnw8mReJDqB25Fua';
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
    return this.watch((er, re) => {
      if (er) return callback(er, null);
      const { type, accountId } = re;
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
      if (!type) return callback('Unmatched type', null);
      return callback(null, { type, accountId });
    });
  }

  _getMintData = (mintAddress) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(mintAddress)) return reject('Invalid mint address');
      const mintPublicKey = account.fromAddress(mintAddress);

      let result = { address: mintAddress }
      return this.connection.getAccountInfo(mintPublicKey).then(re => {
        if (!re) return reject('Uninitialized mint');
        const { data: mintData } = re;
        if (!mintData) return reject(`Cannot read data of ${result.address}`);
        const mintLayout = new soproxABI.struct(schema.MINT_SCHEMA);
        if (mintData.length !== mintLayout.space) return reject('Unmatched buffer length');
        mintLayout.fromBuffer(mintData);
        result = { ...result, ...mintLayout.value };
        return resolve(result);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  _getAccountData = (accountAddress) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(accountAddress)) return reject('Invalid account address');
      const accountPublicKey = account.fromAddress(accountAddress);

      let result = { address: accountAddress }
      return this.connection.getAccountInfo(accountPublicKey).then(re => {
        if (!re) return reject('Uninitialized mint');
        const { data: accountData } = re;
        if (!accountData) return reject(`Cannot read data of ${result.address}`);
        const accountLayout = new soproxABI.struct(schema.ACCOUNT_SCHEMA);
        if (accountData.length !== accountLayout.space) return reject('Unmatched buffer length');
        accountLayout.fromBuffer(accountData);
        result = { ...result, ...accountLayout.value };
        return resolve(result);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  getDAOData = (daoAddress) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(daoAddress)) return reject('Invalid DAO address');
      const daoPublicKey = account.fromAddress(daoAddress);

      let result = { address: daoAddress }
      return this.connection.getAccountInfo(daoPublicKey).then(re => {
        if (!re) return reject('Uninitialized DAO');
        const { data: daoData } = re;
        if (!daoData) return reject(`Cannot read data of ${result.address}`);
        const daoLayout = new soproxABI.struct(schema.DAO_SCHEMA);
        if (daoData.length !== daoLayout.space) return reject('Unmatched buffer length');
        daoLayout.fromBuffer(daoData);
        result = { ...result, ...daoLayout.value };
        return resolve(result);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  getNetworkData = (networkAddress) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(networkAddress)) return reject('Invalid network address');
      const networkPublicKey = account.fromAddress(networkAddress);

      let result = { address: networkAddress }
      return this.connection.getAccountInfo(networkPublicKey).then(re => {
        if (!re) return reject('Uninitialized network');
        const { data: networkData } = re;
        if (!networkData) return reject(`Cannot read data of ${result.address}`);
        const networkLayout = new soproxABI.struct(schema.NETWORK_SCHEMA);
        if (networkData.length !== networkLayout.space) return reject('Unmatched buffer length');
        networkLayout.fromBuffer(networkData);
        let dao = { address: networkLayout.value.dao };
        let primary = { address: networkLayout.value.primary };
        let vault = { address: networkLayout.value.vault };
        result = { ...result, ...networkLayout.value, dao, primary, vault };
        return this.getDAOData(result.dao.address);
      }).then(daoData => {
        result.dao = { ...result.dao, ...daoData };
        return this._getMintData(result.primary.address);
      }).then(primaryData => {
        result.primary = { ...result.primary, ...primaryData };
        return this._getAccountData(result.vault.address);
      }).then(vaultData => {
        result.vault = { ...result.vault, ...vaultData };
        return resolve(result);
      }).catch(er => {
        return reject(er);
      });
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
        let mint = { address: poolLayout.value.mint };
        let treasury = { address: poolLayout.value.treasury };
        result = { ...result, ...poolLayout.value, mint, treasury };
        return this._getMintData(result.mint.address);
      }).then(mintData => {
        result.mint = { ...result.mint, ...mintData };
        return this._getAccountData(result.treasury.address);
      }).then(treasuryData => {
        result.treasury = { ...result.treasury, ...treasuryData };
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

  initializeNetwork = (network, primaryAddress, vault, dao, signerAddresses, mintAddresses, payer) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(primaryAddress)) return reject('Invalid primary address');
      for (let signerAddress of signerAddresses) {
        if (!account.isAddress(signerAddress)) return reject('Invalid signer address');
      }
      for (let mintAddress of mintAddresses) {
        if (!account.isAddress(mintAddress)) return reject('Invalid mint address');
      }

      const primaryPublicKey = account.fromAddress(primaryAddress);
      const signerPublicKeys = signerAddresses.map(signerAddress => account.fromAddress(signerAddress));
      const mintPublicKeys = mintAddresses.map(mintAddress => account.fromAddress(mintAddress));

      const networkSpace = (new soproxABI.struct(schema.NETWORK_SCHEMA)).space;
      const vaultSpace = (new soproxABI.struct(schema.ACCOUNT_SCHEMA)).space;
      const daoSpace = (new soproxABI.struct(schema.DAO_SCHEMA)).space;

      return this.connection.getMinimumBalanceForRentExemption(networkSpace).then(lamports => {
        const instruction = SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: network.publicKey,
          lamports,
          space: networkSpace,
          programId: this.swapProgramId,
        });
        const transaction = new Transaction();
        transaction.add(instruction);
        return sendAndConfirmTransaction(
          this.connection,
          transaction,
          [payer, network],
          { skipPreflight: true, commitment: 'recent' });
      }).then(re => {
        return this.connection.getMinimumBalanceForRentExemption(vaultSpace);
      }).then(lamports => {
        const instruction = SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: vault.publicKey,
          lamports,
          space: vaultSpace,
          programId: this.spltProgramId,
        });
        const transaction = new Transaction();
        transaction.add(instruction);
        return sendAndConfirmTransaction(
          this.connection,
          transaction,
          [payer, vault],
          { skipPreflight: true, commitment: 'recent' });
      }).then(re => {
        return this.connection.getMinimumBalanceForRentExemption(daoSpace);
      }).then(lamports => {
        const instruction = SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: dao.publicKey,
          lamports,
          space: daoSpace,
          programId: this.swapProgramId,
        });
        const transaction = new Transaction();
        transaction.add(instruction);
        return sendAndConfirmTransaction(
          this.connection,
          transaction,
          [payer, dao],
          { skipPreflight: true, commitment: 'recent' });
      }).then(re => {
        const seed = [vault.publicKey.toBuffer()];
        return PublicKey.createProgramAddress(seed, this.swapProgramId);
      }).then(treasurerPublicKey => {
        const layout = new soproxABI.struct([{ key: 'code', type: 'u8' }], { code: 0 });
        let _signers = signerPublicKeys.map(signerPublicKey => ({ pubkey: signerPublicKey, isSigner: false, isWritable: false }));
        while (_signers.length < 10) _signers.push({ pubkey: new PublicKey(), isSigner: false, isWritable: false });
        const _mints = mintPublicKeys.map(mintPublicKey => ({ pubkey: mintPublicKey, isSigner: false, isWritable: false }));
        while (_mints.length < 10) _mints.push({ pubkey: new PublicKey(), isSigner: false, isWritable: false });
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payer.publicKey, isSigner: true, isWritable: false },
            { pubkey: network.publicKey, isSigner: true, isWritable: true },
            { pubkey: primaryPublicKey, isSigner: false, isWritable: false },
            { pubkey: vault.publicKey, isSigner: true, isWritable: true },
            { pubkey: treasurerPublicKey, isSigner: false, isWritable: false },
            { pubkey: dao.publicKey, isSigner: true, isWritable: true },
            { pubkey: this.spltProgramId, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
            ..._signers,
            ..._mints
          ],
          programId: this.swapProgramId,
          data: layout.toBuffer()
        });
        const transaction = new Transaction();
        transaction.add(instruction);
        return sendAndConfirmTransaction(
          this.connection,
          transaction,
          [payer, network, vault, dao],
          { skipPreflight: true, commitment: 'recent' });
      }).then(txId => {
        return resolve(txId);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  initializePool = (reserve, value, networkAddress, pool, treasury, lpt, srcAddress, mintAddress, payer) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(networkAddress)) return reject('Invalid network address');
      if (!account.isAddress(srcAddress)) return reject('Invalid source address');
      if (!account.isAddress(mintAddress)) return reject('Invalid mint address');

      const networkPublicKey = account.fromAddress(networkAddress);
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
            { key: 'lpt', type: 'u128' },
          ],
          { code: 1, reserve, lpt: value }
        );
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payer.publicKey, isSigner: true, isWritable: false },
            { pubkey: networkPublicKey, isSigner: false, isWritable: true },
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
        const layout = new soproxABI.struct([{ key: 'code', type: 'u8' }], { code: 2 });
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
      });
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
        { code: 3, reserve }
      );
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
        { skipPreflight: true, commitment: 'recent' }).then(txId => {
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
        [{ key: 'code', type: 'u8' }, { key: 'lpt', type: 'u128' }],
        { code: 4, lpt }
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
    networkAddress,
    bidPoolAddress,
    bidTreasuryAddress,
    srcAddress,
    askPoolAddress,
    askTreasuryAddress,
    dstAddress,
    senPoolAddress,
    senTreasuryAddress,
    vaultAddress,
    payer,
  ) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(networkAddress)) return reject('Invalid network address');
      if (!account.isAddress(bidPoolAddress)) return reject('Invalid bid pool address');
      if (!account.isAddress(bidTreasuryAddress)) return reject('Invalid bid treasury address');
      if (!account.isAddress(srcAddress)) return reject('Invalid source address');
      if (!account.isAddress(askPoolAddress)) return reject('Invalid ask pool address');
      if (!account.isAddress(askTreasuryAddress)) return reject('Invalid ask treasury address');
      if (!account.isAddress(dstAddress)) return reject('Invalid destination address');
      if (!account.isAddress(senPoolAddress)) return reject('Invalid sen pool address');
      if (!account.isAddress(senTreasuryAddress)) return reject('Invalid sen treasury address');
      if (!account.isAddress(vaultAddress)) return reject('Invalid vault address');
      const networkPublicKey = account.fromAddress(networkAddress);
      const bidPoolPublicKey = account.fromAddress(bidPoolAddress);
      const bidTreasuryPublicKey = account.fromAddress(bidTreasuryAddress);
      const srcPublicKey = account.fromAddress(srcAddress);
      const askPoolPublicKey = account.fromAddress(askPoolAddress);
      const askTreasuryPublicKey = account.fromAddress(askTreasuryAddress);
      const dstPublicKey = account.fromAddress(dstAddress);
      const senPoolPublicKey = account.fromAddress(senPoolAddress);
      const senTreasuryPublicKey = account.fromAddress(senTreasuryAddress);
      const vaultPublicKey = account.fromAddress(vaultAddress);

      const layout = new soproxABI.struct(
        [{ key: 'code', type: 'u8' }, { key: 'amount', type: 'u64' }],
        { code: 5, amount }
      );
      let askTreasurerPublicKey = '';
      let senTreasurerPublicKey = '';
      const ask_seed = [askPoolPublicKey.toBuffer()];
      return PublicKey.createProgramAddress(ask_seed, this.swapProgramId).then(re => {
        askTreasurerPublicKey = re;
        const sen_seed = [senPoolPublicKey.toBuffer()];
        return PublicKey.createProgramAddress(sen_seed, this.swapProgramId);
      }).then(re => {
        senTreasurerPublicKey = re;
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payer.publicKey, isSigner: true, isWritable: false },
            { pubkey: networkPublicKey, isSigner: false, isWritable: false },
            { pubkey: bidPoolPublicKey, isSigner: false, isWritable: true },
            { pubkey: bidTreasuryPublicKey, isSigner: false, isWritable: true },
            { pubkey: srcPublicKey, isSigner: false, isWritable: true },
            { pubkey: askPoolPublicKey, isSigner: false, isWritable: true },
            { pubkey: askTreasuryPublicKey, isSigner: false, isWritable: true },
            { pubkey: dstPublicKey, isSigner: false, isWritable: true },
            { pubkey: askTreasurerPublicKey, isSigner: false, isWritable: false },
            { pubkey: senPoolPublicKey, isSigner: false, isWritable: true },
            { pubkey: senTreasuryPublicKey, isSigner: false, isWritable: true },
            { pubkey: vaultPublicKey, isSigner: false, isWritable: true },
            { pubkey: senTreasurerPublicKey, isSigner: false, isWritable: false },
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

  transfer = (lpt, poolAddress, srcLPTAddress, dstLPTAddress, payer) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(poolAddress)) return reject('Invalid pool address');
      if (!account.isAddress(srcLPTAddress)) return reject('Invalid source LPT address');
      if (!account.isAddress(dstLPTAddress)) return reject('Invalid destination LPT address');
      const poolPublicKey = account.fromAddress(poolAddress);
      const srcLPTPublicKey = account.fromAddress(srcLPTAddress);
      const dstLPTPublicKey = account.fromAddress(dstLPTAddress);

      const layout = new soproxABI.struct(
        [{ key: 'code', type: 'u8' }, { key: 'lpt', type: 'u128' }],
        { code: 6, lpt }
      );
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: payer.publicKey, isSigner: true, isWritable: false },
          { pubkey: poolPublicKey, isSigner: false, isWritable: false },
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

  closeLPT = (lptAddress, dstAddress, payer) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(lptAddress)) return reject('Invalid LPT address');
      if (!account.isAddress(dstAddress)) return reject('Invalid destination address');
      const lptPublicKey = account.fromAddress(lptAddress);
      const dstPublicKey = account.fromAddress(dstAddress);

      const layout = new soproxABI.struct(
        [{ key: 'code', type: 'u8' }],
        { code: 13 }
      );
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: payer.publicKey, isSigner: true, isWritable: false },
          { pubkey: lptPublicKey, isSigner: false, isWritable: true },
          { pubkey: dstPublicKey, isSigner: false, isWritable: true },
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

  closePool = (poolAddress, treasuryAddress, dstAddress, payer) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(poolAddress)) return reject('Invalid pool address');
      if (!account.isAddress(treasuryAddress)) return reject('Invalid treasury address');
      if (!account.isAddress(dstAddress)) return reject('Invalid destination address');

      const poolPublicKey = account.fromAddress(poolAddress);
      const treasuryPublicKey = account.fromAddress(treasuryAddress);
      const dstPublicKey = account.fromAddress(dstAddress);

      const layout = new soproxABI.struct([{ key: 'code', type: 'u8' }], { code: 14 });
      const seed = [poolPublicKey.toBuffer()];
      return PublicKey.createProgramAddress(seed, this.swapProgramId).then(treasurerPublicKey => {
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payer.publicKey, isSigner: true, isWritable: false },
            { pubkey: poolPublicKey, isSigner: false, isWritable: true },
            { pubkey: treasuryPublicKey, isSigner: false, isWritable: true },
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
}

module.exports = Swap;