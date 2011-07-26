/*
 Create documentation from a JavaScript namespace.
 */
/*jslint evil:true */
namespace.lookup('org.startpad.nsdoc').defineOnce(function(ns)
{
    var base = namespace.lookup('org.startpad.base');
    var format = namespace.lookup('org.startpad.format');
    var reArgs = /^function\s+\S*\(([^\)]*)\)/;
    var reFuncName = /function\s+(\S+)\s*\(/;
    var reComma = /\s*,\s/;

    function functionDoc(name, func) {
        var s = new base.StBuf();
        var level = name.split('.').length;

        s.append(format.repeat('#', level) + ' *' + name + '*(');

        var args = reArgs.exec(func.toString());
        if (args === null) {
            return "error reading function: " + name + '\n';
        }
        args = args[1].split(reComma);
        var sep = '';
        if (args.length > 1 || args[0] != '') {
            s.append('*' + args.join('*, *') + '*');
            sep = ', ';
        }
        if (func.toString().indexOf('arguments') != -1) {
            s.append(sep + '...');
        }
        s.append(')\n');

        name = name[0].toLowerCase() + name.slice(1);
        for (var methodName in func.prototype) {
            if (typeof func.prototype[methodName] == 'function') {
                var method = func.prototype[methodName];
                s.append(functionDoc(name + '.' + methodName, method));
            }
        }

        return s.toString();
    }

    function getFunctionName(func) {
        if (typeof func != 'function') {
            return "notAFunction";
        }
        var result = reFuncName.exec(func.toString());
        if (result == null) {
            return "anonymous";
        }
        return result[1];
    }

    function namespaceDoc(ns) {
        var s = new base.StBuf();

        for (var name in ns) {
            if (ns.hasOwnProperty(name)) {
                var func = ns[name];
                if (typeof func != 'function' || name == '_closure') {
                    continue;
                }

                s.append(functionDoc(name, func));
            }
        }
        return s.toString();
    }

    /*
       Update embedded <script> sections and insert markdown-formatted
       blocks to display them.

       <script class="eval-lines"> can be used to eval each line and
       append a comment with the returned value.

       REVIEW: Injecting script into DOM executes on Firefox?  Need to disable.
    */
    function updateScriptSections(context) {
        var scripts = $('script', context);
        var e;
        var printed;

        // Improved version for format module
        // Takes a dictionary or any number of positional arguments.
        // {n} - positional arg
        // {key} - dictionary arg (first match)
        function replaceKeys(st) {
            var args = arguments;
            st = st.toString();
            var re = /\{([^}]+)\}/g;
            st = st.replace(re, function(whole, key) {
                var n = parseInt(key);
                if (!isNaN(n)) {
                    return args[n];
                } else {
                    return args[1][key];
                }
            });
            return st;
        }

        function print() {
            var s = replaceKeys.apply(undefined, arguments);
            while (s.length > 80) {
                printed.push(s.slice(0, 80));
                s = s.slice(80);
            }
            printed.push(s);
        }

        for (var i = 0; i < scripts.length; i++) {
            var script = scripts[i];
            printed = [];
            var body = base.strip(script.innerHTML);
            var lines = body.split('\n');
            var comments = [];
            var max = 0;
            var jBegin = 0;
            for (var j = 0; j < lines.length; j++) {
                if (j != lines.length - 1 &&
                    !/^\S.*;\s*$/.test(lines[j])) {
                    comments[j] = '';
                    continue;
                }
                var batch = lines.slice(jBegin, j + 1).join('\n');
                batch = base.strip(batch);
                try {
                    var value = eval(batch);
                    if (value == undefined) {
                        comments[j] = '';
                    } else {
                        if (typeof value == 'string') {
                            value = '"' + value + '"';
                            value.replace(/"/g, '""');
                        }
                        if (typeof value == 'function') {
                            value = "function " + getFunctionName(value);
                        }
                        if (typeof value == 'object') {
                            if (value === null) {
                                value = "null";
                            } else {
                                var prefix = getFunctionName(value.constructor) + ': ';
                                try {
                                    value = prefix + JSON.stringify(value);
                                } catch (e3) {
                                    value += prefix + "{...}";
                                }
                            }
                        }
                        comments[j] = '// ' + value.toString();
                    }
                } catch (e2) {
                    comments[j] = "// Exception: " + e2.message;
                }
                max = Math.max(lines[j].length, max);
                jBegin = j + 1;
            }

            for (j = 0; j < lines.length; j++) {
                if (comments[j] != "") {
                    lines[j] += format.repeat(' ', max - lines[j].length + 2) + comments[j];
                }
            }
            body = lines.join('\n');
            $(script).before('<pre><code>' + format.escapeHTML(body) + '</code></pre>');
            if (printed.length > 0) {
                $(script).after('<pre class="printed"><code>' +
                                format.escapeHTML(printed.join('\n')) +
                                '</code></pre>');
            }
        }
    }

    ns.extend({
        'namespaceDoc': namespaceDoc,
        'updateScriptSections': updateScriptSections
    });

});