theme = {
    "sidebar": function(mode) { },
    "draw": function(data) {
        $('#stationAdder,.noUi-base').css('background', 'hsl(' + data.color.join(',') + '%)');
        var hsl = data.color[0] + ',' + data.color[1] + ',' + Math.min(data.color[2] + (data.dark ? -10 : 10), 100) + '%';
        $('.fancyInput,.noUi-background').css('background-color', 'hsl(' + hsl + ')');
        $('.sidr .container').css('background-color', 'hsla(' + hsl + ',0.675)');
        var str = data.songName + '<br>' + data.artistName;
        if (data.albumName !== null) str += ' - ' + data.albumName;
        $('#sagText').html(str);
        $('.noUi-handle').css('background-color', light ? 'black' : 'white');
        px = parseFloat(getComputedStyle(document.documentElement).fontSize);
        var blurRad;

        if (data.albumUrl == '/img/noAlbum.png' || typeof data.albumUrl === 'undefined') {
            var pattern = GeoPattern.generate(data.artistName + data.songName, {
                color: tinycolor('hsl(' + data.color.join(',') + '%)').toHexString()
            });
            $('#frost').css({
                'background-image': pattern.toDataUrl(),
                'background-size': 'auto'
            });
            $('#background').css({
                'z-index': 0,
                'width': '100%',
                'height': '100%'
            });
            blurRad = 0.5;
        } else {
            $('#frost').css({
                'background-image': 'url("' + data.albumUrl + '")',
                'background-size': 'cover'
            });
            $('#background').css({
                'z-index': -1,
                'width': 'auto',
                'height': 'auto'
            });
            blurRad = 6;
        }

        $('#frost').css({
            filter: 'blur(' + blurRad * px + 'px)',
            '-webkit-filter': 'blur(' + blurRad * px + 'px)'
        });
    },
    "tick": function() {
        if (isRunning) {
            requestAnimationFrame(theme.tick);
        }
        music().analyser.getByteFrequencyData(music().frequencyData);
        var avg = 0;
        for (var i  = 0; i < 80; i++) {
            avg += music().frequencyData[i];
        }
        avg /= music().frequencyData.length;
        avg *= 4;
        /*
        bkg.css({
           width:  avg*0.675 + 'vmin',
           height: avg*0.675 + 'vmin'
        });
        */
        var hslVal;
        //hslVal = 'hsl(0, 0%, ' + (light ? (100 - avg) : avg) + '%)';
        var bri;
        var ratio = 0.735; //hue to light values. Higher -> colorful/subtle
        if (light)
            bri = (((color[2] + (100 - avg*0.75))/2 - 10)*ratio + (100 - avg))*(1 - ratio);
        else
            bri = Math.max((color[2] + avg*0.75 + 25)/3, color[2] + 25)*ratio + avg*(1 - ratio);
        if (typeof songs[curSong] !== 'undefined' && typeof songs[curSong].albumUrl !== 'undefined' && songs[curSong].albumUrl != '/img/noAlbum.png') {
            body.css('background', 'hsl(' + color[0] + ',' + parseFloat(color[1])*0.8 + '%,' + bri + '%)');
        } else {
            bkg.css('background-image', 'radial-gradient(circle closest-side, hsla(' + color[0] + ',' + parseFloat(color[1])*0.8 + '%,' + bri + '%, 0.25) ' + avg + '%, hsl(' + color.join(',') + '%) 95%)');
        }
    },
    "init": function() {
        $.getScript('/js/lib/geopattern.min.js'); //Screw Async
        $('#album,#noalbum').css('border-radius', '1em');
        $('#download,#feedbackBtn,#feedbackIcon').css('top', '2.5vh');
        $('#feedbackBtn,#feedbackIcon').css('right', '2.5vh');
        $('#download').css('left', '2.5vh');
        var blur = 'blur(' + 6 * px + 'px)';
        if (typeof InstallTrigger !== 'undefined' || isApp)  {
            blur = 'url("/img/filters.svg#';
            blur += (navigator.appVersion.indexOf("Win") != -1) ? 'win' : 'mac';
            blur += 'Blur")';
        }
        /*
        bkg.css({
            'z-index': 0,
            width: 0,
            height: 0,
            'border-radius': '1em',
            left: 0,
            'background': 'none'
        });
        */
        bkg.css('background', 'none');
        $('<div></div>')
            .attr({
                id: 'frost',
                'class': 'themeSpec'
            })
            .css({
                width:  '100%',
                height: '100%',
                'background-size': 'cover',
                'background-position': 'center',
                transform: 'translate3d(0, 0, 0)',
                filter: blur,
                '-webkit-filter': 'blur(' + 6 * px + 'px)',
                position: 'absolute',
            })
            .prependTo(body)
        ;
        $('#progress')
            .addClass('bigHandle')
            .detach()
            .prependTo('#player')
        ;
    }
};
