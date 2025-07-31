import mongoose, { Document, Schema } from 'mongoose';

export interface IUserPortfolio extends Document {
  userId: mongoose.Types.ObjectId;
  poolId: mongoose.Types.ObjectId;
  amountInvested: number;
  lastDepositDate: Date;
  lastWithdrawalDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserPortfolioSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
  poolId: { type: Schema.Types.ObjectId, required: true, ref: 'Pool', index: true },
  amountInvested: { type: Number, required: true, default: 0, min: 0 },
  lastDepositDate: { type: Date, required: true },
  lastWithdrawalDate: { type: Date, required: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

UserPortfolioSchema.index({ userId: 1, poolId: 1 }, { unique: true });

UserPortfolioSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const UserPortfolio = mongoose.model<IUserPortfolio>('UserPortfolio', UserPortfolioSchema);