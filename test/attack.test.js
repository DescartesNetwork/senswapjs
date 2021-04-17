const { div } = require('../dist/math');
const { curve } = require('../dist/oracle');

const DECIMALS = 10n ** 9n;

function poolInfo(name, data) {
  console.group();
  console.log(`===== Pool ${name} =====`);
  console.log(`*** Reserve: ${div(data.reserve, DECIMALS)}`);
  console.log(`*** Price: $${div(data.lpt, data.reserve)}`);
  console.log(`*** Value: $${div(data.lpt, DECIMALS)}`);
  console.groupEnd();
}

function price(data) {
  return div(data.lpt, data.reserve);
}

function attackerInfo(data) {
  console.group();
  console.log(`===== Attacker =====`);
  console.log(`*** A: ${div(data.a, DECIMALS)}`);
  console.log(`*** B: ${div(data.b, DECIMALS)}`);
  console.log(`*** Value: $${div(data.a, DECIMALS) * 10 + div(data.b, DECIMALS) * 0.1}`);
  console.groupEnd();
}

describe('Attack scenario', function () {
  it('Attack based on slippage', function (done) {
    const A = { reserve: 10n ** 4n * DECIMALS, lpt: 10n ** 9n * DECIMALS }
    const B = { reserve: 10n ** 5n * DECIMALS, lpt: 10n ** 4n * DECIMALS }
    let attacker = { a: 0n, b: 0n }
    poolInfo('A', A);
    poolInfo('B', B);
    attackerInfo(attacker);
    console.log('\n');

    // Swap A for B
    const a = 1n * DECIMALS;
    const A1 = { ...A, reserve: A.reserve + a }
    const B1 = { ...B, reserve: curve(A1.reserve, A.reserve, A.lpt, B.reserve, B.lpt) }
    attacker = { a: attacker.a - a, b: attacker.b + B.reserve - B1.reserve }
    poolInfo('A1', A1);
    poolInfo('B1', B1);
    attackerInfo(attacker);
    console.log('\n');

    // Deposit B to x10 reserve
    const _b = B1.reserve * 9n;
    const _lpt = global.BigInt(parseInt(parseInt(_b) * price(B1)));
    const A2 = { ...A1 }
    const B2 = { reserve: B1.reserve + _b, lpt: B1.lpt + _lpt }
    attacker = { a: attacker.a, b: attacker.b - _b }
    poolInfo('A2', A2);
    poolInfo('B2', B2);
    attackerInfo(attacker);
    console.log('\n');

    // Sell B to get A until the B price reduce to 0.1
    const b = 10n ** 6n * DECIMALS;
    const B3 = { ...B2, reserve: B2.reserve + b }
    const A3 = { ...A2, reserve: curve(B3.reserve, B2.reserve, B2.lpt, A2.reserve, A2.lpt) }
    attacker = { a: attacker.a + A2.reserve - A3.reserve, b: attacker.b - b }
    poolInfo('A3', A3);
    poolInfo('B3', B3);
    attackerInfo(attacker);
    console.log('\n');

    return done();
  });

  it('Attack based on slippage with limit differential', function (done) {
    const A = { reserve: 10n ** 4n * DECIMALS, lpt: 10n ** 5n * DECIMALS }
    const B = { reserve: 10n ** 5n * DECIMALS, lpt: 10n ** 4n * DECIMALS }
    let attacker = { a: 0n, b: 0n }
    poolInfo('A', A);
    poolInfo('B', B);
    attackerInfo(attacker);
    console.log('\n');

    // Swap 1A for B
    const a = 1000n * DECIMALS;
    const A1 = { ...A, reserve: A.reserve + a }
    const B1 = { ...B, reserve: curve(A1.reserve, A.reserve, A.lpt, B.reserve, B.lpt) }
    attacker = { a: attacker.a - a, b: attacker.b + B.reserve - B1.reserve }
    poolInfo('A1', A1);
    poolInfo('B1', B1);
    attackerInfo(attacker);
    console.log('\n');

    // Deposit B to x10 reserve
    const _b = B1.reserve * 9n;
    const _lpt = global.BigInt(parseInt(parseInt(_b) * price(B1)));
    const A2 = { ...A1 }
    const B2 = { reserve: B1.reserve + _b, lpt: B1.lpt + _lpt }
    attacker = { a: attacker.a, b: attacker.b - _b }
    poolInfo('A2', A2);
    poolInfo('B2', B2);
    attackerInfo(attacker);
    console.log('\n');

    // Sell B to get A until the B price reduce to 0.1
    const b = 10n ** 6n * DECIMALS;
    const B3 = { ...B2, reserve: B2.reserve + b }
    const A3 = { ...A2, reserve: curve(B3.reserve, B2.reserve, B2.lpt, A2.reserve, A2.lpt) }
    attacker = { a: attacker.a + A2.reserve - A3.reserve, b: attacker.b - b }
    poolInfo('A3', A3);
    poolInfo('B3', B3);
    attackerInfo(attacker);
    console.log('\n');

    return done();
  });

});