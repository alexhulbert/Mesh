var isApp = document.URL.indexOf('http://') === -1 && document.URL.indexOf('https://') === -1;
var color = [0, "0%", 0]; //Changes according to album
var isRunning = false;
var musicPlayer = [{}, {}];
var bkg;
var light = true;
var curStation = null;
var inQueue = false;
var sidebar = 0;
var curSong = 0;
var songs = [];
var body;
var intervalDown, intervalUp;
var mx, my;
var maxHeight = 0;
var onUp = false, onDown = false;
var mIndex = 0;
var progBar;
var nextData;
var pb = true;
var con;
var sFreeze = false;
var theme;
var px = parseFloat(getComputedStyle(document.documentElement).fontSize);
var base = '';
var nativeMedia = false;
var globalOverhead = 0;
var audioWorkaround = navigator.userAgent.match(/(iPhone)|(AppleCore)|(chrome)|(iTunes)|(undefined)/gi);

//Used for mobile debugging
//var report = window.onerror;
//window.onerror = function() {alert(Array.prototype.slice.call(arguments).join('\n'));}; //TODO: Remove

//This is probably a really bad idea
function devTest(str) {
    var parts = str.split(':');
    if (parts.length != 3) return;
    $('.' + parts[0].replace(/[^a-zA-Z]*/g, '')).css(parts[1], parts[2]);
}

function chooseTheme(themeName, callback) {
    $.getScript(base + '/js/themes/' + themeName + '.js', function() {
        theme.init();
        callback();
    });
}

function refreshStations() {
    con.sortable('destroy');
    con.sortable({
        items: '.station:not(.add)'
    });
    con.sortable().bind('sortupdate', function(e, ui) {
        var item = $(ui.item);
        var oldS = item.data('orderIndex');
        var newS = 7 - item.index();
        if (oldS != newS) {
            $.ajax('/order/' + oldS + '/' + newS);
            item.data('orderIndex', newS);
        }
    });
}

function login(cb, tries) {
    if (typeof tries === 'undefined') tries = 1;
    $.ajax(base + '/user/authenticated').done(function(loggedIn) {
        if (loggedIn != "true") {
            var creds = {
                email: localStorage.email || prompt("Email"),
                password: localStorage.password || prompt("Password")
            };
            
            $.post(base + '/user/login', creds).done(function(resp) {
                if (resp.redirect.slice(-4) == 'home') {
                    localStorage.email = creds.email;
                    localStorage.password = creds.password;
                    cb(resp.slice(7));
                } else {
                    if (tries <= 3) {
                        alert("Incorrect Credentials.");
                        login(cb, tries + 1);
                    } else {
                        //ERROR: Get an account!
                    }
                }
            });
        } else {
            cb();
        }
    });
}

function music() {
    return musicPlayer[mIndex];
}

if (!String.prototype.format) {
    String.prototype.format = function() {
        var args = arguments;
        return this.replace(/{(\d+)}/g, function(match, number) { 
            return typeof args[number] !== 'undefined' ? args[number] : match;
        });
    };
}

function loadStation(sid, callback) {
    var doDefault = (typeof callback === 'undefined');
    
    if (doDefault) {
        $('.station').removeClass('current');
        $('.station[data-id=' + sid + ']')
            .detach()
            .insertAfter('#stat .container > .station:first-child')
            .addClass('current')
        ;
    }
    
    $.ajax(base + '/station/load/' + sid).done(function(data) {
        curStation = sid;
        if (doDefault) {
            isRunning = true;
            next(false);
            play();
        } else {
            callback();
        }
    });
}

function back() {
    mesh(curSong - 1, 3, function() {});
}

function next() {
    mesh(curSong + 1, 3, function() {});
}

function playSong(id) {
    $.ajax(base + '/grab/song/' + id + (audioWorkaround ? '/fixed' : '')).done(function(data) {
       nextData = JSON.parse(data)[0];
       load(nextData);
       mesh(songs.length, 2, function() {});
   });
}

function mesh(ind, part, cb) {
    if (ind >= songs.length) {
        if (inQueue) {
            part = 2;
            inQueue = false;
        }
        if (part & 1) {
            newSong(function(data) {
                nextData = data;
                load(data);
                cb();
                if (part & 2) {
                    mesh(ind, 2, cb);
                }
            });
        } else if (part & 2) {
            songs.push(nextData);
            curSong = ind;
            updateHistory('add', songs.length - 1);
            updateUI(nextData);
            playQueue();
        }
    } else {
        if (inQueue) {
            songs.push(nextData);
            inQueue = false;
        }
        var soin = songs[ind];
        if (part & 1) {
            load(soin);
        }
        if (part & 2) {
            curSong = ind;
            updateUI(soin);
            playQueue();
        }
    }
}

