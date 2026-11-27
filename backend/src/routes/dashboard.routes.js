const router = require('express').Router();
const { getStats } = require('../controllers/dashboard.controller');
const { protect } = require('../middlewares/auth.middleware');

router.get('/stats', protect, getStats);

module.exports = router;
