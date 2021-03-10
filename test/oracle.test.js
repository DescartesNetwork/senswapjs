const { _alpha, _reversedAlpha, _lambda, _beta, curve } = require("../dist");

describe('Oracle library', function () {
  it('Should compute alpha', function (done) {
    const a = _alpha(2, 1).toString();
    if (a !== '500000000000000000000000000000000000') return done('Wrong alpha');
    return done();
  });

  it('Should compute reversed alpha', function (done) {
    const ra = _reversedAlpha(2, 1).toString();
    if (ra !== '2000000000000000000000000000000000000') return done('Wrong reversed alpha');
    return done();
  });

  it('Should compute lambda', function (done) {
    const l = _lambda(2, 1).toString();
    if (l !== '500000000000000000') return done('Wrong lambda');
    return done();
  });

  it('Should compute beta', function (done) {
    const b = _beta(2, 1, 2, 1);
    if (b.toString() !== '302775637731994646') return done('Wrong beta');
    return done();
  });

  it('Should compute curve', function (done) {
    const newBidReserve = '1000001000000000';
    const bidReserve = '1000000000000000';
    const bidLPT = '2000000000000000000';
    const askReserve = '300000000000000000';
    const askLPT = '300000000000000000';
    const c = curve(newBidReserve, bidReserve, bidLPT, askReserve, askLPT);
    if (c.toString() !== '299998000007666658') return done('Wrong beta');
    return done();
  });
});