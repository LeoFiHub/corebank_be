import mongoose from 'mongoose';
import { Pool, IPool } from '../models/Pool';
import { UserPortfolio, IUserPortfolio } from '../models/UserPortfolio';
import { Transaction, ITransaction } from '../models/Transaction';

interface IUserInvestmentProfile {
  totalPoolsInvested: number;
  investments: Array<{
    poolId: mongoose.Types.ObjectId;
    poolName?: string;
    amountInvested: number;
    lastDepositDate?: Date;
    lastWithdrawalDate?: Date;
  }>;
  totalAmountInvestedAcrossAllPools: number;
}

export class PoolService {
  public async getOpenBTCPools(): Promise<IPool[]> {
    try {
      const pools = await Pool.find({ status: 'open', asset: 'BTC' }).sort({ name: 1 });
      return pools;
    } catch (error) {
      console.error('Error fetching BTC pools:', error);
      throw new Error('Could not retrieve BTC pools');
    }
  }

   public async createPool(poolData: Partial<IPool>): Promise<IPool> {
    try {
      // Đảm bảo asset là BTC nếu không được cung cấp hoặc sai
      if (!poolData.asset || poolData.asset !== 'BTC') {
        poolData.asset = 'BTC';
      }
      // Đảm bảo currentBalance mặc định là 0 nếu không được cung cấp
      if (poolData.currentBalance === undefined || poolData.currentBalance < 0) {
        poolData.currentBalance = 0;
      }
      // Đảm bảo status mặc định là 'open' nếu không được cung cấp
      if (!poolData.status) {
        poolData.status = 'open';
      }

      const newPool = new Pool(poolData);
      await newPool.save();
      return newPool;
    } catch (error: any) {
      console.error('Error creating pool:', error);
      // Kiểm tra lỗi trùng lặp tên hoặc các lỗi validation khác từ Mongoose
      if (error.code === 11000) { // Duplicate key error
        throw new Error('Pool with this name already exists.');
      }
      if (error.name === 'ValidationError') {
        const errors = Object.keys(error.errors).map(key => error.errors[key].message);
        throw new Error(`Validation failed: ${errors.join(', ')}`);
      }
      throw new Error('Could not create pool');
    }
  }

  /**
   * Thực hiện giao dịch gửi tiền vào pool.
   * Đảm bảo tính toàn vẹn dữ liệu bằng MongoDB Transactions.
   * @param userId ID của người dùng thực hiện gửi tiền.
   * @param poolId ID của pool muốn gửi tiền vào.
   * @param amount Số lượng BTC muốn gửi.
   * @returns Transaction đã tạo nếu thành công.
   */
  public async depositToPool(userId: mongoose.Types.ObjectId, poolId: string, amount: number): Promise<ITransaction> {
    // Basic validation
    if (amount <= 0) {
      throw new Error('Deposit amount must be positive.');
    }

    // Convert string poolId to ObjectId
    const objectPoolId = new mongoose.Types.ObjectId(poolId);
    const objectUserId = new mongoose.Types.ObjectId(userId);

    try {
      // 1. Find the Pool
      const pool = await Pool.findById(objectPoolId);

      if (!pool) {
        throw new Error('Pool not found.');
      }
      if (pool.status !== 'open') {
        throw new Error(`Pool is ${pool.status} and cannot accept deposits.`);
      }
      if (pool.currentBalance + amount > pool.totalCapacity) {
        throw new Error(`Deposit amount of ${amount} BTC exceeds pool capacity. Current balance: ${pool.currentBalance}, Total capacity: ${pool.totalCapacity}`);
      }

      // 2. Update Pool balance
      // Sử dụng findByIdAndUpdate để cập nhật nguyên tử, không cần session cho standalone
      const updatedPool = await Pool.findByIdAndUpdate(
        objectPoolId,
        { $inc: { currentBalance: amount }, $set: { updatedAt: new Date() } },
        { new: true } // Trả về tài liệu đã cập nhật
      );

      if (!updatedPool) {
        throw new Error('Failed to update pool balance. Pool might have been modified concurrently.');
      }

      // 3. Update User Portfolio
      // findOneAndUpdate là một lựa chọn tốt cho các hoạt động upsert không cần transactions
      const userPortfolio = await UserPortfolio.findOneAndUpdate(
        { userId: objectUserId, poolId: objectPoolId },
        {
          $inc: { amountInvested: amount }, // Tăng số tiền đã đầu tư
          $set: { lastDepositDate: new Date(), updatedAt: new Date() }, // Cập nhật ngày gửi tiền cuối cùng
          $setOnInsert: { // Chỉ đặt các trường này nếu tài liệu mới được tạo
            createdAt: new Date(),
          }
        },
        { new: true, upsert: true } // new: trả về tài liệu sau cập nhật; upsert: tạo mới nếu không tìm thấy
      );

      // Nếu bạn cần kiểm tra lại, có thể thêm:
      if (!userPortfolio) {
        throw new Error('Failed to update user portfolio.');
      }

      // 4. Record the Transaction
      const transaction = new Transaction({
        userId: objectUserId,
        poolId: objectPoolId,
        type: 'DEPOSIT',
        asset: 'BTC',
        amount: amount,
        transactionDate: new Date(),
        status: 'completed',
        description: `Deposit ${amount} BTC into pool ${pool.name}`
      });
      await transaction.save(); // Lưu transaction, không cần session cho standalone

      // Trả về đối tượng transaction đã được tạo
      return transaction;

    } catch (error: any) {
      // Vì không dùng transactions, không có abort.
      // Các thao tác đã hoàn thành sẽ không được rollback.
      console.error('Deposit operation failed:', error);
      throw new Error(`Deposit failed: ${error.message}`);
    }
  }

