const BN = require("bn.js");

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

const PRECISION = new BN("1000000000000000000");
const DOUBLE_PRECISION = new BN("1000000000000000000000000000000000000");

const oracle = {}

oracle._alpha = (newBidReserve, bidReserve) => {
  const br = new BN(bidReserve);
  const nbr = new BN(newBidReserve);
  return br.mul(DOUBLE_PRECISION).div(nbr);
}

oracle._reversedAlpha = (newBidReserve, bidReserve) => {
  const br = new BN(bidReserve);
  const nbr = new BN(newBidReserve);
  return nbr.mul(DOUBLE_PRECISION).div(br);
}

oracle._lambda = (bidLPT, askLPT) => {
  const bl = new BN(bidLPT);
  const al = new BN(askLPT);
  return al.mul(PRECISION).div(bl);
}

oracle._beta = (newBidReserve, bidReserve, bidLPT, askLPT) => {
  const two = new BN(2);
  const four = new BN(4);

  const alpha = oracle._alpha(newBidReserve, bidReserve);
  const reversedAlpha = oracle._reversedAlpha(newBidReserve, bidReserve);
  const lambda = oracle._lambda(bidLPT, askLPT);

  const b = reversedAlpha.sub(alpha).div(lambda);
  const delta = b.sqr().add(four.mul(DOUBLE_PRECISION));

  return delta.sqrt().sub(b).div(two);
}

oracle.curve = (newBidReserve, bidReserve, bidLPT, askReserve, askLPT) => {
  const ar = new BN(askReserve);
  const beta = oracle._beta(newBidReserve, bidReserve, bidLPT, askLPT);
  return ar.mul(beta).div(PRECISION);
}

oracle.reversedCurve = (newAskReserve, bidReserve, bidLPT, askReserve, askLPT) => {
  // const ar = new BN(askReserve);
  // const beta = oracle._beta(newAskReserve, bidReserve, bidLPT, askLPT);
  // return ar.mul(beta).div(PRECISION);
}

module.exports = oracle;
