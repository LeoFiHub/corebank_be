import mongoose, { Document, Schema } from 'mongoose';

export interface ITransaction extends Document {
  userId: mongoose.Types.ObjectId;
  poolId?: mongoose.Types.ObjectId;
  type: 'DEPOSIT' | 'WITHDRAW' | 'INTEREST_PAYOUT';
  asset: 'BTC';
  amount: number;
  transactionDate: Date;
  status: 'completed' | 'pending' | 'failed';
  referenceId?: string;
  description?: string;
  createdAt: Date;
}

const TransactionSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
  poolId: { type: Schema.Types.ObjectId, ref: 'Pool', required: false, index: true },
  type: { type: String, required: true, enum: ['DEPOSIT', 'WITHDRAW', 'INTEREST_PAYOUT'] },
  asset: { type: String, required: true, enum: ['BTC'], default: 'BTC' },
  amount: { type: Number, required: true, min: 0 },
  transactionDate: { type: Date, required: true, default: Date.now },
  status: { type: String, required: true, enum: ['completed', 'pending', 'failed'], default: 'completed' },
  referenceId: { type: String, required: false },
  description: { type: String, required: false },
  createdAt: { type: Date, default: Date.now },
});

TransactionSchema.pre('save', function (next) {
  this.transactionDate = new Date();
  this.createdAt = new Date();
  next();
});

export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);