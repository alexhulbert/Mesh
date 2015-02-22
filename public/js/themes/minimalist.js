theme = {
    "sidebar": function() { },
    "draw": function(data) {
        $('#stationAdder').css('background', 'hsl(' + data.color.join(',') + '%)');
        $('.sidr .container,.fancyInput').css('background-color', 'hsl(' + data.color[0] + ',' + data.color[1] + ',' + Math.min(data.color[2] + (data.dark ? -10 : 10), 100) + '%)');
        var str = data.songName + '<br>' + data.artistName;
        if (data.albumName !== null) str += ' - ' + data.albumName;
        $('#sagText').html(str);
        var glowBri;
        if (data.dark)
            glowBri = Math.min(color[2] + 50, 100);
        else
            glowBri = Math.max(color[2] - 25, 0);
        $('#pauseStyle').html(
            '#background.paused' + ((isApp && nativeMedia) ? ',html.mobile' : '') + ' #background { ' + 
            'background-image: radial-gradient(circle closest-side, ' +
            'hsl(' + color[0] + ',' + color[1] + ',' + glowBri + '%) 0%, ' + 
            'hsl(' + color.join(',') + '%) 95%) !important; }'
        );
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
        avg *= 5; //Amplitude
        alert(music().frequencyData);
        var bri;
        if (light) {
            bri = (color[2] + (100 - avg*0.75))/2 - 10;
        } else {
            bri = Math.max((color[2] + avg*0.75 + 25)/3, color[2] + 25);
        }
        bkg.css('background-image', 'radial-gradient(circle closest-side, hsl(' + color[0] + ',' + color[1] + ',' + bri + '%) ' + avg + '%, hsl(' + color.join(',') + '%) 95%)');
    },
    "init": function() {
        if (isApp) {
            $('#progress')
                .addClass('bigHandle')
                .detach()
                .prependTo('#player')
                .css({
                    bottom: 0,
                    top: '100%'
                })
            ;
        }
    }
};