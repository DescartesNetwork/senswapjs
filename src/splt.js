const {
  Transaction, SystemProgram, TransactionInstruction,
  SYSVAR_RENT_PUBKEY
} = require('@solana/web3.js');
const soproxABI = require('soprox-abi');

const Tx = require('./core/tx');
const account = require('./account');
const schema = require('./schema');
const {
  DEFAULT_SPLT_PROGRAM_ADDRESS,
  DEFAULT_SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ADDRESS,
  DEFAULT_EMPTY_ADDRESSS
} = require('./default');

const AuthorityType = {
  get MintTokens() {
    return 0;
  },
  get FreezeAccount() {
    return 1;
  },
  get AccountOwner() {
    return 2;
  },
  get CloseAccount() {
    return 3;
  }
}

class SPLT extends Tx {
  constructor(
    spltProgramAddress = DEFAULT_SPLT_PROGRAM_ADDRESS,
    splataProgramAddress = DEFAULT_SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ADDRESS,
    nodeUrl,
  ) {
    super(nodeUrl);

    if (!account.isAddress(spltProgramAddress)) throw new Error('Invalid SPL token program address');
    if (!account.isAddress(splataProgramAddress)) throw new Error('Invalid SPL associated token program address');
    this.spltProgramId = account.fromAddress(spltProgramAddress);
    this.splataProgramId = account.fromAddress(splataProgramAddress);
  }

  watchAndFetch = (callback) => {
    return this.watch((er, re) => {
      if (er) return callback(er, null);
      const { type, address } = re;
      let getData = () => { }
      if (type === 'account') getData = this.getAccountData;
      if (type === 'mint') getData = this.getMintData;
      if (type === 'multisig') getData = this.getMultiSigData;
      return getData(address).then(data => {
        return callback(null, data);
      }).catch(er => {
        return callback(er, null);
      });
    });
  }

  watch = (callback) => {
    return this.connection.onProgramAccountChange(this.spltProgramId, ({ accountId, accountInfo: { data } }) => {
      const address = accountId.toBase58();
      const accountSpace = (new soproxABI.struct(schema.ACCOUNT_SCHEMA)).space;
      const mintSpace = (new soproxABI.struct(schema.MINT_SCHEMA)).space;
      const multisigSpace = (new soproxABI.struct(schema.MULTISIG_SCHEMA)).space;
      let type = null;
      if (data.length === accountSpace) type = 'account';
      if (data.length === mintSpace) type = 'mint';
      if (data.length === multisigSpace) type = 'multisig';
      if (!type) return callback('Unmatched type', null);
      return callback(null, { type, address });
    });
  }

