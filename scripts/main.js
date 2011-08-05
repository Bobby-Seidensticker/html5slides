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
    'setCursorPos': setCursorPos,
    'getDocid': getDocid,
    'setDocid': setDocid
});
//testing vars
var startTime = Math.floor(new Date().getTime() / 1000);


var client;
var doc;                            // Bound elements here
var blob;
var latestText = '';
var renderedText = '';
var syncTime = 5;
var editVisible = false;
var editorInitialized = false;
var editTimer;
var EDIT_BUFFER = 1000;   // ms

var currentScale;
var currentScroll = 0;
var index = false;
var slideBoundries = [];
var curBoundriesText = '';


var BASE_HEIGHT = 130;
var BUTTON_HEIGHT = 40;
var IDEAL_WIDTH = 1300;
var COMPRESSED_WIDTH = 900;
var HEIGHT = 700;
var OUTPUT_WIDTH = .9;
var OUTPUT_WIDTH_EDIT = .4317;

var stockCode = {};


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

function onEditChange(event) {
    if (event) {
        switch (event.keyCode) {
        case 39: // right arrow
        case 37: // left arrow
        case 40: // down arrow
        case 38: // up arrow
        case 34: // PgDn
        case 33: // PgUp
            return;
        }
    }
    latestText = doc.editor.value;
    if (editTimer == undefined) {
        editTimer = setTimeout(render, EDIT_BUFFER);
    }
    client.setDirty();
}

function render() {
    editTimer = undefined;
    if (renderedText == latestText) {
        return;
    }
    editTimer = setTimeout(render, EDIT_BUFFER);

    $(doc.output).html("<section class='slides'>" + latestText + "</section>");
    renderedText = latestText;

    refresh();
    tooFarInFuture();
    onResize();
}

// if deleting text makes currentSlide > # slides then,
// rewind so currentSlide is new last slide
function tooFarInFuture() {
    if (curSlide < slideEls.length) {
        return;
    }
    if (slideEls.length == 0) {
        adjustSlidePos(0);
    }
    adjustSlidePos(slideEls.length - 1);
}

function adjustSlidePos(newIndex) {
    var diff = newIndex - curSlide;
    var temp;
    if (diff === 0) {
        return;
    }
    if (diff > 0) {
        for (var i = 0; i < diff; i++) {
            temp = curSlide;
            automatedFlag = true;
            nextSlide();
            while (curSlide < slideEls.length - 1 && curSlide == temp) {  // for slides that build
                automatedFlag = true;
                nextSlide();
            }
        }
    } else {
        for (var i = 0; i < -diff; i++) {
            automatedFlag = true;
            prevSlide();
        }
    }
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
    var text, val, tail, str, loc;
    text = trimCode(stockCode[$(doc.select).val()]);
    if (!text) {
        return;
    }
    val = $(doc.editor).val();
    tail = val.slice(doc.editor.selectionEnd);
    if (tail.indexOf('<article') == -1) {
        str = val + '\n' + text;
    } else {
        loc = doc.editor.selectionEnd + tail.indexOf('<article');
        str = val.slice(0, loc) + text + '\n' + val.slice(loc);
    }
    $(doc.editor).val(str);
    onEditChange();
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
//    $(window).bind('scroll', onScroll);
    $(doc.editor).keydown(tabToSpace);
    $(doc.fullscreen).bind('click', function (event) {
        event.preventDefault();
        alert('You have to save a document to view it fullscreen');
    });

    var scripts = $('script[type=slide-template]');
    var s;
    for (var i = 0; i < scripts.length; i++) {
        s = scripts[i];
        stockCode[s.title] = $(s).text();
    }

    $(doc.editor).bind('keydown click', setSlidePosFromCursor);

    $.ajax({
        url: 'slides.html',
        error: function(result, status) {
            console.log('ajax load error');
        },
        success: function(slides) {
            $(doc.output).css('display', 'none');
            latestText = slides;
            doc.editor.value = slides;
            var el = document.createElement('script');
            el.type = 'text/javascript';
            el.src = 'scripts/slides.js';
            el.onload = function() {
                render();
                handleDomLoaded();
                $(doc.next).click(nextSlide);
                $(doc.prev).click(prevSlide);
                getSlideBoundries();
                $(doc.output).css('display', 'block');
            }
            document.body.appendChild(el);
        }
    });
    $(window).bind('resize', onResize);
}

function getSlideBoundries() {
    var nextLoc, s;
    var distFromZero = 0;
    var val = $(doc.editor).val();
    slideBoundries = [0];
    s = slideBoundries;
    nextLoc = val.indexOf('</article>') + 10;
    while (nextLoc > 9) {
        distFromZero += nextLoc
        s[s.length] = distFromZero;
        val = val.slice(nextLoc);
        nextLoc = val.indexOf('</article>') + 10;
    }
    curBoundriesText = latestText;
}

function setSlidePosFromCursor(event) {
    if (latestText != curBoundriesText) {
        getSlideBoundries();
    }
    // if cursor is inside slide currently displayed do nothing
    if (doc.editor.selectionEnd > slideBoundries[curSlide] &&
        doc.editor.selectionEnd < slideBoundries[curSlide + 1]) {
        return;
    }
    // find which slide cursor is in
    for (var i = 1; i < slideBoundries.length; i++) {
        if (slideBoundries[i] >= doc.editor.selectionEnd) {
            adjustSlidePos(i - 1);
            return;
        }
    }
    // in case cursor is at very end
    adjustSlidePos(slideEls.length - 1);
    return;
}

function setCursorPos() {
    var text = $(doc.editor).val().slice(0, slideBoundries[curSlide]);
    $(doc.phantom).html('<pre>' + format.escapeHTML(text) + '</pre>');
    var height = doc.phantom.offsetHeight;
    if (height < 100) {
        height = 0;
    }
    doc.editor.selectionStart = slideBoundries[curSlide];
    doc.editor.selectionEnd = slideBoundries[curSlide];
    $(doc.editor).scrollTop(height);
    $(doc.editor).blur();
}

function tabToSpace(event) {
    if (event.keyCode == 9) { //tab
        var selectionStart = this.selectionStart;
        event.preventDefault();
        var val = $(this).val();
        var str = val.slice(0, selectionStart) + '  ' + val.slice(selectionStart);
        $(this).val(str);
        this.selectionStart = selectionStart + 2;
        this.selectionEnd = this.selectionStart;
    }
}
/*
function onScroll() {
    if (editVisible) {
        currentScroll = window.scrollY;
        setCrossTransform(doc.output, 'transform');
        setTimeout(positionNav, 10);
    }
}*/

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
    $(doc.phantom).css('width', doc.editor.scrollWidth + 'px');
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
    $(doc.fullscreen).unbind();
    $(doc.fullscreen).attr('href',
                           location.href.replace('editor', '').
                           replace(/&page=[0-9]+/, ''));
}

function onSaveSuccess(json) {
    updateMeta(client.meta);
//    client.storage.putBlob(
}

function onReadyIndex() {
    handleAppCache();
    if (!document.location.hash) {
        document.location = 'http://html5slides.pageforest.com/editor';
        return;
    }
    index = true;
    doc = dom.bindIDs();
    client = new clientLib.Client(exports);
    client.saveInterval = 0;
    $(document.body).addClass('index');
}

function setDoc(json) {
    if (index) {
        $('body').html("<section class='slides'>" + json.blob.markdown + "</section>");
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
    getSlideBoundries();
    updateMeta(json);
}

function getDoc() {
    if (index) {
        return {
            blob: undefined,
            reader: ['public']
        };
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
