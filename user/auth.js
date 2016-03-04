var LocalStrategy = require('passport-local').Strategy;
var Model = require('./model');
var User = Model.user;
var BetaKeys = Model.keys;
var async = require('async');
var crypto = require('crypto');
var nodemailer = require('nodemailer');
var validator = require('validator');
var smtpTransport = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
    }
});

module.exports = function(passport) {
    passport.serializeUser(function(user, done) {
        done(null, user.id);
    });
    
    passport.deserializeUser(function(id, done) {
        User.findById(id, function(err, user) {
            done(err, user);
        });
    });
    
    passport.sendEmail = function(req, next, user, flash) {
        if (user.activated) return next();
        crypto.randomBytes(20, function(err, buf) {
            var token = buf.toString('hex');
            user.activated = false;
            user.verifyToken = token;
            var mailOptions = {
                to: user.email,
                from: 'Mesh <bot@' + process.env.URL.replace(/^.*?:\/\//, '') + '>',
                subject: 'Mesh - Email Verification',
                text: 'Welcome to Mesh!\n\n'
                    + 'To activate your account and get started, click the following link:\n'
                    + process.env.URL + '/user/verify/' + tokehn
            };
            smtpTransport.sendMail(mailOptions, function(err) {
                if (flash) req.flash('signupMessage', 'Done! Please check your email for further instructions.');
                user.save(next);
            });
        });
    };
    
    passport.verify = function(req, res, next) {
        User.findOne({ verifyToken: req.params.token }, function(err, user, b) {
            if (!user) {
                res.end('Invalid verification link. Try resending the email.');
            } else {
                user.verifyToken = undefined;
                user.activated = true;
                user.save(function() {
                    req.logIn(user, function() {
                        res.redirect('/user/login');
                        next();
                    });
                });
            }
        });
    };
    
    passport.resend = function(req, res, next) {
        if (req.isAuthenticated()) return next();
        User.findOne({ email: req.params.email, activated: false }, function(err, user) {
            if (!user) return next();
            passport.sendEmail(req, next, user, false);
        });
    };
    
    passport.getReset = function(req, res) {
        User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
            if (!user) {
                req.flash('forgotMessage', 'Password reset token is invalid or has expired.');
                return res.redirect('/user/forgot');
            } else {
                res.render('reset', {
                    title: 'Change Password'
                });
            }
        });
    };
    
    //Keeping everything tidy. There's probably a much better way to do this
    passport.reset = function(req, res) {
        async.waterfall([
            function(done) {
                User.findOne({
                    resetPasswordToken: req.params.token,
                    resetPasswordExpires: {
                        $gt: Date.now()
                    }
                }, function(err, user) {
                    if (!user) {
                        req.flash('resetMessage', 'Password reset token is invalid or has expired.');
                        return res.redirect('back');
                    }

                    user.password = req.body.password;
                    user.resetPasswordToken = undefined;
                    user.resetPasswordExpires = undefined;

                    user.save(function(err) {
                        req.logIn(user, function(err) {
                            done(err, user);
                        });
                    });
                });
            },
            function(user, done) {
                var mailOptions = {
                    to: user.email,
                    from: 'bot@' + process.env.URL.replace(/^.*?:\/\//, ''),
                    subject: 'Mesh - Your password has been changed',
                    text: 'Hello,\n\n'
                        + 'This is a confirmation that the password for your account (' + user.email + ') has just been changed.\n'
                };
                smtpTransport.sendMail(mailOptions, function(err) {
                    req.flash('loginMessage', '<style>body.bad #subtitle,body.bad #err{color:#11BF11 !important}</style>Success! Your password has been changed.')
                    done(err);
                });
            }
        ], function(err) {
            res.redirect('/');
        });
    };
    
    passport.forgot = function(req, res, next) {
        if (req.body.email.indexOf(/(opml)|(KEY_)/) != -1 || !validator.isEmail(req.body.email)) {
            req.flash('forgotMessage', 'Invalid email');
            return res.redirect('/user/forgot');
        }
        async.waterfall([
            function(done) {
                crypto.randomBytes(20, function(err, buf) {
                    var token = buf.toString('hex');
                    done(err, token);
                });
            },
            function(token, done) {
                User.findOne({
                    email: req.body.email
                }, function(err, user) {
                    if (!user) {
                        req.flash('forgotMessage', 'No account with that email address exists.');
                        return res.redirect('/user/forgot');
                    }
            
                    user.resetPasswordToken = token;
                    user.resetPasswordExpires = Date.now() + 864e5; //1 day
            
                    user.save(function(err) {
                        done(err, token, user);
                    });
                });
            },
            function(token, user, done) {
                var mailOptions = {
                    to: user.email,
                    from: 'bot@' + process.env.URL.replace(/^.*?:\/\//, ''),
                    subject: 'Mesh - Password Reset',
                    text: 'You are receiving this because you have requested a password reset for your account.\n\n' +
                        'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
                        process.env.URL + '/user/reset/' + token + '\n\n' +
                        'If you did not request this, please ignore this email and your password will remain unchanged.\n'
                };
                smtpTransport.sendMail(mailOptions, function(err) {
                    console.log(err);
                    done(err, 'done');
                    res.render('static', {
                        title: 'Password Reset',
                        message: 'Confirmation Email Sent',
                        subtitle: 'Check your email for further instructions'
                    });
                });
            }
        ], function(err) {
            if (err) return next(err);
        });
    };
    
    passport.use('signup', new LocalStrategy({
        usernameField : 'email',
        passwordField : 'password',
        passReqToCallback : true
    }, function(req, email, password, done) {
        email = email.toLowerCase();
        
        function userGen(elevate) {
            var newUser = new User();
            newUser.email = email;
            newUser.password = password;
            newUser.bootstrapped = false;
            newUser.elevated = elevate;
            newUser.save(function(err) {
                passport.sendEmail(req, function() {
                    done(null, newUser);
                }, newUser, true);
            });
        }
        
        if (email.indexOf(/(opml)|(KEY_)/) != -1 || !validator.isEmail(email)) return done(null, false, req.flash('signupMessage', 'Invalid email'));
        process.nextTick(function() {
            User.findOne({ email:  email }, function(err, user) {
                if (err) return done(err);
                if (user) {
                    return done(null, false, req.flash('signupMessage', 'That email is already taken.'));
                } else {
                    User.findOne({ elevated: true }, function(er, adminExists) {
                        if (validator.toBoolean(process.env.USE_BETAKEYS)) {
                            BetaKeys.findOne({
                                key: req.body.key,
                                usesLeft: {$ne:0},
                                $or: [
                                    {expires: null},
                                    {expires: {$gte: new Date()}}
                                ]
                            }, function(suberr, key) {
                                if (key) {
                                    key.usesLeft--;
                                    key.save(function() {
                                        userGen(!adminExists);
                                    });
                                } else if (!adminExists) {
                                    userGen(true);
                                } else return done(null, false, req.flash('signupMessage', 'Invalid Beta Key.'));
                            });
                        } else userGen(!adminExists);
                    });
                }
            });
        });
    }));
    
    passport.use('login', new LocalStrategy({
        usernameField: 'email',
        passwordField: 'password',
        passReqToCallback: true
    },
    function(req, email, password, done) {
        email = email.toLowerCase();
        
        User.findOne({ email:  email }, function(err, user) {
            if (err) return done(err);

            if (!user)
                return done(null, false, req.flash('loginMessage', 'No user with that name exists.'));
                
            if (!user.validPassword(password))
                return done(null, false, req.flash('loginMessage', 'Oops! Wrong password.'));
            
            if (!user.activated)
                return done(null, false, req.flash('loginMessage', 'Please verify your account via email.'));
            
            return done(null, user);
        });
    }));
};