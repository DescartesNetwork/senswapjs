const { 
  _curve, curve, _reversedCurve, reversedCurve,
  slippage, ratio,
} = require('../dist');

const newBidReserve = 1000001000000000n;
const newAskReserve = 299998000007666658n;
const bidReserve = '1000000000000000';
const bidLPT = '2000000000000000000';
const askReserve = '300000000000000000';
const askLPT = '300000000000000000';

describe('Oracle library', function () {

  describe('Curve', function () {
    it('Should compute alpha', function (done) {
      const a = _curve.alpha(2, 1).toString();
      if (a !== '500000000000000000000000000000000000') return done('Wrong alpha');
      return done();
    });

    it('Should compute reversed alpha', function (done) {
      const ra = _curve.reversedAlpha(2, 1).toString();
      if (ra !== '2000000000000000000000000000000000000') return done('Wrong reversed alpha');
      return done();
    });

    it('Should compute lambda', function (done) {
      const l = _curve.lambda(2, 1).toString();
      if (l !== '500000000000000000') return done('Wrong lambda');
      return done();
    });

    it('Should compute beta', function (done) {
      const b = _curve.beta(2, 1, 2, 1);
      if (b.toString() !== '302775637731994646') return done('Wrong beta');
      return done();
    });
  });

  describe('Reversed curve', function () {
    it('Should compute beta', function (done) {
      const b = _reversedCurve.beta(2, 1).toString();
      if (b !== '2000000000000000000000000000000000000') return done('Wrong beta');
      return done();
    });

    it('Should compute reversed beta', function (done) {
      const rb = _reversedCurve.reversedBeta(2, 1).toString();
      if (rb !== '500000000000000000000000000000000000') return done('Wrong reversed beta');
      return done();
    });

    it('Should compute reversed lambda', function (done) {
      const rl = _reversedCurve.reversedLambda(2, 1).toString();
      if (rl !== '2000000000000000000') return done('Wrong reversed lambda');
      return done();
    });

    it('Should compute alpha', function (done) {
      const a = _reversedCurve.alpha(2, 1, 2, 1);
      if (a.toString() !== '1443000468164691395') return done('Wrong alpha');
      return done();
    });
  });

  describe('Main', function () {
    it('Should compute curve', function (done) {
      const c = curve(newBidReserve, bidReserve, bidLPT, askReserve, askLPT);
      if (c !== newAskReserve) return done('Wrong market state');
      return done();
    });

    it('Should compute reversed curve', function (done) {
      const c = reversedCurve(newAskReserve, bidReserve, bidLPT, askReserve, askLPT);
      if (c !== newBidReserve) return done('Wrong market state');
      return done();
    });

    it('Should compute slippage', function (done) {
      const s = slippage(newBidReserve, bidReserve, bidLPT, askReserve, askLPT);
      if (s !== 0.9999923333665555) return done('Wrong slippage');
      return done();
    });

    it('Should compute ratio', function (done) {
      const r = ratio(newBidReserve, bidReserve, bidLPT, askReserve, askLPT);
      if (r !== 1999.992333341) return done('Wrong ratio');
      return done();
    });
  });
});