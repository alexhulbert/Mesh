var curPage = 'none';
var filterIndex = -1;
var currentFilter = $();
var bigList = {
    moods: [],
    styles: []
};

function removeFilter() {
    $('#manageView > *:not(:first-child)').out(function(e) {
        $(e).remove();
    });
    $.ajax(base + '/filter/remove/' + filterIndex + '/' + $(this).parent().data('index')).done(function() {
        refreshFilters(filterIndex);
    });
}

function refreshFilters(index) {
    $.ajax(base + '/filter/list/' + index).done(function(filterStr) {
        var filters = JSON.parse(filterStr);
        $('#manageView > *:not(:first-child)').remove();
        for (var f in filters) {
            var filter = filters[f];
            $('<div><div>')
                .addClass('filterItem')
                .data('index', filter.index)
                .append(
                    $('<div></div>')
                        .addClass('deleteFilter clickable circular')
                        .click(removeFilter)
                )
                .append(
                    $('<div></div>')
                        .addClass('filterDesc')
                        .text(filter.desc)
                )
                .insertAfter('#manageView > div:first-child')
            ;
            theme.recolor(color, $('body').hasClass('light'));
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
            if (!ui.item) $(this).val($(this).closest('.ui-menu-item:first-child').text() || "");
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
    showFilter('manage');
}

function showFilter(type, opt) {
    var tempFilter = $('.subview[data-page=' + opt + ']');
    if (!tempFilter.length && type == 'filter') return;
    currentFilter.out();
    if (currentFilter.hasClass('subview'))
        $('#filterView .cBtn').out();
    switch(type) {
        case 'filter':
            currentFilter = tempFilter;
        break;
        case 'station':
            currentFilter = $('#stationList');
        break;
        case 'manage':
            refreshFilters(filterIndex);
            currentFilter = $('#manage');
        break;
        case 'main':
            currentFilter = $('#filterMenu');
        break;
    }
    if (type == 'filter') $('#filterView .cBtn').in();
    currentFilter.in();
    if (opt === true) {
        $('#filterView').in();
        vex.dialog.alert(
            'IMPORTANT: Filters are currently not production-ready.\n' +
            'They may cause serious problems or bugs, so proceed with caution.'
        );
    }
}

function initFilters() {
    var slimParams = {
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
    };
    $('#types').slimScroll(slimParams).parent().attr('id', 'filterMenu');
    $('#manageView').slimScroll(slimParams).parent().attr('id', 'manage');
    $('.nl-form').each(function() {
        new NLForm(this);
    });
    
    $('.filterChoice').click(function() {
        var pageName = $(this).data('page');
        curPage = pageName;
        showFilter('filter', pageName);
    });
    $('#filterView .minus, #cLeft').click(function() {
        if (currentFilter.hasClass('subview'))
            return showFilter('main');
        if (currentFilter.attr('id') == 'filterMenu')
            return showFilter('manage');
        if (currentFilter.attr('id') == 'manage')
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
        predictInput('.subview[data-page=mood] .filterKey', bigList.moods);
        predictInput('.subview[data-page=style] .filterKey', bigList.styles);
    });
}

function submitFilter() {
    if (locked) return;
    var isValid = true;
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
        case 'style':
            str += $('.subview[data-page=style] .filterKey').val() || 'acid jazz';
            str += '/';
            str += $('.subview[data-page=style] .filterVal option:checked').attr('value') || 'G+';
        break;
        case 'mood':
            str += $('.subview[data-page=mood] .filterKey').val() || 'aggressive';
            str += '/';
            str += $('.subview[data-page=mood] .filterVal option:checked').attr('value') || 'M+';
        break;
        default:
            isValid = false;
        break;
    }
    if (isValid) {
        lock();
        $.ajax(str).done(function() {
            showFilter('manage');
            unlock();
        });
    }
}