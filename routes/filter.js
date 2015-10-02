var express = require('express');
var router = express.Router();
var moment = require('moment');
var locks = GLOBAL.db.get('locks');
var async = require('async');
var echo = require('../echo.js');
var freq = 60;

GLOBAL.getChoices = function(cb) {
    async.parallel([
        function(next) {
            locks.findOne({
                name: 'moods'
            }, {}, function(moods) {
                var noMoods = typeof moods === 'undefined' || moods === null;
                if (noMoods || moment(moods.timestamp, 'MM-DD-YYYY').diff(moment(), 'days') < (1 - freq)) {
                    GLOBAL.updateList('moods', noMoods ? [] : moods, function(list) {
                        next(null, list);
                    });
                } else {
                    next(null, moods.list);
                }
            });
        },
        function(next) {
            locks.findOne({
                name: 'styles'
            }, {}, function(styles) {
                var noStyles = typeof styles === 'undefined' || styles === null;
                if (noStyles || moment(styles.timestamp, 'MM-DD-YYYY').diff(moment(), 'days') < (1 - freq)) {
                    GLOBAL.updateList('styles', noStyles ? [] : styles, function(list) {
                        next(null, list);
                    });
                } else {
                    next(null, styles.list);
                }
            });
        }
    ], function(err, data) {
        cb({
            moods: data[0],
            styles: data[1]
        });
    });
}

GLOBAL.filterData = {
    target: {
        valueRegex: /^([+-])\1?$/,
        replace: false,
        domain: 'steer',
        keys: {
            loud: 'loudness',
            danceable: 'danceability',
            energetic: 'energy',
            live: 'liveness',
            vocal: 'speechiness',
            acoustic: 'acousticness',
            popular: 'song_hotttnesss',
            familiar: 'artist_familiarity',
            current: 'song_currency',
            uplifting: 'valence',
            instrumental: 'instrumentalness'
        },
        defaults: {
            loud: {
                operation: '+',
                singleX: 7.5,
                doubleX: 10,
                start: 0,
                min: -100,
                max: 100
            },
            other: {
                operation: '*',
                singleX: 1.15,
                doubleX: 1.25,
                start: 0.5,
                min: 0,
                max: 1
            }
        }
    },
    tertiary: {
        valueRegex: /^[YNM]$/,
        replace: true,
        domain: 'steer',
        keys: {
            christmas: 'christmas',
            live: 'live',
            studio: 'studio',
            acoustic: 'acoustic',
            electric: 'electric',
            //childrens: 'childrens',
            instrumental: 'instrumental',
            vocal: 'vocal'
        }
    },
    tempo: {
        valueRegex: function(fKey) {
            var twoTempos = fKey.split(':');
            var numberRegex = /^[0-9]{2,3}(.[0-9])?$/;
            if (twoTempos.length != 2) return false;
            for (var f in twoTempos) {
                var str = twoTempos[f];
                if (!str.match(numberRegex)) return false;
                var float = parseFloat(str);
                if (float < 0 || float > 500) return false;
                if (float != float.toFixed(1)) return false;
            }
            return (parseFloat(twoTempos[1]) > parseFloat(twoTempos[0]));
        },
        replace: true,
        domain: 'steer',
        keys: {
            'tempo': 'tempo'
        }
    },
    mood: {
        valueRegex: /^M[+-]$/,
        replace: false,
        domain: 'steer',
        keys: 'moods'
    },
    style: {
        valueRegex: /^G[+-]$/,
        replace: false,
        domain: 'steer',
        keys: 'styles'
    }
};

