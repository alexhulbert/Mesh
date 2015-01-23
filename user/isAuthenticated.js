var User = require("./model").user;

module.exports = function(req, res, next) {
	if (req.isAuthenticated() && req.user.activated)
		return next();
	if (!req.query.key) return res.redirect('/user/login');
	User.findOne({ squeezeboxId: req.query.key, activated: true }, function(err, user) {
        if (user) {
            req.logIn(user, function(err) {
                if (err)
                    res.redirect('/user/login');
                else
                    next();
            });
        } else {
            res.redirect('/user/login');
        }
    });
};