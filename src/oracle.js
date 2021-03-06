const BN = require('bn.js');

// BN.js patch: sqrt()
BN.prototype.sqrt = function () {
  if (this.lt(new BN(2))) return this;
  const bits = Math.floor((this.bitLength() + 1) / 2);
  let start = (new BN(1)).shln(bits - 1);
  let end = (new BN(1)).shln(bits + 1);
  while (start.lt(end)) {
    end = start.add(end).shrn(1);
    start = this.div(end);
  }
  return end;
}
// BN.js patch: cbrt()
BN.prototype.cbrt = function () {
  if (this.lt(new BN(2))) return this;
  const bits = Math.floor(this.bitLength() / 3);
  let end = (new BN(1)).shln(bits);
  while (true) {
    let next = this.div(end.pow(new BN(2))).add(end.mul(new BN(2))).div(new BN(3));
    if (end.eq(next)) return end;
    end = next;
  }
}

const TRIPPLE_PRECISION = new BN('1000000000000000000');

const oracle = {}

/**
 * Curve & Inverse Curve
 */
oracle._curve = (bidAmount, bidReserve, askReserve) => {
  const newBidReserve = bidAmount.add(bidReserve);
  const newAskReserve = bidReserve.mul(askReserve).div(newBidReserve);
  const askAmount = askReserve.sub(newAskReserve);
  return askAmount;
}
oracle._inverseCurve = (askAmount, bidReserve, askReserve) => {
  const newAskReserve = askReserve.sub(askAmount);
  const newBidReserve = bidReserve.mul(askReserve).div(newAskReserve);
  const bidAmount = newBidReserve.sub(bidReserve);
  return bidAmount;
}

/**
 * Single Rake && Multiple Rake
 */
oracle._rake = (delta, reserveS, reserveA, reserveB) => {
  if (reserveS.isZero() || reserveA.isZero() || reserveB.isZero()) throw new Error('Invalid reserve');
  if (delta.isZero()) return [new BN(0), new BN(0), new BN(0)];
  const cbrtOfDeltaPlusReserve = delta.add(reserveS).mul(TRIPPLE_PRECISION).cbrt();
  const cbrtOfReserce = reserveS.mul(TRIPPLE_PRECISION).cbrt();
  const z = cbrtOfDeltaPlusReserve.pow(new BN(2)).mul(cbrtOfReserce).div(TRIPPLE_PRECISION).sub(reserveS);
  const x = z.add(reserveS).mul(reserveS).sqrt().sub(reserveS);
  const y = z.sub(x);
  const s = delta.sub(z);
  const a = reserveA.mul(x).div(reserveS.add(x));
  const b = reserveB.mul(y).div(reserveS.add(z));
  return [s, a, b];
}

/**
 * Main
 */

oracle.curve = (bidAmount, bidReserve, askReserve, fee, feeDecimals) => {
  bidAmount = new BN(bidAmount.toString());
  bidReserve = new BN(bidReserve.toString());
  askReserve = new BN(askReserve.toString());
  fee = new BN(fee.toString());
  feeDecimals = new BN(feeDecimals.toString());
  const askAmountWithoutFee = oracle._curve(bidAmount, bidReserve, askReserve);
  const askAmount = askAmountWithoutFee.mul(feeDecimals.sub(fee)).div(feeDecimals);
  return global.BigInt(askAmount.toString());
}

oracle.inverseCurve = (askAmount, bidReserve, askReserve, fee, feeDecimals) => {
  askAmount = new BN(askAmount.toString());
  bidReserve = new BN(bidReserve.toString());
  askReserve = new BN(askReserve.toString());
  fee = new BN(fee.toString());
  feeDecimals = new BN(feeDecimals.toString());
  const bidAmountWithoutFee = oracle._inverseCurve(askAmount, bidReserve, askReserve);
  const bidAmount = bidAmountWithoutFee.mul(feeDecimals).div(feeDecimals.sub(fee));
  return global.BigInt(bidAmount.toString());
}

oracle.slippage = (bidAmount, bidReserve, askReserve, fee, feeDecimals) => {
  const askAmount = oracle.curve(bidAmount, bidReserve, askReserve, fee, feeDecimals);
  const newBidReserve = bidAmount + bidReserve;
  const newAskReserve = askReserve - askAmount;
  const slippage = (newBidReserve * askReserve - newAskReserve * bidReserve) * feeDecimals / (newBidReserve * askReserve);
  return slippage;
}

oracle.rake = (deltaS, deltaA, deltaB, reserveS, reserveA, reserveB, reserveLPT) => {
  let reserveSPrime = new BN(0);
  deltaS = new BN(deltaS.toString());
  deltaA = new BN(deltaA.toString());
  deltaB = new BN(deltaB.toString());
  reserveS = new BN(reserveS.toString());
  reserveA = new BN(reserveA.toString());
  reserveB = new BN(reserveB.toString());
  reserveLPT = new BN(reserveLPT.toString());

  const [s1, a1, b1] = oracle._rake(deltaS, reserveS, reserveA, reserveB);
  reserveS = reserveS.add(deltaS);
  reserveSPrime = reserveS.sub(s1);
  const lpt1 = s1.mul(reserveLPT).div(reserveSPrime);
  reserveLPT = reserveLPT.add(lpt1);

  const [a2, b2, s2] = oracle._rake(deltaA, reserveA, reserveB, reserveS);
  reserveA = reserveA.add(deltaA);
  reserveSPrime = reserveS.sub(s2);
  const lpt2 = s2.mul(reserveLPT).div(reserveSPrime);
  reserveLPT = reserveLPT.add(lpt2);

  const [b3, s3, a3] = oracle._rake(deltaB, reserveB, reserveS, reserveA);
  reserveB = reserveB.add(deltaB);
  reserveSPrime = reserveS.sub(s3);
  const lpt3 = s3.mul(reserveLPT).div(reserveSPrime);
  const lpt = lpt1.add(lpt2).add(lpt3);

  return {
    lpt: global.BigInt(lpt.toString()),
    newReserveS: global.BigInt(reserveS.toString()),
    newReserveA: global.BigInt(reserveA.toString()),
    newReserveB: global.BigInt(reserveB.toString()),
  }
}

module.exports = oracle;
