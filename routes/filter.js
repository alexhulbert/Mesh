var express = require('express');
var router = express.Router();
var echo = require('echojs')({
    key: process.env.ECHONEST_KEY
});

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
            familiar: 'artist_familiarity'
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
            childrens: 'childrens',
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
    }
};

GLOBAL.parseFilters = function(filters) {
    var finalData = {};
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
        }
    }
    return finalData;
};

router.get('/filter/add/:sid/:filter/:value', require('../user/isAuthenticated'), function(req, res) {
    var curFilters = req.user.stations[req.params.sid].filters;
    var type = 'invalid';
    for (var fKey in GLOBAL.filterData) {
        var fData = GLOBAL.filterData[fKey];
        if (typeof fData.valueRegex === 'function')
            if (!fData.valueRegex(req.params.value)) continue;
        else
            if (!req.params.value.match(fData.valueRegex)) continue;
        for (var shortKey in fData.keys) {
            if (req.params.filter == shortKey) {
                type = fKey;
                break;
            }
        }
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
    
    //console.log(GLOBAL.parseFilters(curFilters));
    req.user.save(function() {
        if (req.user.lastStation == req.params.sid) {
            var filters = GLOBAL.parseFilters(curFilters);
            filters.session_id = curFilters.playlist;
            echo('playlist/dynamic/steer').get(filters, function() {
                res.end(index+""); //TODO: Make this a JSON object
            });
        } else res.end(index+"");
    });
});

router.get('/filter/remove/:sid/:kid', require('../user/isAuthenticated'), function(req, res) {
    
});

router.get('/filter/list/:sid', require('../user/isAuthenticated'), function(req, res) {
    var data = [];
    req.user.stations[req.params.sid].filters.forEach(function(rawFilter) {
        var filterInfo = JSON.parse(JSON.stringify(rawFilter));
        filterInfo._id = undefined;
        filterInfo.desc = 'Your station ';
        switch(filterInfo.type) {
            case 'target':
                filterInfo.desc += 'is ';
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
        }
        data.push(filterInfo);
    });
    res.end(JSON.stringify(data));
});

module.exports = router;