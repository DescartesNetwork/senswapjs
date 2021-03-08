const { randEmoji, salt } = require('../dist');


describe('SPLT library', function () {
  it('Should randomize emoji', function (done) {
    const emoji = randEmoji('seed');
    if (!emoji) return done('Cannot randomize emoji');
    return done();
  });

  it('Should generate salt', function (done) {
    const seed = salt();
    if (!seed) return done('Cannot generate salt');
    return done();
  });
});