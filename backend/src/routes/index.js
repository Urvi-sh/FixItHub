const router = require('express').Router();
const { getMeta } = require('../controllers/meta.controller');

router.get('/meta', getMeta);
router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/issues', require('./issue.routes'));
router.use('/comments', require('./comment.routes'));
router.use('/dashboard', require('./dashboard.routes'));

module.exports = router;
