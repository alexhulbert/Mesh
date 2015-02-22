var express = require('express');
var router = express.Router();
var User = require('../user/model').user;

router.get('/squeezebox/:username?/:password?', function(req, res) {
    var params = {
        url: process.env.URL
    };
    if (!req.params.password) {
        if (!req.params.username) {
            //No Username; No Password. Prompt for Username
            params.mode = 0;
        } else {
            //Has Username; No Password. Prompt for Password
            params.mode = 1;
            params.data = req.params.username.slice(0, -5);
        }
        res.render('squeezeauth', params);
    } else {
        //Has Username; Has Password. Generate key and redirect.
        params.mode = 2;
        User.findOne({ email: req.params.username, activated: true }, function(err, user) {
            if (user && user.validPassword(req.params.password.slice(0, -5))) {
                var randomToken = "KEY_" + new Date().getTime().toString(16); //Unsafe?
                user.squeezeboxId = randomToken;
                params.data = randomToken;
                user.save(function() {
                    res.render('squeezeauth', params);
                });
            } else {
                return res.redirect('/squeezebox');
            }
        });
    }
});

module.exports = router;