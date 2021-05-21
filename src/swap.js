const { PublicKey, Transaction, SYSVAR_RENT_PUBKEY, TransactionInstruction } = require('@solana/web3.js');
const soproxABI = require('soprox-abi');

const Tx = require('./core/tx');
const { SPLT } = require('./splt');
const account = require('./account');
const { proofOfMintLPT } = require('./crypto');
const schema = require('./schema');
const {
  DEFAULT_SWAP_PROGRAM_ADDRESS,
  DEFAULT_SPLT_PROGRAM_ADDRESS,
  DEFAULT_SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ADDRESS,
  DEFAULT_EMPTY_ADDRESSS
} = require('./default');

class Swap extends Tx {
  constructor(
    swapProgramAddress = DEFAULT_SWAP_PROGRAM_ADDRESS,
    spltProgramAddress = DEFAULT_SPLT_PROGRAM_ADDRESS,
    splataProgramAddress = DEFAULT_SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ADDRESS,
    nodeUrl
  ) {
    super(nodeUrl);

    if (!account.isAddress(swapProgramAddress)) throw new Error('Invalid swap program address');
    if (!account.isAddress(spltProgramAddress)) throw new Error('Invalid SPL token program address');
    if (!account.isAddress(splataProgramAddress)) throw new Error('Invalid SPL associated token program address');
    this.swapProgramId = account.fromAddress(swapProgramAddress);
    this.spltProgramId = account.fromAddress(spltProgramAddress);
    this.splataProgramId = account.fromAddress(splataProgramAddress);

    this._splt = new SPLT(spltProgramAddress, splataProgramAddress, nodeUrl);
  }

  watchAndFetch = (callback) => {
    return this.watch((er, re) => {
      if (er) return callback(er, null);
      const { type, address } = re;
      let getData = () => { }
      if (type === 'pool') getData = this.getPoolData;
      return getData(address).then(data => {
        return callback(null, data);
      }).catch(er => {
        return callback(er, null);
      });
    });
  }

  watch = (callback) => {
    return this.connection.onProgramAccountChange(this.swapProgramId, ({ accountId, accountInfo: { data } }) => {
      const address = accountId.toBase58();
      const poolSpace = (new soproxABI.struct(schema.POOL_SCHEMA)).space;
      let type = null;
      if (data.length === poolSpace) type = 'pool';
      if (!type) return callback('Unmatched type', null);
      return callback(null, { type, address });
    });
  }

