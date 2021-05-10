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

const PRECISION = new BN('1000000');
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
oracle.__rake = (delta, reserveS, reserveA, reserveB) => {
  if (reserveS.isZero() || reserveA.isZero() || reserveB.isZero()) throw new Error('Invalid reserve');
  if (delta.isZero()) return [0, 0, 0];
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
oracle._rake = (deltaS, deltaA, deltaB, reserveS, reserveA, reserveB) => {
  const [s1, a1, b1] = oracle.__rake(deltaS, reserveS, reserveA, reserveB);
  reserveS = reserveS.add(deltaS);
  const [a2, b2, s2] = oracle.__rake(deltaA, reserveA, reserveB, reserveS);
  reserveA = reserveA.add(deltaA);
  const [b3, s3, a3] = oracle.__rake(deltaB, reserveB, reserveS, reserveA);
  reserveB = reserveB.add(deltaB);
  const lpt = s1.add(s2).add(s3);
  return [lpt, reserveS, reserveA, reserveB];
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
  const slippage = (newAskReserve * bidReserve - newBidReserve * askReserve) * feeDecimals / (newBidReserve * askReserve);
  return slippage;
}

oracle.rake = (
  deltaS, deltaA, deltaB,
  reserveS, reserveA, reserveB,
  fee, feeDecimals
) => {
  deltaS = new BN(deltaS.toString());
  deltaA = new BN(deltaA.toString());
  deltaB = new BN(deltaB.toString());
  reserveS = new BN(reserveS.toString());
  reserveA = new BN(reserveA.toString());
  reserveB = new BN(reserveB.toString());
  fee = new BN(fee.toString());
  feeDecimals = new BN(feeDecimals.toString());
  const [s, newReserveS, newReserveA, newReserveB] = oracle._rake(
    deltaS, deltaA, deltaB,
    reserveS, reserveA, reserveB,
  );
  const sFee = s.mul(fee).div(feeDecimals);
  const sInFee = s.sub(sFee);
  const newReserveSInFee = newReserveS.add(sFee);
  return {
    lpt: global.BigInt(sInFee.toString()),
    newReserveS: global.BigInt(newReserveSInFee.toString()),
    newReserveA: global.BigInt(newReserveA.toString()),
    newReserveB: global.BigInt(newReserveB.toString()),
  }
}

module.exports = oracle;
