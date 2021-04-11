const { PublicKey, Transaction,
  SystemProgram, sendAndConfirmTransaction, SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} = require('@solana/web3.js');
const soproxABI = require('soprox-abi');

const Tx = require('./core/tx');
const account = require('./account');
const schema = require('./schema');

const DEFAULT_SWAP_PROGRAM_ADDRESS = 'DV9TWNbaN8nabswzdDT1PYqqcP8eKvBtGGXShKj5E5ya';
const DEFAULT_SPLT_PROGRAM_ADDRESS = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';


class Swap extends Tx {
  constructor(
    swapProgramAddress = DEFAULT_SWAP_PROGRAM_ADDRESS,
    spltProgramAddress = DEFAULT_SPLT_PROGRAM_ADDRESS,
    nodeUrl
  ) {
    super(nodeUrl);

    if (!account.isAddress(swapProgramAddress)) throw new Error('Invalid swap program address');
    if (!account.isAddress(spltProgramAddress)) throw new Error('Invalid SPL token program address');
    this.swapProgramId = account.fromAddress(swapProgramAddress);
    this.spltProgramId = account.fromAddress(spltProgramAddress);
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
        let primary = { address: networkLayout.value.primary };
        let vault = { address: networkLayout.value.vault };
        result = { ...result, ...networkLayout.value, primary, vault };
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
        let network = { address: poolLayout.value.network };
        let mint = { address: poolLayout.value.mint };
        let treasury = { address: poolLayout.value.treasury };
        result = { ...result, ...poolLayout.value, network, mint, treasury };
        return this.getNetworkData(result.network.address)
      }).then(networkData => {
        result.network = { ...result.network, ...networkData };
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

  initializeNetwork = (network, primaryAddress, vault, mintAddresses, wallet) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(primaryAddress)) return reject('Invalid primary address');
      for (let mintAddress of mintAddresses) {
        if (!account.isAddress(mintAddress)) return reject('Invalid mint address');
      }

      let transaction = new Transaction();
      let treasurerPublicKey = '';
      const primaryPublicKey = account.fromAddress(primaryAddress);
      const mintPublicKeys = mintAddresses.map(mintAddress => account.fromAddress(mintAddress));
      const networkSpace = (new soproxABI.struct(schema.NETWORK_SCHEMA)).space;
      const vaultSpace = (new soproxABI.struct(schema.ACCOUNT_SCHEMA)).space;

      return this._rentAccount(wallet, network, networkSpace, this.swapProgramId).then(txId => {
        return this._rentAccount(wallet, vault, vaultSpace, this.spltProgramId);
      }).then(txId => {
        return this._addRecentCommitment(transaction);
      }).then(txWithCommitment => {
        transaction = txWithCommitment;
        const seed = [vault.publicKey.toBuffer()];
        return PublicKey.createProgramAddress(seed, this.swapProgramId);
      }).then(publicKeyFromSeed => {
        treasurerPublicKey = publicKeyFromSeed;
        return wallet.getAccount();
      }).then(payerAddress => {
        const payerPublicKey = account.fromAddress(payerAddress);
        const layout = new soproxABI.struct([{ key: 'code', type: 'u8' }], { code: 0 });
        const mintOpts = mintPublicKeys.map(mintPublicKey => ({ pubkey: mintPublicKey, isSigner: false, isWritable: false }));
        while (mintOpts.length < 20) mintOpts.push({ pubkey: new PublicKey(), isSigner: false, isWritable: false });
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payerPublicKey, isSigner: true, isWritable: false },
            { pubkey: network.publicKey, isSigner: true, isWritable: true },
            { pubkey: primaryPublicKey, isSigner: false, isWritable: false },
            { pubkey: vault.publicKey, isSigner: true, isWritable: true },
            { pubkey: treasurerPublicKey, isSigner: false, isWritable: false },
            { pubkey: this.spltProgramId, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
            ...mintOpts
          ],
          programId: this.swapProgramId,
          data: layout.toBuffer()
        });
        transaction.add(instruction);
        transaction.feePayer = payerPublicKey;
        return wallet.sign(transaction);
      }).then(payerSig => {
        this._addSignature(transaction, payerSig);
        return this._sign(transaction, network);
      }).then(networkSig => {
        this._addSignature(transaction, networkSig);
        return this._sign(transaction, vault);
      }).then(vaultSig => {
        this._addSignature(transaction, vaultSig);
        return this._sendTransaction(transaction);
      }).then(txId => {
        return resolve(txId);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  initializePool = (reserve, value, networkAddress, pool, treasury, lpt, srcAddress, mintAddress, wallet) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(networkAddress)) return reject('Invalid network address');
      if (!account.isAddress(srcAddress)) return reject('Invalid source address');
      if (!account.isAddress(mintAddress)) return reject('Invalid mint address');

      let transaction = new Transaction();
      let treasurerPublicKey = null;
      const networkPublicKey = account.fromAddress(networkAddress);
      const srcPublicKey = account.fromAddress(srcAddress);
      const mintPublicKey = account.fromAddress(mintAddress);
      const poolSpace = (new soproxABI.struct(schema.POOL_SCHEMA)).space;
      const treasurySpace = (new soproxABI.struct(schema.ACCOUNT_SCHEMA)).space;
      const lptSpace = (new soproxABI.struct(schema.LPT_SCHEMA)).space;

      return this._rentAccount(wallet, pool, poolSpace, this.swapProgramId).then(txId => {
        return this._rentAccount(wallet, treasury, treasurySpace, this.spltProgramId);
      }).then(txId => {
        return this._rentAccount(wallet, lpt, lptSpace, this.swapProgramId);
      }).then(txId => {
        return this._addRecentCommitment(transaction);
      }).then(txWithCommitment => {
        transaction = txWithCommitment;
        const seed = [pool.publicKey.toBuffer()];
        return PublicKey.createProgramAddress(seed, this.swapProgramId);
      }).then(publicKeyFromSeed => {
        treasurerPublicKey = publicKeyFromSeed;
        return wallet.getAccount();
      }).then(payerAddress => {
        const payerPublicKey = account.fromAddress(payerAddress);
        const layout = new soproxABI.struct([
          { key: 'code', type: 'u8' },
          { key: 'reserve', type: 'u64' },
          { key: 'lpt', type: 'u128' },
        ], {
          code: 1,
          reserve,
          lpt: value
        });
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payerPublicKey, isSigner: true, isWritable: false },
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
        transaction.add(instruction);
        transaction.feePayer = payerPublicKey;
        return wallet.sign(transaction);
      }).then(payerSig => {
        this._addSignature(transaction, payerSig);
        return this._sign(transaction, pool);
      }).then(poolSig => {
        this._addSignature(transaction, poolSig);
        return this._sign(transaction, treasury);
      }).then(treasurySig => {
        this._addSignature(transaction, treasurySig);
        return this._sign(transaction, lpt);
      }).then(lptSig => {
        this._addSignature(transaction, lptSig);
        return this._sendTransaction(transaction);
      }).then(txId => {
        return resolve(txId);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  initializeLPT = (lpt, poolAddress, wallet) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(poolAddress)) return reject('Invalid pool address');

      let transaction = new Transaction();
      const poolPublicKey = account.fromAddress(poolAddress);
      const lptSpace = (new soproxABI.struct(schema.LPT_SCHEMA)).space;

      return this._rentAccount(wallet, lpt, lptSpace, this.swapProgramId).then(txId => {
        return this._addRecentCommitment(transaction);
      }).then(txWithCommitment => {
        transaction = txWithCommitment;
        return wallet.getAccount();
      }).then(payerAddress => {
        const payerPublicKey = account.fromAddress(payerAddress);
        const layout = new soproxABI.struct([{ key: 'code', type: 'u8' }], { code: 2 });
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payerPublicKey, isSigner: true, isWritable: false },
            { pubkey: poolPublicKey, isSigner: false, isWritable: false },
            { pubkey: lpt.publicKey, isSigner: true, isWritable: true },
          ],
          programId: this.swapProgramId,
          data: layout.toBuffer()
        });
        transaction.add(instruction);
        transaction.feePayer = payerPublicKey;
        return wallet.sign(transaction);
      }).then(payerSig => {
        this._addSignature(transaction, payerSig);
        return this._sign(transaction, lpt);
      }).then(lptSig => {
        this._addSignature(transaction, lptSig);
        return this._sendTransaction(transaction);
      }).then(txId => {
        return resolve(txId);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  addLiquidity = (reserve, poolAddress, treasuryAddress, lptAddress, srcAddress, wallet) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(poolAddress)) return reject('Invalid pool address');
      if (!account.isAddress(treasuryAddress)) return reject('Invalid treasury address');
      if (!account.isAddress(lptAddress)) return reject('Invalid lpt address');
      if (!account.isAddress(srcAddress)) return reject('Invalid source address');

      let transaction = new Transaction();
      const poolPublicKey = account.fromAddress(poolAddress);
      const treasuryPublicKey = account.fromAddress(treasuryAddress);
      const lptPublicKey = account.fromAddress(lptAddress);
      const srcPublicKey = account.fromAddress(srcAddress);

      return this._addRecentCommitment(transaction).then(txWithCommitment => {
        transaction = txWithCommitment;
        return wallet.getAccount();
      }).then(payerAddress => {
        const payerPublicKey = account.fromAddress(payerAddress);
        const layout = new soproxABI.struct(
          [{ key: 'code', type: 'u8' }, { key: 'reserve', type: 'u64' }],
          { code: 3, reserve }
        );
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payerPublicKey, isSigner: true, isWritable: false },
            { pubkey: poolPublicKey, isSigner: false, isWritable: true },
            { pubkey: treasuryPublicKey, isSigner: false, isWritable: true },
            { pubkey: lptPublicKey, isSigner: false, isWritable: true },
            { pubkey: srcPublicKey, isSigner: false, isWritable: true },
            { pubkey: this.spltProgramId, isSigner: false, isWritable: false },
          ],
          programId: this.swapProgramId,
          data: layout.toBuffer()
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

  removeLiquidity = (lpt, poolAddress, treasuryAddress, lptAddress, dstAddress, wallet) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(poolAddress)) return reject('Invalid pool address');
      if (!account.isAddress(treasuryAddress)) return reject('Invalid treasury address');
      if (!account.isAddress(lptAddress)) return reject('Invalid lpt address');
      if (!account.isAddress(dstAddress)) return reject('Invalid destination address');

      let transaction = new Transaction();
      const poolPublicKey = account.fromAddress(poolAddress);
      const treasuryPublicKey = account.fromAddress(treasuryAddress);
      let treasurerPublicKey = null
      const lptPublicKey = account.fromAddress(lptAddress);
      const dstPublicKey = account.fromAddress(dstAddress);

      return this._addRecentCommitment(transaction).then(txWithCommitment => {
        transaction = txWithCommitment;
        const seed = [poolPublicKey.toBuffer()];
        return PublicKey.createProgramAddress(seed, this.swapProgramId)
      }).then(publicKeyFromSeed => {
        treasurerPublicKey = publicKeyFromSeed;
        return wallet.getAccount();
      }).then(payerAddress => {
        const payerPublicKey = account.fromAddress(payerAddress);
        const layout = new soproxABI.struct(
          [{ key: 'code', type: 'u8' }, { key: 'lpt', type: 'u128' }],
          { code: 4, lpt }
        );
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payerPublicKey, isSigner: true, isWritable: false },
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
    wallet,
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

      let transaction = new Transaction();
      const networkPublicKey = account.fromAddress(networkAddress);
      const bidPoolPublicKey = account.fromAddress(bidPoolAddress);
      const bidTreasuryPublicKey = account.fromAddress(bidTreasuryAddress);
      const srcPublicKey = account.fromAddress(srcAddress);
      const askPoolPublicKey = account.fromAddress(askPoolAddress);
      const askTreasuryPublicKey = account.fromAddress(askTreasuryAddress);
      let askTreasurerPublicKey = null;
      const dstPublicKey = account.fromAddress(dstAddress);
      const senPoolPublicKey = account.fromAddress(senPoolAddress);
      const senTreasuryPublicKey = account.fromAddress(senTreasuryAddress);
      let senTreasurerPublicKey = null;
      const vaultPublicKey = account.fromAddress(vaultAddress);

      return this._addRecentCommitment(transaction).then(txWithCommitment => {
        transaction = txWithCommitment;
        const ask_seed = [askPoolPublicKey.toBuffer()];
        return PublicKey.createProgramAddress(ask_seed, this.swapProgramId)
      }).then(publicKeyFromSeed => {
        askTreasurerPublicKey = publicKeyFromSeed;
        const sen_seed = [senPoolPublicKey.toBuffer()];
        return PublicKey.createProgramAddress(sen_seed, this.swapProgramId);
      }).then(publicKeyFromSeed => {
        senTreasurerPublicKey = publicKeyFromSeed;
        return wallet.getAccount();
      }).then(payerAddress => {
        const payerPublicKey = account.fromAddress(payerAddress);
        const layout = new soproxABI.struct(
          [{ key: 'code', type: 'u8' }, { key: 'amount', type: 'u64' }],
          { code: 5, amount }
        );
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payerPublicKey, isSigner: true, isWritable: false },
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

  transfer = (lpt, poolAddress, srcLPTAddress, dstLPTAddress, wallet) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(poolAddress)) return reject('Invalid pool address');
      if (!account.isAddress(srcLPTAddress)) return reject('Invalid source LPT address');
      if (!account.isAddress(dstLPTAddress)) return reject('Invalid destination LPT address');

      let transaction = new Transaction();
      const poolPublicKey = account.fromAddress(poolAddress);
      const srcLPTPublicKey = account.fromAddress(srcLPTAddress);
      const dstLPTPublicKey = account.fromAddress(dstLPTAddress);

      return this._addRecentCommitment(transaction).then(txWithCommitment => {
        transaction = txWithCommitment;
        return wallet.getAccount();
      }).then(payerAddress => {
        const payerPublicKey = account.fromAddress(payerAddress);
        const layout = new soproxABI.struct(
          [{ key: 'code', type: 'u8' }, { key: 'lpt', type: 'u128' }],
          { code: 6, lpt }
        );
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payerPublicKey, isSigner: true, isWritable: false },
            { pubkey: poolPublicKey, isSigner: false, isWritable: false },
            { pubkey: srcLPTPublicKey, isSigner: false, isWritable: true },
            { pubkey: dstLPTPublicKey, isSigner: false, isWritable: true },
          ],
          programId: this.swapProgramId,
          data: layout.toBuffer()
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

  freezePool = (networkAddress, poolAddress, wallet) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(networkAddress)) return reject('Invalid network address');
      if (!account.isAddress(poolAddress)) return reject('Invalid pool address');

      let transaction = new Transaction();
      const networkPublicKey = account.fromAddress(networkAddress);
      const poolPublicKey = account.fromAddress(poolAddress);

      return this._addRecentCommitment(transaction).then(txWithCommitment => {
        transaction = txWithCommitment;
        return wallet.getAccount();
      }).then(payerAddress => {
        const payerPublicKey = account.fromAddress(payerAddress);
        const layout = new soproxABI.struct([{ key: 'code', type: 'u8' }], { code: 7 });
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payerPublicKey, isSigner: true, isWritable: false },
            { pubkey: networkPublicKey, isSigner: false, isWritable: false },
            { pubkey: poolPublicKey, isSigner: false, isWritable: true },
          ],
          programId: this.swapProgramId,
          data: layout.toBuffer()
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

  thawPool = (networkAddress, poolAddress, wallet) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(networkAddress)) return reject('Invalid network address');
      if (!account.isAddress(poolAddress)) return reject('Invalid pool address');

      let transaction = new Transaction();
      const networkPublicKey = account.fromAddress(networkAddress);
      const poolPublicKey = account.fromAddress(poolAddress);

      return this._addRecentCommitment(transaction).then(txWithCommitment => {
        transaction = txWithCommitment;
        return wallet.getAccount();
      }).then(payerAddress => {
        const payerPublicKey = account.fromAddress(payerAddress);
        const layout = new soproxABI.struct([{ key: 'code', type: 'u8' }], { code: 8 });
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payerPublicKey, isSigner: true, isWritable: false },
            { pubkey: networkPublicKey, isSigner: false, isWritable: false },
            { pubkey: poolPublicKey, isSigner: false, isWritable: true },
          ],
          programId: this.swapProgramId,
          data: layout.toBuffer()
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

  earn = (amount, networkAddress, vaultAddress, dstAddress, wallet) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(networkAddress)) return reject('Invalid network address');
      if (!account.isAddress(vaultAddress)) return reject('Invalid vault address');
      if (!account.isAddress(dstAddress)) return reject('Invalid destination address');

      let transaction = new Transaction();
      const networkPublicKey = account.fromAddress(networkAddress);
      const vaultPublicKey = account.fromAddress(vaultAddress);
      let treasurerPublicKey = null;
      const dstPublicKey = account.fromAddress(dstAddress);

      return this._addRecentCommitment(transaction).then(txWithCommitment => {
        transaction = txWithCommitment;
        const seed = [vaultPublicKey.toBuffer()];
        return PublicKey.createProgramAddress(seed, this.swapProgramId)
      }).then(publicKeyFromSeed => {
        treasurerPublicKey = publicKeyFromSeed;
        return wallet.getAccount();
      }).then(payerAddress => {
        const payerPublicKey = account.fromAddress(payerAddress);
        const layout = new soproxABI.struct(
          [{ key: 'code', type: 'u8' }, { key: 'amount', type: 'u64' }],
          { code: 9, amount });
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payerPublicKey, isSigner: true, isWritable: false },
            { pubkey: networkPublicKey, isSigner: false, isWritable: false },
            { pubkey: vaultPublicKey, isSigner: false, isWritable: true },
            { pubkey: dstPublicKey, isSigner: false, isWritable: true },
            { pubkey: treasurerPublicKey, isSigner: false, isWritable: false },
            { pubkey: this.spltProgramId, isSigner: false, isWritable: false },
          ],
          programId: this.swapProgramId,
          data: layout.toBuffer()
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

  closeLPT = (lptAddress, dstAddress, wallet) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(lptAddress)) return reject('Invalid LPT address');
      if (!account.isAddress(dstAddress)) return reject('Invalid destination address');

      let transaction = new Transaction();
      const lptPublicKey = account.fromAddress(lptAddress);
      const dstPublicKey = account.fromAddress(dstAddress);

      return this._addRecentCommitment(transaction).then(txWithCommitment => {
        transaction = txWithCommitment;
        return wallet.getAccount();
      }).then(payerAddress => {
        const payerPublicKey = account.fromAddress(payerAddress);
        const layout = new soproxABI.struct([{ key: 'code', type: 'u8' }], { code: 10 });
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payerPublicKey, isSigner: true, isWritable: false },
            { pubkey: lptPublicKey, isSigner: false, isWritable: true },
            { pubkey: dstPublicKey, isSigner: false, isWritable: true },
          ],
          programId: this.swapProgramId,
          data: layout.toBuffer()
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

  closePool = (poolAddress, treasuryAddress, dstAddress, wallet) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(poolAddress)) return reject('Invalid pool address');
      if (!account.isAddress(treasuryAddress)) return reject('Invalid treasury address');
      if (!account.isAddress(dstAddress)) return reject('Invalid destination address');

      let transaction = new Transaction();
      const poolPublicKey = account.fromAddress(poolAddress);
      const treasuryPublicKey = account.fromAddress(treasuryAddress);
      let treasurerPublicKey = null;
      const dstPublicKey = account.fromAddress(dstAddress);

      return this._addRecentCommitment(transaction).then(txWithCommitment => {
        transaction = txWithCommitment;
        const seed = [poolPublicKey.toBuffer()];
        return PublicKey.createProgramAddress(seed, this.swapProgramId)
      }).then(publicKeyFromSeed => {
        treasurerPublicKey = publicKeyFromSeed;
        return wallet.getAccount();
      }).then(payerAddress => {
        const payerPublicKey = account.fromAddress(payerAddress);
        const layout = new soproxABI.struct([{ key: 'code', type: 'u8' }], { code: 11 });
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payerPublicKey, isSigner: true, isWritable: false },
            { pubkey: poolPublicKey, isSigner: false, isWritable: true },
            { pubkey: treasuryPublicKey, isSigner: false, isWritable: true },
            { pubkey: dstPublicKey, isSigner: false, isWritable: true },
            { pubkey: treasurerPublicKey, isSigner: false, isWritable: false },
            { pubkey: this.spltProgramId, isSigner: false, isWritable: false },
          ],
          programId: this.swapProgramId,
          data: layout.toBuffer()
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

  transferOwnership = (newOwner, networkAddress, wallet) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(networkAddress)) return reject('Invalid network address');

      let transaction = new Transaction();
      const networkPublicKey = account.fromAddress(networkAddress);
      return this._addRecentCommitment(transaction).then(txWithCommitment => {
        transaction = txWithCommitment;
        return wallet.getAccount();
      }).then(payerAddress => {
        const payerPublicKey = account.fromAddress(payerAddress);
        const layout = new soproxABI.struct([{ key: 'code', type: 'u8' }], { code: 12 });
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payerPublicKey, isSigner: true, isWritable: false },
            { pubkey: newOwner.publicKey, isSigner: true, isWritable: false },
            { pubkey: networkPublicKey, isSigner: false, isWritable: true },
          ],
          programId: this.swapProgramId,
          data: layout.toBuffer()
        });
        transaction.add(instruction);
        transaction.feePayer = payerPublicKey;
        return wallet.sign(transaction);
      }).then(payerSig => {
        this._addSignature(transaction, payerSig);
        return this._sign(transaction, newOwner);
      }).then(newOwnerSig => {
        this._addSignature(transaction, newOwnerSig);
        return this._sendTransaction(transaction);
      }).then(txId => {
        return resolve(txId);
      }).catch(er => {
        return reject(er);
      });
    });
  }
}

module.exports = Swap;