const {
  Transaction, SystemProgram, TransactionInstruction,
  SYSVAR_RENT_PUBKEY, PublicKey
} = require('@solana/web3.js');
const soproxABI = require('soprox-abi');
const xor = require('buffer-xor');

const Tx = require('./core/tx');
const { SPLT } = require('./splt');
const account = require('./account');
const schema = require('./schema');
const {
  DEFAULT_SPLT_PROGRAM_ADDRESS,
  DEFAULT_SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ADDRESS,
  DEFAULT_FARMING_PROGRAM_ADDRESS,
} = require('./defaults');


class Farming extends Tx {
  constructor(
    farmingProgramAddress = DEFAULT_FARMING_PROGRAM_ADDRESS,
    spltProgramAddress = DEFAULT_SPLT_PROGRAM_ADDRESS,
    splataProgramAddress = DEFAULT_SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ADDRESS,
    nodeUrl,
  ) {
    super(nodeUrl);

    if (!account.isAddress(farmingProgramAddress)) throw new Error('Invalid farming program address');
    if (!account.isAddress(spltProgramAddress)) throw new Error('Invalid SPL token program address');
    if (!account.isAddress(splataProgramAddress)) throw new Error('Invalid SPL associated token program address');
    this.farmingProgramId = account.fromAddress(farmingProgramAddress);
    this.spltProgramId = account.fromAddress(spltProgramAddress);
    this.splataProgramId = account.fromAddress(splataProgramAddress);

    this._splt = new SPLT(spltProgramAddress, splataProgramAddress, nodeUrl);
  }

  watchAndFetch = (callback) => {
    return this.watch((er, re) => {
      if (er) return callback(er, null);
      const { type, address } = re;
      let getData = () => { }
      if (type === 'stake_pool') getData = this.getStakePoolData;
      return getData(address).then(data => {
        return callback(null, data);
      }).catch(er => {
        return callback(er, null);
      });
    });
  }

  watch = (callback) => {
    return this.connection.onProgramAccountChange(this.farmingProgramId, ({ accountId, accountInfo: { data } }) => {
      const address = accountId.toBase58();
      const stakePoolSpace = (new soproxABI.struct(schema.STAKE_POOL_SCHEMA)).space;
      let type = null;
      if (data.length === stakePoolSpace) type = 'stake_pool';
      if (!type) return callback('Unmatched type', null);
      return callback(null, { type, address });
    });
  }

  _genProofAddress = async (stakePoolAddress) => {
    if (!account.isAddress(stakePoolAddress)) throw new Error('Invalid stake pool address');
    const stakePoolPublicKey = account.fromAddress(stakePoolAddress);
    const seed = [stakePoolPublicKey.toBuffer()];
    const treasurerPublicKey = await PublicKey.createProgramAddress(seed, this.farmingProgramId);
    const proof = new PublicKey(xor(this.farmingProgramId.toBuffer(),
      xor(stakePoolPublicKey.toBuffer(), treasurerPublicKey.toBuffer())
    ));
    return proof.toBase58();
  }

  deriveStakePoolAddress = async (mintAuthorityAddress, freezeAuthorityAddress) => {
    if (!account.isAddress(mintAuthorityAddress)) throw new Error('Invalid mint authority address');
    if (!account.isAddress(freezeAuthorityAddress)) throw new Error('Invalid freeze authority address');

    const mintAuthorityPublicKey = account.fromAddress(mintAuthorityAddress);
    const freezeAuthorityPublicKey = account.fromAddress(freezeAuthorityAddress); // Proof of mint LPT
    const stakePoolPublicKey = new PublicKey(xor(this.farmingProgramId.toBuffer(),
      xor(freezeAuthorityPublicKey.toBuffer(), mintAuthorityPublicKey.toBuffer())
    ));
    const seed = [stakePoolPublicKey.toBuffer()];
    const treasurerPublicKey = await PublicKey.createProgramAddress(seed, this.farmingProgramId);
    if (treasurerPublicKey.toBase58() != mintAuthorityPublicKey.toBase58()) return null;
    return stakePoolPublicKey.toBase58();
  }