  getMintData = async (mintAddress) => {
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

  getAccountData = async (accountAddress) => {
    if (!account.isAddress(accountAddress)) throw new Error('Invalid account address');
    const accountPublicKey = account.fromAddress(accountAddress);
    let result = { address: accountAddress }
    const { data } = await this.connection.getAccountInfo(accountPublicKey) || {};
    if (!data) throw new Error(`Cannot read data of ${accountAddress}`);
    const accountLayout = new soproxABI.struct(schema.ACCOUNT_SCHEMA);
    if (data.length !== accountLayout.space) throw new Error('Unmatched buffer length');
    accountLayout.fromBuffer(data);
    let mint = { address: accountLayout.value.mint }
    result = { ...result, ...accountLayout.value, mint }
    const mintData = await this.getMintData(result.mint.address);
    result.mint = { ...result.mint, ...mintData }
    return result;
  }

  getMultiSigData = async (multiSigAddress) => {
    if (!account.isAddress(multiSigAddress)) throw new Error('Invalid multiSig address');
    const multiSigPublicKey = account.fromAddress(multiSigAddress);
    const { data } = await this.connection.getAccountInfo(multiSigPublicKey) || {};
    if (!data) throw new Error(`Cannot read data of ${multiSigAddress}`);
    const multiSigLayout = new soproxABI.struct(schema.MULTISIG_SCHEMA);
    if (data.length !== multiSigLayout.space) throw new Error('Unmatched buffer length');
    multiSigLayout.fromBuffer(data);
    const result = { address: multiSigAddress, ...multiSigLayout.value }
    return result;
  }

  initializeMint = async (decimals, mintAuthorityAddress, freezeAuthorityAddress, mint, wallet) => {
    freezeAuthorityAddress = freezeAuthorityAddress || DEFAULT_EMPTY_ADDRESSS;
    if (!account.isAddress(mintAuthorityAddress)) throw new Error('Invalid mint authority address');
    if (!account.isAddress(freezeAuthorityAddress)) throw new Error('Invalid freeze authority address');
    // Get payer
    const payerAddress = await wallet.getAccount();
    const payerPublicKey = account.fromAddress(payerAddress);
    // Rent mint
    const mintSpace = (new soproxABI.struct(schema.MINT_SCHEMA)).space;
    await this._rentAccount(wallet, mint, mintSpace, this.spltProgramId);
    // Build tx
    let transaction = new Transaction();
    transaction = await this._addRecentCommitment(transaction);
    const layout = new soproxABI.struct([
      { key: 'code', type: 'u8' },
      { key: 'decimals', type: 'u8' },
      { key: 'mint_authority', type: 'pub' },
      { key: 'freeze_authority_option', type: 'u8' },
      { key: 'freeze_authority', type: 'pub' },
    ], {
      code: 0,
      decimals,
      mint_authority: mintAuthorityAddress,
      freeze_authority_option: freezeAuthorityAddress === DEFAULT_EMPTY_ADDRESSS ? 0 : 1,
      freeze_authority: freezeAuthorityAddress,
    });
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: mint.publicKey, isSigner: false, isWritable: true },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId: this.spltProgramId,
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

  initializeAccount = async (accountOrAddress, mintAddress, wallet, ownerAddress = null) => {
    if (!accountOrAddress) throw new Error('Invalid token account/address');
    const _initializeAccount = account.isAddress(accountOrAddress) ? this._initializeAssociatedAccount : this._initializeArbitraryAccount;
    const payerAddress = await wallet.getAccount();
    const txId = await _initializeAccount(accountOrAddress, ownerAddress || payerAddress, mintAddress, wallet);
    return txId;
  }

  _initializeArbitraryAccount = async (newAccount, ownerAddress, mintAddress, wallet) => {
    if (!account.isAddress(ownerAddress)) throw new Error('Invalid owner address');
    if (!account.isAddress(mintAddress)) throw new Error('Invalid mint address');
    const ownerPublicKey = account.fromAddress(ownerAddress);;
    const mintPublicKey = account.fromAddress(mintAddress);
    // Get payer
    const payerAddress = await wallet.getAccount();
    const payerPublicKey = account.fromAddress(payerAddress);
    // Rent account
    const accountSpace = (new soproxABI.struct(schema.ACCOUNT_SCHEMA)).space;
    await this._rentAccount(wallet, newAccount, accountSpace, this.spltProgramId);
    // Build tx
    let transaction = new Transaction();
    transaction = await this._addRecentCommitment(transaction);
    const layout = new soproxABI.struct([{ key: 'code', type: 'u8' }], { code: 1 });
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: newAccount.publicKey, isSigner: false, isWritable: true },
        { pubkey: mintPublicKey, isSigner: false, isWritable: false },
        { pubkey: ownerPublicKey, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId: this.spltProgramId,
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

  _initializeAssociatedAccount = async (accountAddress, ownerAddress, mintAddress, wallet) => {
    if (!account.isAddress(accountAddress)) throw new Error('Invalid account address');
    if (!account.isAddress(ownerAddress)) throw new Error('Invalid owner address');
    if (!account.isAddress(mintAddress)) throw new Error('Invalid mint address');
    const ownerPublicKey = account.fromAddress(ownerAddress);
    const accountPublicKey = account.fromAddress(accountAddress);
    const mintPublicKey = account.fromAddress(mintAddress);
    // Get payer
    const payerAddress = await wallet.getAccount();
    const payerPublicKey = account.fromAddress(payerAddress);
    // Validate account address
    const expectedAccountAddress = await account.deriveAssociatedAddress(
      ownerAddress,
      mintAddress,
      this.spltProgramId.toBase58(),
      this.splataProgramId.toBase58()
    );
    if (accountAddress !== expectedAccountAddress) throw new Error('Invalid associated account address');
    // Build tx
    let transaction = new Transaction();
    transaction = await this._addRecentCommitment(transaction);
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: payerPublicKey, isSigner: true, isWritable: true },
        { pubkey: accountPublicKey, isSigner: false, isWritable: true },
        { pubkey: ownerPublicKey, isSigner: false, isWritable: false },
        { pubkey: mintPublicKey, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: this.spltProgramId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId: this.splataProgramId,
      data: Buffer.from([])
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

  initializeMultiSig = async (minimumSig, signerAddresses, multiSig, wallet) => {
    if (!signerAddresses || !signerAddresses.length) throw new Error('Empty array of signer addresses');
    for (let signerAddress of signerAddresses)
      if (!account.isAddress(signerAddress))
        throw new Error('Invalid signer address');
    // Gey payer
    const payerAddress = await wallet.getAccount();
    const payerPublicKey = account.fromAddress(payerAddress);
    // Rent multisig
    const multiSigSpace = (new soproxABI.struct(schema.MULTISIG_SCHEMA)).space;
    await this._rentAccount(wallet, multiSig, multiSigSpace, this.spltProgramId);
    // Build tx
    let transaction = new Transaction();
    transaction = await this._addRecentCommitment(transaction);
    const layout = new soproxABI.struct(
      [{ key: 'code', type: 'u8' }, { key: 'm', type: 'u8' }],
      { code: 2, m: minimumSig });
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: multiSig.publicKey, isSigner: false, isWritable: true },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        ...signerAddresses.map(
          signerAddress => ({ pubkey: account.fromAddress(signerAddress), isSigner: false, isWritable: false })
        )
      ],
      programId: this.spltProgramId,
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

  transfer = async (amount, srcAddress, dstAddress, wallet) => {
    if (!account.isAddress(srcAddress)) throw new Error('Invalid source address');
    if (!account.isAddress(dstAddress)) throw new Error('Invalid destination address');
    const srcPublicKey = account.fromAddress(srcAddress);
    const dstPublicKey = account.fromAddress(dstAddress);
    // Get payer
    const payerAddress = await wallet.getAccount();
    const payerPublicKey = account.fromAddress(payerAddress);
    // Build tx
    let transaction = new Transaction();
    transaction = await this._addRecentCommitment(transaction);
    const layout = new soproxABI.struct(
      [{ key: 'code', type: 'u8' }, { key: 'amount', type: 'u64' }],
      { code: 3, amount });
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: srcPublicKey, isSigner: false, isWritable: true },
        { pubkey: dstPublicKey, isSigner: false, isWritable: true },
        { pubkey: payerPublicKey, isSigner: true, isWritable: false }
      ],
      programId: this.spltProgramId,
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

  approve = async (amount, srcAddress, delegateAddress, wallet) => {
    if (!account.isAddress(srcAddress)) throw new Error('Invalid source address');
    if (!account.isAddress(delegateAddress)) throw new Error('Invalid delegate address');
    const srcPublicKey = account.fromAddress(srcAddress);
    const delegatePublicKey = account.fromAddress(delegateAddress);
    // Get payer
    const payerAddress = await wallet.getAccount();
    const payerPublicKey = account.fromAddress(payerAddress);
    // Build tx
    let transaction = new Transaction();
    transaction = await this._addRecentCommitment(transaction);
    const layout = new soproxABI.struct(
      [{ key: 'code', type: 'u8' }, { key: 'amount', type: 'u64' }],
      { code: 4, amount });
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: srcPublicKey, isSigner: false, isWritable: true },
        { pubkey: delegatePublicKey, isSigner: false, isWritable: true },
        { pubkey: payerPublicKey, isSigner: true, isWritable: false },
      ],
      programId: this.spltProgramId,
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

