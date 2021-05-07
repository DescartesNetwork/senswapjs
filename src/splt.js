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

  getMintData = (mintAddress) => {
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

  getAccountData = (accountAddress) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(accountAddress)) return reject('Invalid account address');
      const accountPublicKey = account.fromAddress(accountAddress);

      let result = { address: accountAddress }
      return this.connection.getAccountInfo(accountPublicKey).then(re => {
        if (!re) return reject('Uninitialized account');
        const { data: accountData } = re;
        if (!accountData) return reject(`Cannot read data of ${result.address}`);
        const accountLayout = new soproxABI.struct(schema.ACCOUNT_SCHEMA);
        if (accountData.length !== accountLayout.space) return reject('Unmatched buffer length');
        accountLayout.fromBuffer(accountData);
        let mint = { address: accountLayout.value.mint }
        result = { ...result, ...accountLayout.value, mint }
        return this.getMintData(result.mint.address);
      }).then(mintData => {
        result.mint = { ...result.mint, ...mintData }
        return resolve(result);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  getMultiSigData = (multiSigAddress) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(multiSigAddress)) return reject('Invalid multiSig address');
      const multiSigPublicKey = account.fromAddress(multiSigAddress);

      return this.connection.getAccountInfo(multiSigPublicKey).then(({ data }) => {
        if (!data) return reject(`Cannot read data of ${result.address}`);
        const multiSigLayout = new soproxABI.struct(schema.MULTISIG_SCHEMA);
        if (data.length !== multiSigLayout.space) return reject('Unmatched buffer length');
        multiSigLayout.fromBuffer(data);
        const result = { address: multiSigAddress, ...multiSigLayout.value }
        return resolve(result);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  initializeMint = (decimals, mintAuthorityAddress, freezeAuthorityAddress, mint, wallet) => {
    return new Promise((resolve, reject) => {
      freezeAuthorityAddress = freezeAuthorityAddress || DEFAULT_EMPTY_ADDRESSS;
      if (!account.isAddress(mintAuthorityAddress)) return reject('Invalid mint authority address');
      if (!account.isAddress(freezeAuthorityAddress)) return reject('Invalid freeze authority address');

      let transaction = new Transaction();
      const mintSpace = (new soproxABI.struct(schema.MINT_SCHEMA)).space;

      return this._rentAccount(wallet, mint, mintSpace, this.spltProgramId).then(txId => {
        return this._addRecentCommitment(transaction);
      }).then(txWithCommitment => {
        transaction = txWithCommitment;
        return wallet.getAccount();
      }).then(payerAddress => {
        const payerPublicKey = account.fromAddress(payerAddress);
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

  initializeAccount = (accountOrAddress, mintAddress, wallet) => {
    return new Promise((resolve, reject) => {
      if (!accountOrAddress) return reject('Invalid token account/address');
      const _initializeAccount = account.isAddress(accountOrAddress) ? this._initializeAssociatedAccount : this._initializeArbitraryAccount;
      return _initializeAccount(accountOrAddress, mintAddress, wallet).then(txId => {
        return resolve(txId);
      }).catch(er => {
        return reject(er);
      });
    });
  }

  _initializeArbitraryAccount = (newAccount, mintAddress, wallet) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(mintAddress)) return reject('Invalid mint address');

      let transaction = new Transaction();
      const mintPublicKey = account.fromAddress(mintAddress);
      const accountSpace = (new soproxABI.struct(schema.ACCOUNT_SCHEMA)).space;

      return this._rentAccount(wallet, newAccount, accountSpace, this.spltProgramId).then(txId => {
        return this._addRecentCommitment(transaction);
      }).then(txWithCommitment => {
        transaction = txWithCommitment;
        return wallet.getAccount();
      }).then(payerAddress => {
        const payerPublicKey = account.fromAddress(payerAddress);
        const layout = new soproxABI.struct([{ key: 'code', type: 'u8' }], { code: 1 });
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: newAccount.publicKey, isSigner: false, isWritable: true },
            { pubkey: mintPublicKey, isSigner: false, isWritable: false },
            { pubkey: payerPublicKey, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
          ],
          programId: this.spltProgramId,
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

  _initializeAssociatedAccount = (accountAddress, mintAddress, wallet) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(accountAddress)) return reject('Invalid account address');
      if (!account.isAddress(mintAddress)) return reject('Invalid mint address');

      let transaction = new Transaction();
      let payerPublicKey = null;
      const accountPublicKey = account.fromAddress(accountAddress);
      const mintPublicKey = account.fromAddress(mintAddress);
      return wallet.getAccount().then(payerAddress => {
        payerPublicKey = account.fromAddress(payerAddress);
        return account.deriveAssociatedAddress(
          payerAddress,
          mintAddress,
          this.spltProgramId.toBase58(),
          this.splataProgramId.toBase58()
        );
      }).then(expectedAccountAddress => {
        if (accountAddress !== expectedAccountAddress) return reject('Invalid associated account address');
        return this._addRecentCommitment(transaction);
      }).then(txWithCommitment => {
        transaction = txWithCommitment;
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payerPublicKey, isSigner: true, isWritable: true },
            { pubkey: accountPublicKey, isSigner: false, isWritable: true },
            { pubkey: payerPublicKey, isSigner: false, isWritable: false },
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

  initializeMultiSig = (minimumSig, signerAddresses, multiSig, wallet) => {
    return new Promise((resolve, reject) => {
      if (!signerAddresses || !signerAddresses.length) return reject('Empty array of signer addresses');
      for (let signerAddress of signerAddresses)
        if (!account.isAddress(signerAddress)) return reject('Invalid signer address');

      let transaction = new Transaction();
      const multiSigSpace = (new soproxABI.struct(schema.MULTISIG_SCHEMA)).space;
      return this._rentAccount(wallet, multiSig, multiSigSpace, this.spltProgramId).then(txId => {
        return this._addRecentCommitment(transaction);
      }).then(txWithCommitment => {
        transaction = txWithCommitment;
        return wallet.getAccount();
      }).then(payerAddress => {
        const payerPublicKey = account.fromAddress(payerAddress);
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

  transfer = (amount, srcAddress, dstAddress, wallet) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(srcAddress)) return reject('Invalid source address');
      if (!account.isAddress(dstAddress)) return reject('Invalid destination address');

      let transaction = new Transaction();
      const srcPublicKey = account.fromAddress(srcAddress);
      const dstPublicKey = account.fromAddress(dstAddress);

      return this._addRecentCommitment(transaction).then(txWithCommitment => {
        transaction = txWithCommitment;
        return wallet.getAccount();
      }).then(payerAddress => {
        const payerPublicKey = account.fromAddress(payerAddress);
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

  approve = (amount, srcAddress, delegateAddress, wallet) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(srcAddress)) return reject('Invalid source address');
      if (!account.isAddress(delegateAddress)) return reject('Invalid delegate address');

      let transaction = new Transaction();
      const srcPublicKey = account.fromAddress(srcAddress);
      const delegatePublicKey = account.fromAddress(delegateAddress);

      return this._addRecentCommitment(transaction).then(txWithCommitment => {
        transaction = txWithCommitment;
        return wallet.getAccount();
      }).then(payerAddress => {
        const payerPublicKey = account.fromAddress(payerAddress);
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

  revoke = (srcAddress, wallet) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(srcAddress)) return reject('Invalid source address');

      let transaction = new Transaction();
      const srcPublicKey = account.fromAddress(srcAddress);

      return this._addRecentCommitment(transaction).then(txWithCommitment => {
        transaction = txWithCommitment;
        return wallet.getAccount();
      }).then(payerAddress => {
        const payerPublicKey = account.fromAddress(payerAddress);
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

  setAuthority = (authorityType, newAuthorityAddress, targetAddress, wallet) => {
    return new Promise((resolve, reject) => {
      newAuthorityAddress = newAuthorityAddress || DEFAULT_EMPTY_ADDRESSS;
      if (!account.isAddress(newAuthorityAddress)) return reject('Invalid new authority address');
      if (!account.isAddress(targetAddress)) return reject('Invalid target address');

      let transaction = new Transaction();
      const targetPublicKey = account.fromAddress(targetAddress);

      return this._addRecentCommitment(transaction).then(txWithCommitment => {
        transaction = txWithCommitment;
        return wallet.getAccount();
      }).then(payerAddress => {
        const payerPublicKey = account.fromAddress(payerAddress);
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

  mintTo = (amount, mintAddress, dstAddress, wallet) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(mintAddress)) return reject('Invalid mint address');
      if (!account.isAddress(dstAddress)) return reject('Invalid destination address');

      let transaction = new Transaction();
      const mintPublicKey = account.fromAddress(mintAddress);
      const dstPublicKey = account.fromAddress(dstAddress);

      return this._addRecentCommitment(transaction).then(txWithCommitment => {
        transaction = txWithCommitment;
        return wallet.getAccount();
      }).then(payerAddress => {
        const payerPublicKey = account.fromAddress(payerAddress);
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

  burn = (amount, srcAddress, mintAddress, wallet) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(srcAddress)) return reject('Invalid source address');
      if (!account.isAddress(mintAddress)) return reject('Invalid mint address');

      let transaction = new Transaction();
      const srcPublicKey = account.fromAddress(srcAddress);
      const mintPublicKey = account.fromAddress(mintAddress);

      return this._addRecentCommitment(transaction).then(txWithCommitment => {
        transaction = txWithCommitment;
        return wallet.getAccount();
      }).then(payerAddress => {
        const payerPublicKey = account.fromAddress(payerAddress);
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

  closeAccount = (targetAccount, wallet) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(targetAccount)) return reject('Invalid target address');

      let transaction = new Transaction();
      const targetPublicKey = account.fromAddress(targetAccount);

      return this._addRecentCommitment(transaction).then(txWithCommitment => {
        transaction = txWithCommitment;
        return wallet.getAccount();
      }).then(payerAddress => {
        const payerPublicKey = account.fromAddress(payerAddress);
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

  freezeAccount = (targetAddress, mintAddress, wallet) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(targetAddress)) return reject('Invalid target address');
      if (!account.isAddress(mintAddress)) return reject('Invalid mint address');

      let transaction = new Transaction();
      const targetPublicKey = account.fromAddress(targetAddress);
      const mintPublicKey = account.fromAddress(mintAddress);

      return this._addRecentCommitment(transaction).then(txWithCommitment => {
        transaction = txWithCommitment;
        return wallet.getAccount();
      }).then(payerAddress => {
        const payerPublicKey = account.fromAddress(payerAddress);
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

  thawAccount = (targetAddress, mintAddress, wallet) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(targetAddress)) return reject('Invalid target address');
      if (!account.isAddress(mintAddress)) return reject('Invalid mint address');

      let transaction = new Transaction();
      const targetPublicKey = account.fromAddress(targetAddress);
      const mintPublicKey = account.fromAddress(mintAddress);

      return this._addRecentCommitment(transaction).then(txWithCommitment => {
        transaction = txWithCommitment;
        return wallet.getAccount();
      }).then(payerAddress => {
        const payerPublicKey = account.fromAddress(payerAddress);
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

module.exports = { SPLT, AuthorityType };