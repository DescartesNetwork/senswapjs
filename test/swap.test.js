const {
  fromSecretKey, createAccount, createStrictAccount,
  Swap, SPLT
} = require('../dist');

const PAYER = 'e06a1a17cf400f6c322e32377a9a7653eecf58f3eb0061023b743c689b43a5fa491573553e4afdcdcd1c94692a138dd2fd0dc0f6946ef798ba34ac1ad00b3720';
// Mint 1
let MINT_ADDRESS_1 = '';
let ACCOUNT_ADDRESS_1 = '';
// Mint 2
let MINT_ADDRESS_2 = '';
let ACCOUNT_ADDRESS_2 = '';
// Pool 1
let POOL_ADDRESS_1 = '';
let TREASURY_ADDRESS_1 = '';
let LPT_ADDRESS_1 = '';
// Pool 2
let POOL_ADDRESS_2 = '';
let TREASURY_ADDRESS_2 = '';
let LPT_ADDRESS_2 = '';


describe('Swap library', function () {
  before('Mint 1', function (done) {
    const mint = createAccount();
    const account = createAccount();
    MINT_ADDRESS_1 = mint.publicKey.toBase58();
    ACCOUNT_ADDRESS_1 = account.publicKey.toBase58();
    const payer = fromSecretKey(PAYER);
    const splt = new SPLT();
    splt.initializeMint(9, null, mint, payer).then(txId => {
      return splt.initializeAccount(account, MINT_ADDRESS_1, payer);
    }).then(txId => {
      return splt.mintTo(5000000000000000000n, MINT_ADDRESS_1, ACCOUNT_ADDRESS_1, payer);
    }).then(txId => {
      return done();
    }).catch(er => {
      return done(er);
    });
  });

  before('Token 2', function (done) {
    const mint = createAccount();
    const account = createAccount();
    MINT_ADDRESS_2 = mint.publicKey.toBase58();
    ACCOUNT_ADDRESS_2 = account.publicKey.toBase58();
    const payer = fromSecretKey(PAYER);
    const splt = new SPLT();
    splt.initializeMint(9, null, mint, payer).then(txId => {
      return splt.initializeAccount(account, MINT_ADDRESS_2, payer);
    }).then(txId => {
      return splt.mintTo(5000000000000000000n, MINT_ADDRESS_2, ACCOUNT_ADDRESS_2, payer);
    }).then(txId => {
      return done();
    }).catch(er => {
      return done(er);
    });
  });

  before('Pool 1', function (done) {
    const swap = new Swap();
    const treasury = createAccount();
    const lpt = createAccount();
    const payer = fromSecretKey(PAYER);
    TREASURY_ADDRESS_1 = treasury.publicKey.toBase58();
    LPT_ADDRESS_1 = lpt.publicKey.toBase58();
    createStrictAccount(swap.swapProgramId).then(pool => {
      POOL_ADDRESS_1 = pool.publicKey.toBase58();
      return swap.initializePool(
        1000000000000n,
        50000000000n,
        ACCOUNT_ADDRESS_1,
        MINT_ADDRESS_1,
        pool,
        treasury,
        lpt,
        payer);
    }).then(txId => {
      return done();
    }).catch(er => {
      return done(er);
    });
  });

  before('Pool 2', function (done) {
    const swap = new Swap();
    const treasury = createAccount();
    const lpt = createAccount();
    const payer = fromSecretKey(PAYER);
    TREASURY_ADDRESS_2 = treasury.publicKey.toBase58();
    LPT_ADDRESS_2 = lpt.publicKey.toBase58();
    createStrictAccount(swap.swapProgramId).then(pool => {
      POOL_ADDRESS_2 = pool.publicKey.toBase58();
      return swap.initializePool(
        2000000000000n,
        80000000000n,
        ACCOUNT_ADDRESS_2,
        MINT_ADDRESS_2,
        pool,
        treasury,
        lpt,
        payer);
    }).then(txId => {
      return done();
    }).catch(er => {
      return done(er);
    });
  });

  describe('Test constructor', function () {
    it('Should fill configs', function (done) {
      // PAYER
      const payer = fromSecretKey(PAYER);
      console.log('PAYER:', payer.publicKey.toBase58());
      // Mint 1
      console.log('MINT_ADDRESS_1:', MINT_ADDRESS_1);
      console.log('ACCOUNT_ADDRESS_1:', ACCOUNT_ADDRESS_1);
      // Mint 2
      console.log('MINT_ADDRESS_2:', MINT_ADDRESS_2);
      console.log('ACCOUNT_ADDRESS_2:', ACCOUNT_ADDRESS_2);
      // Pool 1
      console.log('POOL_ADDRESS_1:', POOL_ADDRESS_1);
      console.log('TREASURY_ADDRESS_1:', TREASURY_ADDRESS_1);
      console.log('LPT_ADDRESS_1:', LPT_ADDRESS_1);
      // Pool 2
      console.log('POOL_ADDRESS_2:', POOL_ADDRESS_2);
      console.log('TREASURY_ADDRESS_2:', TREASURY_ADDRESS_2);
      console.log('LPT_ADDRESS_2:', LPT_ADDRESS_2);

      return done();
    });

    it('Should be a valid default in constructor', function (done) {
      try {
        const swap = new Swap();
        return done();
      } catch (er) {
        return done(er);
      }
    });

    it('Should be a valid address in constructor', function (done) {
      try {
        const swap = new Swap('F5SvYWVLivzKc8XjoKaKxeXe2Yo8YZbJtbPbvq3b2sGj');
        return done();
      } catch (er) {
        return done(er);
      }
    });

    it('Should be an invalid address in constructor', function (done) {
      try {
        const swap = new Swap('abc');
        return done('An invalid address is skipped');
      } catch (er) {
        return done();
      }
    });
  });

  describe('Test Pool', function () {
    it('Should be a valid pool data', function (done) {
      const swap = new Swap();
      swap.getPoolData(POOL_ADDRESS_1).then(data => {
        return done();
      }).catch(er => {
        return done(er);
      });
    });

    it('Should initialize pool', function (done) {
      const swap = new Swap();
      const treasury = createAccount();
      const lpt = createAccount();
      const payer = fromSecretKey(PAYER);
      createStrictAccount(swap.swapProgramId).then(pool => {
        return swap.initializePool(
          1000000000000n,
          50000000000n,
          ACCOUNT_ADDRESS_1,
          MINT_ADDRESS_1,
          pool,
          treasury,
          lpt,
          payer);
      }).then(txId => {
        return swap.getLPTData(lpt.publicKey.toBase58());
      }).then(data => {
        return done();
      }).catch(er => {
        return done(er);
      });
    });

    it('Should swap', function (done) {
      const swap = new Swap();
      const payer = fromSecretKey(PAYER);
      swap.swap(
        10000000000n,
        POOL_ADDRESS_1,
        TREASURY_ADDRESS_1,
        ACCOUNT_ADDRESS_1,
        POOL_ADDRESS_2,
        TREASURY_ADDRESS_2,
        ACCOUNT_ADDRESS_2,
        payer
      ).then(txId => {
        return swap.getLPTData(LPT_ADDRESS_2);
      }).then(data => {
        return done();
      }).catch(er => {
        return done(er);
      })
    });
  });

  describe('Test LPT', function () {
    it('Should be a valid lpt data', function (done) {
      const swap = new Swap();
      swap.getLPTData(LPT_ADDRESS_1).then(data => {
        return done();
      }).catch(er => {
        return done(er);
      });
    });

    it('Should add liquidity', function (done) {
      const swap = new Swap();
      const payer = fromSecretKey(PAYER);
      const lpt = createAccount();
      const lptAddress = lpt.publicKey.toBase58();
      swap.initializeLPT(lpt, POOL_ADDRESS_1, payer).then(txId => {
        return swap.getLPTData(lptAddress);
      }).then(data => {
        return swap.addLiquidity(
          100000000000n,
          POOL_ADDRESS_1,
          TREASURY_ADDRESS_1,
          lptAddress,
          ACCOUNT_ADDRESS_1,
          payer
        )
      }).then(txId => {
        return swap.getLPTData(lptAddress);
      }).then(data => {
        return done();
      }).catch(er => {
        return done(er);
      });
    });

    it('Should remove liquidity', function (done) {
      const swap = new Swap();
      const payer = fromSecretKey(PAYER);
      swap.removeLiquidity(
        5000000000n,
        POOL_ADDRESS_1,
        TREASURY_ADDRESS_1,
        LPT_ADDRESS_1,
        ACCOUNT_ADDRESS_1,
        payer
      ).then(txId => {
        return swap.getLPTData(LPT_ADDRESS_1);
      }).then(data => {
        return done();
      }).catch(er => {
        return done(er);
      });
    });

    it('Should transfer', function (done) {
      const swap = new Swap();
      const lpt = createAccount();
      const lptAddress = lpt.publicKey.toBase58();
      const payer = fromSecretKey(PAYER);

      swap.initializeLPT(lpt, POOL_ADDRESS_1, payer).then(txId => {
        return swap.getLPTData(lptAddress);
      }).then(data => {
        return swap.transfer(1000000000n, LPT_ADDRESS_1, lptAddress, payer);
      }).then(txId => {
        return swap.getLPTData(lptAddress);
      }).then(data => {
        return done();
      }).catch(er => {
        return done(er);
      });
    });

    it('Should close Pool & close LPT', function (done) {
      const swap = new Swap();
      const payer = fromSecretKey(PAYER);
      const dstAddress = payer.publicKey.toBase58();

      swap.removeLiquidity(
        80000000000n,
        POOL_ADDRESS_2,
        TREASURY_ADDRESS_2,
        LPT_ADDRESS_2,
        ACCOUNT_ADDRESS_2,
        payer
      ).then(txId => {
        return swap.closeLPT(LPT_ADDRESS_2, dstAddress, payer);
      }).then(txId => {
        return done();
      }).catch(er => {
        return done(er);
      });
    });
  });

});