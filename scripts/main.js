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
var H_TO_W_EDIT = .77;
var H_TO_W_NOT_EDIT = .50;
var index = false;

var stockCode = {
    title: '\n<article>\n  <h1>Title Goes Here Up<br/>To Two Lines</h1>' +
        '\n  <p>Sergey Brin<br/>May 10, 2011</p>\n</article>\n',
    basic: '\n<article>\n  <p>\n    This is a slide with just text. This is a slide with just text.  This is a slide with just text.  This is a slide with just text.  This is a slide with just text. This is a slide with just text.\n  </p>\n  <p>There is more text just underneath.</p>\n</article>\n',
    code: '',
    codePretty: '<article>\n  <h3>This slide has some code </h3>' +
        '\n  <section><pre>' +
        '\n    &lt;script type="text/javascript"&gt;' +
        '\n    // Say hello world until the user starts questioning' +
        '\n    // the meaningfulness of their existence.' +
        '\n    function helloWorld(world) {' +
        '\n    for (var i = 42; --i &gt;= 0;) {' +
        '\n    alert("Hello " + String(world));' +
        '\n    }' +
        '\n    }' +
        '\n    &lt;/script&gt;' +
        '\n    &lt;style&gt;' +
        '\n    p { color: pink }' +
        '\n    b { color: blue }' +
        '\n    u { color: "umber" }' +
        '\n  &lt;/style&gt;' +
        '\n  </pre></section>' +
        '\n  </article>',
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
};

var wrap = function (articles) {
    return "<section class='slides'>" + articles + "</section>";
}

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
    $(doc.output).children('section').remove();
    $(doc.output).append(wrap(lastText));
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
        onResize();
    } else {
        render();
        $(doc.page).removeClass('edit');
        currentScroll = 0;
        onResize();
    }
    $(doc.edit).val(editVisible ? 'hide' : 'edit');
}

function insertStockCode() {
    $(doc.editor).val($(doc.editor).val() + stockCode[$(doc.select).val()]);
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
        $(doc.nav).css('top', (doc.outputBlock.offsetHeight - 45) + 'px');        
    }
}

function onResize(evt) {
    var width = editVisible ? 900 : 1300;
    currentScale = doc.outputBlock.offsetWidth / width;
    if (editVisible) {
        $(doc.editor).css('height', window.innerHeight - 140);
        $(doc.outputBlock).css('height', doc.editor.offsetHeight);
    } else {
        $(doc.outputBlock).css('height', (currentScale * 700 + 50) + 'px');
    }
    setCrossTransform(doc.output, 'transform');
    positionNav();
}

function setCrossTransform(elem, type) {
    var val = 'translate(0, ' + currentScroll + 'px) scale(' + currentScale + ')';
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
