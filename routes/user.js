var express = require('express');
var passport = require('passport');
var router = express.Router();
var blacklist = ["squeezeboxId", "resetPasswordToken", "resetPasswordExpires", "password", "verifyToken"];
var crypto = require('crypto');

//Test Status

router.get('/user/authenticated', function(req, res) {
    res.end(+req.isAuthenticated()+"");
});

//Get User Model

router.get('/user/model', require('../user/isAuthenticated'), function(req, res) {
    var userData = JSON.parse(JSON.stringify(req.user));
    for (var i in blacklist) userData[blacklist[i]] = undefined;
    var prettyMostPlayed = {};
    for (var i in userData.mostPlayed) {
        var mp = userData.mostPlayed[i];
        var total = 0;
        for (var j in mp) total += mp[j];
        prettyMostPlayed[i] = total;
    }
    for (var i in userData.stations) {
        var stat = userData.stations[i];
        if (stat.feedback.active) {
            var likes = [];
            var dislikes = [];
            var ratings = [];
            for (var j in stat.feedback.likes)
                likes.push(stat.feedback.likes[j].id);
            for (var j in stat.feedback.dislikes)
                dislikes.push(stat.feedback.dislikes[j].id);
            for (var j in stat.feedback.ratings)
                ratings.push(stat.feedback.ratings[j].id + '^' + stat.feedback.ratings[j].rating);
            stat.feedback = {
                likes: likes,
                dislikes: dislikes,
                ratings: ratings
            };
        } else {
            delete stat.feedback;
        }
    }
    userData.mostPlayed = prettyMostPlayed;
	res.end(JSON.stringify(userData, null, 4));
});

//Log Out

router.get('/user/logout', require("../user/isAuthenticated"), function(req, res) {
    req.logout();
    res.redirect('/user/login');
});

//Log In

router.post('/user/login', passport.authenticate('login', {
	successRedirect: '/home',
	failureRedirect: '/user/login',
	failureFlash: true
}));

router.post('/user/login/noredirect', passport.authenticate('login', {
    successRedirect: '',
	failureRedirect: '/user/login',
	failureFlash: true
}));

router.get('/user/login', function(req, res) {
	res.render('login', {
        title: 'Log In',
        error: req.flash('loginMessage')
    });
});

//Sign Up

router.post('/user/signup', passport.authenticate('signup', {
	successRedirect: '/welcome', //TODO: Implement this page
	failureRedirect: '/user/signup',
	failureFlash: true
}));

router.get('/user/signup', function(req, res) {
    res.render('signup', {
        title: 'Sign Up',
        error: req.flash('signupMessage')
    });
});

//Forgot Password

router.post('/user/forgot', passport.forgot);
router.get('/user/forgot'); //TODO: Build this

//Reset Password

router.post('/user/reset/:token', passport.reset);
router.get('/user/reset/:token', passport.getReset);

//Verify/Resend Email

router.get('/user/verify/:token', passport.verify);
router.get('/user/resend/:email', passport.resend);

//Get Unique Token For Hue

router.get('/user/huesername', require("../user/isAuthenticated"), function(req, res) {
    if (req.user.uuid) return res.end(req.user.uuid);
    crypto.randomBytes(16, function(err, buf) {
        var uuid = buf.toString('hex');
        req.user.uuid = uuid;
        req.user.save(function() {
            res.end(uuid);
        });
    });
});

module.exports = router;