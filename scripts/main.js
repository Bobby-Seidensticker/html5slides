var clientLib = require('com.pageforest.client');
var dom = require('org.startpad.dom');
var format = require('org.startpad.format');
var markdown = new Showdown.converter();

exports.extend({
    'onReady': onReady,
    'onReadyIndex': onReadyIndex,
    'getDoc': getDoc,
    'setDoc': setDoc,
    'onSaveSuccess': onSaveSuccess,
    'handleLocationHash': handleLocationHash,
    'getDocid': getDocid,
    'setDocid': setDocid
});

var client;
var doc;                            // Bound elements here
var blob;
var lastText = "";
var syncTime = 5;
var editVisible = false;
var editorInitialized = false;
var editTimer;
var EDIT_BUFFER = 1000;   // ms

var currentScale;
var currentScroll = 0;
var index = false;
var BASE_HEIGHT = 130;
var BUTTON_HEIGHT = 40;
var IDEAL_WIDTH = 1300;
var COMPRESSED_WIDTH = 900;
var HEIGHT = 700;
var OUTPUT_WIDTH = .9;
var OUTPUT_WIDTH_EDIT = .4317;


var stockCode = {};/* = {
    title: '',
    basic: '',
    code: '',
    codePretty: '',
    basicBullet: '',
    builds: '',
    buildP: '',
    smaller: '',
    table: '',
    styles: '',
    segue: '',
    image: '',
    imageCenter: '',
    imageFill: '',
    quote: '',
    embed: '',
    embedFull: ''
};*/

function getDocid() {
    return handleLocationHash().doc;
}

function setDocid(docid) {
    handleLocationHash({ doc: docid });
}