function playQueue() {
    pause();
    mIndex = !mIndex + 0;
    play();
}

function deleteStation(id, event) {
    if (id === 0 && $('.station').length == 2) return; //Don't delete last station
    if (event) event.stopPropagation();
    if (curStation == id) pause(); //lock?
    $.ajax(base + '/station/delete/' + id).done(function(resp) {
        updateHistory('remove', id);
        refreshStations();
        if (curStation == id) 
            loadStation(resp);
        else
            curStation = resp;
    });
}

function updateHistory(action, param) {
    switch(action) {
        case 'remove':
            $('#stat .container > [data-id="' + param + '"]').remove();
            $('#stat .container > :not(.add)').each(function(elem) {
                var e = $(elem);
                if (parseInt(e.data('id')) > parseInt(param)) {
                    e.data('id', parseInt(e.data('id')) - 1);
                }
            });
            
        break;
        case 'add':
            var data = songs[param];
            $('#song .container > div:first-child').after(
                '<div class="song"><div onclick="mesh({4}, 3, function() {});" style="background-image: url({3})"></div><span><span>"{0}"<br>{1}<br>{2}</span></span></div>'.format(
                    data.songName,
                    data.artistName,
                    data.albumName === null ? '(No Album)' : data.albumName,
                    data.albumUrl,
                    songs.length - 1
                )
            );
        break;
        case 'set':
            $('.song').removeClass('current');
            $('.song:nth-last-child(' + (param + 1) + ')').addClass('current');
        break;
    }
}

function updateUI(data) {
    updateHistory('set', curSong);
    var fill, specFill, tintFill;
    color = data.color;
    if (color[0] === null) color[0] = 0;
    if (data.dark) {
        $('body').addClass('light').removeClass('dark');
        light = false;
        fill = "#FFF";
        specFill = "#444";
        tintFill = "#CCC";
    } else {
        light = true;
        $('body').addClass('dark').removeClass('light');
        fill = "#000";
        specFill = "#D8D8D8";
        tintFill = "#444";
    }
    var icons = $('.icon').contents();
    for (var i = 0; i < icons.length; i++) {
        var icon = $('g g,path', icons[i]);
        $('svg', icons[i]).css('cursor', 'pointer');
        icon.attr('fill', fill);
    }
    $('.icon.clickable')
        .mouseover(function(self) {
            var context = $(self.target).contents().addBack();
            $('g g,path', context).attr('fill', data.dark ? "#DDD" : "#222");
        })
        .mouseout(function(self) {
            var context = $(self.target).contents().addBack();
            $('g g,path', context).attr('fill',  fill);
        })
        .contents().find('svg').add('svg.icon.clickable')
            .mousedown(function(self) {
                $('g g,path', self.target).attr('fill', data.dark ? "#BBB" : "#444");
            })
            .mouseup(function(self) {
                $('g g,path', self.target).attr('fill', data.dark ? "#DDD" : "#222");
            })
    ;
    $('#centerpiece').contents().find('g g,path').attr('fill', specFill);
    if (data.albumUrl === null) {
        $('#album').css('background-image', 'none');
    } else {
        $('#album').css('background-image', 'url("' + data.albumUrl + '")');
    }
    theme.draw($.extend(data, {color:color}));
}

function downloadSong() {
    var el = $('<a download></a>')
        .attr('href', music().audio.src.replace('/fixed', '') + '/download')
        .appendTo('body')
    ;
    el[0].click();
    el.remove();
}

function nextUp(data) {
    var upNext = $('.next.song');
    upNext.data('song', data);
    upNext.find('div').css('background-image', 'repeating-linear-gradient(135deg, transparent, transparent 0.25em, rgba(127,127,127, 0.5) 0.25em, rgba(127,127,127, 0.5) 0.5em), url(' + data.albumUrl + ')');
    upNext.find('span span').html('"{0}"<br>{1}<br>{2}'.format(
        data.songName,
        data.artistName,
        data.albumName === null ? '(No Album)' : data.albumName
    ));
}

function newSong(cb, skip) {
    if (typeof skip === 'undefined') skip = false;
    //TODO: Improve song lookahead logic
    $.ajax(base + '/grab/station/' + curStation /* + '/' + globalOverhead */).done(function(data) {
        globalOverhead = 0;
        var queueSongs = JSON.parse(data);
        cb(queueSongs[0]);
        nextUp(queueSongs[1]);
    });
}