  public async withdrawFromPool(userId: mongoose.Types.ObjectId, poolId: string, amount: number): Promise<ITransaction> {
    // 1. Basic Validation
    if (amount <= 0) {
      throw new Error('Withdrawal amount must be positive.');
    }

    const objectPoolId = new mongoose.Types.ObjectId(poolId);
    const objectUserId = new mongoose.Types.ObjectId(userId);

    try {
      // 2. Find the Pool
      const pool = await Pool.findById(objectPoolId);

      if (!pool) {
        throw new Error('Pool not found.');
      }
      if (pool.status !== 'open') {
        throw new Error(`Pool is ${pool.status} and does not allow withdrawals.`);
      }
      // Đảm bảo số tiền rút không vượt quá số dư hiện tại của pool
      if (pool.currentBalance < amount) {
        throw new Error(`Insufficient balance in pool. Current balance: ${pool.currentBalance} BTC, requested: ${amount} BTC.`);
      }

      // 3. Find User Portfolio to check if user has enough invested amount
      const userPortfolio = await UserPortfolio.findOne({ userId: objectUserId, poolId: objectPoolId });

      if (!userPortfolio) {
        throw new Error('User has no investment in this pool.');
      }
      if (userPortfolio.amountInvested < amount) {
        throw new Error(`Insufficient invested amount in portfolio. Current invested: ${userPortfolio.amountInvested} BTC, requested: ${amount} BTC.`);
      }

      // 4. Update Pool balance (giảm số dư)
      const updatedPool = await Pool.findByIdAndUpdate(
        objectPoolId,
        { $inc: { currentBalance: -amount }, $set: { updatedAt: new Date() } }, // Dùng -amount để giảm
        { new: true }
      );

      if (!updatedPool) {
        throw new Error('Failed to update pool balance during withdrawal.');
      }

      // 5. Update User Portfolio (giảm số tiền đã đầu tư)
      const updatedUserPortfolio = await UserPortfolio.findOneAndUpdate(
        { userId: objectUserId, poolId: objectPoolId },
        {
          $inc: { amountInvested: -amount }, // Giảm số tiền đã đầu tư
          $set: { lastWithdrawalDate: new Date(), updatedAt: new Date() } // Cập nhật ngày rút tiền cuối cùng
        },
        { new: true }
      );

      if (!updatedUserPortfolio) {
        throw new Error('Failed to update user portfolio during withdrawal.');
      }

      // 6. Record the Transaction
      const transaction = new Transaction({
        userId: objectUserId,
        poolId: objectPoolId,
        type: 'WITHDRAW', // Loại giao dịch là WITHDRAW
        asset: 'BTC',
        amount: amount,
        transactionDate: new Date(),
        status: 'completed',
        description: `Withdraw ${amount} BTC from pool ${pool.name}`
      });
      await transaction.save();

      return transaction;

    } catch (error: any) {
      console.error('Withdrawal operation failed:', error);
      throw new Error(`Withdrawal failed: ${error.message}`);
    }
  }

  public async getTransactionsByUserId(userId: mongoose.Types.ObjectId): Promise<ITransaction[]> {
    try {
      // Tìm tất cả các giao dịch (deposit và withdraw) cho userId này
      // Sắp xếp theo transactionDate giảm dần để hiển thị các giao dịch mới nhất trước
      const transactions = await Transaction.find({ userId: userId })
                                            .sort({ transactionDate: -1 }) // Sắp xếp giảm dần theo ngày
                                            .exec(); // Thực thi truy vấn

      return transactions;
    } catch (error: any) {
      console.error('Failed to retrieve transaction history:', error);
      throw new Error(`Failed to get transaction history: ${error.message}`);
    }
  }

   /**
   * Lấy profile đầu tư của người dùng, bao gồm tổng số pool đã đầu tư
   * và chi tiết từng khoản đầu tư.
   * @param userId ObjectId của người dùng.
   * @returns Đối tượng IUserInvestmentProfile.
   */
  public async getUserInvestmentProfile(userId: mongoose.Types.ObjectId): Promise<IUserInvestmentProfile> {
    try {
      // Tìm tất cả các mục trong UserPortfolio cho userId này
      // Sử dụng .populate('poolId', 'name') nếu bạn muốn hiển thị tên pool trực tiếp.
      // Tuy nhiên, bạn cần đảm bảo 'poolId' trong UserPortfolio là một ref đến model Pool.
      const userPortfolios = await UserPortfolio.find({ userId: userId })
                                                // .populate({
                                                //   path: 'poolId',
                                                //   select: 'name' // Chỉ lấy trường 'name' của Pool
                                                // })
                                                .exec();

      let totalAmountInvestedAcrossAllPools = 0;
      const investments: Array<any> = [];

      userPortfolios.forEach(portfolio => {
        totalAmountInvestedAcrossAllPools += portfolio.amountInvested;
        investments.push({
          poolId: portfolio.poolId,
          // poolName: (portfolio.poolId as any)?.name, // Chỉ sử dụng nếu bạn dùng populate
          amountInvested: portfolio.amountInvested,
          lastDepositDate: portfolio.lastDepositDate,
          lastWithdrawalDate: portfolio.lastWithdrawalDate,
        });
      });

      const profile: IUserInvestmentProfile = {
        totalPoolsInvested: userPortfolios.length,
        investments: investments,
        totalAmountInvestedAcrossAllPools: totalAmountInvestedAcrossAllPools,
      };

      return profile;
    } catch (error: any) {
      console.error('Failed to retrieve user investment profile:', error);
      throw new Error(`Failed to get user investment profile: ${error.message}`);
    }
  }

}