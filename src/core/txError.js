class ParsedTransactionError extends Error {
  constructor(transactionError) {
    if (!transactionError || !transactionError.InstructionError) {
      super(JSON.stringify(transactionError));
      return;
    }

    const instruction = transactionError.InstructionError[1];
    // Type 1: { InstructionError: [ 0, 'ProgramFailedToComplete' ] }
    if (typeof instruction === 'string') {
      super(instruction);
      return;
    }

    // Type 2: { InstructionError: [ 0, { Custom: 1 } ] }
    const errCode = parseInt(instruction.Custom);
    let message;
    switch (errCode) {
      case 1:
        message = 'Insufficient funds';
        break;
      case 7:
        message = 'Zero value';
        break;
      case 10:
        message = 'Exceed limit';
        break;
      case 16:
        message = 'This token mint cannot freeze accounts';
        break;
      default:
        message = 'Unknown - ' + JSON.stringify(instruction);
        break;
    }

    super(message);
    this.name = 'Transaction Error';
  }
}

module.exports = ParsedTransactionError;