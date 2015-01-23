var express = require('express');
var router = express.Router();

router.get('/firstStation', function(req, res) {
    res.render('fstat', {
        title: 'Start Listening'
    });
});

module.exports = router;