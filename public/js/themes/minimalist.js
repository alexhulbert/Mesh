theme = {
    "sidebar": function() { },
    "draw": function(data) {
        $('.view').css('background', 'hsl(' + data.color.join(',') + '%)');
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
            '#background.paused { ' + 
            'background-image: radial-gradient(circle closest-side, ' +
            'hsl(' + color[0] + ',' + color[1] + ',' + glowBri + '%) 0%, ' + 
            'hsl(' + color.join(',') + '%) 95%) !important; }'
        );
        var colorA =
            'hsl(' + ((data.color[0] + 120) % 360)
            + ',' + (parseFloat(data.color[1])+50)/2 + '%,' +
            ((data.dark ? 75 : 25) + data.color[2])/2 + '%)'
        ;
        $('.nl-dd ul, nl-dd ul li:hover:active').css('color', colorA);
        var colorB =
            'hsl(' + ((data.color[0] + 240) % 360)
            + ',' + parseFloat(data.color[1])/2 + '%,'
        ;
        var colorDarker = colorB + ((data.dark ? 100 : 0) + data.color[2])/2 + '%)';
        colorB += data.color[2] + '%)';
        
        $('.nl-field ul, .ui-autocomplete').css('background', colorB);
        $('.nl-form select, .nl-form input, .nl-field-toggle').css({
            'color': colorDarker,
            'border-bottom': '1px dashed ' + colorDarker
        });
    },
    "tick": function() {
        if (isRunning) {
            requestAnimationFrame(theme.tick);
        }
        ear.analyser.getByteFrequencyData(ear.frequencies);
        var avg = 0;
        for (var i  = 0; i < 80; i++) {
            avg += ear.frequencies[i];
        }
        avg /= ear.frequencies.length;
        avg *= 5; //Amplitude
        var bri;
        if (light) {
            bri = (color[2] + (100 - avg*0.75))/2 - 10;
        } else {
            bri = Math.max((color[2] + avg*0.75 + 25)/3, color[2] + 25);
        }
        bkg.css('background-image', 'radial-gradient(circle closest-side, hsl(' + color[0] + ',' + color[1] + ',' + bri + '%) ' + avg + '%, hsl(' + color.join(',') + '%) 95%)');
    },
    "init": function() {
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
};