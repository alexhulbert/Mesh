var User = require("./model").user;

module.exports = function(req, res, next) {
    var proceedWithSid = function() {
        if (typeof req.params.sid !== 'undefined') {
            var sid = parseInt(req.params.sid);
            if (sid >= req.user.stations.length || sid < 0 || isNaN(sid))
                return res.status(400).end('Invalid Station Index');
            req.params.sid = sid;
        }
        next();
    };
	if (req.isAuthenticated() && req.user.activated) return proceedWithSid();
	if (!req.query.key) return res.redirect('/user/login');
	User.findOne({ squeezeboxId: req.query.key, activated: true }, function(err, user) {
        if (user) {
            req.logIn(user, function(err) {
                if (err) res.redirect('/user/login'); else proceedWithSid();
            });
        } else {
            res.redirect('/user/login');
        }
    });
};