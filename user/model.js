var mongoose = require('mongoose');
var bcrypt = require('bcrypt-nodejs');

var filter = mongoose.Schema({
    index: String,
    type: String,
    key: String,
    value: String
});

var station = mongoose.Schema({
    playlist: String,
    prettyName: String,
    index: String,
    id: String,
    name: String,
    type: String,
    timestamp: String,
    bootstrapped: false,
    image: String,
    filters: [filter],
    lastUpdated: String,
    feedback: mongoose.Schema.Types.Mixed
});

var userSchema = mongoose.Schema({
    email: String,
    password: String,
    stations: [station],
    lastStation: String,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    squeezeboxId: String,
    bootstrapped: false,
    activated: false,
    verifyToken: String,
    elevated: false,
    recent: String,
    bookmarks: String,
    uuid: String,
    mostPlayed: mongoose.Schema.Types.Mixed
});

userSchema.pre('save', function(next) {
    var user = this;
    var SALT_FACTOR = 5;
    
    if (!user.isModified('password')) return next();
    
    bcrypt.genSalt(SALT_FACTOR, function(err, salt) {
        if (err) return next(err);
        bcrypt.hash(user.password, salt, null, function(err, hash) {
            if (err) return next(err);
            user.password = hash;
            next();
        });
    });
});

userSchema.methods.validPassword = function(password) {
    return bcrypt.compareSync(password, this.password);
};

var keySchema = mongoose.Schema({
    key: { type: String, unique: true },
    usesLeft: { type: Number, default: 5 },
    expires: { type: Date, default: new Date(new Date().getTime() + 30 * 864e5) }
});

module.exports = {
    user: mongoose.model('User', userSchema),
    keys: mongoose.model('BetaKeys', keySchema)
};