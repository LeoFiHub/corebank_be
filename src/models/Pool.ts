import mongoose, { Document, Schema } from 'mongoose';

export interface IPool extends Document {
  name: string;
  asset: 'BTC';
  totalCapacity: number;
  currentBalance: number;
  interestRate: number;
  startDate: Date;
  endDate: Date;
  status: 'open' | 'closed' | 'full';
  createdAt: Date;
  updatedAt: Date;
}

const PoolSchema: Schema = new Schema({
  name: { type: String, required: true, trim: true },
  asset: { type: String, required: true, enum: ['BTC'], default: 'BTC' },
  totalCapacity: { type: Number, required: true, min: 0 },
  currentBalance: { type: Number, required: true, default: 0, min: 0 },
  interestRate: { type: Number, required: true, min: 0 },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, required: true, enum: ['open', 'closed', 'full'], default: 'open' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

PoolSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const Pool = mongoose.model<IPool>('Pool', PoolSchema);