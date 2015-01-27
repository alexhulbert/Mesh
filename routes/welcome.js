var express = require('express');
var router = express.Router();

router.get('/welcome', function(req, res) {
    res.render('welcome', {
        title: 'Welcome'
    });
});

module.exports = router;