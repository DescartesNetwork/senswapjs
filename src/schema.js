const schema = {}


/**
 * SRC20
 */
schema.SRC20_ACCOUNT_SCHEMA = [
  { key: 'owner', type: 'pub' },
  { key: 'token', type: 'pub' },
  { key: 'amount', type: 'u64' },
  { key: 'initialized', type: 'bool' }
];

schema.TOKEN_SCHEMA = [
  { key: 'symbol', type: '[char;4]' },
  { key: 'total_supply', type: 'u64' },
  { key: 'decimals', type: 'u8' },
  { key: 'initialized', type: 'bool' }
];

/**
 * SenSwap
 */

schema.DAO_SCHEMA = [
  { key: 'signers', type: '[pub;11]' },
  { key: 'is_initialized', type: 'bool' }
];

schema.NETWORK_STATE = {
  get Uninitialized() {
    return 0;
  },
  get Initialized() {
    return 1;
  },
  get Activated() {
    return 2;
  }
}
schema.NETWORK_SCHEMA = [
  { key: 'owner', type: 'pub' },
  { key: 'primary', type: 'pub' },
  { key: 'vault', type: 'pub' },
  { key: 'mints', type: '[pub;21]' },
  { key: 'state', type: 'u8' }
];

schema.POOL_STATE = {
  get Uninitialized() {
    return 0;
  },
  get Initialized() {
    return 1;
  },
  get Frozen() {
    return 2;
  }
}
schema.POOL_SCHEMA = [
  { key: 'owner', type: 'pub' },
  { key: 'network', type: 'pub' },
  { key: 'mint', type: 'pub' },
  { key: 'treasury', type: 'pub' },
  { key: 'reserve', type: 'u64' },
  { key: 'lpt', type: 'u128' },
  { key: 'state', type: 'u8' }
];

schema.LPT_SCHEMA = [
  { key: 'owner', type: 'pub' },
  { key: 'pool', type: 'pub' },
  { key: 'lpt', type: 'u128' },
  { key: 'is_initialized', type: 'bool' }
];

/**
 * SPL Token
 */

schema.MINT_SCHEMA = [
  { key: "mint_authority_option", type: "u32" },
  { key: "mint_authority", type: "pub" },
  { key: "supply", type: "u64" },
  { key: "decimals", type: "u8" },
  { key: "is_initialized", type: "bool" },
  { key: "freeze_authority_option", type: "u32" },
  { key: "freeze_authority", type: "pub" },
]

schema.ACCOUNT_STATE = {
  get Uninitialized() {
    return 0;
  },
  get Initialized() {
    return 1;
  },
  get Frozen() {
    return 2;
  }
}
schema.ACCOUNT_SCHEMA = [
  { key: "mint", type: "pub" },
  { key: "owner", type: "pub" },
  { key: "amount", type: "u64" },
  { key: "delegate_option", type: "u32" },
  { key: "delegate", type: "pub" },
  { key: "state", type: "u8" },
  { key: "is_native_option", type: "u32" },
  { key: "is_native", type: "u64" },
  { key: "delegated_amount", type: "u64" },
  { key: "close_authority_option", type: "u32" },
  { key: "close_authority", type: "pub" }
]

schema.MULTISIG_SCHEMA = [
  { key: "m", type: "u8" },
  { key: "n", type: "u8" },
  { key: "is_initialized", type: "bool" },
  { key: "signers", type: "[pub;11]" }
]

module.exports = schema;