GLOBAL.parseFilters = function(filters) {
    var finalData = {};
    var otherData = {
        mood: {},
        style: {}
    };
    for (var index in filters) {
        var thisFilter = filters[index];
        var key = thisFilter.key;
        var actualKey, actualVal;
        switch(thisFilter.type) {
            case 'target':
                var defaultOps = GLOBAL.filterData.target.defaults.other;
                if (GLOBAL.filterData.target.defaults.hasOwnProperty(key))
                    defaultOps = GLOBAL.filterData.target.defaults[key];
                actualVal = defaultOps.start;
                for (var i in filters) {
                    if (filters[i].key == key) {
                        switch(filters[i].value) {
                            case '+':
                                if (defaultOps.operation == '+')
                                    actualVal += defaultOps.singleX;
                                else
                                    actualVal *= defaultOps.singleX;
                            break;
                            case '++':
                                if (defaultOps.operation == '+')
                                    actualVal += defaultOps.doubleX;
                                else
                                    actualVal *= defaultOps.doubleX;
                            break;
                            case '-':
                                if (defaultOps.operation == '+')
                                    actualVal -= defaultOps.singleX;
                                else
                                    actualVal /= defaultOps.singleX;
                            break;
                            case '--':
                                if (defaultOps.operation == '+')
                                    actualVal -= defaultOps.doubleX;
                                else
                                    actualVal /= defaultOps.doubleX;
                            break;
                        }
                    }
                }
                actualVal = Math.min(defaultOps.max, actualVal);
                actualVal = Math.max(defaultOps.min, actualVal);
                actualKey = 'target_' + GLOBAL.filterData.target.keys[key];
                finalData[actualKey] = actualVal;
            break;
            case 'tertiary':
                actualKey = 'song_type';
                var valueRestrict;
                switch(thisFilter.value) {
                    case 'Y':
                        valueRestrict = 'true';
                    break;
                    case 'N':
                        valueRestrict = 'false';
                    break;
                    case 'M':
                        valueRestrict = 'any';
                    break;
                    default:
                        valueRestrict = 'seed';
                    break;
                }
                actualVal = GLOBAL.filterData.tertiary.keys[key] + ':' + valueRestrict;
                finalData[actualKey] = actualVal;
            break;
            case 'tempo':
                finalData['min_tempo'] = parseFloat(thisFilter.value.split(':')[0]);
                finalData['max_tempo'] = parseFloat(thisFilter.value.split(':')[1]);
            break;
            case 'mood':
            case 'style':
                var data = otherData[thisFilter.type];
                var baseNum;
                if (typeof data[thisFilter.key] === 'undefined')
                    baseNum = 0;
                else
                    baseNum = data[thisFilter.key];
                switch(thisFilter.value.slice(1)) {
                    case '+':
                        baseNum += 1;
                    break;
                    case '++':
                        baseNum += 2.5;
                    break;
                    case '-':
                        baseNum -= 1;
                    break;
                    case '--':
                        baseNum -= 2.5;
                    break;
                }
                data[thisFilter.key] = baseNum;
            break;
        }
    }
    for (var t in otherData) {
        var oData = otherData[t];
        if (Object.keys(oData).length !== 0) {
            finalData[t] = [];
            for (var k in oData)
                finalData[t].push(k + '^' + oData[k]);
        }
    }
    return finalData;
};

router.get('/filter/add/:sid/:filter/:value', require('../user/isAuthenticated'), function(req, res) {
    GLOBAL.getChoices(function(keyList) {
        var curFilters = req.user.stations[req.params.sid].filters;
        var type = 'invalid';
        for (var fKey in GLOBAL.filterData) {
            var fData = GLOBAL.filterData[fKey];
            if (typeof fData.valueRegex === 'function')
                if (!fData.valueRegex(req.params.value)) continue;
            else
                if (!req.params.value.match(fData.valueRegex)) continue;
            var validKeys;
            if (typeof fData.keys === 'string')
                validKeys = keyList[fData.keys];
            else
                validKeys = Object.keys(fData.keys);
            for (var i in validKeys) {
                if (req.params.filter == validKeys[i]) {
                    type = fKey;
                    break;
                }
            }
            if (type != 'invalid') break;
        }
        if (type == 'invalid') return res.end("-1");
        if (GLOBAL.filterData[type].replace) {
            for (var i = curFilters.length - 1; i >= 0; i--) {
                if (curFilters[i].type == type) {
                    curFilters.splice(i, 1);
                }
            }
        }
        var index = curFilters.length;
        curFilters.push({
            index: index,
            type: type,
            key: req.params.filter,
            value: req.params.value
        });
        
        req.user.save(function() {
            if (req.user.lastStation == req.params.sid) {
                var lastUpdated = req.user.stations[req.params.sid].lastUpdated; 
                if (lastUpdated && moment().diff(moment(lastUpdated, 'x'), 'hours') < 23) {
                    var filters = GLOBAL.parseFilters(curFilters);
                    filters.session_id = req.user.stations[req.params.sid].playlist;
                    echo('playlist/dynamic/steer').get(filters, function() {
                        res.end(index+""); //TODO: Make this a JSON object
                    });
                } else res.end(index+"");
            } else res.end(index+"");
        });
    });
});

