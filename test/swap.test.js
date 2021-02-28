const {
  fromSecretKey, createAccount, createStrictAccount,
  Swap, SPLT
} = require('../dist');

const PAYER = 'e06a1a17cf400f6c322e32377a9a7653eecf58f3eb0061023b743c689b43a5fa491573553e4afdcdcd1c94692a138dd2fd0dc0f6946ef798ba34ac1ad00b3720';
const POOL_ADDRESS = 'Hhcqht7K8MNJCGaiEC9xe7qZcxWFb6A7GCHMkMoLgT6e';
const TREASURY_ADDRESS = '9Dqhaf2iaExVb55y3fPhaXMKG8APAyWeFVZzxoSZu17v';
const LPT_ADDRESS = '1hg8yS7C9AaKvYEFYYy5kbf7yFmnNha8WoUsMQDp1WM';
const MINT_ADDRESS = '6Qvp2kKkZwPoNibncFPygiEJJd6sFP5JeHbtsQDyBqNN';
const SRC_ADDRESS = 'AHukZ3YJWVUpEERwsqZ6YKumnfJ2eYLqDekuWFiLDkJn';
const DST_ADDRESS = 'Hw7nKqfp5EmKGroX7M3LQHuuWHvfgwTSajHYfmLUt8u5';


describe('Swap library', function () {
  describe('Test constructor', function () {
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
      swap.getPoolData(POOL_ADDRESS).then(data => {
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
          SRC_ADDRESS,
          MINT_ADDRESS,
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
      const splt = new SPLT();
      const swap = new Swap();
      const payer = fromSecretKey(PAYER);

      const askLPT = createAccount();
      const askLPTAddress = askLPT.publicKey.toBase58();
      const askTreasury = createAccount();
      const askTreasuryAddress = askTreasury.publicKey.toBase58();
      const askMint = createAccount();
      const askMintAddress = askMint.publicKey.toBase58();
      const dst = createAccount();
      const dstAddress = dst.publicKey.toBase58();
      let askPoolAddress = null;
      splt.initializeMint(9, null, askMint, payer).then(txId => {
        return splt.initializeAccount(dst, askMintAddress, payer);
      }).then(txId => {
        return splt.mintTo(5000000000000000000n, askMintAddress, dstAddress, payer);
      }).then(txId => {
        return createStrictAccount(swap.swapProgramId);
      }).then(pool => {
        askPoolAddress = pool.publicKey.toBase58();
        return swap.initializePool(
          1000000000000000n,
          1000000000000n,
          dstAddress,
          askMintAddress,
          pool,
          askTreasury,
          askLPT,
          payer
        );
      }).then(txId => {
        return swap.getLPTData(askLPTAddress);
      }).then(data => {
        return swap.swap(
          10000000000n,
          POOL_ADDRESS,
          TREASURY_ADDRESS,
          SRC_ADDRESS,
          askPoolAddress,
          askTreasuryAddress,
          dstAddress,
          payer
        )
      }).then(txId => {
        return swap.getLPTData(askLPTAddress);
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
      swap.getLPTData(LPT_ADDRESS).then(data => {
        return done();
      }).catch(er => {
        return done(er);
      });
    });

    it('Should add liquidity (with lpt account)', function (done) {
      const swap = new Swap();
      const lpt = createAccount();
      const payer = fromSecretKey(PAYER);
      swap.addLiquidity(
        100000000000n,
        POOL_ADDRESS,
        TREASURY_ADDRESS,
        lpt,
        SRC_ADDRESS,
        payer
      ).then(txId => {
        return swap.getLPTData(lpt.publicKey.toBase58());
      }).then(data => {
        return done();
      }).catch(er => {
        return done(er);
      });
    });

    it('Should add liquidity (with lpt address)', function (done) {
      const swap = new Swap();
      const payer = fromSecretKey(PAYER);
      swap.addLiquidity(
        100000000000n,
        POOL_ADDRESS,
        TREASURY_ADDRESS,
        LPT_ADDRESS,
        SRC_ADDRESS,
        payer
      ).then(txId => {
        return swap.getLPTData(LPT_ADDRESS);
      }).then(data => {
        return done();
      }).catch(er => {
        return done(er);
      });
    });

    it('Should remove liquidity', function (done) {
      const swap = new Swap();
      const payer = fromSecretKey(PAYER);
      swap.addLiquidity(
        5000000000n,
        POOL_ADDRESS,
        TREASURY_ADDRESS,
        LPT_ADDRESS,
        DST_ADDRESS,
        payer
      ).then(txId => {
        return swap.getLPTData(LPT_ADDRESS);
      }).then(data => {
        return done();
      }).catch(er => {
        return done(er);
      });
    });
  });

});