const router = require('express').Router();
const c = require('../controllers/user.controller');
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');
const validate = require('../middlewares/validate.middleware');
const { profileRules } = require('../validators/auth.validator');

router.use(protect);
router.put('/profile', upload.single('avatar'), profileRules, validate, c.updateProfile);

// admin only
router.use(restrictTo('admin'));
router.get('/', c.getUsers);
router.get('/staff', c.getStaff);
router.put('/:id/role', c.updateRole);
router.put('/:id/status', c.updateStatus);
router.delete('/:id', c.deleteUser);

module.exports = router;
