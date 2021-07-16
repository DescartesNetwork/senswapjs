const {
  PublicKey, Transaction, SYSVAR_RENT_PUBKEY,
  TransactionInstruction, SystemProgram
} = require('@solana/web3.js');
const soproxABI = require('soprox-abi');
const xor = require('buffer-xor');

const Tx = require('./core/tx');
const { SPLT } = require('./splt');
const account = require('./account');
const schema = require('./schema');
const {
  DEFAULT_SWAP_PROGRAM_ADDRESS,
  DEFAULT_SPLT_PROGRAM_ADDRESS,
  DEFAULT_SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ADDRESS,
  DEFAULT_EMPTY_ADDRESS
} = require('./defaults');

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

  _genProofAddress = async (poolAddress) => {
    if (!account.isAddress(poolAddress)) throw new Error('Invalid pool address');
    const poolPublicKey = account.fromAddress(poolAddress);
    const seed = [poolPublicKey.toBuffer()];
    const treasurerPublicKey = await PublicKey.createProgramAddress(seed, this.swapProgramId);
    const proof = new PublicKey(xor(this.swapProgramId.toBuffer(),
      xor(poolPublicKey.toBuffer(), treasurerPublicKey.toBuffer())
    ));
    return proof.toBase58();
  }

  derivePoolAddress = async (mintAuthorityAddress, freezeAuthorityAddress) => {
    if (!account.isAddress(mintAuthorityAddress)) throw new Error('Invalid mint authority address');
    if (!account.isAddress(freezeAuthorityAddress)) throw new Error('Invalid freeze authority address');

    const mintAuthorityPublicKey = account.fromAddress(mintAuthorityAddress);
    const freezeAuthorityPublicKey = account.fromAddress(freezeAuthorityAddress); // Proof of mint LPT
    const poolPublicKey = new PublicKey(xor(this.swapProgramId.toBuffer(),
      xor(freezeAuthorityPublicKey.toBuffer(), mintAuthorityPublicKey.toBuffer())
    ));
    const seed = [poolPublicKey.toBuffer()];
    const treasurerPublicKey = await PublicKey.createProgramAddress(seed, this.swapProgramId);
    if (treasurerPublicKey.toBase58() != mintAuthorityPublicKey.toBase58()) return null;
    return poolPublicKey.toBase58();
  }

  _getMintData = async (mintAddress) => {
    if (!account.isAddress(mintAddress)) throw new Error('Invalid mint address');
    const mintPublicKey = account.fromAddress(mintAddress);
    const { data } = await this.connection.getAccountInfo(mintPublicKey) || {};
    if (!data) throw new Error(`Cannot read data of ${mintAddress}`);
    const mintLayout = new soproxABI.struct(schema.MINT_SCHEMA);
    if (data.length !== mintLayout.space) throw new Error('Unmatched buffer length');
    mintLayout.fromBuffer(data);
    const result = { address: mintAddress, ...mintLayout.value };
    return result;
  }

  _getAccountData = async (accountAddress) => {
    if (!account.isAddress(accountAddress)) throw new Error('Invalid account address');
    const accountPublicKey = account.fromAddress(accountAddress);
    const { data } = await this.connection.getAccountInfo(accountPublicKey) || {};
    if (!data) throw new Error(`Cannot read data of ${result.address}`);
    const accountLayout = new soproxABI.struct(schema.ACCOUNT_SCHEMA);
    if (data.length !== accountLayout.space) throw new Error('Unmatched buffer length');
    accountLayout.fromBuffer(data);
    const result = { address: accountAddress, ...accountLayout.value };
    return result;
  }

  _deriveTreasuryAddresses = async (treasurerAddress, mintAddresses) => {
    const treasuryAddresses = await Promise.all(mintAddresses.map(mintAddress => {
      return account.deriveAssociatedAddress(
        treasurerAddress,
        mintAddress,
        this.spltProgramId.toBase58(),
        this.splataProgramId.toBase58(),
      );
    }));
    return treasuryAddresses;
  }

  getPoolData = async (poolAddress) => {
    if (!account.isAddress(poolAddress)) throw new Error('Invalid pool address');
    const poolPublicKey = account.fromAddress(poolAddress);
    let result = { address: poolAddress }
    const { data: poolData } = await this.connection.getAccountInfo(poolPublicKey) || {};
    if (!poolData) throw new Error(`Cannot read data of ${result.address}`);
    const poolLayout = new soproxABI.struct(schema.POOL_SCHEMA);
    if (poolData.length !== poolLayout.space) throw new Error('Unmatched buffer length');
    poolLayout.fromBuffer(poolData);
    result = {
      ...result, ...poolLayout.value,
      mint_lpt: { address: poolLayout.value.mint_lpt },
      vault: { address: poolLayout.value.vault },
      mint_s: { address: poolLayout.value.mint_s },
      mint_a: { address: poolLayout.value.mint_a },
      mint_b: { address: poolLayout.value.mint_b },
    }
    const mintLPTData = await this._splt.getMintData(result.mint_lpt.address);
    result.mint_lpt = { ...result.mint_lpt, ...mintLPTData };
    const vaultData = await this._getAccountData(result.vault.address);
    result.vault = { ...result.vault, ...vaultData };
    const mintSData = await this._getMintData(result.mint_s.address);
    result.mint_s = { ...result.mint_s, ...mintSData };
    const mintAData = await this._getMintData(result.mint_a.address);
    result.mint_a = { ...result.mint_a, ...mintAData };
    const mintBData = await this._getMintData(result.mint_b.address);
    result.mint_b = { ...result.mint_b, ...mintBData };
    return result;
  }

  getLPTData = async (lptAddress) => {
    return await this._splt.getAccountData(lptAddress);
  }

  initializePool = async (
    reserveS, reserveA, reserveB,
    ownerAddress, pool, lptAddress, mintLPT, vault,
    srcSAddress, mintSAddress,
    srcAAddress, mintAAddress,
    srcBAddress, mintBAddress,
    wallet
  ) => {
    srcSAddress = srcSAddress || DEFAULT_EMPTY_ADDRESS;
    srcAAddress = srcAAddress || DEFAULT_EMPTY_ADDRESS;
    srcBAddress = srcBAddress || DEFAULT_EMPTY_ADDRESS;
    if (!account.isAddress(ownerAddress)) throw new Error('Invalid owner address');
    if (!account.isAddress(lptAddress)) throw new Error('Invalid lpt address');
    if (!account.isAddress(srcSAddress)) throw new Error('Invalid source address');
    if (!account.isAddress(mintSAddress)) throw new Error('Invalid mint address');
    if (!account.isAddress(srcAAddress)) throw new Error('Invalid source address');
    if (!account.isAddress(mintAAddress)) throw new Error('Invalid mint address');
    if (!account.isAddress(srcBAddress)) throw new Error('Invalid source address');
    if (!account.isAddress(mintBAddress)) throw new Error('Invalid mint address');
    if (mintSAddress === mintAAddress) throw new Error('There are same mint addresses');
    if (mintSAddress === mintBAddress) throw new Error('There are same mint addresses');
    const ownerPublicKey = account.fromAddress(ownerAddress);
    const lptPublicKey = account.fromAddress(lptAddress);
    const srcSPublicKey = account.fromAddress(srcSAddress);
    const mintSPublicKey = account.fromAddress(mintSAddress);
    const srcAPublicKey = account.fromAddress(srcAAddress);
    const mintAPublicKey = account.fromAddress(mintAAddress);
    const srcBPublicKey = account.fromAddress(srcBAddress);
    const mintBPublicKey = account.fromAddress(mintBAddress);
    // Get payer
    const payerAddress = await wallet.getAccount();
    const payerPublicKey = account.fromAddress(payerAddress);
    // Get treasurer
    const seed = [pool.publicKey.toBuffer()];
    const treasurerPublicKey = await PublicKey.createProgramAddress(seed, this.swapProgramId);
    const treasurerAddress = treasurerPublicKey.toBase58();
    // Get treasury S, A, B
    const [treasurySPublicKey, treasuryAPublicKey, treasuryBPublicKey] = (await this._deriveTreasuryAddresses(
      treasurerAddress,
      [mintSAddress, mintAAddress, mintBAddress]
    )).map(treasuryAddress => account.fromAddress(treasuryAddress));
    // Rent pool
    const poolSpace = (new soproxABI.struct(schema.POOL_SCHEMA)).space;
    await this._rentAccount(wallet, pool, poolSpace, this.swapProgramId);
    // Rent mint
    const mintSpace = (new soproxABI.struct(schema.MINT_SCHEMA)).space;
    await this._rentAccount(wallet, mintLPT, mintSpace, this.spltProgramId);
    // Rent vault
    const accountSpace = (new soproxABI.struct(schema.ACCOUNT_SCHEMA)).space;
    await this._rentAccount(wallet, vault, accountSpace, this.spltProgramId);
    // Generate proof
    const proofAddress = await this._genProofAddress(pool.publicKey.toBase58());
    const proofPublicKey = account.fromAddress(proofAddress);
    // Build tx
    let transaction = new Transaction();
    transaction = await this._addRecentCommitment(transaction);
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
        { pubkey: mintLPT.publicKey, isSigner: false, isWritable: true },
        { pubkey: vault.publicKey, isSigner: true, isWritable: true },
        { pubkey: proofPublicKey, isSigner: false, isWritable: false },

        { pubkey: srcSPublicKey, isSigner: false, isWritable: true },
        { pubkey: mintSPublicKey, isSigner: false, isWritable: false },
        { pubkey: treasurySPublicKey, isSigner: false, isWritable: true },

        { pubkey: srcAPublicKey, isSigner: false, isWritable: true },
        { pubkey: mintAPublicKey, isSigner: false, isWritable: false },
        { pubkey: treasuryAPublicKey, isSigner: false, isWritable: true },

        { pubkey: srcBPublicKey, isSigner: false, isWritable: true },
        { pubkey: mintBPublicKey, isSigner: false, isWritable: false },
        { pubkey: treasuryBPublicKey, isSigner: false, isWritable: true },

        { pubkey: treasurerPublicKey, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: this.spltProgramId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: this.splataProgramId, isSigner: false, isWritable: false },
      ],
      programId: this.swapProgramId,
      data: layout.toBuffer()
    });
    transaction.add(instruction);
    transaction.feePayer = payerPublicKey;
    // Sign tx
    const payerSig = await wallet.sign(transaction);
    this._addSignature(transaction, payerSig);
    const poolSig = await this._selfSign(transaction, pool);
    this._addSignature(transaction, poolSig);
    const vaultSig = await this._selfSign(transaction, vault);
    this._addSignature(transaction, vaultSig);
    // Send tx
    const txId = await this._sendTransaction(transaction);
    return txId;
  }

  initializeLPT = async (lptAccountOrAddress, mintLPTAddress, wallet) => {
    return await this._splt.initializeAccount(lptAccountOrAddress, mintLPTAddress, wallet);
  }

  addLiquidity = async (
    deltaS, deltaA, deltaB,
    poolAddress, lptAddress, mintLPTAddress,
    srcSAddress, mintSAddress,
    srcAAddress, mintAAddress,
    srcBAddress, mintBAddress,
    wallet
  ) => {
    if (!srcSAddress && !srcAAddress && !srcBAddress) throw new Error('Invalid source address');
    srcSAddress = srcSAddress || DEFAULT_EMPTY_ADDRESS;
    srcAAddress = srcAAddress || DEFAULT_EMPTY_ADDRESS;
    srcBAddress = srcBAddress || DEFAULT_EMPTY_ADDRESS;
    if (!account.isAddress(poolAddress)) throw new Error('Invalid pool address');
    if (!account.isAddress(lptAddress)) throw new Error('Invalid lpt address');
    if (!account.isAddress(mintLPTAddress)) throw new Error('Invalid mint LPT address');
    if (!account.isAddress(srcSAddress)) throw new Error('Invalid source S address');
    if (!account.isAddress(mintSAddress)) throw new Error('Invalid mint S address');
    if (!account.isAddress(srcAAddress)) throw new Error('Invalid source A address');
    if (!account.isAddress(mintAAddress)) throw new Error('Invalid mint A address');
    if (!account.isAddress(srcBAddress)) throw new Error('Invalid source B address');
    if (!account.isAddress(mintBAddress)) throw new Error('Invalid mint B address');
    const poolPublicKey = account.fromAddress(poolAddress);
    const lptPublicKey = account.fromAddress(lptAddress);
    const mintLPTPublicKey = account.fromAddress(mintLPTAddress);
    const srcSPublicKey = account.fromAddress(srcSAddress);
    const srcAPublicKey = account.fromAddress(srcAAddress);
    const srcBPublicKey = account.fromAddress(srcBAddress);
    // Get payer
    const payerAddress = await wallet.getAccount();
    const payerPublicKey = account.fromAddress(payerAddress);
    // Get treasurer
    const seed = [poolPublicKey.toBuffer()];
    const treasurerPublicKey = await PublicKey.createProgramAddress(seed, this.swapProgramId);
    const treasurerAddress = treasurerPublicKey.toBase58();
    // Get treasury S, A, B
    const [treasurySPublicKey, treasuryAPublicKey, treasuryBPublicKey] = (await this._deriveTreasuryAddresses(
      treasurerAddress,
      [mintSAddress, mintAAddress, mintBAddress]
    )).map(treasuryAddress => account.fromAddress(treasuryAddress));
    // Build tx
    let transaction = new Transaction();
    transaction = await this._addRecentCommitment(transaction);
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
    // Sign tx
    const payerSig = await wallet.sign(transaction);
    this._addSignature(transaction, payerSig);
    // Send tx
    const txId = await this._sendTransaction(transaction);
    return txId;
  }

  removeLiquidity = async (
    lpt,
    poolAddress, lptAddress, mintLPTAddress,
    dstSAddress, mintSAddress,
    dstAAddress, mintAAddress,
    dstBAddress, mintBAddress,
    wallet
  ) => {
    if (!account.isAddress(poolAddress)) throw new Error('Invalid pool address');
    if (!account.isAddress(lptAddress)) throw new Error('Invalid lpt address');
    if (!account.isAddress(mintLPTAddress)) throw new Error('Invalid mint LPT address');
    if (!account.isAddress(dstSAddress)) throw new Error('Invalid destination S address');
    if (!account.isAddress(mintSAddress)) throw new Error('Invalid mint S address');
    if (!account.isAddress(dstAAddress)) throw new Error('Invalid destination A address');
    if (!account.isAddress(mintAAddress)) throw new Error('Invalid mint A address');
    if (!account.isAddress(dstBAddress)) throw new Error('Invalid destination B address');
    if (!account.isAddress(mintBAddress)) throw new Error('Invalid mint B address');
    const poolPublicKey = account.fromAddress(poolAddress);
    const lptPublicKey = account.fromAddress(lptAddress);
    const mintLPTPublicKey = account.fromAddress(mintLPTAddress);
    const dstSPublicKey = account.fromAddress(dstSAddress);
    const dstAPublicKey = account.fromAddress(dstAAddress);
    const dstBPublicKey = account.fromAddress(dstBAddress);
    // Get payer
    const payerAddress = await wallet.getAccount();
    const payerPublicKey = account.fromAddress(payerAddress);
    // Get treasurer
    const seed = [poolPublicKey.toBuffer()];
    const treasurerPublicKey = await PublicKey.createProgramAddress(seed, this.swapProgramId);
    const treasurerAddress = treasurerPublicKey.toBase58();
    // Get treasury S, A, B
    const [treasurySPublicKey, treasuryAPublicKey, treasuryBPublicKey] = (await this._deriveTreasuryAddresses(
      treasurerAddress,
      [mintSAddress, mintAAddress, mintBAddress]
    )).map(treasuryAddress => account.fromAddress(treasuryAddress));
    // Build tx
    let transaction = new Transaction();
    transaction = await this._addRecentCommitment(transaction);
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
    // Sign tx
    const payerSig = await wallet.sign(transaction);
    this._addSignature(transaction, payerSig);
    // Send tx
    const txId = await this._sendTransaction(transaction);
    return txId;
  }

  swap = async (
    amount, limit,
    poolAddress, vaultAddress,
    srcAddress, mintBidAddress,
    dstAddress, mintAskAddress,
    treasurySenAddress,
    wallet,
  ) => {
    if (!account.isAddress(poolAddress)) throw new Error('Invalid pool address');
    if (!account.isAddress(vaultAddress)) throw new Error('Invalid vault address');
    if (!account.isAddress(srcAddress)) throw new Error('Invalid source address');
    if (!account.isAddress(mintBidAddress)) throw new Error('Invalid mint bid address');
    if (!account.isAddress(dstAddress)) throw new Error('Invalid destination address');
    if (!account.isAddress(mintAskAddress)) throw new Error('Invalid mint ask address');
    if (!account.isAddress(treasurySenAddress)) throw new Error('Invalid treasury sen address');
    const poolPublicKey = account.fromAddress(poolAddress);
    const vaultPublicKey = account.fromAddress(vaultAddress);
    const srcPublicKey = account.fromAddress(srcAddress);
    const dstPublicKey = account.fromAddress(dstAddress);
    const treasurySenPublicKey = account.fromAddress(treasurySenAddress);
    // Get payer
    const payerAddress = await wallet.getAccount();
    const payerPublicKey = account.fromAddress(payerAddress);
    // Get treasurer
    const seed = [poolPublicKey.toBuffer()];
    const treasurerPublicKey = await PublicKey.createProgramAddress(seed, this.swapProgramId);
    const treasurerAddress = treasurerPublicKey.toBase58();
    // get treasury bid, ask
    const [treasuryBidPublicKey, treasuryAskPublicKey] = (await this._deriveTreasuryAddresses(
      treasurerAddress,
      [mintBidAddress, mintAskAddress]
    )).map(treasuryAddress => account.fromAddress(treasuryAddress));
    // Build tx
    let transaction = new Transaction();
    transaction = await this._addRecentCommitment(transaction);
    const layout = new soproxABI.struct([
      { key: 'code', type: 'u8' },
      { key: 'amount', type: 'u64' },
      { key: 'limit', type: 'u64' }
    ], { code: 3, amount, limit });
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
    // Sign tx
    const payerSig = await wallet.sign(transaction);
    this._addSignature(transaction, payerSig);
    // Send tx
    const txId = await this._sendTransaction(transaction);
    return txId;
  }

  transfer = async (lpt, srcLPTAddress, dstLPTAddress, wallet) => {
    return await this._splt.transfer(lpt, srcLPTAddress, dstLPTAddress, wallet);
  }

  freezePool = async (poolAddress, wallet) => {
    if (!account.isAddress(poolAddress)) throw new Error('Invalid pool address');
    const poolPublicKey = account.fromAddress(poolAddress);
    // Get payer
    const payerAddress = await wallet.getAccount();
    const payerPublicKey = account.fromAddress(payerAddress);
    // Build tx
    let transaction = new Transaction();
    transaction = await this._addRecentCommitment(transaction);
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
    // Sign tx
    const payerSig = await wallet.sign(transaction);
    this._addSignature(transaction, payerSig);
    // Send tx
    const txId = await this._sendTransaction(transaction);
    return txId;
  }

  thawPool = async (poolAddress, wallet) => {
    if (!account.isAddress(poolAddress)) throw new Error('Invalid pool address');
    const poolPublicKey = account.fromAddress(poolAddress);
    // Get payer
    const payerAddress = await wallet.getAccount();
    const payerPublicKey = account.fromAddress(payerAddress);
    // Build tx
    let transaction = new Transaction();
    transaction = await this._addRecentCommitment(transaction);
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
    // Sign tx
    const payerSig = await wallet.sign(transaction);
    this._addSignature(transaction, payerSig);
    // Send tx
    const txId = await this._sendTransaction(transaction);
    return txId;
  }

  earn = async (amount, poolAddress, vaultAddress, dstAddress, wallet) => {
    if (!account.isAddress(poolAddress)) throw new Error('Invalid pool address');
    if (!account.isAddress(vaultAddress)) throw new Error('Invalid vault address');
    if (!account.isAddress(dstAddress)) throw new Error('Invalid destination address');
    const poolPublicKey = account.fromAddress(poolAddress);
    const vaultPublicKey = account.fromAddress(vaultAddress);
    const dstPublicKey = account.fromAddress(dstAddress);
    // Get payer
    const payerAddress = await wallet.getAccount();
    const payerPublicKey = account.fromAddress(payerAddress);
    // Get treasurer
    const seed = [poolPublicKey.toBuffer()];
    const treasurerPublicKey = await PublicKey.createProgramAddress(seed, this.swapProgramId);
    // build tx
    let transaction = new Transaction();
    transaction = await this._addRecentCommitment(transaction);
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
    // Sign tx
    const payerSig = await wallet.sign(transaction);
    this._addSignature(transaction, payerSig);
    // Send tx
    const txId = await this._sendTransaction(transaction);
    return txId;
  }

  closeLPT = async (lptAddress, wallet) => {
    return await this._splt.closeAccount(lptAddress, wallet);
  }

  transferPoolOwnership = async (poolAddress, newOwnerAddress, wallet) => {
    if (!account.isAddress(poolAddress)) throw new Error('Invalid pool address');
    if (!account.isAddress(newOwnerAddress)) throw new Error('Invalid new owner address');
    const poolPublicKey = account.fromAddress(poolAddress);
    const newOwnerPublicKey = account.fromAddress(newOwnerAddress);
    // Get payer
    const payerAddress = await wallet.getAccount();
    const payerPublicKey = account.fromAddress(payerAddress);
    // Build tx
    let transaction = new Transaction();
    transaction = await this._addRecentCommitment(transaction);
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
    // Sign tx
    const payerSig = await wallet.sign(transaction);
    this._addSignature(transaction, payerSig);
    // Send tx
    const txId = await this._sendTransaction(transaction);
    return txId;
  }
}

module.exports = Swap;