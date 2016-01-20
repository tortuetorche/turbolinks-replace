assert = proclaim

suite 'Turbolinks.replace()', ->
  setup (done) ->
    @iframe = $("<iframe></iframe>")
    @iframe.attr('style', 'display: none;')
    @iframe.attr('src', '/base/test/javascript/iframe.html')
    $('body').append(@iframe)
    frame = @iframe.get(0)

    # Source: http://stackoverflow.com/a/11874986
    # For IE 8/9
    frameInterval = setInterval((=>
      doc = $(frame.contentDocument).contents()
      if $('body', doc).length
        clearInterval frameInterval
        @window = @iframe.get(0).contentWindow
        @document = @window.document
        @jQuery = @window.jQuery
        @Turbolinks = @window.Turbolinks
        @$ = (selector) => @document.querySelector(selector)
        done()
    ), 100)

    # For more modern Browsers
    @iframe.get(0).onload = =>
      clearInterval frameInterval
      @window = @iframe.get(0).contentWindow
      @document = @window.document
      @jQuery = @window.jQuery
      @Turbolinks = @window.Turbolinks
      @$ = (selector) => @document.querySelector(selector)
      done()

  teardown ->
    # console.log 'Turbolinks loaded? : ' + !!@Turbolinks.defaultReplace
    @iframe.remove()

  test "default", (done) ->
    doc = """
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>new title</title>
        <meta content="new-token" name="csrf-token">
        <script>var headScript = true</script>
      </head>
      <body new-attribute>
        <div id="new-div"></div>
        <div id="permanent" data-turbolinks-permanent>new content</div>
        <div id="temporary" data-turbolinks-temporary>new content</div>
        <script>window.j = window.j || 0; window.j++;</script>
        <script data-turbolinks-eval="false">var bodyScriptEvalFalse = true</script>
      </body>
      </html>
    """
    body = @jQuery('body').html()
    permanent = @jQuery('#permanent').html()
    @jQuery(@document).on 'click', '#permanent', ->
      done()
    beforeUnloadFired = partialLoadFired = false
    @jQuery(@document).on 'page:before-unload', =>
      assert.isUndefined @window.j
      assert.notOk @$('#new-div')
      assert.notOk @$('body').hasAttribute('new-attribute')
      assert.ok @$('#div')
      assert.equal @$('meta[name="csrf-token"]').getAttribute('content'), 'token'
      assert.equal @document.title, 'title'
      assert.equal @jQuery('body').html(), body
      beforeUnloadFired = true
    @jQuery(@document).on 'page:partial-load', (event) =>
      partialLoadFired = true
    @jQuery(@document).on 'page:load', (event) =>
      assert.ok beforeUnloadFired
      assert.notOk partialLoadFired
      assert.deepEqual event.originalEvent.data, [@document.body]
      assert.equal @window.j, 1
      assert.isUndefined @window.headScript
      assert.isUndefined @window.bodyScriptEvalFalse
      assert.ok @$('#new-div')
      assert.ok @$('body').hasAttribute('new-attribute')
      assert.notOk @$('#div')
      assert.equal @jQuery('#permanent').text(), 'permanent content'
      assert.equal @jQuery('#temporary').text(), 'new content'
      assert.equal @document.title, 'new title'
      assert.equal @$('meta[name="csrf-token"]').getAttribute('content'), 'new-token'
      assert.notEqual @jQuery('body').html(), body # body is replaced
      assert.equal @jQuery('#permanent').html(), permanent # permanent nodes are transferred
      @jQuery('#permanent').trigger('click') # event listeners on :keep nodes should not be lost
    @Turbolinks.replace(doc)

  test "with :flush", (done) ->
    doc = """
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title></title>
      </head>
      <body>
        <div id="permanent" data-turbolinks-permanent>new content</div>
      </body>
      </html>
    """
    body = @$('body')
    beforeUnloadFired = partialLoadFired = false
    @jQuery(@document).on 'page:before-unload', =>
      assert.equal @jQuery('#permanent').text(), 'permanent content'
      beforeUnloadFired = true
    @jQuery(@document).on 'page:partial-load', (event) =>
      partialLoadFired = true
    @jQuery(@document).on 'page:change', =>
      assert.ok beforeUnloadFired
      assert.notOk partialLoadFired
      assert.equal @jQuery('#permanent').text(), 'new content'
      done()
    @Turbolinks.replace(doc, flush: true)

  test "with :keep", (done) ->
    doc = """
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title></title>
      </head>
      <body>
        <div id="div">new content</div>
      </body>
      </html>
    """
    body = @$('body')
    div = @jQuery('#div').html()
    @jQuery(@document).on 'click', '#div', ->
      done()
    beforeUnloadFired = partialLoadFired = false
    @jQuery(@document).on 'page:before-unload', =>
      assert.equal @jQuery('#div').text(), 'div content'
      beforeUnloadFired = true
    @jQuery(@document).on 'page:partial-load', (event) =>
      partialLoadFired = true
    @jQuery(@document).on 'page:change', =>
      assert.ok beforeUnloadFired
      assert.notOk partialLoadFired
      assert.equal @jQuery('#div').text(), 'div content'
      assert.equal @jQuery('#div').html(), div # :keep nodes are transferred
      @jQuery('#div').trigger('click') # event listeners on :keep nodes should not be lost
    @Turbolinks.replace(doc, keep: ['div'])

  test "with :change", (done) ->
    doc = """
      <!DOCTYPE html>
      <HTML>
      <head>
        <meta charset="utf-8">
        <title>new title</title>
        <meta content="new-token" name="csrf-token">
        <script>var headScript = true</script>
      </head>
      <BODY new-attribute>
        <div id="new-div"></div>
        <div id="div">new content</div>
        <div id="change">new content</div>
        <div id="change:key">new content</div>
        <div id="permanent" data-turbolinks-permanent>new content</div>
        <div id="temporary" data-turbolinks-temporary>new content</div>
        <script>var bodyScript = true</script>
      </body>
      </html>
    """
    body = @$('body')
    change = @$('#change')
    temporary = @jQuery('#temporary').html()
    beforeUnloadFired = loadFired = false
    @jQuery(@document).on 'page:before-unload', =>
      assert.equal @window.i, 1
      assert.equal @jQuery('#change').text(), 'change content'
      assert.equal @jQuery('[id="change:key"]').text(), 'change content'
      assert.equal @jQuery('#temporary').text(), 'temporary content'
      assert.equal @document.title, 'title'
      beforeUnloadFired = true
    afterRemoveNodes = [@$('#temporary'), change, @$('[id="change:key"]')]
    @jQuery(@document).on 'page:after-remove', (event) =>
      assert.isUndefined @jQuery(event.originalEvent.data).parent().get(0)
      assert.equal event.originalEvent.data, afterRemoveNodes.shift()
    @jQuery(@document).on 'page:load', (event) =>
      loadFired = true
    @jQuery(@document).on 'page:partial-load', (event) =>
      assert.ok beforeUnloadFired
      assert.equal afterRemoveNodes.length, 0
      assert.deepEqual event.originalEvent.data, [@$('#temporary'), @$('#change'), @$('[id="change:key"]')]
      assert.equal @window.i, 1 # only scripts within the changed nodes are re-run
      assert.isUndefined @window.bodyScript
      assert.isUndefined @window.headScript
      assert.notOk @$('#new-div')
      assert.notOk @$('body').hasAttribute('new-attribute')
      assert.equal @jQuery('#change').text(), 'new content'
      assert.equal @jQuery('[id="change:key"]').text(), 'new content'
      assert.equal @jQuery('#temporary').text(), 'new content'
      assert.equal @jQuery('#div').text(), 'div content'
      assert.equal @jQuery('#permanent').text(), 'permanent content'
      assert.equal @$('meta[name="csrf-token"]').getAttribute('content'), 'token'
      assert.equal @document.title, 'new title'
      assert.notEqual @jQuery('#temporary').html, temporary # temporary nodes are cloned
      assert.notEqual @$('#change'), change # changed nodes are cloned
      assert.equal @$('body'), body

      setTimeout =>
        assert.notOk loadFired
        done()
      , 0
    @Turbolinks.replace(doc, change: ['change'])

  test "with :change and html fragment", (done) ->
    html = """
      <div id="new-div"></div>
      <div id="change">new content<script>var insideScript = true</script></div>
      <div id="change:key">new content</div>
      <script>var outsideScript = true</script>
    """
    body = @$('body')
    change = @$('#change')
    temporary = @$('#temporary')
    afterRemoveNodes = [change, @$('[id="change:key"]')]
    @jQuery(@document).on 'page:after-remove', (event) =>
      assert.isUndefined @jQuery(event.originalEvent.data).parent().get(0)
      assert.equal event.originalEvent.data, afterRemoveNodes.shift()
    @jQuery(@document).on 'page:change', =>
      assert.equal afterRemoveNodes.length, 0
      assert.equal @window.i, 1 # only scripts within the changed nodes are re-run
      assert.isUndefined @window.outsideScript
      assert.equal @window.insideScript, true
      assert.notOk @$('#new-div')
      assert.equal @jQuery('#div').text(), 'div content'
      assert.equal @jQuery('#change').contents().get(0).nodeValue, 'new content'
      assert.equal @jQuery('[id="change:key"]').text(), 'new content'
      assert.equal @jQuery('#permanent').text(), 'permanent content'
      assert.equal @$('meta[name="csrf-token"]').getAttribute('content'), 'token'
      assert.equal @document.title, 'title'
      assert.equal @$('#temporary'), temporary # temporary nodes are left untouched when not found
      assert.equal @jQuery('#temporary').text(), 'temporary content'
      assert.notEqual @$('#change'), change # changed nodes are cloned
      assert.equal @$('body'), body
      done()
    @Turbolinks.replace(html, change: ['change'])

  test "with :change and html fragment with temporary node", (done) ->
    html = """
      <div id="div">new div content</div>
      <div id="temporary" data-turbolinks-temporary>new temporary content</div>
    """
    temporary = @$('#temporary')
    afterRemoveNodes = [temporary, @$('#div')]
    @jQuery(@document).on 'page:after-remove', (event) =>
      assert.isUndefined @jQuery(event.originalEvent.data).parent().get(0)
      assert.equal event.originalEvent.data, afterRemoveNodes.shift()
    @jQuery(@document).on 'page:change', =>
      assert.equal afterRemoveNodes.length, 0
      assert.equal @jQuery('#div').text(), 'new div content'
      assert.equal @jQuery('#temporary').text(), 'new temporary content'
      assert.notEqual @$('#temporary'), temporary # temporary nodes are cloned when found
      done()
    @Turbolinks.replace(html, change: ['div'])

  test "with :title set to a value replaces the title with the value", (done) ->
    doc = """
      <!DOCTYPE html>
      <html>
      <head>
        <title>new title</title>
      </head>
      <body new-attribute>
        <div id="new-div"></div>
      </body>
      </html>
    """
    body = @$('body')
    @jQuery(@document).on 'page:load', (event) =>
      assert.equal @document.title, 'specified title'
      done()
    @Turbolinks.replace(doc, title: 'specified title')

  test "with :title set to false doesn't replace the title", (done) ->
    doc = """
      <!DOCTYPE html>
      <html>
      <head>
        <title>new title</title>
      </head>
      <body new-attribute>
        <div id="new-div"></div>
      </body>
      </html>
    """
    body = @$('body')
    @jQuery(@document).on 'page:load', (event) =>
      assert.equal @document.title, 'title'
      done()
    @Turbolinks.replace(doc, title: false)

  # https://connect.microsoft.com/IE/feedback/details/811408/
  test "IE textarea placeholder bug", (done) ->
    doc = """
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>title</title>
      </head>
      <body>
        <div id="form">
          <textarea placeholder="placeholder" id="textarea1"></textarea>
          <textarea placeholder="placeholder" id="textarea2">placeholder</textarea>
          <textarea id="textarea3">value</textarea>
        </div>
        <div id="permanent" data-turbolinks-permanent><textarea placeholder="placeholder" id="textarea-permanent"></textarea></div>
      </body>
      </html>
    """
    change = 0
    @jQuery(@document).on 'page:change', =>
      change += 1
      if change is 1
        assert.equal @$('#textarea1').value, ''
        assert.equal @$('#textarea2').value, 'placeholder'
        assert.equal @$('#textarea3').value, 'value'
        assert.equal @$('#textarea-permanent').value, ''
        # FIXME: Buggy with PhantomJS and IE and slow with Firefox and Chrome.
        #        Maybe a conflict between jQuery event and native DOM event?
        # @Turbolinks.visit('iframe2.html')

        # So the page is changed with JavaScript
        @window.location = '/base/test/javascript/iframe2.html'
        # And the event is triggered manually
        @jQuery(@document).trigger('page:change')
      else if change is 2
        # FIXME: See the FIXME above
        assert.equal @$('#textarea-permanent').value, ''
        setTimeout =>
          @window.history.back()
        , 0
        # So the event is triggered manually
        @jQuery(@document).trigger('page:change')
      else if change is 3
        assert.equal @$('#textarea1').value, ''
        assert.equal @$('#textarea2').value, 'placeholder'
        assert.equal @$('#textarea3').value, 'value'
        assert.equal @$('#textarea-permanent').value, ''
        @$('#textarea-permanent').value = 'test'
        @Turbolinks.replace(doc, change: ['form'])
      else if change is 4
        assert.equal @$('#textarea1').value, ''
        assert.equal @$('#textarea2').value, 'placeholder'
        assert.equal @$('#textarea3').value, 'value'
        assert.equal @$('#textarea-permanent').value, 'test'
        assert.equal @$('#form').ownerDocument, @document
        done()
    @Turbolinks.replace(doc, flush: true)

  test "works with :change key of node that also has data-turbolinks-temporary", (done) ->
    html = """
      <div id="temporary" data-turbolinks-temporary>new temporary content</div>
    """
    afterRemoveNodes = [@$('#temporary')]
    @jQuery(@document).on 'page:after-remove', (event) =>
      assert.equal event.originalEvent.data, afterRemoveNodes.shift()
    @jQuery(@document).on 'page:change', =>
      assert.equal afterRemoveNodes.length, 0
      assert.equal @jQuery('#temporary').text(), 'new temporary content'
      done()
    @Turbolinks.replace(html, change: ['temporary'])

  test "works with :keep key of node that also has data-turbolinks-permanent", (done) ->
    html = """
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>title</title>
      </head>
      <body>
        <div id="permanent" data-turbolinks-permanent></div>
      </body>
      </html>
    """
    permanent = @jQuery('#permanent').html()
    @jQuery(@document).on 'page:change', =>
      assert.equal @jQuery('#permanent').html(), permanent
      done()
    @Turbolinks.replace(html, keep: ['permanent'])

  test "doesn't run scripts inside :change nodes more than once", (done) ->
    doc = """
      <!DOCTYPE html>
      <html>
      <head>
        <title>title</title>
      </head>
      <body>
        <div id="change">
          <script>window.count = (window.count || 0) + 1;</script>
          <script data-turbolinks-eval="false">window.count = (window.count || 0) + 1;</script>
        </div>
      </body>
      </html>
    """
    @jQuery(@document).on 'page:partial-load', (event) =>
      assert.equal @window.count, 1 # using importNode before swapping the nodes would double-eval scripts in Chrome/Safari
      done()
    @Turbolinks.replace(doc, change: ['change'])

  test "appends elements on change when the append option is passed", (done) ->
    doc = """
      <!DOCTYPE html>
      <html>
      <head>
        <title>title</title>
      </head>
      <body>
        <div id="list"><div id="another-list-item">inserted list item</div></div>
      </body>
      </html>
    """
    @Turbolinks.replace(doc, append: ['list'])
    assert.equal @jQuery('#list').children().length, 2 # children is similar to childNodes except it does not include text nodes
    assert.equal @jQuery(@jQuery('#list').children()[0]).text(), 'original list item'
    assert.equal @jQuery(@jQuery('#list').children()[1]).text(), 'inserted list item'

    done()

  test "prepends elements on change when the prepend option is passed", (done) ->
    doc = """
      <!DOCTYPE html>
      <html>
      <head>
        <title>title</title>
      </head>
      <body>
        <div id="list"><div id="another-list-item">inserted list item</div></div>
      </body>
      </html>
    """
    @Turbolinks.replace(doc, prepend: ['list'])
    assert.equal @jQuery('#list').children().length, 2 # children is similar to childNodes except it does not include text nodes
    assert.equal @jQuery(@jQuery('#list').children()[0]).text(), 'inserted list item'
    assert.equal @jQuery(@jQuery('#list').children()[1]).text(), 'original list item'

    done()
