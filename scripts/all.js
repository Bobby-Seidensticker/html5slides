/* Source: scripts/namespace-plus.js */
/* Source: src/namespace.js */
/* Namespace.js - modular namespaces in JavaScript

   by Mike Koss - placed in the public domain
*/

(function(global) {
    var globalNamespace = global['namespace'];
    var VERSION = '3.0.1';

    function Module() {}

    function numeric(s) {
        if (!s) {
            return 0;
        }
        var a = s.split('.');
        return 10000 * parseInt(a[0]) + 100 * parseInt(a[1]) + parseInt(a[2]);
    }

    if (globalNamespace) {
        if (numeric(VERSION) <= numeric(globalNamespace['VERSION'])) {
            return;
        }
        Module = globalNamespace.constructor;
    } else {
        global['namespace'] = globalNamespace = new Module();
    }
    globalNamespace['VERSION'] = VERSION;

    function require(path) {
        path = path.replace(/-/g, '_');
        var parts = path.split('.');
        var ns = globalNamespace;
        for (var i = 0; i < parts.length; i++) {
            if (ns[parts[i]] === undefined) {
                ns[parts[i]] = new Module();
            }
            ns = ns[parts[i]];
        }
        return ns;
    }

    var proto = Module.prototype;

    proto['module'] = function(path, closure) {
        var exports = require(path);
        if (closure) {
            closure(exports, require);
        }
        return exports;
    };

    proto['extend'] = function(exports) {
        for (var sym in exports) {
            if (exports.hasOwnProperty(sym)) {
                this[sym] = exports[sym];
            }
        }
    };
}(this));
/* Source: src/types.js */
namespace.module('org.startpad.types', function (exports, require) {
exports.extend({
    'VERSION': '0.1.0',
    'isArguments': function (value) { return isType(value, 'arguments'); },
    'isArray': function (value) { return isType(value, 'array'); },
    'copyArray': copyArray,
    'isType': isType,
    'typeOf': typeOf,
    'extend': extend,
    'project': project,
    'getFunctionName': getFunctionName
});

// Can be used to copy Arrays and Arguments into an Array
function copyArray(arg) {
    return Array.prototype.slice.call(arg);
}

var baseTypes = ['number', 'string', 'boolean', 'array', 'function', 'date',
                 'regexp', 'arguments', 'undefined', 'null'];

function internalType(value) {
    return Object.prototype.toString.call(value).match(/\[object (.*)\]/)[1].toLowerCase();
}

function isType(value, type) {
    return typeOf(value) == type;
}

// Return one of the baseTypes as a string
function typeOf(value) {
    if (value === undefined) {
        return 'undefined';
    }
    if (value === null) {
        return 'null';
    }
    var type = internalType(value);
    if (baseTypes.indexOf(type) == -1) {
        type = typeof(value);
    }
    return type;
}

// IE 8 has bug that does not enumerates even own properties that have
// these internal names.
var enumBug = !{toString: true}.propertyIsEnumerable('toString');
var internalNames = ['toString', 'toLocaleString', 'valueOf',
                     'constructor', 'isPrototypeOf'];

// Copy the (own) properties of all the arguments into the first one (in order).
function extend(dest) {
    var i, j;
    var source;
    var prop;

    if (dest === undefined) {
        dest = {};
    }
    for (i = 1; i < arguments.length; i++) {
        source = arguments[i];
        for (prop in source) {
            if (source.hasOwnProperty(prop)) {
                dest[prop] = source[prop];
            }
        }
        if (!enumBug) {
            continue;
        }
        for (j = 0; j < internalNames.length; j++) {
            prop = internalNames[j];
            if (source.hasOwnProperty(prop)) {
                dest[prop] = source[prop];
            }
        }
    }
    return dest;
}

// Return new object with just the listed properties "projected"
// into the new object.  Ignore undefined properties.
function project(obj, props) {
    var result = {};
    for (var i = 0; i < props.length; i++) {
        var name = props[i];
        if (obj && obj.hasOwnProperty(name)) {
            result[name] = obj[name];
        }
    }
    return result;
}

function getFunctionName(fn) {
    if (typeof fn != 'function') {
        return undefined;
    }
    var result = fn.toString().match(/function\s*(\S+)\s*\(/);
    if (!result) {
        return '';
    }
    return result[1];
}
});

/* Source: src/funcs.js */
namespace.module('org.startpad.funcs', function (exports, require) {
var types = require('org.startpad.types');

exports.extend({
    'VERSION': '0.3.0',
    'methods': methods,
    'bind': bind,
    'decorate': decorate,
    'create': Object.create || create,
    'subclass': subclass,
    'mro': mro,
    'numericVersion': numericVersion,
    'monkeyPatch': monkeyPatch,
    'patch': patch
});

// Convert 3-part version number to comparable integer.
// Note: No part should be > 99.
function numericVersion(s) {
    if (!s) {
        return 0;
    }
    var a = s.split('.');
    return 10000 * parseInt(a[0]) + 100 * parseInt(a[1]) + parseInt(a[2]);
}

// Monkey patch additional methods to constructor prototype, but only
// if patch version is newer than current patch version.
function monkeyPatch(ctor, by, version, patchMethods) {
    if (ctor._patches) {
        var patchVersion = ctor._patches[by];
        if (numericVersion(patchVersion) >= numericVersion(version)) {
            return;
        }
    }
    ctor._patches = ctor._patches || {};
    ctor._patches[by] = version;
    methods(ctor, patchMethods);
}

function patch() {
    monkeyPatch(Function, 'org.startpad.funcs', exports.VERSION, {
        'methods': function (obj) { methods(this, obj); },
        'curry': function () {
            var args = [this, undefined].concat(types.copyArray(arguments));
            return bind.apply(undefined, args);
        },
        'curryThis': function (self) {
            var args = types.copyArray(arguments);
            args.unshift(this);
            return bind.apply(undefined, args);
        },
        'decorate': function (decorator) {
            return decorate(this, decorator);
        },
        'subclass': function(parent, extraMethods) {
            subclass(this, parent, extraMethods);
        },
        'mro': function(ctors, extraMethods) {
            ctors.unshift(this);
            mro(ctors, extraMethods);
        }
    });
    return exports;
}

// Copy methods to a Constructor Function's prototype
function methods(ctor, obj) {
    types.extend(ctor.prototype, obj);
}

// Bind 'this' and/or arguments and return new function.
// Differs from native bind (if present) in that undefined
// parameters are merged.
function bind(fn, self) {
    var presets;

    // Handle the monkey-patched and in-line forms of curry
    if (arguments.length == 3 && types.isArguments(arguments[2])) {
        presets = Array.prototype.slice.call(arguments[2], self1);
    } else {
        presets = Array.prototype.slice.call(arguments, 2);
    }

    function merge(a1, a2) {
        var merged = types.copyArray(a1);
        a2 = types.copyArray(a2);
        for (var i = 0; i < merged.length; i++) {
            if (merged[i] === undefined) {
                merged[i] = a2.shift();
            }
        }
        return merged.concat(a2);
    }

    return function curried() {
        return fn.apply(self || this, merge(presets, arguments));
    };
}

// Wrap the fn function with a generic decorator like:
//
// function decorator(fn, arguments, wrapper) {
//   if (fn == undefined) { ... init ...; return;}
//   ...
//   result = fn.apply(this, arguments);
//   ...
//   return result;
// }
//
// The decorated function is created for each call
// of the decorate function.  In addition to wrapping
// the decorated function, it can be used to save state
// information between calls by adding properties to it.
function decorate(fn, decorator) {
    function decorated() {
        return decorator.call(this, fn, arguments, decorated);
    }
    // Init call - pass undefined fn - but available in this
    // if needed.
    decorator.call(fn, undefined, arguments, decorated);
    return decorated;
}

// Create an empty object whose __proto__ points to the given object.
// It's properties will "shadow" those of the given object until modified.
function create(obj) {
    function Create() {}
    Create.prototype = obj;
    return new Create();
}

// Classical JavaScript inheritance pattern.
function subclass(ctor, parent, extraMethods) {
    ctor.prototype = exports.create(parent.prototype);
    ctor.prototype.constructor = ctor;
    methods(ctor, extraMethods);
}

// Define method resolution order for multiple inheritance.
// Builds a custom prototype chain, where each constructor's
// prototype appears exactly once.
function mro(ctors, extraMethods) {
    var parent = ctors.pop().prototype;
    var ctor;
    while (ctors.length > 0) {
        ctor = ctors.pop();
        var ctorName = types.getFunctionName(ctor);
        var proto = exports.create(parent);
        types.extend(proto, ctor.prototype);
        proto.constructor = ctor;
        proto[ctorName + '_super'] = parent;
        parent = proto;
    }
    ctor.prototype = parent;
    methods(ctor, extraMethods);
}
});

/* Source: src/string.js */
namespace.module('org.startpad.string', function (exports, require) {
var funcs = require('org.startpad.funcs');

exports.extend({
    'VERSION': '0.1.2',
    'patch': patch,
    'format': format
});

function patch() {
    funcs.monkeyPatch(String, 'org.startpad.string', exports.VERSION, {
        'format': function formatFunction () {
            if (arguments.length == 1 && typeof arguments[0] == 'object') {
                return format(this, arguments[0]);
            } else {
                return format(this, arguments);
            }
        }
    });
    return exports;
}

var reFormat = /\{\s*([^} ]+)\s*\}/g;

// Format a string using values from a dictionary or array.
// {n} - positional arg (0 based)
// {key} - object property (first match)
// .. same as {0.key}
// {key1.key2.key3} - nested properties of an object
// keys can be numbers (0-based index into an array) or
// property names.
function format(st, args, re) {
    re = re || reFormat;
    if (st == undefined) {
        return "undefined";
    }
    st = st.toString();
    st = st.replace(re, function(whole, key) {
        var value = args;
        var keys = key.split('.');
        for (var i = 0; i < keys.length; i++) {
            key = keys[i];
            var n = parseInt(key);
            if (!isNaN(n)) {
                value = value[n];
            } else {
                value = value[key];
            }
            if (value == undefined) {
                return "";
            }
        }
        // Implicit toString() on this.
        return value;
    });
    return st;
}
});
/* Source: scripts/main.js */
namespace.module('com.pageforest.html5slides', function (exports, require) {
var clientLib = require('com.pageforest.client');
var dom = require('org.startpad.dom');
var format = require('org.startpad.format');

exports.extend({
    'onReady': onReady,
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
var currentShift = 0;
var slideBoundries = [];
var curBoundriesText = '';
var onReadyFlag;


var BASE_HEIGHT = 140;
var BUTTON_HEIGHT = 38;
var IDEAL_WIDTH = 1300;
var COMPRESSED_WIDTH = 900;
var HEIGHT = 700;
var OUTPUT_WIDTH = 0.9;
var OUTPUT_WIDTH_EDIT = 0.4317;

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
    if (latestText != curBoundriesText) {
        getSlideBoundries();
    }
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
    setSlidePosFromCursor();
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
    var i;

    if (diff === 0) {
        return;
    }
    if (diff > 0) {
        for (i = 0; i < diff; i++) {
            var saveSlide = curSlide;
            // Advance past slides that have builds
            while (curSlide == saveSlide && curSlide < slideEls.length - 1) {
                nextSlide('automated');
            }
        }
    } else {
        for (i = 0; i < -diff; i++) {
            prevSlide('automated');
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
        $(doc.page).removeClass('edit');
    }
    onResize();
    $(doc.edit).val(editVisible ? 'Full' : 'Edit');
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
    $(doc.editor).keydown(tabToSpace);
    $(doc.editor).bind('keydown click', setSlidePosFromCursor);
    $(window).bind('resize', onResize);
    $(doc.fullscreen).bind('click', viewSlideshowFullscreen);
    $(doc.next).click(nextSlide);
    $(doc.prev).click(prevSlide);

    $(doc.output).html("<section class='slides'><article></article></section>");
    handleDomLoaded();
    // check the url if there exists a doc to be loaded
    var urlData = handleLocationHash();
    // if there isn't, load default doc
    if (!urlData.doc) {
        $.ajax({
            url: 'slides.html',
            error: function(result, status) {
                console.log('ajax load error');
            },
            success: function(slides) {
                var json = {title: 'Editable HTML5 Slides', blob: {version: 1.1, slides: slides}};
                setDoc(json);
            }
        });
    }
    // get stock code samples from script tags in editor(.html)
    var scripts = $('script[type=slide-template]');
    var s;
    for (var i = 0; i < scripts.length; i++) {
        s = scripts[i];
        stockCode[s.title] = $(s).text();
    }
    onReadyFlag = true;
}

function viewSlideshowFullscreen() {
    if (client.docid == undefined) {
        event.preventDefault();
        alert('You have to save a document to view it fullscreen');
        return;
    }
    if (client.state != 'clean') {
        alert('Warning, the current slideshow has not been saved');
    }
}

function modifyFullscreenURL() {
    if (client.docid != undefined) {
        $(doc.fullscreen).attr('href',
                               location.href.replace(/page=[0-9]+/, '').
                               replace('doc=', 'docs/').
                               replace('#', '').
                               replace('&', '') + '/slides');
    }
}

function getSlideBoundries() {
    var nextLoc, s;
    var distFromZero = 0;
    var val = $(doc.editor).val();
    slideBoundries = [0];
    s = slideBoundries;
    nextLoc = val.indexOf('</article>') + 10;
    while (nextLoc > 9) {
        distFromZero += nextLoc;
        s[s.length] = distFromZero;
        val = val.slice(nextLoc);
        nextLoc = val.indexOf('</article>') + 10;
    }
    curBoundriesText = latestText;
}

function setSlidePosFromCursor(event) {
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
    $(doc.phantomPre).text($(doc.editor).val().slice(0, slideBoundries[curSlide]));
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
    var h, w;

    if (editVisible) {
        h = window.innerHeight - BASE_HEIGHT - BUTTON_HEIGHT;
        w = window.innerWidth * OUTPUT_WIDTH_EDIT; // .4317
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
        h = window.innerHeight - BASE_HEIGHT - BUTTON_HEIGHT;
        w = window.innerWidth * OUTPUT_WIDTH; // .9
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
    var val = 'translate(' + currentShift + 'px, 0px) scale(' + currentScale + ')';
    $(elem).css('-webkit-' + type, val);
    $(elem).css('-moz-' + type, val);
    $(elem).css('-o-' + type, val);
    $(elem).css('-ms-' + type, val);
    $(elem).css(type, val);
}

function updateMeta(json) {
    document.title = json.title;
    $('#title').text(json.title);
    modifyFullscreenURL();
}

function onSaveSuccess(json) {
    updateMeta(client.meta);
    // save a flat html version
    var flat = "<!DOCTYPE html>\n<!--\nGoogle HTML5 slide template  Authors: Luke Mahe (code)\nMarcin Wichary (code and design)\nDominic Mazzoni (browser compatibility)\nCharles Chen (ChromeVox support)\nURL: http://code.google.com/p/html5slides/\n-->\n<html>\n  <head>\n  <title>Presentation</title>\n    <meta charset='utf-8'>\n    <script src='http://html5slides.googlecode.com/svn/trunk/slides.js'></script>\n</head><body style='display: none'>    <section class='slides'>" + renderedText +
        "</section></body></html>";
    client.storage.putBlob(client.docid, 'slides', flat);
}

function setDoc(json) {
    console.log('setDoc()');
    if (json.blob.version === 1) {
        latestText = json.blob.markdown;
    } else if (json.blob.version === 1.1) {
        latestText = json.blob.slides;
    } else {
        console.log('ERROR: unknown blob version number');
    }
    doc.editor.value = latestText;
    renderedText = latestText;
    $(doc.output).css('visibility', 'hidden');
    $(doc.output).html("<section class='slides'>" + latestText + "</section>");
    refresh();
    getSlideBoundries();
    setCursorPos();
    onResize();
    $(doc.output).css('visibility', 'visible');
    tooFarInFuture();

    if (onReadyFlag) {
        toggleEditor();
        onReadyFlag = false;
    }
    updateMeta(json);
}

function getDoc() {
    return {
        blob: {
            version: 1.1,
            slides: doc.editor.value
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
});