  revoke = async (srcAddress, wallet) => {
    if (!account.isAddress(srcAddress)) throw new Error('Invalid source address');
    const srcPublicKey = account.fromAddress(srcAddress);
    // Get payer
    const payerAddress = await wallet.getAccount();
    const payerPublicKey = account.fromAddress(payerAddress);
    // Build tx
    let transaction = new Transaction();
    transaction = await this._addRecentCommitment(transaction);
    const layout = new soproxABI.struct([{ key: 'code', type: 'u8' }], { code: 5 });
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: srcPublicKey, isSigner: false, isWritable: true },
        { pubkey: payerPublicKey, isSigner: true, isWritable: false },
      ],
      programId: this.spltProgramId,
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

  setAuthority = async (authorityType, newAuthorityAddress, targetAddress, wallet) => {
    newAuthorityAddress = newAuthorityAddress || DEFAULT_EMPTY_ADDRESSS;
    if (!account.isAddress(newAuthorityAddress)) throw new Error('Invalid new authority address');
    if (!account.isAddress(targetAddress)) throw new Error('Invalid target address');
    const targetPublicKey = account.fromAddress(targetAddress);
    // Get payer
    const payerAddress = await wallet.getAccount();
    const payerPublicKey = account.fromAddress(payerAddress);
    // Build tx
    let transaction = new Transaction();
    transaction = await this._addRecentCommitment(transaction);
    const layout = new soproxABI.struct([
      { key: 'code', type: 'u8' },
      { key: 'authority_type', type: 'u8' },
      { key: 'new_authority_option', type: 'u8' },
      { key: 'new_authority', type: 'pub' },
    ], {
      code: 6,
      authority_type: authorityType,
      new_authority_option: newAuthorityAddress === DEFAULT_EMPTY_ADDRESSS ? 0 : 1,
      new_authority: newAuthorityAddress,
    });
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: targetPublicKey, isSigner: false, isWritable: true },
        { pubkey: payerPublicKey, isSigner: true, isWritable: false },
      ],
      programId: this.spltProgramId,
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

  mintTo = async (amount, mintAddress, dstAddress, wallet) => {
    if (!account.isAddress(mintAddress)) throw new Error('Invalid mint address');
    if (!account.isAddress(dstAddress)) throw new Error('Invalid destination address');
    const mintPublicKey = account.fromAddress(mintAddress);
    const dstPublicKey = account.fromAddress(dstAddress);
    // Get payer
    const payerAddress = await wallet.getAccount();
    const payerPublicKey = account.fromAddress(payerAddress);
    // Build tx
    let transaction = new Transaction();
    transaction = await this._addRecentCommitment(transaction);
    const layout = new soproxABI.struct(
      [{ key: 'code', type: 'u8' }, { key: 'amount', type: 'u64' }],
      { code: 7, amount });
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: mintPublicKey, isSigner: false, isWritable: true },
        { pubkey: dstPublicKey, isSigner: false, isWritable: true },
        { pubkey: payerPublicKey, isSigner: true, isWritable: false },
      ],
      programId: this.spltProgramId,
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

  burn = async (amount, srcAddress, mintAddress, wallet) => {
    if (!account.isAddress(srcAddress)) throw new Error('Invalid source address');
    if (!account.isAddress(mintAddress)) throw new Error('Invalid mint address');
    const srcPublicKey = account.fromAddress(srcAddress);
    const mintPublicKey = account.fromAddress(mintAddress);
    // Get payer
    const payerAddress = await wallet.getAccount();
    const payerPublicKey = account.fromAddress(payerAddress);
    // Build tx
    let transaction = new Transaction();
    transaction = await this._addRecentCommitment(transaction);
    const layout = new soproxABI.struct(
      [{ key: 'code', type: 'u8' }, { key: 'amount', type: 'u64' }],
      { code: 8, amount });
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: srcPublicKey, isSigner: false, isWritable: true },
        { pubkey: mintPublicKey, isSigner: false, isWritable: true },
        { pubkey: payerPublicKey, isSigner: true, isWritable: false },
      ],
      programId: this.spltProgramId,
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

  closeAccount = async (targetAccount, wallet) => {
    if (!account.isAddress(targetAccount)) throw new Error('Invalid target address');
    const targetPublicKey = account.fromAddress(targetAccount);
    // Get payer
    const payerAddress = await wallet.getAccount();
    const payerPublicKey = account.fromAddress(payerAddress);
    // Build tx
    let transaction = new Transaction();
    transaction = await this._addRecentCommitment(transaction);
    const layout = new soproxABI.struct([{ key: 'code', type: 'u8' }], { code: 9 });
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: targetPublicKey, isSigner: false, isWritable: true },
        { pubkey: payerPublicKey, isSigner: false, isWritable: true },
        { pubkey: payerPublicKey, isSigner: true, isWritable: false },
      ],
      programId: this.spltProgramId,
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

  freezeAccount = async (targetAddress, mintAddress, wallet) => {
    if (!account.isAddress(targetAddress)) throw new Error('Invalid target address');
    if (!account.isAddress(mintAddress)) throw new Error('Invalid mint address');
    const targetPublicKey = account.fromAddress(targetAddress);
    const mintPublicKey = account.fromAddress(mintAddress);
    // Get payer
    const payerAddress = await wallet.getAccount();
    const payerPublicKey = account.fromAddress(payerAddress);
    // Build tx
    let transaction = new Transaction();
    transaction = await this._addRecentCommitment(transaction);
    const layout = new soproxABI.struct([{ key: 'code', type: 'u8' }], { code: 10 });
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: targetPublicKey, isSigner: false, isWritable: true },
        { pubkey: mintPublicKey, isSigner: false, isWritable: false },
        { pubkey: payerPublicKey, isSigner: true, isWritable: false },
      ],
      programId: this.spltProgramId,
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

  thawAccount = async (targetAddress, mintAddress, wallet) => {
    if (!account.isAddress(targetAddress)) throw new Error('Invalid target address');
    if (!account.isAddress(mintAddress)) throw new Error('Invalid mint address');
    const targetPublicKey = account.fromAddress(targetAddress);
    const mintPublicKey = account.fromAddress(mintAddress);
    // Get payer
    const payerAddress = await wallet.getAccount();
    const payerPublicKey = account.fromAddress(payerAddress);
    // Build tx
    let transaction = new Transaction();
    transaction = await this._addRecentCommitment(transaction);
    const layout = new soproxABI.struct([{ key: 'code', type: 'u8' }], { code: 11 });
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: targetPublicKey, isSigner: false, isWritable: true },
        { pubkey: mintPublicKey, isSigner: false, isWritable: false },
        { pubkey: payerPublicKey, isSigner: true, isWritable: false },
      ],
      programId: this.spltProgramId,
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

module.exports = { SPLT, AuthorityType };