  _getMintData = (mintAddress) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(mintAddress)) return reject('Invalid mint address');
      const mintPublicKey = account.fromAddress(mintAddress);

      return this.connection.getAccountInfo(mintPublicKey).then(re => {
        if (!re) return reject('Uninitialized mint');
        const { data } = re;
        if (!data) return reject(`Cannot read data of ${mintAddress}`);
        const mintLayout = new soproxABI.struct(schema.MINT_SCHEMA);
        if (data.length !== mintLayout.space) return reject('Unmatched buffer length');
        mintLayout.fromBuffer(data);
        const result = { address: mintAddress, ...mintLayout.value };
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

      return this.connection.getAccountInfo(accountPublicKey).then(re => {
        if (!re) return reject('Uninitialized account');
        const { data: accountData } = re;
        if (!accountData) return reject(`Cannot read data of ${result.address}`);
        const accountLayout = new soproxABI.struct(schema.ACCOUNT_SCHEMA);
        if (accountData.length !== accountLayout.space) return reject('Unmatched buffer length');
        accountLayout.fromBuffer(accountData);
        const result = { address: accountAddress, ...accountLayout.value };
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

        result = {
          ...result, ...poolLayout.value,
          mint_lpt: { address: poolLayout.value.mint_lpt },
          vault: { address: poolLayout.value.vault },
          mint_s: { address: poolLayout.value.mint_s },
          mint_a: { address: poolLayout.value.mint_a },
          mint_b: { address: poolLayout.value.mint_b },
        }

        return this._splt.getMintData(result.mint_lpt.address);
      }).then(mintData => {
        result.mint_lpt = { ...result.mint_lpt, ...mintData };
        return this._getAccountData(result.vault.address);
      }).then(vaultData => {
        result.vault = { ...result.vault, ...vaultData };
        return this._getMintData(result.mint_s.address);
      }).then(mintData => {
        result.mint_s = { ...result.mint_s, ...mintData };
        return this._getMintData(result.mint_a.address);
      }).then(mintData => {
        result.mint_a = { ...result.mint_a, ...mintData };
        return this._getMintData(result.mint_b.address);
      }).then(mintData => {
        result.mint_b = { ...result.mint_b, ...mintData };
        return resolve(result);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  getLPTData = (lptAddress) => {
    return this._splt.getAccountData(lptAddress);
  }

  initializePool = (
    reserveS, reserveA, reserveB,
    ownerAddress, pool, lptAddress, mintLPT, vault,
    srcSAddress, mintSAddress, treasuryS,
    srcAAddress, mintAAddress, treasuryA,
    srcBAddress, mintBAddress, treasuryB,
    wallet
  ) => {
    return new Promise((resolve, reject) => {
      srcSAddress = srcSAddress || DEFAULT_EMPTY_ADDRESSS;
      srcAAddress = srcAAddress || DEFAULT_EMPTY_ADDRESSS;
      srcBAddress = srcBAddress || DEFAULT_EMPTY_ADDRESSS;
      if (!account.isAddress(ownerAddress)) return reject('Invalid owner address');
      if (!account.isAddress(lptAddress)) return reject('Invalid lpt address');
      if (!account.isAddress(srcSAddress)) return reject('Invalid source address');
      if (!account.isAddress(mintSAddress)) return reject('Invalid mint address');
      if (!account.isAddress(srcAAddress)) return reject('Invalid source address');
      if (!account.isAddress(mintAAddress)) return reject('Invalid mint address');
      if (!account.isAddress(srcBAddress)) return reject('Invalid source address');
      if (!account.isAddress(mintBAddress)) return reject('Invalid mint address');
      if (mintSAddress === mintAAddress) return reject('There are same mint addresses');
      if (mintSAddress === mintBAddress) return reject('There are same mint addresses');

      let transaction = new Transaction();
      const ownerPublicKey = account.fromAddress(ownerAddress);
      const lptPublicKey = account.fromAddress(lptAddress);
      const srcSPublicKey = account.fromAddress(srcSAddress);
      const mintSPublicKey = account.fromAddress(mintSAddress);
      const srcAPublicKey = account.fromAddress(srcAAddress);
      const mintAPublicKey = account.fromAddress(mintAAddress);
      const srcBPublicKey = account.fromAddress(srcBAddress);
      const mintBPublicKey = account.fromAddress(mintBAddress);
      let treasurerPublicKey = null;

      const poolSpace = (new soproxABI.struct(schema.POOL_SCHEMA)).space;
      const accountSpace = (new soproxABI.struct(schema.ACCOUNT_SCHEMA)).space;

      const seed = [pool.publicKey.toBuffer()];
      return PublicKey.createProgramAddress(seed, this.swapProgramId).then(publicKeyFromSeed => {
        treasurerPublicKey = publicKeyFromSeed;
        return proofOfMintLPT(pool.publicKey.toBase58(), this.swapProgramId.toBase58());
      }).then(freezeAuthorityAddress => {
        const treasurerAddress = treasurerPublicKey.toBase58();
        return this._splt.initializeMint(9, treasurerAddress, freezeAuthorityAddress, mintLPT, wallet);
      }).then(txId => {
        const mintLPTAddress = mintLPT.publicKey.toBase58();
        return this._splt.initializeAccount(lptAddress, mintLPTAddress, wallet);
      }).then(txId => {
        return this._rentAccount(wallet, pool, poolSpace, this.swapProgramId);
      }).then(txId => {
        return this._rentAccount(wallet, vault, accountSpace, this.spltProgramId);
      }).then(txId => {
        return this._rentAccount(wallet, treasuryS, accountSpace, this.spltProgramId);
      }).then(txId => {
        return this._rentAccount(wallet, treasuryA, accountSpace, this.spltProgramId);
      }).then(txId => {
        return this._rentAccount(wallet, treasuryB, accountSpace, this.spltProgramId);
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
          { key: 'reserve_s', type: 'u64' },
          { key: 'reserve_a', type: 'u64' },
          { key: 'reserve_b', type: 'u64' },
        ], {
          code: 0,
          reserve_s: reserveS,
          reserve_a: reserveA,
          reserve_b: reserveB,
        });
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payerPublicKey, isSigner: true, isWritable: true },
            { pubkey: ownerPublicKey, isSigner: false, isWritable: false },
            { pubkey: pool.publicKey, isSigner: true, isWritable: true },
            { pubkey: lptPublicKey, isSigner: false, isWritable: true },
            { pubkey: mintLPT.publicKey, isSigner: true, isWritable: true },
            { pubkey: vault.publicKey, isSigner: true, isWritable: true },

            { pubkey: srcSPublicKey, isSigner: false, isWritable: true },
            { pubkey: mintSPublicKey, isSigner: false, isWritable: false },
            { pubkey: treasuryS.publicKey, isSigner: true, isWritable: true },

            { pubkey: srcAPublicKey, isSigner: false, isWritable: true },
            { pubkey: mintAPublicKey, isSigner: false, isWritable: false },
            { pubkey: treasuryA.publicKey, isSigner: true, isWritable: true },

            { pubkey: srcBPublicKey, isSigner: false, isWritable: true },
            { pubkey: mintBPublicKey, isSigner: false, isWritable: false },
            { pubkey: treasuryB.publicKey, isSigner: true, isWritable: true },

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
        return this._sign(transaction, mintLPT);
      }).then(mintLPTSig => {
        this._addSignature(transaction, mintLPTSig);
        return this._sign(transaction, vault);
      }).then(vaultSig => {
        this._addSignature(transaction, vaultSig);
        return this._sign(transaction, treasuryS);
      }).then(treasurySSig => {
        this._addSignature(transaction, treasurySSig);
        return this._sign(transaction, treasuryA);
      }).then(treasuryASig => {
        this._addSignature(transaction, treasuryASig);
        return this._sign(transaction, treasuryB);
      }).then(treasuryBSig => {
        this._addSignature(transaction, treasuryBSig);
        return this._sendTransaction(transaction);
      }).then(txId => {
        return resolve(txId);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  initializeLPT = (lptAccountOrAddress, mintLPTAddress, wallet) => {
    return this._splt.initializeAccount(lptAccountOrAddress, mintLPTAddress, wallet);
  }

  addLiquidity = (
    deltaS, deltaA, deltaB,
    poolAddress, lptAddress, mintLPTAddress,
    srcSAddress, treasurySAddress,
    srcAAddress, treasuryAAddress,
    srcBAddress, treasuryBAddress,
    wallet
  ) => {
    return new Promise((resolve, reject) => {
      if (!srcSAddress && !srcAAddress && !srcBAddress) return reject('Invalid source address');
      if (!account.isAddress(poolAddress)) return reject('Invalid pool address');
      if (!account.isAddress(lptAddress)) return reject('Invalid lpt address');
      if (!account.isAddress(mintLPTAddress)) return reject('Invalid mint LPT address');
      srcSAddress = srcSAddress || DEFAULT_EMPTY_ADDRESSS;
      if (!account.isAddress(srcSAddress)) return reject('Invalid source S address');
      if (!account.isAddress(treasurySAddress)) return reject('Invalid treasury S address');
      srcAAddress = srcAAddress || DEFAULT_EMPTY_ADDRESSS;
      if (!account.isAddress(srcAAddress)) return reject('Invalid source A address');
      if (!account.isAddress(treasuryAAddress)) return reject('Invalid treasury A address');
      srcBAddress = srcBAddress || DEFAULT_EMPTY_ADDRESSS;
      if (!account.isAddress(srcBAddress)) return reject('Invalid source B address');
      if (!account.isAddress(treasuryBAddress)) return reject('Invalid treasury B address');

      let transaction = new Transaction();
      const poolPublicKey = account.fromAddress(poolAddress);
      const lptPublicKey = account.fromAddress(lptAddress);
      const mintLPTPublicKey = account.fromAddress(mintLPTAddress);
      const srcSPublicKey = account.fromAddress(srcSAddress);
      const treasurySPublicKey = account.fromAddress(treasurySAddress);
      const srcAPublicKey = account.fromAddress(srcAAddress);
      const treasuryAPublicKey = account.fromAddress(treasuryAAddress);
      const srcBPublicKey = account.fromAddress(srcBAddress);
      const treasuryBPublicKey = account.fromAddress(treasuryBAddress);
      let treasurerPublicKey = null;

      return this._addRecentCommitment(transaction).then(txWithCommitment => {
        transaction = txWithCommitment;
        const seed = [poolPublicKey.toBuffer()];
        return PublicKey.createProgramAddress(seed, this.swapProgramId);
      }).then(publicKeyFromSeed => {
        treasurerPublicKey = publicKeyFromSeed;
        return wallet.getAccount();
      }).then(payerAddress => {
        const payerPublicKey = account.fromAddress(payerAddress);
        const layout = new soproxABI.struct([
          { key: 'code', type: 'u8' },
          { key: 'delta_s', type: 'u64' },
          { key: 'delta_a', type: 'u64' },
          { key: 'delta_b', type: 'u64' }
        ], {
          code: 1,
          delta_s: deltaS,
          delta_a: deltaA,
          delta_b: deltaB
        });
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payerPublicKey, isSigner: true, isWritable: false },
            { pubkey: poolPublicKey, isSigner: false, isWritable: true },
            { pubkey: lptPublicKey, isSigner: false, isWritable: true },
            { pubkey: mintLPTPublicKey, isSigner: false, isWritable: true },

            { pubkey: srcSPublicKey, isSigner: false, isWritable: true },
            { pubkey: treasurySPublicKey, isSigner: false, isWritable: true },

            { pubkey: srcAPublicKey, isSigner: false, isWritable: true },
            { pubkey: treasuryAPublicKey, isSigner: false, isWritable: true },

            { pubkey: srcBPublicKey, isSigner: false, isWritable: true },
            { pubkey: treasuryBPublicKey, isSigner: false, isWritable: true },

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

  removeLiquidity = (
    lpt,
    poolAddress, lptAddress, mintLPTAddress,
    dstSAddress, treasurySAddress,
    dstAAddress, treasuryAAddress,
    dstBAddress, treasuryBAddress,
    wallet
  ) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(poolAddress)) return reject('Invalid pool address');
      if (!account.isAddress(lptAddress)) return reject('Invalid lpt address');
      if (!account.isAddress(mintLPTAddress)) return reject('Invalid mint LPT address');
      if (!account.isAddress(dstSAddress)) return reject('Invalid destination S address');
      if (!account.isAddress(treasurySAddress)) return reject('Invalid treasury S address');
      if (!account.isAddress(dstAAddress)) return reject('Invalid destination A address');
      if (!account.isAddress(treasuryAAddress)) return reject('Invalid treasury A address');
      if (!account.isAddress(dstBAddress)) return reject('Invalid destination B address');
      if (!account.isAddress(treasuryBAddress)) return reject('Invalid treasury B address');

      let transaction = new Transaction();
      const poolPublicKey = account.fromAddress(poolAddress);
      const lptPublicKey = account.fromAddress(lptAddress);
      const mintLPTPublicKey = account.fromAddress(mintLPTAddress);
      const dstSPublicKey = account.fromAddress(dstSAddress);
      const treasurySPublicKey = account.fromAddress(treasurySAddress);
      const dstAPublicKey = account.fromAddress(dstAAddress);
      const treasuryAPublicKey = account.fromAddress(treasuryAAddress);
      const dstBPublicKey = account.fromAddress(dstBAddress);
      const treasuryBPublicKey = account.fromAddress(treasuryBAddress);
      let treasurerPublicKey = null;

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
          [{ key: 'code', type: 'u8' }, { key: 'lpt', type: 'u64' }],
          { code: 2, lpt }
        );
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payerPublicKey, isSigner: true, isWritable: false },
            { pubkey: poolPublicKey, isSigner: false, isWritable: true },
            { pubkey: lptPublicKey, isSigner: false, isWritable: true },
            { pubkey: mintLPTPublicKey, isSigner: false, isWritable: true },
            { pubkey: dstSPublicKey, isSigner: false, isWritable: true },
            { pubkey: treasurySPublicKey, isSigner: false, isWritable: true },
            { pubkey: dstAPublicKey, isSigner: false, isWritable: true },
            { pubkey: treasuryAPublicKey, isSigner: false, isWritable: true },
            { pubkey: dstBPublicKey, isSigner: false, isWritable: true },
            { pubkey: treasuryBPublicKey, isSigner: false, isWritable: true },
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
    poolAddress, vaultAddress,
    srcAddress, treasuryBidAddress,
    dstAddress, treasuryAskAddress,
    treasurySenAddress,
    wallet,
  ) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(poolAddress)) return reject('Invalid pool address');
      if (!account.isAddress(vaultAddress)) return reject('Invalid vault address');
      if (!account.isAddress(srcAddress)) return reject('Invalid source address');
      if (!account.isAddress(treasuryBidAddress)) return reject('Invalid treasury bid address');
      if (!account.isAddress(dstAddress)) return reject('Invalid destination address');
      if (!account.isAddress(treasuryAskAddress)) return reject('Invalid treasury ask address');
      if (!account.isAddress(treasurySenAddress)) return reject('Invalid treasury sen address');

      let transaction = new Transaction();
      const poolPublicKey = account.fromAddress(poolAddress);
      const vaultPublicKey = account.fromAddress(vaultAddress);
      const srcPublicKey = account.fromAddress(srcAddress);
      const treasuryBidPublicKey = account.fromAddress(treasuryBidAddress);
      const dstPublicKey = account.fromAddress(dstAddress);
      const treasuryAskPublicKey = account.fromAddress(treasuryAskAddress);
      const treasurySenPublicKey = account.fromAddress(treasurySenAddress);
      let treasurerPublicKey = null;

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
          [{ key: 'code', type: 'u8' }, { key: 'amount', type: 'u64' }],
          { code: 3, amount }
        );
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payerPublicKey, isSigner: true, isWritable: false },
            { pubkey: poolPublicKey, isSigner: false, isWritable: true },
            { pubkey: vaultPublicKey, isSigner: false, isWritable: true },
            { pubkey: srcPublicKey, isSigner: false, isWritable: true },
            { pubkey: treasuryBidPublicKey, isSigner: false, isWritable: true },
            { pubkey: dstPublicKey, isSigner: false, isWritable: true },
            { pubkey: treasuryAskPublicKey, isSigner: false, isWritable: true },
            { pubkey: treasurySenPublicKey, isSigner: false, isWritable: true },
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

  transfer = (lpt, srcLPTAddress, dstLPTAddress, wallet) => {
    return this._splt.transfer(lpt, srcLPTAddress, dstLPTAddress, wallet);
  }

  freezePool = (poolAddress, wallet) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(poolAddress)) return reject('Invalid pool address');

      let transaction = new Transaction();
      const poolPublicKey = account.fromAddress(poolAddress);

      return this._addRecentCommitment(transaction).then(txWithCommitment => {
        transaction = txWithCommitment;
        return wallet.getAccount();
      }).then(payerAddress => {
        const payerPublicKey = account.fromAddress(payerAddress);
        const layout = new soproxABI.struct([{ key: 'code', type: 'u8' }], { code: 4 });
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payerPublicKey, isSigner: true, isWritable: false },
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

  thawPool = (poolAddress, wallet) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(poolAddress)) return reject('Invalid pool address');

      let transaction = new Transaction();
      const poolPublicKey = account.fromAddress(poolAddress);

      return this._addRecentCommitment(transaction).then(txWithCommitment => {
        transaction = txWithCommitment;
        return wallet.getAccount();
      }).then(payerAddress => {
        const payerPublicKey = account.fromAddress(payerAddress);
        const layout = new soproxABI.struct([{ key: 'code', type: 'u8' }], { code: 5 });
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payerPublicKey, isSigner: true, isWritable: false },
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

  earn = (amount, poolAddress, vaultAddress, dstAddress, wallet) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(poolAddress)) return reject('Invalid pool address');
      if (!account.isAddress(vaultAddress)) return reject('Invalid vault address');
      if (!account.isAddress(dstAddress)) return reject('Invalid destination address');

      let transaction = new Transaction();
      const poolPublicKey = account.fromAddress(poolAddress);
      const vaultPublicKey = account.fromAddress(vaultAddress);
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
        const layout = new soproxABI.struct(
          [{ key: 'code', type: 'u8' }, { key: 'amount', type: 'u64' }],
          { code: 6, amount });
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payerPublicKey, isSigner: true, isWritable: false },
            { pubkey: poolPublicKey, isSigner: false, isWritable: false },
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

  closeLPT = (lptAddress, wallet) => {
    return this._splt.closeAccount(lptAddress, wallet);
  }

  transferPoolOwnership = (poolAddress, newOwnerAddress, wallet) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(poolAddress)) return reject('Invalid pool address');
      if (!account.isAddress(newOwnerAddress)) return reject('Invalid new owner address');

      let transaction = new Transaction();
      const poolPublicKey = account.fromAddress(poolAddress);
      const newOwnerPublicKey = account.fromAddress(newOwnerAddress);
      return this._addRecentCommitment(transaction).then(txWithCommitment => {
        transaction = txWithCommitment;
        return wallet.getAccount();
      }).then(payerAddress => {
        const payerPublicKey = account.fromAddress(payerAddress);
        const layout = new soproxABI.struct([{ key: 'code', type: 'u8' }], { code: 7 });
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payerPublicKey, isSigner: true, isWritable: false },
            { pubkey: poolPublicKey, isSigner: false, isWritable: true },
            { pubkey: newOwnerPublicKey, isSigner: false, isWritable: false },
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
}

module.exports = Swap;