  _getAccountLiteData = async (accountAddress) => {
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

  _deriveDebtAddress = async (ownerAddress, stakePoolAddress) => {
    if (!account.isAddress(ownerAddress)) throw new Error('Invalid owner address');
    if (!account.isAddress(stakePoolAddress)) throw new Error('Invalid stake pool address');
    const ownerPublicKey = account.fromAddress(ownerAddress);
    const stakePoolPublicKey = account.fromAddress(stakePoolAddress);
    const seeds = [ownerPublicKey.toBuffer(), stakePoolPublicKey.toBuffer(), this.farmingProgramId.toBuffer()];
    const [debtPublicKey, _] = await PublicKey.findProgramAddress(seeds, this.farmingProgramId);
    return debtPublicKey.toBase58();
  }

  getStakePoolData = async (stakePoolAddress) => {
    if (!account.isAddress(stakePoolAddress)) throw new Error('Invalid stake pool address');
    const stakePoolPublicKey = account.fromAddress(stakePoolAddress);
    let result = { address: stakePoolAddress }
    const { data: stakePoolData } = await this.connection.getAccountInfo(stakePoolPublicKey) || {};
    if (!stakePoolData) throw new Error(`Cannot read data of ${result.address}`);
    const stakePoolLayout = new soproxABI.struct(schema.STAKE_POOL_SCHEMA);
    if (stakePoolData.length !== stakePoolLayout.space) throw new Error('Unmatched buffer length');
    stakePoolLayout.fromBuffer(stakePoolData);
    result = {
      ...result, ...stakePoolLayout.value,
      mint_share: { address: stakePoolLayout.value.mint_share },
      mint_token: { address: stakePoolLayout.value.mint_token },
      treasury_token: { address: stakePoolLayout.value.treasury_token },
      treasury_sen: { address: stakePoolLayout.value.treasury_sen },
    }
    const mintShareData = await this._splt.getMintData(result.mint_share.address);
    result.mint_share = { ...result.mint_share, ...mintShareData };
    const mintTokenData = await this._splt.getMintData(result.mint_token.address);
    result.mint_token = { ...result.mint_token, ...mintTokenData };
    const treasuryTokenData = await this._getAccountLiteData(result.treasury_token.address);
    result.treasury_token = { ...result.treasury_token, ...treasuryTokenData };
    const treasurySenData = await this._getAccountLiteData(result.treasury_sen.address);
    result.treasury_sen = { ...result.treasury_sen, ...treasurySenData };
    return result;
  }

  getSharesData = async (shareAddress) => {
    return await this._splt.getAccountData(shareAddress);
  }

  getDebtData = async (debtAddress) => {
    if (!account.isAddress(debtAddress)) throw new Error('Invalid debt address');
    const debtPublicKey = account.fromAddress(debtAddress);
    let result = { address: debtAddress }
    const { data: debtData } = await this.connection.getAccountInfo(debtPublicKey) || {};
    if (!debtData) throw new Error(`Cannot read data of ${result.address}`);
    const debtLayout = new soproxABI.struct(schema.DEBT_SCHEMA);
    if (debtData.length !== debtLayout.space) throw new Error('Unmatched buffer length');
    debtLayout.fromBuffer(debtData);
    result = {
      ...result, ...debtLayout.value,
      stake_pool: { address: debtLayout.value.stake_pool },
      account: { address: debtLayout.value.account },
    }
    const stakePoolData = await this.getStakePoolData(result.stake_pool.address);
    result.stake_pool = { ...result.stake_pool, ...stakePoolData };
    const accountData = await this.getSharesData(result.account.address);
    result.account = { ...result.account, ...accountData };
    return result;
  }

  initializeStakePool = async (
    reward, period,
    ownerAddress, stakePool, mintShare,
    mintTokenAddress, mintSenAddress,
    wallet
  ) => {
    if (!account.isAddress(ownerAddress)) throw new Error('Invalid owner address');
    if (!account.isAddress(mintTokenAddress)) throw new Error('Invalid mint address');
    if (!account.isAddress(mintSenAddress)) throw new Error('Invalid SEN address');
    const ownerPublicKey = account.fromAddress(ownerAddress);
    const mintTokenPublicKey = account.fromAddress(mintTokenAddress);
    const mintSenPublicKey = account.fromAddress(mintSenAddress);
    // Get payer
    const payerAddress = await wallet.getAccount();
    const payerPublicKey = account.fromAddress(payerAddress);
    // Get treasurer
    const seed = [stakePool.publicKey.toBuffer()];
    const treasurerPublicKey = await PublicKey.createProgramAddress(seed, this.farmingProgramId);
    const treasurerAddress = treasurerPublicKey.toBase58();
    // Get treasury S, A, B
    const [treasuryTokenPublicKey, treasurySenPublicKey] = (await this._deriveTreasuryAddresses(
      treasurerAddress,
      [mintTokenAddress, mintSenAddress]
    )).map(treasuryAddress => account.fromAddress(treasuryAddress));
    // Rent stake pool
    const stakePoolSpace = (new soproxABI.struct(schema.STAKE_POOL_SCHEMA)).space;
    await this._rentAccount(wallet, stakePool, stakePoolSpace, this.farmingProgramId);
    // Rent mint
    const mintSpace = (new soproxABI.struct(schema.MINT_SCHEMA)).space;
    await this._rentAccount(wallet, mintShare, mintSpace, this.spltProgramId);
    // Generate proof
    const proofAddress = await this._genProofAddress(stakePool.publicKey.toBase58());
    const proofPublicKey = account.fromAddress(proofAddress);
    // Build tx
    let transaction = new Transaction();
    transaction = await this._addRecentCommitment(transaction);
    const layout = new soproxABI.struct([
      { key: 'code', type: 'u8' },
      { key: 'reward', type: 'u64' },
      { key: 'period', type: 'u64' },
    ], { code: 0, reward, period });
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: payerPublicKey, isSigner: true, isWritable: true },
        { pubkey: ownerPublicKey, isSigner: false, isWritable: false },
        { pubkey: stakePool.publicKey, isSigner: true, isWritable: true },
        { pubkey: mintShare.publicKey, isSigner: false, isWritable: true },
        { pubkey: proofPublicKey, isSigner: false, isWritable: false },

        { pubkey: mintTokenPublicKey, isSigner: false, isWritable: false },
        { pubkey: treasuryTokenPublicKey, isSigner: false, isWritable: true },

        { pubkey: mintSenPublicKey, isSigner: false, isWritable: false },
        { pubkey: treasurySenPublicKey, isSigner: false, isWritable: true },
        { pubkey: treasurerPublicKey, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: this.spltProgramId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: this.splataProgramId, isSigner: false, isWritable: false },
      ],
      programId: this.farmingProgramId,
      data: layout.toBuffer()
    });
    transaction.add(instruction);
    transaction.feePayer = payerPublicKey;
    // Sign tx
    const payerSig = await wallet.sign(transaction);
    this._addSignature(transaction, payerSig);
    const stakePoolSig = await this._selfSign(transaction, stakePool);
    this._addSignature(transaction, stakePoolSig);
    // Send tx
    const txId = await this._sendTransaction(transaction);
    return txId;
  }

  initializeAccount = async (ownerAddress, stakePoolAddress, mintShareAddress, wallet) => {
    if (!account.isAddress(ownerAddress)) throw new Error('Invalid owner address');
    if (!account.isAddress(stakePoolAddress)) throw new Error('Invalid stake pool address');
    if (!account.isAddress(mintShareAddress)) throw new Error('Invalid mint share address');
    const ownerPublicKey = account.fromAddress(ownerAddress);
    const stakePoolPublicKey = account.fromAddress(stakePoolAddress);
    const mintSharePublicKey = account.fromAddress(mintShareAddress);
    // Get payer
    const payerAddress = await wallet.getAccount();
    const payerPublicKey = account.fromAddress(payerAddress);
    // Get share address
    const shareAddress = await account.deriveAssociatedAddress(
      ownerAddress,
      mintShareAddress,
      this.spltProgramId.toBase58(),
      this.splataProgramId.toBase58(),
    );
    const sharePublicKey = account.fromAddress(shareAddress);
    // Get debt address
    const debtAddress = await this._deriveDebtAddress(ownerAddress, stakePoolAddress);
    const debtPublicKey = account.fromAddress(debtAddress);
    // Build tx
    let transaction = new Transaction();
    transaction = await this._addRecentCommitment(transaction);
    const layout = new soproxABI.struct([{ key: 'code', type: 'u8' },], { code: 1 });
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: payerPublicKey, isSigner: true, isWritable: true },
        { pubkey: ownerPublicKey, isSigner: false, isWritable: false },
        { pubkey: stakePoolPublicKey, isSigner: false, isWritable: false },
        { pubkey: mintSharePublicKey, isSigner: false, isWritable: false },

        { pubkey: sharePublicKey, isSigner: false, isWritable: true },
        { pubkey: debtPublicKey, isSigner: false, isWritable: true },

        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: this.spltProgramId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: this.splataProgramId, isSigner: false, isWritable: false },
      ],
      programId: this.farmingProgramId,
      data: layout.toBuffer()
    });
    transaction.add(instruction);
    transaction.feePayer = payerPublicKey;
    // Sign tx
    const payerSig = await wallet.sign(transaction);
    this._addSignature(transaction, payerSig);
    // Send tx
    const txId = await this._sendTransaction(transaction);
    return { txId, shareAddress, debtAddress }
  }

  stake = async (
    amount,
    stakePoolAddress, mintShareAddress,
    srcAddress, treasuryTokenAddress,
    shareAddress, debtAddress,
    dstSenAddress, treasurySenAddress,
    wallet,
  ) => {
    if (!account.isAddress(stakePoolAddress)) throw new Error('Invalid stake pool address');
    if (!account.isAddress(mintShareAddress)) throw new Error('Invalid mint share address');
    if (!account.isAddress(srcAddress)) throw new Error('Invalid source address');
    if (!account.isAddress(treasuryTokenAddress)) throw new Error('Invalid treasury address');
    if (!account.isAddress(shareAddress)) throw new Error('Invalid share address');
    if (!account.isAddress(debtAddress)) throw new Error('Invalid debt address');
    if (!account.isAddress(dstSenAddress)) throw new Error('Invalid destination address');
    if (!account.isAddress(treasurySenAddress)) throw new Error('Invalid treasury address');
    const stakePoolPublicKey = account.fromAddress(stakePoolAddress);
    const mintSharePublicKey = account.fromAddress(mintShareAddress);
    const srcPublicKey = account.fromAddress(srcAddress);
    const treasuryTokenPublicKey = account.fromAddress(treasuryTokenAddress);
    const sharePublicKey = account.fromAddress(shareAddress);
    const debtPublicKey = account.fromAddress(debtAddress);
    const dstSenPublicKey = account.fromAddress(dstSenAddress);
    const treasurySenPublicKey = account.fromAddress(treasurySenAddress);
    // Get payer
    const payerAddress = await wallet.getAccount();
    const payerPublicKey = account.fromAddress(payerAddress);
    // Get treasurer
    const seed = [stakePoolPublicKey.toBuffer()];
    const treasurerPublicKey = await PublicKey.createProgramAddress(seed, this.farmingProgramId);
    // Build tx
    let transaction = new Transaction();
    transaction = await this._addRecentCommitment(transaction);
    const layout = new soproxABI.struct([
      { key: 'code', type: 'u8' },
      { key: 'amount', type: 'u64' },
    ], { code: 2, amount });
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: payerPublicKey, isSigner: true, isWritable: true },
        { pubkey: stakePoolPublicKey, isSigner: false, isWritable: true },
        { pubkey: mintSharePublicKey, isSigner: false, isWritable: true },

        { pubkey: srcPublicKey, isSigner: false, isWritable: true },
        { pubkey: treasuryTokenPublicKey, isSigner: false, isWritable: true },

        { pubkey: sharePublicKey, isSigner: false, isWritable: true },
        { pubkey: debtPublicKey, isSigner: false, isWritable: true },

        { pubkey: dstSenPublicKey, isSigner: false, isWritable: true },
        { pubkey: treasurySenPublicKey, isSigner: false, isWritable: true },

        { pubkey: treasurerPublicKey, isSigner: false, isWritable: false },
        { pubkey: this.spltProgramId, isSigner: false, isWritable: false },
      ],
      programId: this.farmingProgramId,
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

  unstake = async (
    amount,
    stakePoolAddress, mintShareAddress,
    dstAddress, treasuryTokenAddress,
    shareAddress, debtAddress,
    dstSenAddress, treasurySenAddress,
    wallet,
  ) => {
    if (!account.isAddress(stakePoolAddress)) throw new Error('Invalid stake pool address');
    if (!account.isAddress(mintShareAddress)) throw new Error('Invalid mint share address');
    if (!account.isAddress(dstAddress)) throw new Error('Invalid destination address');
    if (!account.isAddress(treasuryTokenAddress)) throw new Error('Invalid treasury address');
    if (!account.isAddress(shareAddress)) throw new Error('Invalid share address');
    if (!account.isAddress(debtAddress)) throw new Error('Invalid debt address');
    if (!account.isAddress(dstSenAddress)) throw new Error('Invalid destination address');
    if (!account.isAddress(treasurySenAddress)) throw new Error('Invalid treasury address');
    const stakePoolPublicKey = account.fromAddress(stakePoolAddress);
    const mintSharePublicKey = account.fromAddress(mintShareAddress);
    const dstPublicKey = account.fromAddress(dstAddress);
    const treasuryTokenPublicKey = account.fromAddress(treasuryTokenAddress);
    const sharePublicKey = account.fromAddress(shareAddress);
    const debtPublicKey = account.fromAddress(debtAddress);
    const dstSenPublicKey = account.fromAddress(dstSenAddress);
    const treasurySenPublicKey = account.fromAddress(treasurySenAddress);
    // Get payer
    const payerAddress = await wallet.getAccount();
    const payerPublicKey = account.fromAddress(payerAddress);
    // Get treasurer
    const seed = [stakePoolPublicKey.toBuffer()];
    const treasurerPublicKey = await PublicKey.createProgramAddress(seed, this.farmingProgramId);
    // Build tx
    let transaction = new Transaction();
    transaction = await this._addRecentCommitment(transaction);
    const layout = new soproxABI.struct([
      { key: 'code', type: 'u8' },
      { key: 'amount', type: 'u64' },
    ], { code: 3, amount });
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: payerPublicKey, isSigner: true, isWritable: true },
        { pubkey: stakePoolPublicKey, isSigner: false, isWritable: true },
        { pubkey: mintSharePublicKey, isSigner: false, isWritable: true },

        { pubkey: dstPublicKey, isSigner: false, isWritable: true },
        { pubkey: treasuryTokenPublicKey, isSigner: false, isWritable: true },

        { pubkey: sharePublicKey, isSigner: false, isWritable: true },
        { pubkey: debtPublicKey, isSigner: false, isWritable: true },

        { pubkey: dstSenPublicKey, isSigner: false, isWritable: true },
        { pubkey: treasurySenPublicKey, isSigner: false, isWritable: true },

        { pubkey: treasurerPublicKey, isSigner: false, isWritable: false },
        { pubkey: this.spltProgramId, isSigner: false, isWritable: false },
      ],
      programId: this.farmingProgramId,
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

  havest = async (
    stakePoolAddress, mintShareAddress,
    shareAddress, debtAddress,
    dstSenAddress, treasurySenAddress,
    wallet
  ) => {
    if (!account.isAddress(stakePoolAddress)) throw new Error('Invalid stake pool address');
    if (!account.isAddress(mintShareAddress)) throw new Error('Invalid mint share address');
    if (!account.isAddress(shareAddress)) throw new Error('Invalid share address');
    if (!account.isAddress(debtAddress)) throw new Error('Invalid debt address');
    if (!account.isAddress(dstSenAddress)) throw new Error('Invalid destination address');
    if (!account.isAddress(treasurySenAddress)) throw new Error('Invalid treasury address');
    const stakePoolPublicKey = account.fromAddress(stakePoolAddress);
    const mintSharePublicKey = account.fromAddress(mintShareAddress);
    const sharePublicKey = account.fromAddress(shareAddress);
    const debtPublicKey = account.fromAddress(debtAddress);
    const dstSenPublicKey = account.fromAddress(dstSenAddress);
    const treasurySenPublicKey = account.fromAddress(treasurySenAddress);
    // Get payer
    const payerAddress = await wallet.getAccount();
    const payerPublicKey = account.fromAddress(payerAddress);
    // Get treasurer
    const seed = [stakePoolPublicKey.toBuffer()];
    const treasurerPublicKey = await PublicKey.createProgramAddress(seed, this.farmingProgramId);
    // Build tx
    let transaction = new Transaction();
    transaction = await this._addRecentCommitment(transaction);
    const layout = new soproxABI.struct([{ key: 'code', type: 'u8' }], { code: 4 });
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: payerPublicKey, isSigner: true, isWritable: true },
        { pubkey: stakePoolPublicKey, isSigner: false, isWritable: true },
        { pubkey: mintSharePublicKey, isSigner: false, isWritable: true },

        { pubkey: sharePublicKey, isSigner: false, isWritable: true },
        { pubkey: debtPublicKey, isSigner: false, isWritable: true },

        { pubkey: dstSenPublicKey, isSigner: false, isWritable: true },
        { pubkey: treasurySenPublicKey, isSigner: false, isWritable: true },

        { pubkey: treasurerPublicKey, isSigner: false, isWritable: false },
        { pubkey: this.spltProgramId, isSigner: false, isWritable: false },
      ],
      programId: this.farmingProgramId,
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

  seed = async (amount, stakePoolAddress, srcSenAddress, treasurySenAddress, wallet) => {
    if (!account.isAddress(stakePoolAddress)) throw new Error('Invalid stake pool address');
    if (!account.isAddress(srcSenAddress)) throw new Error('Invalid source address');
    if (!account.isAddress(treasurySenAddress)) throw new Error('Invalid treasury address');
    const stakePoolPublicKey = account.fromAddress(stakePoolAddress);
    const srcSenPublicKey = account.fromAddress(srcSenAddress);
    const treasurySenPublicKey = account.fromAddress(treasurySenAddress);
    // Get payer
    const payerAddress = await wallet.getAccount();
    const payerPublicKey = account.fromAddress(payerAddress);
    // Build tx
    let transaction = new Transaction();
    transaction = await this._addRecentCommitment(transaction);
    const layout = new soproxABI.struct([
      { key: 'code', type: 'u8' }, { key: 'amount', type: 'u64' }
    ], { code: 7, amount });
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: payerPublicKey, isSigner: true, isWritable: true },
        { pubkey: stakePoolPublicKey, isSigner: false, isWritable: true },
        { pubkey: srcSenPublicKey, isSigner: false, isWritable: true },
        { pubkey: treasurySenPublicKey, isSigner: false, isWritable: true },
        { pubkey: this.spltProgramId, isSigner: false, isWritable: false },
      ],
      programId: this.farmingProgramId,
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

  unseed = async (amount, stakePoolAddress, dstSenAddress, treasurySenAddress, wallet) => {
    if (!account.isAddress(stakePoolAddress)) throw new Error('Invalid stake pool address');
    if (!account.isAddress(dstSenAddress)) throw new Error('Invalid destination address');
    if (!account.isAddress(treasurySenAddress)) throw new Error('Invalid treasury address');
    const stakePoolPublicKey = account.fromAddress(stakePoolAddress);
    const dstSenPublicKey = account.fromAddress(dstSenAddress);
    const treasurySenPublicKey = account.fromAddress(treasurySenAddress);
    // Get payer
    const payerAddress = await wallet.getAccount();
    const payerPublicKey = account.fromAddress(payerAddress);
    // Get treasurer
    const seed = [stakePoolPublicKey.toBuffer()];
    const treasurerPublicKey = await PublicKey.createProgramAddress(seed, this.farmingProgramId);
    // Build tx
    let transaction = new Transaction();
    transaction = await this._addRecentCommitment(transaction);
    const layout = new soproxABI.struct([
      { key: 'code', type: 'u8' }, { key: 'amount', type: 'u64' }
    ], { code: 8, amount });
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: payerPublicKey, isSigner: true, isWritable: true },
        { pubkey: stakePoolPublicKey, isSigner: false, isWritable: true },
        { pubkey: dstSenPublicKey, isSigner: false, isWritable: true },
        { pubkey: treasurySenPublicKey, isSigner: false, isWritable: true },
        { pubkey: treasurerPublicKey, isSigner: false, isWritable: false },
        { pubkey: this.spltProgramId, isSigner: false, isWritable: false },
      ],
      programId: this.farmingProgramId,
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

  freezeStakePool = async (stakePoolAddress, wallet) => {
    if (!account.isAddress(stakePoolAddress)) throw new Error('Invalid stake pool address');
    const stakePoolPublicKey = account.fromAddress(stakePoolAddress);
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
        { pubkey: stakePoolPublicKey, isSigner: false, isWritable: true },
      ],
      programId: this.farmingProgramId,
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

  thawStakePool = async (stakePoolAddress, wallet) => {
    if (!account.isAddress(stakePoolAddress)) throw new Error('Invalid stake pool address');
    const stakePoolPublicKey = account.fromAddress(stakePoolAddress);
    // Get payer
    const payerAddress = await wallet.getAccount();
    const payerPublicKey = account.fromAddress(payerAddress);
    // Build tx
    let transaction = new Transaction();
    transaction = await this._addRecentCommitment(transaction);
    const layout = new soproxABI.struct([{ key: 'code', type: 'u8' }], { code: 6 });
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: payerPublicKey, isSigner: true, isWritable: false },
        { pubkey: stakePoolPublicKey, isSigner: false, isWritable: true },
      ],
      programId: this.farmingProgramId,
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

  transfer = async (shares, srcShareAddress, dstShareAddress, wallet) => {
    return await this._splt.transfer(shares, srcShareAddress, dstShareAddress, wallet);
  }

  closeShare = async (shareAddress, wallet) => {
    return await this._splt.closeAccount(shareAddress, wallet);
  }

  transferStakePoolOwnership = async (stakePoolAddress, newOwnerAddress, wallet) => {
    if (!account.isAddress(stakePoolAddress)) throw new Error('Invalid stake pool address');
    if (!account.isAddress(newOwnerAddress)) throw new Error('Invalid new owner address');
    const stakePoolPublicKey = account.fromAddress(stakePoolAddress);
    const newOwnerPublicKey = account.fromAddress(newOwnerAddress);
    // Get payer
    const payerAddress = await wallet.getAccount();
    const payerPublicKey = account.fromAddress(payerAddress);
    // Build tx
    let transaction = new Transaction();
    transaction = await this._addRecentCommitment(transaction);
    const layout = new soproxABI.struct([{ key: 'code', type: 'u8' }], { code: 9 });
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: payerPublicKey, isSigner: true, isWritable: false },
        { pubkey: stakePoolPublicKey, isSigner: false, isWritable: true },
        { pubkey: newOwnerPublicKey, isSigner: false, isWritable: false },
      ],
      programId: this.farmingProgramId,
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

module.exports = Farming;