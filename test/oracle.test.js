const BN = require('bn.js');
const {
  _curve, curve, _inverseCurve, inverseCurve, slippage,
  __rake, _rake, rake,
} = require('../dist');

const fee = 2500000n;
const feeDecimals = 1000000000n;

const bidAmount = 1000000000n;
const bidReserve = 1000000000000000n;
const askAmount = 1000000000000n;
const askReserve = 300000000000000000n;

const deltaS = 1000000000n;
const deltaA = 2000000000n;
const deltaB = 3000000000n;
const reserseS = 100000000000n;
const reserseA = 5000000000000n;
const reserseB = 200000000000n;

describe('Oracle library', function () {

  describe('Curve & Inverse Curve', function () {
    it('Should compute curve', function (done) {
      const amount = _curve(
        new BN(bidAmount.toString()),
        new BN(bidReserve.toString()),
        new BN(askReserve.toString())
      );
      if (amount.toString() !== '299999700001') return done('Wrong _curve');
      return done();
    });

    it('Should compute inverse curve', function (done) {
      const amount = _inverseCurve(
        new BN(askAmount.toString()),
        new BN(bidReserve.toString()),
        new BN(askReserve.toString())
      );
      if (amount.toString() !== '3333344444') return done('Wrong _inverseCurve');
      return done();
    });
  });

  describe('Single Rake && Multiple Rake', function () {
    it('Should compute __rake', function (done) {
      const [lpt, a, b] = __rake(
        new BN(deltaS.toString()),
        new BN(reserseS.toString()),
        new BN(reserseA.toString()),
        new BN(reserseB.toString()),
      );
      if (lpt.toString() !== '334439583') return done('Wrong __rake');
      if (a.toString() !== '16556411410') return done('Wrong __rake');
      if (b.toString() !== '662256457') return done('Wrong __rake');
      return done();
    });

    it('Should compute _rake', function (done) {
      const [lpt, rs, ra, rb] = _rake(
        new BN(deltaS.toString()),
        new BN(deltaA.toString()),
        new BN(deltaB.toString()),
        new BN(reserseS.toString()),
        new BN(reserseA.toString()),
        new BN(reserseB.toString()),
      );
      if (lpt.toString() !== '847910833') return done('Wrong __rake');
      if (rs.toString() !== '101000000000') return done('Wrong __rake');
      if (ra.toString() !== '5002000000000') return done('Wrong __rake');
      if (rb.toString() !== '203000000000') return done('Wrong __rake');
      return done();
    });
  });

  describe('Main', function () {
    it('Should compute curve', function (done) {
      const amount = curve(bidAmount, bidReserve, askReserve, fee, feeDecimals);
      if (amount !== 299249700750n) return done('Wrong market state');
      return done();
    });

    it('Should compute inverse curve', function (done) {
      const amount = inverseCurve(askAmount, bidReserve, askReserve, fee, feeDecimals);
      if (amount !== 3341698690n) return done('Wrong market state');
      return done();
    });

    it('Should compute slippage', function (done) {
      const s = slippage(1000000000000n, bidReserve, askReserve, fee, feeDecimals);
      if (s !== 1800180n) return done('Wrong slippage');
      return done();
    });

    it('Should compute rake', function (done) {
      const { lpt, newReserveS, newReserveA, newReserveB } = rake(
        deltaS, deltaA, deltaB,
        reserseS, reserseA, reserseB,
        fee, feeDecimals
      );
      if (lpt !== 845791056n) return done('Wrong rake');
      if (newReserveS !== 101002119777n) return done('Wrong rake');
      if (newReserveA !== 5002000000000n) return done('Wrong rake');
      if (newReserveB !== 203000000000n) return done('Wrong rake');
      return done();
    });
  });
});