function load(data) {
    var artist = encodeURIComponent(data.artistName);
    var song = encodeURIComponent(data.songName);
    var srcUrl = base + '/stream/' + artist.replace(/\//g, '%2F') + '/' + song.replace(/\//g, '%2F') + (audioWorkaround ? '/fixed' : '');
    if (isApp && nativeMedia) {
        musicPlayer[!mIndex + 0].audio.release();
        musicPlayer[!mIndex + 0].audio = new Media(srcUrl);
    } else {
        musicPlayer[!mIndex + 0].audio.src = srcUrl;
        musicPlayer[!mIndex + 0].audio.load();
    }
    if (data.len) {
        musicPlayer[!mIndex + 0].duration = function() {
            return data.len;
        };  
    } else {
        musicPlayer[!mIndex + 0].duration = function() {
            return isApp && nativeMedia ? this.audio.getDuration() : this.audio.duration;
        };
    }
}

function bounce(what) {
    $.ajax(base + '/feedback/' + curStation + '/' + what).done(function() {
        switch(what) {
            case 'dislike':
                next();
            break;
        }
    });
}

if (!isApp) $(document).mousemove(function(e) {
	if (!sidebar) return;
    mx = e.pageX;
    my = e.pageY;

	if (sidebar == 1) {
		var stat = $('#stat');
		var op = 0;
		if (stat.css('display') != 'none') {
			op = stat.width();
		}
		if (e.pageX > $('#stations').position().left + $('#stations').width() + op && !sFreeze) {
			$.sidr('close', 'stat');
		}
	} else {
		if (e.pageX < ($('#song').position().left - $('#songs').width())) {
			$.sidr('close', 'song');
		}
	}

	var div = $('#' + (sidebar == 1 ? 'stat' : 'song')).find('.container');
	if (e.pageY < $(window).height()*0.25) {
		if (!onUp) {
			onUp = true;
			maxHeight = div.prop("scrollHeight") - div.height();
			intervalUp = setInterval(function() {
				var sub = (1 - my / ($(window).height() * 0.25)) * 7.5;
				var pos = div.scrollTop();
				if (pos >= sub) {
					div.scrollTop(pos - sub);
				}
			}, 50);
		}
	} else {
		if (onUp) {
			onUp = false;
			clearInterval(intervalUp);
		}
	}

	if (e.pageY > $(window).height()*0.75) {
		if (!onDown) {
			onDown = true;
			maxHeight = div.prop("scrollHeight") - div.height();
			intervalDown = setInterval(function() {
				var sub = (my - $(window).height() * 0.75) / ($(window).height() * 0.25) * 7.5;
				var pos = div.scrollTop();
				if (pos <= (maxHeight - sub)) {
					div.scrollTop(pos + sub);
				}
			}, 50);
		}
	} else {
		if (onDown) {
			onDown = false;
			clearInterval(intervalDown);
		}
	}
});

function play() {
    $('#pause').removeClass('hidden');
    $('#play').addClass('hidden');
    $('#background').removeClass('paused');
    music().audio.play({ playAudioWhenScreenIsLocked: true });
    isRunning = true;
    if (!nativeMedia || !isApp) theme.tick();
}

function pause() {
    $('#pause').addClass('hidden');
    $('#play').removeClass('hidden');
    $('#background').addClass('paused');
    isRunning = false;
    music().audio.pause();
}

function appendStation(station) {
    var elem = $('<div class="station"><span class="left" onclick="deleteStation($(this).parent().data(\'id\'), event);"></span><div></div></div>')
        .attr('title', station.name)
        .css('background-image', 'url(' + station.image + ')')
        .data('id', station.id)
        .data('orderIndex', $('#stat .container .station:not(.add)').length)
        .attr('data-id', station.id)
        .insertAfter('#stat .container > .station:first')
    ;
    refreshStations();
    return elem;
}

function getStations() {
    $.ajax(base + '/stations').done(function(res){ 
        var data = JSON.parse(res);
        for (var i in data.stations) {
            var station = data.stations[i];
            appendStation(station);
        }
        
        $('.station[data-id=' + data.lastStation  + ']').addClass('current');
        loadStation(data.lastStation, function() {
            mIndex = !mIndex + 0;
            newSong(function(data) {
                load(data);
                songs.push(data);
                updateHistory('add', 0);
                updateUI(data);
                $('#loading').fadeOut(350, playQueue);
            });
        });
    });
}

function timeUpdate() {
    var elapsed = music().audio.currentTime;
    var total = music().duration();
    
    if (pb) progBar.val(elapsed/total);
    
    if (total - elapsed < 15 && total - elapsed > 0.1 && !inQueue) {
        mesh(curSong + 1, 1, function() {});
        inQueue = true;
    }
    
    if (total - elapsed < 0.25 && inQueue) {
        inQueue = false;
        mesh(curSong + 1, 2, function() {});
    }
}

function squeezebox(username, password, ip, port) {
    if (typeof ip === 'undefined') ip = 'localhost';
    if (typeof port === 'undefined') port = 9000;
    if (typeof cb === 'undefined') cb = $.noop;
    
    var file = (base || location.protocol + '//' + location.host) + '/stations/' + btoa(username + ':' + password).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '~') + '.opml';
    
    window.open('http://' + ip + ':' + port + '/plugins/Favorites/index.html?' + $.param({
        index: 2,
        sess: 1,
        action: 'editset',
        removeoncancel: 1,
        entrytitle: 'Mesh',
        entryurl: file,
        editset: 'Save'
    }));
    return file;
}

