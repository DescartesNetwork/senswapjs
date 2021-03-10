const BN = require('bn.js');
const { div } = require('../dist/math');
const { undecimalize } = require('./math');

// BN.js patch: sqrt()
BN.prototype.sqrt = function () {
  const one = new BN(1);
  const two = new BN(2);
  if (this.lt(two)) return this;

  let start = one;
  let end = this;
  let ans = one;
  while (start.lte(end)) {
    const mid = start.add(end).div(two);
    if (mid.sqr().eq(this)) return mid;
    if (mid.sqr().lt(this)) {
      start = mid.add(one);
      ans = mid;
    } else {
      end = mid.sub(one);
    }
  }
  return ans;
}

const PRECISION = new BN('1000000000000000000');
const DOUBLE_PRECISION = new BN('1000000000000000000000000000000000000');

const oracle = {}

/**
 * Curve
 * ALPHA -> BETA
 */

oracle._curve = {
  // Double precision
  alpha: (newBidReserve, bidReserve) => {
    const br = new BN(bidReserve);
    const nbr = new BN(newBidReserve);
    return br.mul(DOUBLE_PRECISION).div(nbr);
  },
  // Double precision
  reversedAlpha: (newBidReserve, bidReserve) => {
    const br = new BN(bidReserve);
    const nbr = new BN(newBidReserve);
    return nbr.mul(DOUBLE_PRECISION).div(br);
  },
  // Single precision
  lambda: (bidLPT, askLPT) => {
    const bl = new BN(bidLPT);
    const al = new BN(askLPT);
    return al.mul(PRECISION).div(bl);
  },
  // Single precision
  beta: (newBidReserve, bidReserve, bidLPT, askLPT) => {
    const two = new BN(2);
    const four = new BN(4);
    const alpha = oracle._curve.alpha(newBidReserve, bidReserve); // Double precision
    const reversedAlpha = oracle._curve.reversedAlpha(newBidReserve, bidReserve); // Double precision
    const lambda = oracle._curve.lambda(bidLPT, askLPT); // Single precision
    const b = reversedAlpha.sub(alpha).div(lambda); // Single precision
    const delta = b.sqr().add(four.mul(DOUBLE_PRECISION)); // Double precision
    return delta.sqrt().sub(b).div(two); // Single precision
  },
  // Single precision
  exec: (newBidReserve, bidReserve, bidLPT, askReserve, askLPT) => {
    const ar = new BN(askReserve);
    const beta = oracle._curve.beta(newBidReserve, bidReserve, bidLPT, askLPT);
    return ar.mul(beta);
  }
}

/**
 * Reversed Curve
 * BETA -> ALPHA
 */

oracle._reversedCurve = {
  // Double precision
  beta: (newAskReserve, askReserve) => {
    const ar = new BN(askReserve);
    const nar = new BN(newAskReserve);
    return nar.mul(DOUBLE_PRECISION).div(ar);
  },
  // Double precision
  reversedBeta: (newAskReserve, askReserve) => {
    const ar = new BN(askReserve);
    const nar = new BN(newAskReserve);
    return ar.mul(DOUBLE_PRECISION).div(nar);
  },
  // Single precision
  reversedLambda: (bidLPT, askLPT) => {
    const bl = new BN(bidLPT);
    const al = new BN(askLPT);
    return bl.mul(PRECISION).div(al);
  },
  // Single precision
  alpha: (newAskReserve, askReserve, bidLPT, askLPT) => {
    const two = new BN(2);
    const four = new BN(4);
    const beta = oracle._reversedCurve.beta(newAskReserve, askReserve); // Double precision
    const reversedBeta = oracle._reversedCurve.reversedBeta(newAskReserve, askReserve); // Double precision
    const reversedLambda = oracle._reversedCurve.reversedLambda(bidLPT, askLPT); // Single precision
    const b = reversedBeta.sub(beta).div(reversedLambda); // Single precision
    const delta = b.sqr().add(four.mul(DOUBLE_PRECISION)); // Double precision
    return delta.sqrt().sub(b).div(two); // Single precision
  },
  // Single precision
  exec: (newAskReserve, bidReserve, bidLPT, askReserve, askLPT) => {
    const br = new BN(bidReserve);
    const alpha = oracle._reversedCurve.alpha(newAskReserve, askReserve, bidLPT, askLPT);
    return br.mul(DOUBLE_PRECISION).div(alpha);
  }
}

/**
 * Main
 */

oracle.curve = (newBidReserve, bidReserve, bidLPT, askReserve, askLPT) => {
  const nar = oracle._curve.exec(newBidReserve, bidReserve, bidLPT, askReserve, askLPT);
  return BigInt(nar.div(PRECISION).toString());
}

oracle.reversedCurve = (newAskReserve, bidReserve, bidLPT, askReserve, askLPT) => {
  const nbr = oracle._reversedCurve.exec(newAskReserve, bidReserve, bidLPT, askReserve, askLPT);
  return BigInt(nbr.div(PRECISION).toString());
}

oracle.slippage = (newBidReserve, bidReserve, bidLPT, _askReserve, askLPT) => {
  const alpha = oracle._curve.alpha(newBidReserve, bidReserve).div(PRECISION);
  const beta = oracle._curve.beta(newBidReserve, bidReserve, bidLPT, askLPT);
  const slippage = alpha.mul(beta);
  return undecimalize(slippage, 36);
}

oracle.ratio = (newBidReserve, bidReserve, bidLPT, askReserve, askLPT) => {
  const br = (new BN(bidReserve)).mul(PRECISION);
  const ar = (new BN(askReserve)).mul(PRECISION);
  const nbr = (new BN(newBidReserve)).mul(PRECISION);
  const nar = oracle._curve.exec(newBidReserve, bidReserve, bidLPT, askReserve, askLPT);
  const deltaBid = nbr.sub(br);
  const deltaAsk = ar.sub(nar);
  return div(deltaAsk, deltaBid);
}

module.exports = oracle;
