import express, { Application, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import poolRoutes from './routes/poolRoutes'; // Import routes
import path from 'path';

dotenv.config(); // Load environment variables from .env file

const app: Application = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/corebank_db';

// Middleware
app.use(express.json()); // Body parser for JSON requests
app.use(express.static(path.join(__dirname, '../public')));

// Connect to MongoDB
mongoose
  .connect(MONGO_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
  })
  .then(() => {
    console.log('MongoDB connected successfully!');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit process if DB connection fails
  });

// API Routes
app.use('/api/pools', poolRoutes); // Mount pool routes
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Hello from CoreBank API!' });
});

// Basic error handling middleware (for demonstration)
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Only start server if run directly (not imported by Vercel)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Access BTC pool listing at http://localhost:${PORT}/api/pools`);
  });
}

export default app;