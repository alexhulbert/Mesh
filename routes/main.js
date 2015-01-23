var express = require('express');
var router = express.Router();

router.get('/home', require('../user/isAuthenticated'), function(req, res) {
    if (!req.user.bootstrapped) {
        return res.redirect('/firstStation');
    }
    req.user.save(function() {
        res.render('main', {
            title: 'Radio'
        });
    });
});

module.exports = router;