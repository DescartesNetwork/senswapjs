const {
  Connection, Transaction,
  SystemProgram, sendAndConfirmTransaction,
  TransactionInstruction, SYSVAR_RENT_PUBKEY
} = require('@solana/web3.js');
const soproxABI = require('soprox-abi');

const account = require('./account');
const schema = require('./schema');

const DEFAULT_NODEURL = 'https://devnet.solana.com';
const DEFAULT_SPLT_PROGRAM_ADDRESS = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const DEFAULT_SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ADDRESS = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';

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

class SPLT {
  constructor(
    spltProgramAddress = DEFAULT_SPLT_PROGRAM_ADDRESS,
    splataProgramAddress = DEFAULT_SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ADDRESS,
    nodeUrl = DEFAULT_NODEURL,
  ) {
    this.nodeUrl = nodeUrl;
    if (!account.isAddress(spltProgramAddress)) throw new Error('Invalid SPL-Token program address');
    this.spltProgramId = account.fromAddress(spltProgramAddress);
    this.splataProgramId = account.fromAddress(splataProgramAddress);
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
      if (type === 'accpunt') getData = this.getAccountData;
      if (type === 'mint') getData = this.getMintData;
      if (type === 'multisig') getData = this.getMultiSigData;
      return getData(accountId).then(data => {
        return callback(null, data);
      }).catch(er => {
        return callback(er, null);
      });
    });
  }

  watch = (callback) => {
    return this.connection.onProgramAccountChange(this.swapProgramId, ({ accountId, accountInfo: { data } }) => {
      const accountSpace = (new soproxABI.struct(schema.ACCOUNT_SCHEMA)).space;
      const mintSpace = (new soproxABI.struct(schema.MINT_SCHEMA)).space;
      const multisigSpace = (new soproxABI.struct(schema.MULTISIG_SCHEMA)).space;
      let type = null;
      if (data.length === accountSpace) type = 'account';
      if (data.length === mintSpace) type = 'mint';
      if (data.length === multisigSpace) type = 'multisig';
      if (!type) return callback('Unmatched type');
      return callback(null, { type, accountId });
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

  initializeMint = (decimals, freezeAuthorityAddress, mint, payer) => {
    return new Promise((resolve, reject) => {
      freezeAuthorityAddress = freezeAuthorityAddress || '11111111111111111111111111111111';
      if (!account.isAddress(freezeAuthorityAddress)) return reject('Invalid freeze authority address');

      const mintSpace = (new soproxABI.struct(schema.MINT_SCHEMA)).space;
      return this.connection.getMinimumBalanceForRentExemption(mintSpace).then(lamports => {
        const instruction = SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: mint.publicKey,
          lamports,
          space: mintSpace,
          programId: this.spltProgramId,
        });
        const transaction = new Transaction();
        transaction.add(instruction);
        return sendAndConfirmTransaction(
          this.connection,
          transaction,
          [payer, mint],
          { skipPreflight: true, commitment: 'recent' });
      }).then(re => {
        const layout = new soproxABI.struct(
          [
            { key: 'code', type: 'u8' },
            { key: 'decimals', type: 'u8' },
            { key: 'mint_authority', type: 'pub' },
            { key: "freeze_authority_option", type: "u8" },
            { key: "freeze_authority", type: "pub" },
          ],
          {
            code: 0,
            decimals,
            mint_authority: payer.publicKey.toBase58(),
            freeze_authority_option: freezeAuthorityAddress === '11111111111111111111111111111111' ? 0 : 1,
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

  initializeAccount = (accountOrAddress, mintAddress, payer) => {
    return new Promise((resolve, reject) => {
      if (!accountOrAddress) return reject('Invalid token account/address');
      const _initializeAccount = account.isAddress(accountOrAddress) ? this._initializeAssociatedAccount : this._initializeArbitraryAccount;
      return _initializeAccount(accountOrAddress, mintAddress, payer).then(txId => {
        return resolve(txId);
      }).catch(er => {
        return reject(er);
      });
    })
  }

  _initializeArbitraryAccount = (newAccount, mintAddress, payer) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(mintAddress)) return reject('Invalid mint address');
      const mintPublicKey = account.fromAddress(mintAddress);

      const accountSpace = (new soproxABI.struct(schema.ACCOUNT_SCHEMA)).space;
      return this.connection.getMinimumBalanceForRentExemption(accountSpace).then(lamports => {
        const instruction = SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: newAccount.publicKey,
          lamports,
          space: accountSpace,
          programId: this.spltProgramId,
        });
        const transaction = new Transaction();
        transaction.add(instruction);
        return sendAndConfirmTransaction(
          this.connection,
          transaction,
          [payer, newAccount],
          { skipPreflight: true, commitment: 'recent' });
      }).then(re => {
        const layout = new soproxABI.struct(
          [{ key: 'code', type: 'u8' }],
          { code: 1 });
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: newAccount.publicKey, isSigner: false, isWritable: true },
            { pubkey: mintPublicKey, isSigner: false, isWritable: false },
            { pubkey: payer.publicKey, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
          ],
          programId: this.spltProgramId,
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

  _initializeAssociatedAccount = (accountAddress, mintAddress, payer) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(accountAddress)) return reject('Invalid account address');
      const accountPublicKey = account.fromAddress(accountAddress);
      if (!account.isAddress(mintAddress)) return reject('Invalid mint address');
      const mintPublicKey = account.fromAddress(mintAddress);

      return account.deriveAssociatedAddress(
        payer.publicKey.toBase58(),
        mintAddress,
        this.spltProgramId.toBase58(),
        this.splataProgramId.toBase58()
      ).then(expectedAccountAddress => {
        if (accountAddress !== expectedAccountAddress) return reject('Invalid associated account address');

        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: payer.publicKey, isSigner: true, isWritable: true },
            { pubkey: accountPublicKey, isSigner: false, isWritable: true },
            { pubkey: payer.publicKey, isSigner: false, isWritable: false },
            { pubkey: mintPublicKey, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: this.spltProgramId, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
          ],
          programId: this.splataProgramId,
          data: Buffer.from([])
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

  initializeMultiSig = (minimumSig, signerAddresses, multiSig, payer) => {
    return new Promise((resolve, reject) => {
      if (!signerAddresses || !signerAddresses.length) return reject('Empty array of signer addresses');
      for (let signerAddress of signerAddresses)
        if (!account.isAddress(signerAddress)) return reject('Invalid signer address');

      const multiSigSpace = (new soproxABI.struct(schema.MULTISIG_SCHEMA)).space;
      return this.connection.getMinimumBalanceForRentExemption(multiSigSpace).then(lamports => {
        const instruction = SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: multiSig.publicKey,
          lamports,
          space: multiSigSpace,
          programId: this.spltProgramId,
        });
        const transaction = new Transaction();
        transaction.add(instruction);
        return sendAndConfirmTransaction(
          this.connection,
          transaction,
          [payer, multiSig],
          { skipPreflight: true, commitment: 'recent' });
      }).then(re => {
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

  transfer = (amount, srcAddress, dstAddress, payer) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(srcAddress)) return reject('Invalid source address');
      if (!account.isAddress(dstAddress)) return reject('Invalid destination address');
      const srcPublicKey = account.fromAddress(srcAddress);
      const dstPublicKey = account.fromAddress(dstAddress);

      const layout = new soproxABI.struct(
        [{ key: 'code', type: 'u8' }, { key: 'amount', type: 'u64' }],
        { code: 3, amount });
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: srcPublicKey, isSigner: false, isWritable: true },
          { pubkey: dstPublicKey, isSigner: false, isWritable: true },
          { pubkey: payer.publicKey, isSigner: true, isWritable: false }
        ],
        programId: this.spltProgramId,
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

  approve = (amount, srcAddress, delegateAddress, payer) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(srcAddress)) return reject('Invalid source address');
      if (!account.isAddress(delegateAddress)) return reject('Invalid delegate address');
      const srcPublicKey = account.fromAddress(srcAddress);
      const delegatePublicKey = account.fromAddress(delegateAddress);

      const layout = new soproxABI.struct(
        [{ key: 'code', type: 'u8' }, { key: 'amount', type: 'u64' }],
        { code: 4, amount });
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: srcPublicKey, isSigner: false, isWritable: true },
          { pubkey: delegatePublicKey, isSigner: false, isWritable: true },
          { pubkey: payer.publicKey, isSigner: true, isWritable: false },
        ],
        programId: this.spltProgramId,
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

  revoke = (srcAddress, payer) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(srcAddress)) return reject('Invalid source address');
      const srcPublicKey = account.fromAddress(srcAddress);

      const layout = new soproxABI.struct(
        [{ key: 'code', type: 'u8' }],
        { code: 5 });
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: srcPublicKey, isSigner: false, isWritable: true },
          { pubkey: payer.publicKey, isSigner: true, isWritable: false },
        ],
        programId: this.spltProgramId,
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

  setAuthority = (authorityType, newAuthorityAddress, targetAddress, payer) => {
    return new Promise((resolve, reject) => {
      newAuthorityAddress = newAuthorityAddress || '11111111111111111111111111111111';
      if (!account.isAddress(newAuthorityAddress)) return reject('Invalid new authority address');
      if (!account.isAddress(targetAddress)) return reject('Invalid target address');
      const targetPublicKey = account.fromAddress(targetAddress);

      const layout = new soproxABI.struct(
        [
          { key: 'code', type: 'u8' },
          { key: 'authority_type', type: 'u8' },
          { key: 'new_authority_option', type: 'u8' },
          { key: 'new_authority', type: 'pub' },
        ],
        {
          code: 6,
          authority_type: authorityType,
          new_authority_option: newAuthorityAddress === '11111111111111111111111111111111' ? 0 : 1,
          new_authority: newAuthorityAddress,
        });
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: targetPublicKey, isSigner: false, isWritable: true },
          { pubkey: payer.publicKey, isSigner: true, isWritable: false },
        ],
        programId: this.spltProgramId,
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
    })
  }

  mintTo = (amount, mintAddress, dstAddress, payer) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(mintAddress)) return reject('Invalid mint address');
      if (!account.isAddress(dstAddress)) return reject('Invalid destination address');
      const mintPublicKey = account.fromAddress(mintAddress);
      const dstPublicKey = account.fromAddress(dstAddress);

      const layout = new soproxABI.struct(
        [{ key: 'code', type: 'u8' }, { key: 'amount', type: 'u64' }],
        { code: 7, amount });
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: mintPublicKey, isSigner: false, isWritable: true },
          { pubkey: dstPublicKey, isSigner: false, isWritable: true },
          { pubkey: payer.publicKey, isSigner: true, isWritable: false },
        ],
        programId: this.spltProgramId,
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

  burn = (amount, srcAddress, mintAddress, payer) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(srcAddress)) return reject('Invalid source address');
      if (!account.isAddress(mintAddress)) return reject('Invalid mint address');
      const srcPublicKey = account.fromAddress(srcAddress);
      const mintPublicKey = account.fromAddress(mintAddress);

      const layout = new soproxABI.struct(
        [{ key: 'code', type: 'u8' }, { key: 'amount', type: 'u64' }],
        { code: 8, amount });
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: srcPublicKey, isSigner: false, isWritable: true },
          { pubkey: mintPublicKey, isSigner: false, isWritable: true },
          { pubkey: payer.publicKey, isSigner: true, isWritable: false },
        ],
        programId: this.spltProgramId,
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

  closeAccount = (targetAccount, payer) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(targetAccount)) return reject('Invalid target address');
      const targetPublicKey = account.fromAddress(targetAccount);

      const layout = new soproxABI.struct(
        [{ key: 'code', type: 'u8' }],
        { code: 9 });
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: targetPublicKey, isSigner: false, isWritable: true },
          { pubkey: payer.publicKey, isSigner: false, isWritable: true },
          { pubkey: payer.publicKey, isSigner: true, isWritable: false },
        ],
        programId: this.spltProgramId,
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

  freezeAccount = (targetAddress, mintAddress, payer) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(targetAddress)) return reject('Invalid target address');
      if (!account.isAddress(mintAddress)) return reject('Invalid mint address');
      const targetPublicKey = account.fromAddress(targetAddress);
      const mintPublicKey = account.fromAddress(mintAddress);

      const layout = new soproxABI.struct(
        [{ key: 'code', type: 'u8' }],
        { code: 10 });
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: targetPublicKey, isSigner: false, isWritable: true },
          { pubkey: mintPublicKey, isSigner: false, isWritable: false },
          { pubkey: payer.publicKey, isSigner: true, isWritable: false },
        ],
        programId: this.spltProgramId,
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

  thawAccount = (targetAddress, mintAddress, payer) => {
    return new Promise((resolve, reject) => {
      if (!account.isAddress(targetAddress)) return reject('Invalid target address');
      if (!account.isAddress(mintAddress)) return reject('Invalid mint address');
      const targetPublicKey = account.fromAddress(targetAddress);
      const mintPublicKey = account.fromAddress(mintAddress);

      const layout = new soproxABI.struct(
        [{ key: 'code', type: 'u8' }],
        { code: 11 });
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: targetPublicKey, isSigner: false, isWritable: true },
          { pubkey: mintPublicKey, isSigner: false, isWritable: false },
          { pubkey: payer.publicKey, isSigner: true, isWritable: false },
        ],
        programId: this.spltProgramId,
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

module.exports = { SPLT, AuthorityType };