router.get('/filter/clear/:sid', require('../user/isAuthenticated'), function(req, res) {
    var curFilters = req.user.stations[req.params.sid].filters;
    req.user.stations[req.params.sid].filters = [];
    req.user.save(function() {
        if (req.user.lastStation == req.params.sid) {
            var lastUpdated = req.user.stations[req.params.sid].lastUpdated; 
            if (lastUpdated && moment().diff(moment(lastUpdated, 'x'), 'hours') < 23) {
                var filters = GLOBAL.parseFilters(curFilters);
                filters.session_id = req.user.stations[req.params.sid].playlist;
                echo('playlist/dynamic/steer').get(filters, function() {
                    res.end("1"); //TODO: Make this a JSON object
                });
            } else res.end("1");
        } else res.end("1");
    });
});

router.get('/filter/remove/:sid/:kid', require('../user/isAuthenticated'), function(req, res) {
    var curFilters = req.user.stations[req.params.sid].filters;
    var foundFilter = false;
    for (var f in curFilters) {
        if (curFilters[f].index == req.params.kid) {
            curFilters.splice(req.params.kid, 1);
            foundFilter = true;
            break;
        }
    }
    if (!foundFilter) return res.end("0");
    for (var f in curFilters) {
        if (curFilters[f].index >= req.params.kid)
            curFilters[f].index--;
    }
    req.user.save(function() {
        if (req.user.lastStation == req.params.sid) {
            var lastUpdated = req.user.stations[req.params.sid].lastUpdated; 
            if (lastUpdated && moment().diff(moment(lastUpdated, 'x'), 'hours') < 23) {
                var filters = GLOBAL.parseFilters(curFilters);
                filters.session_id = req.user.stations[req.params.sid].playlist;
                echo('playlist/dynamic/steer').get(filters, function() {
                    res.end("1"); //TODO: Make this a JSON object
                });
            } else res.end("1");
        } else res.end("1");
    });
});

router.get('/filter/choices', function(req, res) {
    GLOBAL.getChoices(function(keyList) {
        res.end(JSON.stringify(keyList));
    });
});

router.get('/filter/list/:sid', require('../user/isAuthenticated'), function(req, res) {
    var data = [];
    req.user.stations[req.params.sid].filters.forEach(function(rawFilter) {
        var filterInfo = JSON.parse(JSON.stringify(rawFilter));
        filterInfo._id = undefined;
        filterInfo.desc = 'Your station ';
        switch(filterInfo.type) {
            case 'target':
                filterInfo.desc += 'will be ';
                if (filterInfo.value.length == 2)
                    filterInfo.desc += 'much ';
                if (filterInfo.value.slice(-1) == '-')
                    filterInfo.desc += 'less ';
                else
                    filterInfo.desc += 'more ';
                filterInfo.desc += filterInfo.key;
                filterInfo.desc += '.';
            break;
            case 'tertiary':
                filterInfo.desc += 'will ';
                switch(filterInfo.value) {
                    case 'Y':
                        filterInfo.desc += 'usually';
                    break;
                    case 'N':
                        filterInfo.desc += 'never';
                    break;
                    default:
                        filterInfo.desc += 'sometimes';
                    break;
                }
                filterInfo.desc += ' play ';
                filterInfo.desc += filterInfo.key;
                filterInfo.desc += ' music.';
            break;
            case 'tempo':
                filterInfo.desc += 'will only play music between ';
                filterInfo.desc += filterInfo.value.split(':')[0];
                filterInfo.desc += ' and ';
                filterInfo.desc += filterInfo.value.split(':')[1];
                filterInfo.desc += ' BPM.';
            break;
            case 'style':
                filterInfo.desc += 'will play ';
                if (filterInfo.length > 2)
                    filterInfo.desc += 'much ';
                if (filterInfo.value.slice(-1) == '+')
                    filterInfo.desc += 'more ';
                else
                    filterInfo.desc += 'less ';
                filterInfo.desc += filterInfo.key;
                filterInfo.desc += '-influenced music.';
            break;
            case 'mood':
                filterInfo.desc += 'will play music that is ';
                if (filterInfo.length > 2)
                    filterInfo.desc += 'much ';
                if (filterInfo.value.slice(-1) == '+')
                    filterInfo.desc += 'more ';
                else
                    filterInfo.desc += 'less ';
                filterInfo.desc += filterInfo.key;
                filterInfo.desc += '.';
        }
        data.push(filterInfo);
    });
    res.end(JSON.stringify(data));
});

module.exports = router;