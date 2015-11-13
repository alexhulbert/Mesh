var echo = require('echojs')({
  key: process.env.ECHONEST_KEY
});
var quota = require('quota');
var quotaServer = new quota.Server();
quotaServer.addManager('echonest');
var quotaClient = new quota.Client(quotaServer);

module.exports = function(p, pp) {
    var gen = function(type) {
        var finalFunct = function(params, callback, onFail) {
            quotaClient.requestQuota('echonest', {}, { requests: 1 }, { maxWait: 10000 })
                .then(function(grant) {
                    echo(p)[type](params, function(err, json, response) {
                        if (response.statusCode != 429) {
                            grant.dismiss({
                                forRule: {
                                    main: {
                                        limit: parseInt(response.headers['x-ratelimit-limit'])
                                    }
                                }
                            });
                            callback.apply(this, arguments);
                        } else {
                            grant.dismiss({
                                backoff: true //Math.min(60, (62 - new Date().getUTCSeconds()))
                            });
                            finalFunct.apply(this, arguments);
                        }
                    });
                })
                .catch(quota.OutOfQuotaError, function(err) {
                    if (onFail) onFail(err);
                    console.log('OUT OF QUOTA!');
                })
                .catch(function(err) {
                    console.error('QUOTA ERROR!', err);
                })
            ;
        };
        return finalFunct;
    };
    return {
        post: gen('post'),
        get:  gen('get')
    };
};