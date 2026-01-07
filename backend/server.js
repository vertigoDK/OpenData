import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from frontend
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// API Routes
app.use('/api', apiRoutes);

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║     Air Quality Monitoring Backend Server         ║
╠═══════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT}          ║
║                                                   ║
║  API Endpoints:                                   ║
║  • GET  /api/air-quality   - All data             ║
║  • GET  /api/stations      - List stations        ║
║  • GET  /api/station/:id   - Station details      ║
║  • GET  /api/station/:id/history - History data   ║
║  • GET  /api/health        - Health check         ║
╚═══════════════════════════════════════════════════╝
  `);
});

export default app;
