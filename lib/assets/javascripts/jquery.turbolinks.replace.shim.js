// jQuery Turbolinks Replace Shim
// Experimental IE 8 and 9 compatibility for the `replace()` method of Turbolinks 3
// TODO: Port `scroll`?, `cacheRequest`? and `showProgressBar`? options for the `replace()` method
//       `onNodeRemoved()`? methods
// WIP: `executeScriptTags()`
// See: https://github.com/rails/turbolinks/issues/526
(function($) {
  if ((typeof Turbolinks === 'undefined' || Turbolinks === null) || !Turbolinks.supported) {
    var replace = function(html, options) {
      if (typeof options === 'undefined' || options === null) {
        options = {};
      }

      var loadedNodes = changePage(extractTitleAndBody(html), options);

      var eventOptions = {
        type: (options.change ? 'page:partial-load' : 'page:load'),
        originalEvent: {data: loadedNodes}
      };

      return $(document).trigger(eventOptions);
    };

    var changePage = function(content, options) {
      if (typeof content === 'object' && typeof options === 'object') {
        // We can't create virtual a `body` element, it seems buggy with IE 8 and 9
        var body = $('<div' + content.bodyAttributes + '>' + content.body + '</div>');

        var scriptsToRemove = options.runScripts === false ? 'script:not([data-turbolinks-eval="always"])' : 'script[data-turbolinks-eval="false"]';
        $(scriptsToRemove, body).remove();

        var currentBody = $('body');
        var nodesToChange;
        var changedNodes = [];
        if (options.change) {
          nodesToChange = $('[data-turbolinks-temporary]', 'body').toArray();
          $.merge(nodesToChange, findNodesMatchingKeys(currentBody, options.change));
        } else {
          nodesToChange = currentBody.toArray();
        }

        $(document).trigger({type: 'page:before-unload', originalEvent: {data: nodesToChange}});

        var scriptsToRun = options.runScripts === false ? 'script[data-turbolinks-eval="always"]' : 'script:not([data-turbolinks-eval="false"])';
        executeScriptTags(scriptsToRun);

        if (options.title !== false) {
          if (options.title) {
            document.title = options.title;
          } else if (content.title) {
            document.title = content.title;
          }
        }

        if (options.change) {
          changedNodes = swapNodes(body, nodesToChange, {keep: false});
        } else {
          if (!options.flush) {
            var nodesToKeep = $('[data-turbolinks-permanent]', 'body').toArray();
            if (options.keep) {
              $.merge(nodesToKeep, findNodesMatchingKeys(currentBody, options.keep));
            }
            swapNodes(body, nodesToKeep, {keep: true});
          }

          currentBody.empty().append(body.html());
          currentBody.attributes(body.attributes());
          currentBody = $('body');
          if (content.csrfToken) {
            CSRFToken.update(content.csrfToken);
            CSRFToken.setupAjaxHeader();
          }
          changedNodes = currentBody.toArray();
        }

        CSRFToken.refreshForms();

        $(document).trigger({type: 'page:change', originalEvent: {data: changedNodes}});
        $(document).trigger('page:update');
        return changedNodes;
      } else {
        throw new Error('Invalid arguments');
        // Fallback to default Turbolinks.replace() method?
        // return Turbolinks.defaultReplace(html, options);
      }
    };

    var findNodesMatchingKeys = function(body, keys) {
      var matchingNodes = [];
      var ref = $.isArray(keys) ? keys : [keys];
      // var ref = $.makeArray(keys); // jQuery alternative
      $.each(ref, function(i, key) {
        $.merge(matchingNodes, $('[id^="' + key + ':"], [id="' + key + '"]', body).toArray());
      });
      return matchingNodes;
    };

    var swapNodes = function(targetBody, existingNodes, options) {
      var changedNodes = [];
      $.each(existingNodes, function(i, existingNode) {
        // IDs may contain '-', ‘_’, '.' and ':'. w3.org/TR/html4/types.html#type-name
        // Source: http://stackoverflow.com/a/605835
        var nodeId = existingNode.getAttribute('id').replace(/([-_.:])/g, '\\$1');
        if (!nodeId) {
          throw new Error('Turbolinks partial replace: turbolinks elements must have an id.');
        }
        var targetNode = $('#' + nodeId, targetBody);
        if (targetNode.length) {
          if (options.keep) {
            targetNode.replaceWith(existingNode.cloneNode(true));
            // $(document).trigger({type: 'page:after-remove', originalEvent: {data: targetNode.get(0)}});
          } else {
            targetNode = targetNode.get(0).cloneNode(true);
            $(existingNode).replaceWith(targetNode);
            $(document).trigger({type: 'page:after-remove', originalEvent: {data: existingNode}});
            changedNodes.push(targetNode);
          }
        }
      });

      return changedNodes;
    };

    var executeScriptTags = function(selector) {
      var scripts = $('body').find(selector);
      scripts.each(function(i, script) {
        script = $(script);
        var ref = script.attr('type');
        if (ref && ref !== '' && ref !== 'text/javascript') {
          return true;
        }
        var copy = $('<script></script>');
        copy.attributes(script.attributes());

        if (!script.is('[async]')) {
          copy.removeAttr('async');
        }
        // copy.text(script.html());// Buggy with IE8
        // document.body.appendChild(copy.get(0));
        // script.remove();
        script.replaceWith(copy);
        copy.get(0).text = script.get(0).text; // See: http://stackoverflow.com/a/12201713
      });
    };

    var extractTitleAndBody = function(html) {
      var $html = $(html);
      var csrfTokenContent = CSRFToken.get(html).token;
      var titleContent = null;
      var $title = $html.filter('title');
      if ($title.length) {
        titleContent = $('<div></div>').text($title.html()).html();
      } else {
        // For IE 8
        var result = html.match(/<title>([^<]+)<\/title>/);
        if (result) {
          titleContent = $('<div></div>').text(result[1]).html();
        }
      }

      var htmlMatches = html.match(/^(.|[\n\r])*<body([^>]*)>((.|[\n\r])*)<\/body>(.|[\n\r])*$/im);
      var bodyAttributesContent = '';
      var bodyContent = html;
      if (htmlMatches && htmlMatches.length >= 3) {
        bodyAttributesContent = htmlMatches[2];
        bodyContent = htmlMatches[3];
      }
      return {
        title: titleContent,
        body: bodyContent,
        bodyAttributes: bodyAttributesContent,
        csrfToken: csrfTokenContent
      };
    };

    var CSRFToken = {
      get: function(doc) {
        if (!doc) {
          doc = document;
        }
        var tag = $(doc).find('meta[name="csrf-token"]');
        if (!tag || tag.length === 0) {
          tag = $(doc).filter('meta[name="csrf-token"]');
        }

        var param = $(doc).find('meta[name="csrf-param"]');
        if (!param || param.length === 0) {
          param = $(doc).filter('meta[name="csrf-param"]');
        }

        return {
          node: tag,
          token: tag.attr('content'),
          param: param.attr('content')
        };
      },
      update: function(latest) {
        var current = this.get();
        if ((current.token) && (latest) && current.token !== latest) {
          current.node.attr('content', latest);
        }
      },
      // Making sure that all forms have actual up-to-date token(cached forms contain old one)
      // TODO: Some Server-side frameworks like Laravel need this.
      // If your application doesn't use `jquery.turbolinks` library,
      // You should add this on every `page:load` event.
      // Even if Turbolinks is supported by the browser.
      refreshForms: function() {
        // console.log('Refresh Forms tokens!');//debug
        var current = this.get();
        $('form input[name="' + current.param + '"]').val(current.token);
      },
      // Make sure that every Ajax request sends the CSRF token
      // TODO: If your application doesn't use jQuery UJS but it send jQuery AJAX requests.
      // You should add this on every `page:load` event.
      // Even if Turbolinks is supported by the browser.
      setupAjaxHeader: function() {
        $.ajaxPrefilter(function(options, originalOptions, xhr) {
          if (!options.crossDomain) {
            var current = CSRFToken.get();
            if (current.token) {
              // console.log('Refresh X-CSRF-Token' + current.token);//debug
              xhr.setRequestHeader('X-CSRF-Token', current.token);
            }
          }
        });
      }
    };

    // Get all attributes of an element using jQuery
    // Source: http://stackoverflow.com/a/14645827
    // Usage:
    //   $element.attributes();// Get all attributes of the current jQuery object
    //   $element.attributes({id: 'new_id', class: 'new-class'}); // Set multiple attributes to the current jQuery object
    // var defaultJQueryAttributes;
    // if ($.fn.attributes) {
    //   // Backup default `$.fn.attributes` function if any
    //   defaultJQueryAttributes = $.fn.attributes;
    // }
    $.fn.attributes = function() {
      if (arguments.length === 0) {
        if (this.length === 0) {
          return null;
        }

        var obj = {};
        $.each(this[0].attributes, function() {
          if (this.specified) {
            obj[this.name] = this.value;
          }
        });
        return obj;
      }

      return $.fn.attr.apply(this, arguments);
    };

    // Public API
    if (typeof Turbolinks === 'undefined' || Turbolinks === null) {
      Turbolinks = {};
    }
    Turbolinks.defaultReplace = Turbolinks.replace;
    Turbolinks.replace = replace;

    // Restore default `$.fn.attributes` function
    // $.fn.attributes = defaultJQueryAttributes;
  }
})(jQuery);
