// jQuery Turbolinks Replace Shim
// Experimental IE 8 and 9 compatibility for the `replace()` method of Turbolinks 3
// TODO: Port `scroll`?, `cacheRequest`? and `showProgressBar`? options for the `replace()` method
//       `onNodeRemoved()`? methods
// See: https://github.com/rails/turbolinks/issues/526
(function($) {
  if ((typeof Turbolinks === 'undefined' || Turbolinks === null) || !Turbolinks.supported) {
    var isPartialReplacement = function(options) {
      return options.change || options.append || options.prepend;
    };

    var replace = function(html, options) {
      if (typeof options === 'undefined' || options === null) {
        options = {};
      }

      var loadedNodes = changePage(extractTitleAndBody(html), options);

      var eventOptions = {
        type: (isPartialReplacement(options) ? 'page:partial-load' : 'page:load'),
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
        var nodesToAppend;
        var nodesToPrepend;
        var nodesToReplace;
        if (isPartialReplacement(options)) {
          if (options.append) {
            nodesToAppend = findNodesMatchingKeys(currentBody, options.append);
          }
          if (options.prepend) {
            nodesToPrepend = findNodesMatchingKeys(currentBody, options.prepend);
          }

          nodesToReplace = $('[data-turbolinks-temporary]', 'body').toArray();
          if (options.change) {
            nodesToReplace = nodesToReplace.concat(findNodesMatchingKeys(currentBody, options.change));
          }

          nodesToChange = [].concat(nodesToAppend || [], nodesToPrepend || [], nodesToReplace || []);
          nodesToChange = removeDuplicates(nodesToChange);
        } else {
          nodesToChange = currentBody.toArray();
        }

        $(document).trigger({type: 'page:before-unload', originalEvent: {data: nodesToChange}});

        executeScriptTags(getScriptsToRun(changedNodes, options.runScripts));

        if (options.title !== false) {
          if (options.title) {
            document.title = options.title;
          } else if (content.title) {
            document.title = content.title;
          }
        }

        if (isPartialReplacement(options)) {
          var appendedNodes;
          if (nodesToAppend) {
            // console.log(nodesToAppend);//debug
            appendedNodes = swapNodes(body, nodesToAppend, {
              keep: false,
              append: true
            });
          }
          var prependedNodes;
          if (nodesToPrepend) {
            prependedNodes = swapNodes(body, nodesToPrepend, {
              keep: false,
              prepend: true
            });
          }
          var replacedNodes;
          if (nodesToReplace) {
            replacedNodes = swapNodes(body, nodesToReplace, {
              keep: false
            });
          }

          changedNodes = [].concat(appendedNodes || [], prependedNodes || [], replacedNodes || []);
          changedNodes = removeDuplicates(changedNodes);
        } else {
          if (!options.flush) {
            var nodesToKeep = $('[data-turbolinks-permanent]', 'body').toArray();
            if (options.keep) {
              $.merge(nodesToKeep, findNodesMatchingKeys(currentBody, options.keep));
            }
            swapNodes(body, removeDuplicates(nodesToKeep), {keep: true});
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
            if (options.append || options.prepend) {
              var firstChild = $(existingNode).children(':first')[0];

              // a copy has to be made since the list is mutated while processing
              var childNodes = targetNode.contents().slice();
              childNodes.each(function(i, childNode) {
                // when the parent node is empty, there is no difference between appending and prepending
                if (!firstChild || options.append) {
                  $(existingNode).append(childNode);
                } else if (options.prepend) {
                  $(childNode).insertBefore(firstChild);
                }
              });
              changedNodes.push(existingNode);
            } else {
              targetNode = targetNode.get(0);
              $(existingNode).replaceWith(targetNode);
              $(document).trigger({type: 'page:after-remove', originalEvent: {data: existingNode}});
              changedNodes.push(targetNode);
            }
          }
        }
      });

      return changedNodes;
    };

    var getScriptsToRun = function(changedNodes, runScripts) {
      var selector = runScripts === false ? 'script[data-turbolinks-eval="always"]' : 'script:not([data-turbolinks-eval="false"])';
      var scripts = $('body').find(selector);
      var results = [];
      scripts.each(function(i, script) {
        if (isEvalAlways(script) || (nestedWithinNodeList(changedNodes, script) && !withinPermanent(script))) {
          results.push(script);
        }
      });
      return results;
    };

    var isEvalAlways = function (script) {
      return $(script).attr('data-turbolinks-eval') === 'always';
    };

    var withinPermanent = function(element) {
      while (element !== null && element.length) {
        if ($(element).attr('data-turbolinks-permanent')) {
          return true;
        }
        element = $(element).parent();
      }
      return false;
    };

    var nestedWithinNodeList = function(nodeList, element) {
      while (element !== null && element.length) {
        if ($.inArray(element, nodeList) > -1) {
          return true;
        }
        element = $(element).parent();
      }
      return false;
    };

    var executeScriptTags = function(scripts) {
      $.each(scripts, function(i, script) {
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

    var removeDuplicates = function(array) {
      var result = [];
      $.each(array, function(i, obj) {
        if ($.inArray(obj, result) === -1) {
          result.push(obj);
        }
      });
      return result;
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
