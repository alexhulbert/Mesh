var curPage = 'none';
var filterIndex = -1;
var currentFilter = $();
var bigList = {
    moods: [],
    styles: []
};

function refreshFilters(index) {
    $.ajax(base + '/filter/list/' + index).done(function(filterStr) {
        var filters = JSON.parse(filterStr);
        $('#manage').empty();
        for (var f in filters) {
            var filter = filters[f];
            $('<div><div>')
                .addClass('filterItem')
                .data(filter)
                .append('<div class="deleteFilter"></div>')
                .append(
                    $('<div></div>')
                        .addClass('filterDesc')
                        .text(filter.desc)
                )
                .appendTo('#manage')
            ;
        }
    });
}

function predictInput(selector, tokens) {
    $(selector).prev().find('.nl-ti-input input').autocomplete({
	    source: tokens,
		minLength: 0,
        select: function(e, ui) {
            $(this).next().val(ui.item.id);
        },
        change: function(ev, ui) {
            if (!ui.item) $(this).val($('.ui-menu-item:first-child').text() || "");
        }
    }).focus(function() {
        var el = $(this);
        el.data('ui-autocomplete').menu.element.css({
            'max-height': $(window).height() - el.offset().top - el.height() - 42 + 'px'
        });
		el.autocomplete('search');
    });
}

function filterStation(index) {
    filterIndex = index;
    showFilter('main');
}

function showFilter(type, opt) {
    var tempFilter = $('.subview[data-page=' + opt + ']');
    if (!tempFilter.length && type == 'filter') return;
    currentFilter.out();
    if (currentFilter.hasClass('subview'))
        $('#filterView .circledButton').out();
    switch(type) {
        case 'filter':
            currentFilter = tempFilter;
        break;
        case 'station':
            currentFilter = $('#stationList');
        break;
        case 'manage':
            currentFilter = $('#manage');
        break;
        case 'main':
            currentFilter = $('#filterMenu');
        break;
    }
    if (!currentFilter)
    if (type == 'filter') $('#filterView .circledButton').in();
    currentFilter.in();
    if (opt === true) {
        $('#filterView').in();
        vex.dialog.alert(
            'IMPORTANT: There is currently no way to delete existing filters. ' + 
            'Filters have been disabled on this server (Server β). ' +
            'Although you can browse them, they will currenly do nothing. ' +
            'Filters should be stable enough to be enabled before June 1st.'
        );
    }
}

function initFilters() {
    $('#types').slimScroll({
        size: '1em',
        position: 'right',
        width: '100%',
        alwaysVisible: true,
        railVisible: true,
        railOpacity: 0.3,
        disableFadeOut: true,
        railBorderRadius: '0',
        borderRadius: '0',
        height: '70vh'
    }).parent().attr('id', 'filterMenu');
    $('.nl-form').each(function() {
        new NLForm(this);
    });
    
    $('.filterChoice').click(function() {
        var pageName = $(this).data('page');
        curPage = pageName;
        showFilter('filter', pageName);
    });
    $('#filterView .minus, .circledButton.left').click(function() {
        if (currentFilter.hasClass('subview'))
            return showFilter('main');
        if (currentFilter.attr('id') == 'filterMenu')
            return showFilter('station');
        $('#filterView').out();
    });
    
    var generalMap = {
        acoustic: 'acousticness',
        danceable: 'danceability',
		energetic: 'energy',
		instrumental: 'instrumentalness',
		live: 'liveness',
		loud: 'loudness',
		current: 'song_currency',
		varied: 'variety',
		vocal: 'speechiness',
		uplifting: 'valance',
		familiar: 'artist_familiarity',
		popular: 'artist_hotness', //!!!
	};
	var generalKeys = [];
	for (var adjective in generalMap)
		generalKeys.push(adjective);
	predictInput('.subview[data-page=general] .filterKey', generalKeys);

    $.ajax(base + '/filter/choices').done(function(choices) {
        bigList = JSON.parse(choices);
        //TODO: predictInput('.subview[data-page=mood] .filterKey', bigList.moods);
        predictInput('.subview[data-page=style] .filterKey', bigList.styles);
    });
}

function submitFilter() {
    var str = base + '/filter/add/' + filterIndex + '/';
    switch(curPage) {
        case 'general':
            str += $('.subview[data-page=general] .filterKey').val() || 'acoustic';
            str += '/';
            str += $('.subview[data-page=general] .filterVal option:checked').attr('value') || '+';
        break;
        case 'tertiary':
            str += $('.subview[data-page=tertiary] .filterKey option:checked').attr('value') || 'live';
            str += '/';
            str += $('.subview[data-page=tertiary] .filterVal option:checked').attr('value') || 'M';
        break;
        case 'tempo':
            
        break;
    }
    console.log(str);
}