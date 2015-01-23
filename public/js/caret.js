var elem;
var blnk;
var t = false;
var str = "";

document.onkeypress = function(e) {
    if (typeof elem === 'undefined') elem = document.getElementById('input');
    var c = (e.charCode === 0 ? e.keyCode : e.charCode);
    if (e.ctrlKey) {
        return;
    }
    switch(c) {
        case 13:
            var request = new XMLHttpRequest();
            request.open('GET', '/bootstrap/' + str, true);
            document.getElementById('prog').setAttribute('style', 'width: 50%');
            request.onload = function() {
                if (request.status >= 200 && request.status < 400) {
                    document.getElementById('prog').setAttribute('style','width: 100%; background-color: #8DFF8D')
                    location.href = '/home';
                } else {
                    document.getElementById('prog').setAttribute('style','width: 0%')
                    setTimeout(function() {
                        document.getElementById('textBar').setAttribute('style', 'background-color: #D8D8D8');
                    }, 500);
                    document.getElementById('textBar').setAttribute('style', 'background-color: #FF8D8D');
                }
            };
            request.send();
        break;
        case 32:
            elem.innerHTML += '&nbsp;';
            str += " ";
        break;
        default:
            var char = String.fromCharCode(c);
            elem.innerHTML += char;
            str += char;
        break;
    }
};

document.onkeydown = function(e) {
    if (e.keyCode == 8) {
        e.preventDefault();
        str = str.slice(0, -1);
        if (elem.innerHTML.slice(-6) == '&nbsp;') {
            elem.innerHTML = elem.innerHTML.slice(0, -6);
        } else {
            elem.innerHTML = elem.innerHTML.slice(0, -1);
        }
    }
};

setInterval(function() {
    if (typeof blnk === 'undefined') blnk = document.getElementById('caret');
    t = !t;
    document.getElementById('caret').setAttribute("class", t ? 'hidden' : '');
}, 530);

function testProg(percent) {
    document.getElementById('prog').style.width = percent + '%';
}