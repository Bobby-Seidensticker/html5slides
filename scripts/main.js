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

var renderedText = "";
var editTimer;
var EDIT_BUFFER = 1000;   // ms

var HEIGHT = 700;
var H_TO_W_EDIT = .77;
var H_TO_W_NOT_EDIT = .50;
var index = false;


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
    if (newText == renderedText) {
        lastText = newText;
        return;
    }
    client.setDirty();
    lastText = newText;
    editTimer = setTimeout(render, EDIT_BUFFER);
/*
    try {
        doc.output.innerHTML = markdown.makeHtml(newText);
        nsdoc.updateScriptSections(doc.output);
    } catch (e) {
        $(doc.output).text("Error: " + e.message);
    }*/
}

function render() {
    if (editTimer) {
        clearTimeout(editTimer);
    }
    renderedText = lastText;
    doc.output.innerHTML = lastText;
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
            $(doc.editor)
                .bind('keyup', onEditChange)
                .autoResize({limit: 10000});
        }
        onResize();
    } else {
        render();
        $(doc.page).removeClass('edit');
        onResize();
    }
    $(doc.edit).val(editVisible ? 'hide' : 'edit');
}

function onReady() {
    handleAppCache();
    doc = dom.bindIDs();
    client = new clientLib.Client(exports);
    client.saveInterval = 0;

    client.addAppBar();

    $(doc.edit).click(toggleEditor);
    $(window).bind('scroll', onScroll);

    setInterval(onEditChange, syncTime * 1000);

    $.ajax({
        url: 'slides.html',
        error: function(result, status) {
            console.log('ajax load error');
        },
        success: function(slides) {
            doc.output.innerHTML = slides;
            doc.editor.innerHTML = slides;
            var el = document.createElement('script');
            el.type = 'text/javascript';
            el.src = 'scripts/slides.js';
            el.onload = function() {
                handleDomLoaded();
            }
            document.body.appendChild(el);
            onResize();
        }
    });
    $(window).bind('resize', onResize);
}


function onScroll() {
    if (editVisible) {
        doc.output.style['-webkit-transform'] = 'translate(0, ' + window.scrollY + 'px)';
    } else {
        doc.output.style['-webkit-transform'] = 'translate(0, 0)';
    }
    return;
}

function onResize(evt) {
    var height;
    if (editVisible) {
        height = parseFloat($('#outputBlock').css('width')) * H_TO_W_EDIT;
        $(doc.output).children().css('-webkit-transform', 'scale(' + height / HEIGHT + ')');
        $(doc.output).css('height', height);
        $(doc.outputBlock).css('height', doc.editor.style.height);
    } else {
        height = parseFloat($('#outputBlock').css('width')) * H_TO_W_NOT_EDIT;
        $(doc.output).children().css('-webkit-transform', 'scale(' + height / HEIGHT + ')');
        $(doc.output).css('height', height);
        $(doc.outputBlock).css('height', '100%');
    }
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
        document.body.innerHTML = json.blob.markdown;
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
