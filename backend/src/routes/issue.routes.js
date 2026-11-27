const router = require('express').Router();
const c = require('../controllers/issue.controller');
const comments = require('../controllers/comment.controller');
const { protect } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');
const validate = require('../middlewares/validate.middleware');
const { createIssueRules, updateIssueRules, commentRules } = require('../validators/issue.validator');

router.use(protect); // every issue route needs login

router.route('/')
  .get(c.getIssues)
  .post(upload.single('photo'), createIssueRules, validate, c.createIssue);

router.route('/:id')
  .get(c.getIssue)
  .put(upload.single('photo'), updateIssueRules, validate, c.updateIssue)
  .delete(c.deleteIssue);

router.post('/:id/upvote', c.toggleUpvote);
router.route('/:id/comments')
  .get(comments.getComments)
  .post(commentRules, validate, comments.addComment);

module.exports = router;
