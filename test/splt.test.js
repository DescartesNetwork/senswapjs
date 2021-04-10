const {
  SPLT, AuthorityType, createAccount,
  deriveAssociatedAddress, Lamports
} = require('../dist');
const Wallet = require('./wallet.mock');

const payer = new Wallet('e06a1a17cf400f6c322e32377a9a7653eecf58f3eb0061023b743c689b43a5fa491573553e4afdcdcd1c94692a138dd2fd0dc0f6946ef798ba34ac1ad00b3720');
const delegate = new Wallet('2cedf5aba2387360b2e1cbfc649200bbda25f3ca01920c1e97bf81a58b91302180f78b4aeb06b742fd36decdbc60df7dfba2a606ba11de6c987eed1d827572a0');
let MINT_ADDRESS = '';
let SRC_ADDRESS = '';
let DST_ADDRESS = '';
let MULTISIG_ADDRESS = 'J57UhhZe5xpc3oje11aj8QFjAAZVgg4hWxbpLgJnVxyN';


describe('SPLT library', function () {
  it('Mint', function (done) {
    const mint = createAccount();
    const src = createAccount();
    const dst = createAccount();
    MINT_ADDRESS = mint.publicKey.toBase58();
    SRC_ADDRESS = src.publicKey.toBase58();
    DST_ADDRESS = dst.publicKey.toBase58();
    const splt = new SPLT();
    splt.initializeMint(9, null, mint, payer).then(txId => {
      return splt.initializeAccount(src, MINT_ADDRESS, payer);
    }).then(txId => {
      return splt.mintTo(5000000000000000000n, MINT_ADDRESS, SRC_ADDRESS, payer);
    }).then(txId => {
      return splt.initializeAccount(dst, MINT_ADDRESS, payer);
    }).then(txId => {
      return done();
    }).catch(er => {
      return done(er);
    });
  });

  describe('Test constructor', function () {
    it('Should fill configs', function (done) {
      // Mint
      console.log('MINT_ADDRESS:', MINT_ADDRESS);
      console.log('SRC_ADDRESS:', SRC_ADDRESS);
      console.log('DST_ADDRESS:', DST_ADDRESS);
      console.log('\n');
      return done();
    });


    it('Should be a valid default in constructor', function (done) {
      try {
        const splt = new SPLT();
        return done();
      } catch (er) {
        return done(er);
      }
    });

    it('Should be a valid address in constructor', function (done) {
      try {
        const splt = new SPLT('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
        return done();
      } catch (er) {
        return done(er);
      }
    });

    it('Should be an invalid address in constructor', function (done) {
      try {
        const splt = new SPLT('abc');
        return done('An invalid address is skipped');
      } catch (er) {
        return done();
      }
    });
  });

  describe('Test Mint', function () {
    it('Should be a valid mint data', function (done) {
      const splt = new SPLT();
      splt.getMintData(MINT_ADDRESS).then(data => {
        return done();
      }).catch(er => {
        return done(er);
      });
    });

    it('Should initialize Mint', function (done) {
      const splt = new SPLT();
      const mint = createAccount();
      const freezeAuthorityAddress = null; // Unset freeze authority
      splt.initializeMint(9, freezeAuthorityAddress, mint, payer).then(txId => {
        return splt.getMintData(mint.publicKey.toBase58());
      }).then(data => {
        return done();
      }).catch(er => {
        return done(er);
      });
    });

    it('Should mint', function (done) {
      const splt = new SPLT();
      const amount = 10000000000000n;
      splt.mintTo(amount, MINT_ADDRESS, SRC_ADDRESS, payer).then(txId => {
        return splt.getAccountData(SRC_ADDRESS);
      }).then(data => {
        return done();
      }).catch(er => {
        return done(er);
      });
    });

    it('Should burn', function (done) {
      const splt = new SPLT();
      const amount = 5000000000000n;
      splt.burn(amount, SRC_ADDRESS, MINT_ADDRESS, payer).then(txId => {
        return splt.getAccountData(SRC_ADDRESS);
      }).then(data => {
        return done();
      }).catch(er => {
        return done(er);
      });
    });

    it('Should not set authority (to mint)', function (done) {
      const splt = new SPLT();
      const authorityType = AuthorityType.FreezeAccount;
      payer.getAccount().then(newFreezeAuthorityAddress => {
        return splt.setAuthority(authorityType, newFreezeAuthorityAddress, MINT_ADDRESS, payer)
      }).then(txId => {
        return done('An invalid action is skipped');
      }).catch(er => {
        return done();
      });
    });

    it('Should initialize/set/unset authority (to mint)', function (done) {
      const splt = new SPLT();
      const mint = createAccount();
      const authorityType = AuthorityType.FreezeAccount;
      const mintAddress = mint.publicKey.toBase58();
      payer.getAccount().then(freezeAuthorityAddress => {
        return splt.initializeMint(9, freezeAuthorityAddress, mint, payer);
      }).then(txId => {
        return delegate.getAccount();
      }).then(newFreezeAuthorityAddress => {
        return splt.setAuthority(authorityType, newFreezeAuthorityAddress, mintAddress, payer);
      }).then(txId => {
        return splt.setAuthority(authorityType, null, mintAddress, delegate);
      }).then(txId => {
        return done();
      }).catch(er => {
        return done(er);
      });
    });
  });

  describe('Test Account', function () {
    it('Should be a valid account data', function (done) {
      const splt = new SPLT();
      splt.getAccountData(SRC_ADDRESS).then(data => {
        return done();
      }).catch(er => {
        return done(er);
      });
    });

    it('Should initialize/close Account (associated)', function (done) {
      const lamports = new Lamports();
      const splt = new SPLT();
      const targetAccount = createAccount();
      const targetWallet = new Wallet(Buffer.from(targetAccount.secretKey).toString('hex'));
      let newAddress = null;
      lamports.transfer(10000000, targetAccount.publicKey.toBase58(), payer).then(txId => {
        return deriveAssociatedAddress(
          targetAccount.publicKey.toBase58(),
          MINT_ADDRESS,
          splt.spltProgramId.toBase58(),
          splt.splataProgramId.toBase58()
        );
      }).then(accountAddress => {
        newAddress = accountAddress;
        return splt.initializeAccount(accountAddress, MINT_ADDRESS, targetWallet);
      }).then(txId => {
        return splt.getAccountData(newAddress);
      }).then(data => {
        return splt.closeAccount(newAddress, targetWallet);
      }).then(txId => {
        return done();
      }).catch(er => {
        return done(er);
      });
    });

    it('Should initialize/close Account (arbitrary)', function (done) {
      const splt = new SPLT();
      const newAccount = createAccount();
      splt.initializeAccount(newAccount, MINT_ADDRESS, payer).then(txId => {
        return splt.getAccountData(newAccount.publicKey.toBase58());
      }).then(data => {
        return splt.closeAccount(newAccount.publicKey.toBase58(), payer);
      }).then(txId => {
        return done();
      }).catch(er => {
        return done(er);
      });
    });

    it('Should transfer (from owner)', function (done) {
      const splt = new SPLT();
      const amount = 10000000000n;
      splt.transfer(amount, SRC_ADDRESS, DST_ADDRESS, payer).then(txId => {
        return splt.getAccountData(SRC_ADDRESS);
      }).then(data => {
        return splt.getAccountData(DST_ADDRESS);
      }).then(data => {
        return done();
      }).catch(er => {
        return done(er);
      });
    });

    it('Should approve', function (done) {
      const splt = new SPLT();
      const amount = 10000000000n;
      delegate.getAccount().then(delegateAddress => {
        return splt.approve(amount, SRC_ADDRESS, delegateAddress, payer)
      }).then(txId => {
        return splt.getAccountData(SRC_ADDRESS);
      }).then(data => {
        return done();
      }).catch(er => {
        return done(er);
      });
    });

    it('Should transfer (from delegate)', function (done) {
      const splt = new SPLT();
      const amount = 5000000000n;
      splt.transfer(amount, SRC_ADDRESS, DST_ADDRESS, delegate).then(txId => {
        return splt.getAccountData(SRC_ADDRESS);
      }).then(data => {
        return splt.getAccountData(DST_ADDRESS);
      }).then(data => {
        return done();
      }).catch(er => {
        return done(er);
      });
    });

    it('Should revoke', function (done) {
      const splt = new SPLT();
      splt.revoke(SRC_ADDRESS, payer).then(txId => {
        return splt.getAccountData(SRC_ADDRESS);
      }).then(data => {
        return done();
      }).catch(er => {
        return done(er);
      });
    });

    it('Should set authority (to account)', function (done) {
      const splt = new SPLT();
      const authorityType = AuthorityType.CloseAccount;
      payer.getAccount(newAuthorityAddress => {
        return splt.setAuthority(authorityType, newAuthorityAddress, SRC_ADDRESS, payer)
      }).then(txId => {
        return splt.getAccountData(SRC_ADDRESS);
      }).then(data => {
        return done();
      }).catch(er => {
        return done(er);
      });
    });

    it('Should unset authority', function (done) {
      const splt = new SPLT();
      const authorityType = AuthorityType.CloseAccount;
      splt.setAuthority(authorityType, null, SRC_ADDRESS, payer).then(txId => {
        return splt.getAccountData(SRC_ADDRESS);
      }).then(data => {
        return done();
      }).catch(er => {
        return done(er);
      });
    });

    it('Should freeze/thaw account', function (done) {
      const splt = new SPLT();
      const newAccount = createAccount();
      const mint = createAccount();
      const accountAddress = newAccount.publicKey.toBase58();
      const mintAddress = mint.publicKey.toBase58();
      payer.getAccount().then(freezeAuthorityAddress => {
        return splt.initializeMint(9, freezeAuthorityAddress, mint, payer)
      }).then(txId => {
        return splt.initializeAccount(newAccount, mintAddress, payer);
      }).then(txId => {
        return splt.freezeAccount(accountAddress, mintAddress, payer);
      }).then(txId => {
        return splt.thawAccount(accountAddress, mintAddress, payer);
      }).then(txId => {
        return done();
      }).catch(er => {
        return done(er);
      });
    });
  });

  describe('Test MultiSig', function () {
    it('Should be a valid mint data', function (done) {
      const splt = new SPLT();
      splt.getMultiSigData(MULTISIG_ADDRESS).then(data => {
        return done();
      }).catch(er => {
        return done(er);
      });
    });

    it('Should initialize MultiSig', function (done) {
      const splt = new SPLT();
      const multiSig = createAccount();
      const signerAddresses = [];
      payer.getAccount().then(payerAddress => {
        signerAddresses.push(payerAddress);
        return delegate.getAccount();
      }).then(delegateAddress => {
        signerAddresses.push(delegateAddress);
        return splt.initializeMultiSig(2, signerAddresses, multiSig, payer)
      }).then(txId => {
        return splt.getMultiSigData(multiSig.publicKey.toBase58());
      }).then(data => {
        return done();
      }).catch(er => {
        return done(er);
      });
    });
  });

});