import { Router } from 'express';
import { PoolController } from '../controllers/PoolController';

const router = Router();
const poolController = new PoolController();

router.get('/', poolController.listBTCPools);

router.post('/', poolController.createPool);

router.post('/deposit', poolController.depositToPool);

router.post('/withdraw', poolController.withdrawFromPool);

router.get('/transactions/:userId', poolController.getTransactionHistory);

router.get('/profile/:userId', poolController.getUserProfile);



export default router;