function init() {
    if (isApp) {
        new Audio('').play();
        $('object').each(function() {
            var e = $(this);
            $.ajax(e.data('url'), {
                dataType: 'text'
            }).done(function(resp) {
                var newSvg = $(resp)
                    .attr({
                        id: e.attr('id'),
                        class: e.attr('class')
                    })
                ;
                newSvg
                    .find('[onmouseover][onclick]')
                    .addBack()
                    .removeAttr('onmouseover onclick')
                ;
                e.removeAttr('id').after(newSvg).remove();
            });
        });
    }
    $('#loadLogo').contents().find('g, path').css('fill', '#333');
    for (var i in musicPlayer) {
        if (isApp && nativeMedia) {
            var mp = musicPlayer[i];
            mp.audio = new Media('');
            Object.defineProperty(mp.audio, "currentTime", {
                set: function(value) {
                    this.seekTo(value*1000);
                }
            });
        } else {
            var mp = musicPlayer[i];
            mp.ctx = typeof AudioContext === 'undefined' ? new webkitAudioContext() : new AudioContext();
            mp.audio = new Audio('');
            mp.audioSrc = mp.ctx.createMediaElementSource(mp.audio);
            mp.analyser = mp.ctx.createAnalyser();
            mp.audioSrc.connect(mp.analyser);
            mp.analyser.connect(mp.ctx.destination);
            mp.frequencyData = new Uint8Array(mp.analyser.frequencyBinCount);
            mp.audio.addEventListener('timeupdate', timeUpdate);
        }
    }
    if (!nativeMedia || !isApp) theme.tick();
    getStations();
    
    con = $('#stat .container');
    con.click(function(e) {
        var target = $(e.target).closest('.station');
        if (target.length && !target.hasClass('add')) {
            loadStation(target[0].dataset.id);
        }
    });
    
    
    /*$("#feedbackBtn")
        .attr('href', options.star ? '#rating' : '#feedback')
        .wheelmenu({
            trigger: "hover",
            animation: "fly",
            animationSpeed: "fast",
            angle: [30, 60]
        })
    ;*/
    
    $('#stations').sidr({
        side: 'left',
        name: 'stat',
        onOpen: function() {
            sidebar = 1;
            theme.sidebar(sidebar);
        },
        onClose: function() {
            sidebar = 0;
            theme.sidebar(sidebar);
        },
        body: '#player,#frost'
    });
    
    $('#songs').sidr({
        side: 'right',
        name: 'song',
        onOpen: function() {
            sidebar = 2;
            theme.sidebar(sidebar);
        },
        onClose: function() {
            sidebar = 0;
            theme.sidebar(sidebar);
        }
    });
    
    progBar.noUiSlider({
        start: 0,
        connect: "lower",
        range: {
            min: 0,
            max: 1
        }
    });
    
    /*$('#volume').noUiSlider({
        start: 0,
        orientation: 'vertical',
        connect: "lower",
        range: {
            min: 0,
            max: 1
        }
    });*/
    
    progBar
        .on('slide', function() {
            music().audio.currentTime = progBar.val()*music().duration();
        })
        .on('mousedown', function(e) {
            pb = false;
        })
        .on('mouseup', function() {
            pb = true;
        })
    ;
    
    $('#search').keyup(function(e) {
        if (e.keyCode == 13) {
            $.ajax(base + '/search/' + e.target.value).done(function(resp) {
                playSong(eval(resp)[0]);
            });
        }
    });
    
    newStation();
};

if (isApp) {
    document.addEventListener("deviceready", function() {
        $(document).ready(function() {
            progBar = $('#progress');
            body = $('body');
            bkg = $('#background');
            chooseTheme("frostedGlass", function() { login(init); });
        });
    }, false);
} else {
    $(document).ready(function() {
        progBar = $('#progress');
        body = $('body');
        bkg = $('#background');
        chooseTheme("frostedGlass", init);
    });
}

$(document).on("keydown", function (e) {
    if (e.which === 8 && !$(e.target).is("input, textarea")) {
        e.preventDefault();
    }
});