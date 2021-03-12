const { div, decimalize, undecimalize } = require('../dist');

describe('Math library', function () {
  it('Should divide', function (done) {
    const a = div(123n, 456n);
    if (a !== 0.269736842) return done('Wrong result');
    return done();
  });

  it('Should decimalize #1', function (done) {
    const a = decimalize(5000000000, 9);
    if (a !== 5000000000000000000n) return done('Wrong result');
    return done();
  });

  it('Should decimalize #2', function (done) {
    const a = decimalize(1.1, 9);
    if (a !== 1100000000n) return done('Wrong result');
    return done();
  });

  it('Should undecimalize', function (done) {
    const a = undecimalize(5000123456789n, 9);
    if (a !== 5000.123456789) return done('Wrong result');
    return done();
  });
});