import { Request, Response } from 'express';
import { PoolService } from '../services/PoolService';
import { IPool } from '../models/Pool';
import mongoose from 'mongoose';

const poolService = new PoolService();

export class PoolController {
  /**
   * @route GET /api/pools
   * @description Lấy danh sách các pool BTC đang mở.
   * @access Public (hoặc Private nếu yêu cầu authentication)
   */
  public async listBTCPools(req: Request, res: Response): Promise<void> {
    try {
      const pools = await poolService.getOpenBTCPools();
      res.status(200).json({
        message: 'Successfully retrieved BTC pools',
        data: pools,
      });
    } catch (error: any) {
      console.error('Failed to list BTC pools:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: error.message,
      });
    }
  }

  /**
   * @route POST /api/pools
   * @description Tạo một pool BTC mới.
   * @access Private (yêu cầu quyền admin/quản trị)
   */
  public async createPool(req: Request, res: Response): Promise<void> {
    const { name, totalCapacity, interestRate, startDate, endDate, status } = req.body;

    // Basic validation (có thể dùng thư viện Joi/class-validator để mạnh mẽ hơn)
    if (!name || !totalCapacity || !interestRate || !startDate || !endDate) {
      res.status(400).json({ message: 'Missing required pool fields.' });
      return;
    }

    // Chuyển đổi ngày tháng từ string sang Date object
    const poolData: Partial<IPool> = {
      name,
      totalCapacity,
      interestRate,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      asset: 'BTC', // Mặc định là BTC
      currentBalance: 0, // Mặc định là 0 khi tạo mới
      status: status || 'open' // Mặc định là 'open'
    };

    try {
      const newPool = await poolService.createPool(poolData);
      res.status(201).json({
        message: 'Pool created successfully',
        data: newPool,
      });
    } catch (error: any) {
      console.error('Failed to create pool:', error);
      // Phân biệt các loại lỗi để trả về status code phù hợp
      if (error.message.includes('Validation failed') || error.message.includes('Pool with this name already exists')) {
        res.status(400).json({
          message: error.message,
        });
      } else {
        res.status(500).json({
          message: 'Internal server error',
          error: error.message,
        });
      }
    }
  }

    /**
   * @route POST /api/deposit
   * @description Depoist
   * @access Private (userId wallet)
   */
  public async depositToPool(req: Request, res: Response): Promise<void> {
    const { poolId, amount } = req.body;
    const userId = req.body.userId || '60c72b2f7a4d5e6f7c8d9e00'; // Giả định một userId cố định để test

    if (!poolId || !amount) {
      res.status(400).json({ message: 'Missing poolId or amount.' });
      return;
    }
    if (typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ message: 'Amount must be a positive number.' });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(poolId)) {
      res.status(400).json({ message: 'Invalid Pool ID format.' });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) { // Validate giả định userId
        res.status(400).json({ message: 'Invalid User ID format.' });
        return;
    }

    try {
      const depositTransaction = await poolService.depositToPool(new mongoose.Types.ObjectId(userId), poolId, amount);

      res.status(200).json({
        message: 'Deposit successful',
        transactionId: depositTransaction._id,
        amount: depositTransaction.amount,
        poolId: depositTransaction.poolId,
        type: depositTransaction.type,
      });
    } catch (error: any) {
      console.error('Failed to deposit into pool:', error);
      if (error.message.includes('Pool not found') ||
          error.message.includes('Pool is') ||
          error.message.includes('exceeds pool capacity') ||
          error.message.includes('Deposit amount must be positive')) {
        res.status(400).json({
          message: error.message,
        });
      } else {
        res.status(500).json({
          message: 'Internal server error',
          error: error.message,
        });
      }
    }
  }

   /**
   * @route GET /api/deposit
   * @description Depoist
   * @access Private (userId wallet)
   */
  public async withdrawFromPool(req: Request, res: Response): Promise<void> {
    const { poolId, amount } = req.body;
    const userId = req.body.userId || '60c72b2f7a4d5e6f7c8d9e00'; // Giả định một userId cố định để test

    // 1. Validation đầu vào tương tự như deposit
    if (!poolId || !amount) {
      res.status(400).json({ message: 'Missing poolId or amount.' });
      return;
    }
    if (typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ message: 'Amount must be a positive number.' });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(poolId)) {
      res.status(400).json({ message: 'Invalid Pool ID format.' });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) { // Validate giả định userId
        res.status(400).json({ message: 'Invalid User ID format.' });
        return;
    }

    try {
      // 2. Gọi service layer để thực hiện rút tiền
      const withdrawTransaction = await poolService.withdrawFromPool(new mongoose.Types.ObjectId(userId), poolId, amount);

      // 3. Trả về phản hồi thành công
      res.status(200).json({
        message: 'Withdrawal successful',
        transactionId: withdrawTransaction._id,
        amount: withdrawTransaction.amount,
        poolId: withdrawTransaction.poolId,
        type: withdrawTransaction.type,
      });
    } catch (error: any) {
      console.error('Failed to withdraw from pool:', error);
      // 4. Xử lý các loại lỗi cụ thể từ service layer
      if (error.message.includes('Pool not found') ||
          error.message.includes('Pool is') ||
          error.message.includes('Insufficient balance in pool') ||
          error.message.includes('Insufficient invested amount in portfolio') ||
          error.message.includes('Withdrawal amount must be positive') ||
          error.message.includes('User has no investment in this pool')) {
        res.status(400).json({
          message: error.message,
        });
      } else {
        res.status(500).json({
          message: 'Internal server error',
          error: error.message,
        });
      }
    }
  }

   public async getTransactionHistory(req: Request, res: Response): Promise<void> {
    // Lấy userId từ params của URL
    const { userId } = req.params;

    // 1. Validation userId
    if (!userId) {
      res.status(400).json({ message: 'Missing userId in URL parameter.' });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ message: 'Invalid User ID format.' });
      return;
    }

    try {
      // 2. Gọi service layer để lấy lịch sử giao dịch
      const transactions = await poolService.getTransactionsByUserId(new mongoose.Types.ObjectId(userId));

      // 3. Trả về phản hồi thành công
      res.status(200).json({
        message: 'Transaction history retrieved successfully',
        transactions: transactions,
      });
    } catch (error: any) {
      console.error('Failed to get transaction history:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: error.message,
      });
    }
  }

  /**
   * @route GET /api/pools/profile/:userId
   * @description Get user investment profile and statistics
   * @access Private (userId wallet)
   */
  public async getUserProfile(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;

    // 1. Validation userId
    if (!userId) {
      res.status(400).json({ message: 'Missing userId in URL parameter.' });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ message: 'Invalid User ID format.' });
      return;
    }

    try {
      // 2. Gọi service layer để lấy profile
      const userProfile = await poolService.getUserInvestmentProfile(new mongoose.Types.ObjectId(userId));

      // 3. Trả về phản hồi thành công
      res.status(200).json({
        message: 'User investment profile retrieved successfully',
        profile: userProfile,
      });
    } catch (error: any) {
      console.error('Failed to get user investment profile:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: error.message,
      });
    }
  }
}