function handleLocationHash(obj) {
    var hash = document.location.hash.replace(/#/, ''),
        doc,
        page;
    if (hash.length > 0 && hash.search('doc=') == -1 && hash.search('page=') == -1) {
        document.location = location.href.replace('#' + hash, '#doc=' + hash);
    }
    if (hash.search('doc=') > -1) {
        doc = hash.replace('doc=', '');
        if (doc.search('&') > -1) {
            doc = doc.split('&')[0];
        }
    }
    if (hash.search('page=') > -1) {
        page = hash.split('page=');
        page = page[page.length - 1];
    }
    if (obj) {
        if (obj.doc) {
            doc = obj.doc;
        }
        if (obj.page) {
            page = obj.page;
        }
        hash = '#';
        if (doc) {
            hash += 'doc=' + doc;
        }
        if (page) {
            if (doc) {
                hash += '&';
            }
            hash += 'page=' + page;
        }
        location.replace(hash);
    }
    return {
        doc: doc,
        page: page
    };
}

function onEditChange() {
    if (editTimer) {
        clearTimeout(editTimer);
    }
    var newText = doc.editor.value;
    if (newText == lastText) {
        return;
    }
    client.setDirty();
    lastText = newText;
    editTimer = setTimeout(render, EDIT_BUFFER);
}

function render() {
    if (editTimer) {
        clearTimeout(editTimer);
    }
    $(doc.output).html("<section class='slides'>" + lastText + "</section>");
    refresh();
    onResize();
}

function toggleEditor(evt) {
    var height;
    editVisible = !editVisible;
    if (editVisible) {
        $(doc.page).addClass('edit');
        // Binding this in the onReady function does not work
        // since the original textarea is hidden.
        if (!editorInitialized) {
            editorInitialized = true;
            $(doc.editor).bind('keyup', onEditChange);
        }
    } else {
        render();
        $(doc.page).removeClass('edit');
        currentScroll = 0;
    }
    onResize();
    $(doc.edit).val(editVisible ? 'hide' : 'edit');
}

function insertStockCode() {
    var text = stockCode[$(doc.select).val()];
    if (!text) {
        return;
    }
    $(doc.editor).val($(doc.editor).val() + trimCode(text));
}

function trimCode(s) {
    s = s.replace(/^\n+|\s+$/g, '');
    var match = /^\s+/.exec(s);
    if (match) {
        var pre = new RegExp('^\\s{' + match[0].length + '}');
        var lines = s.split('\n');
        for (var i = 0; i < lines.length; i++) {
            lines[i] = lines[i].replace(pre, '');
        }
        s = lines.join('\n');
    }
    return s + '\n';
}

function onReady() {
    handleAppCache();
    doc = dom.bindIDs();
    client = new clientLib.Client(exports);
    client.saveInterval = 0;

    client.addAppBar();

    $(doc.edit).click(toggleEditor);
    $(doc.insert).click(insertStockCode);
    $(window).bind('scroll', onScroll);
    var scripts = $('script[type=slide-template]');
    var s;
    for (var i = 0; i < scripts.length; i++) {
        s = scripts[i];
        stockCode[s.title] = $(s).text();
    }

    $.ajax({
        url: 'slides.html',
        error: function(result, status) {
            console.log('ajax load error');
        },
        success: function(slides) {
            lastText = slides;
            doc.editor.value = slides;
            var el = document.createElement('script');
            el.type = 'text/javascript';
            el.src = 'scripts/slides.js';
            el.onload = function() {
                render();
                handleDomLoaded();
                $(doc.next).click(nextSlide);
                $(doc.prev).click(prevSlide);
            }
            document.body.appendChild(el);
        }
    });
    $(window).bind('resize', onResize);
}

function onScroll() {
    if (editVisible) {
        currentScroll = window.scrollY;
        setCrossTransform(doc.output, 'transform');
        setTimeout(positionNav, 10);
    }
}

function positionNav() {
    if (editVisible) {
        var topOfNav = doc.output.offsetHeight * currentScale + window.scrollY;
        $(doc.nav).css('top', topOfNav + 'px');
    } else {
        $(doc.nav).css('top', (doc.outputBlock.offsetHeight - 35) + 'px');
    }
}

function onResize(evt) {
    var width = editVisible ? COMPRESSED_WIDTH : IDEAL_WIDTH;
    if (editVisible) {
        var h = window.innerHeight - BASE_HEIGHT - BUTTON_HEIGHT;
        var w = window.innerWidth * OUTPUT_WIDTH_EDIT; // .4317
        if (h / HEIGHT > w / COMPRESSED_WIDTH) {
            currentScale = doc.outputBlock.offsetWidth / width;
            if (currentShift > 0) {
                currentShift = 0;
            }
        } else {
            currentScale = h / HEIGHT;
            currentShift = (w - COMPRESSED_WIDTH * currentScale) / 2;
        }
        $(doc.editor).css('height', window.innerHeight - BASE_HEIGHT);
        $(doc.outputBlock).css('height', window.innerHeight - BASE_HEIGHT);
    } else {
        var h = window.innerHeight - BASE_HEIGHT - BUTTON_HEIGHT;

        var w = window.innerWidth * OUTPUT_WIDTH; // .9
        if (h / HEIGHT > w / IDEAL_WIDTH) {
            currentScale = w / IDEAL_WIDTH;
            currentShift = 0;
        } else {
            currentScale = h / HEIGHT;
            currentShift = (w - IDEAL_WIDTH * currentScale) / 2;
        }
        $(doc.outputBlock).css('height', (currentScale * HEIGHT + BUTTON_HEIGHT) + 'px');
    }
    setCrossTransform(doc.output, 'transform');
    positionNav();
}

function setCrossTransform(elem, type) {
    var val = 'translate(' + currentShift + 'px, ' + currentScroll + 'px) scale(' + currentScale + ')';
    $(elem).css('-webkit-' + type, val);
    $(elem).css('-moz-' + type, val);
    $(elem).css('-o-' + type, val);
    $(elem).css('-ms-' + type, val);
    $(elem).css(type, val);
}

function updateMeta(json) {
    document.title = json.title;
    $('#title').text(json.title);
}

function onSaveSuccess(json) {
    updateMeta(client.meta);
}

function onReadyIndex() {
    if (!document.location.hash) {
        document.location = 'http://html5slides.pageforest.com/editor';
    }
    index = true;
    handleAppCache();
    doc = dom.bindIDs();
    client = new clientLib.Client(exports);
    client.saveInterval = 0;
    $(document.body).addClass('index');
}

function setDoc(json) {
    if (index) {
        document.body.innerHTML = wrap(json.blob.markdown);
        var el = document.createElement('script');
        el.type = 'text/javascript';
        el.src = 'scripts/slides.js';
        el.onload = function() {
            handleDomLoaded();
        }
        document.body.appendChild(el);
        return;
    }
    doc.editor.value = json.blob.markdown;
    onEditChange();
    updateMeta(json);
}

function getDoc() {
    if (index) {
        return;
    }
    return {
        blob: {
            version: 1,
            markdown: doc.editor.value
        },
        readers: ['public']
    };
}

// For offline - capable applications
function handleAppCache() {
    if (typeof applicationCache == 'undefined') {
        return;
    }

    if (applicationCache.status == applicationCache.UPDATEREADY) {
        applicationCache.swapCache();
        location.reload();
        return;
    }

    applicationCache.addEventListener('updateready', handleAppCache, false);
}
