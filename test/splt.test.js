const { Account } = require('@solana/web3.js');
const { SPLT, AuthorityType, fromSecretKey } = require('../dist');

const PAYER = 'e06a1a17cf400f6c322e32377a9a7653eecf58f3eb0061023b743c689b43a5fa491573553e4afdcdcd1c94692a138dd2fd0dc0f6946ef798ba34ac1ad00b3720';
const DELEGATE = '2cedf5aba2387360b2e1cbfc649200bbda25f3ca01920c1e97bf81a58b91302180f78b4aeb06b742fd36decdbc60df7dfba2a606ba11de6c987eed1d827572a0';
const MINT_ADDRESS = '6Qvp2kKkZwPoNibncFPygiEJJd6sFP5JeHbtsQDyBqNN';
const SRC_ADDRESS = 'AHukZ3YJWVUpEERwsqZ6YKumnfJ2eYLqDekuWFiLDkJn';
const DST_ADDRESS = 'Hw7nKqfp5EmKGroX7M3LQHuuWHvfgwTSajHYfmLUt8u5';
const MULTISIG_ADDRESS = 'J57UhhZe5xpc3oje11aj8QFjAAZVgg4hWxbpLgJnVxyN';


describe('SPLT library', function () {
  describe('Test constructor', function () {
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
      const mint = new Account();
      const payer = fromSecretKey(PAYER);
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
      const amount = 100000000000n;
      const payer = fromSecretKey(PAYER);
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
      const amount = 50000000000n;
      const payer = fromSecretKey(PAYER);
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
      const payer = fromSecretKey(PAYER);
      const newFreezeAuthorityAddress = payer.publicKey.toBase58();
      const authorityType = AuthorityType.FreezeAccount;
      splt.setAuthority(authorityType, newFreezeAuthorityAddress, MINT_ADDRESS, payer).then(txId => {
        return done('An invalid action is skipped');
      }).catch(er => {
        return done();
      });
    });

    it('Should initialize/set/unset authority (to mint)', function (done) {
      const splt = new SPLT();
      const mint = new Account();
      const payer = fromSecretKey(PAYER);
      const delegate = fromSecretKey(DELEGATE);
      const freezeAuthorityAddress = payer.publicKey.toBase58();
      const newFreezeAuthorityAddress = delegate.publicKey.toBase58();
      const authorityType = AuthorityType.FreezeAccount;
      const mintAddress = mint.publicKey.toBase58();
      splt.initializeMint(9, freezeAuthorityAddress, mint, payer).then(txId => {
        return splt.getMintData(mintAddress);
      }).then(data => {
        return splt.setAuthority(authorityType, newFreezeAuthorityAddress, mintAddress, payer);
      }).then(txId => {
        return splt.getMintData(mintAddress);
      }).then(data => {
        return splt.setAuthority(authorityType, null, mintAddress, delegate);
      }).then(txId => {
        return splt.getMintData(mintAddress);
      }).then(data => {
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

    it('Should initialize/close Account', function (done) {
      const splt = new SPLT();
      const newAccount = new Account();
      const payer = fromSecretKey(PAYER);
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
      const payer = fromSecretKey(PAYER);
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
      const payer = fromSecretKey(PAYER);
      const delegate = fromSecretKey(DELEGATE);
      const delegateAddress = delegate.publicKey.toBase58();
      splt.approve(amount, SRC_ADDRESS, delegateAddress, payer).then(txId => {
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
      const delegate = fromSecretKey(DELEGATE);
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
      const payer = fromSecretKey(PAYER);
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
      const payer = fromSecretKey(PAYER);
      const newAuthorityAddress = payer.publicKey.toBase58();
      const authorityType = AuthorityType.CloseAccount;
      splt.setAuthority(authorityType, newAuthorityAddress, SRC_ADDRESS, payer).then(txId => {
        return splt.getAccountData(SRC_ADDRESS);
      }).then(data => {
        return done();
      }).catch(er => {
        return done(er);
      });
    });

    it('Should unset authority', function (done) {
      const splt = new SPLT();
      const payer = fromSecretKey(PAYER);
      const newAuthorityAddress = null;
      const authorityType = AuthorityType.CloseAccount;
      splt.setAuthority(authorityType, newAuthorityAddress, SRC_ADDRESS, payer).then(txId => {
        return splt.getAccountData(SRC_ADDRESS);
      }).then(data => {
        return done();
      }).catch(er => {
        return done(er);
      });
    });

    it('Should freeze/thaw account', function (done) {
      const splt = new SPLT();
      const newAccount = new Account();
      const mint = new Account();
      const payer = fromSecretKey(PAYER);
      const accountAddress = newAccount.publicKey.toBase58();
      const mintAddress = mint.publicKey.toBase58();
      const freezeAuthorityAddress = payer.publicKey.toBase58();
      splt.initializeMint(9, freezeAuthorityAddress, mint, payer).then(txId => {
        return splt.getMintData(mintAddress);
      }).then(data => {
        return splt.initializeAccount(newAccount, mintAddress, payer);
      }).then(txId => {
        return splt.getAccountData(accountAddress);
      }).then(data => {
        return splt.freezeAccount(accountAddress, mintAddress, payer);
      }).then(txId => {
        return splt.getAccountData(accountAddress);
      }).then(data => {
        return splt.thawAccount(accountAddress, mintAddress, payer);
      }).then(txId => {
        return splt.getAccountData(accountAddress);
      }).then(data => {
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
      const multiSig = new Account();
      const payer = fromSecretKey(PAYER);
      const delegate = fromSecretKey(DELEGATE);
      const signerAddresses = [payer.publicKey.toBase58(), delegate.publicKey.toBase58()]
      splt.initializeMultiSig(2, signerAddresses, multiSig, payer).then(txId => {
        return splt.getMultiSigData(multiSig.publicKey.toBase58());
      }).then(data => {
        return done();
      }).catch(er => {
        return done(er);
      });
    });
  });

});